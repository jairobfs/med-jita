/* MED JITA live runtime. The asset table is inserted by scripts/build-assets.mjs.
 * No Craft connection URL or recovery key is ever bundled into this file. */
const ASSETS = __MED_JITA_ASSET_TABLE__;
const COLLECT_ID = '403c20d9-59e4-e0eb-37ef-5ad6120377f6';
const USERS_COLLECT_ID = 'c4a350de-9e9d-4e29-6f0c-ec31cc6b4ba7';
const MED_SPACE_ID = '6606bf28-79b6-7415-c5c5-6d0a79f7f279';
const enc = new TextEncoder();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function identity(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '');
  if (!match) return null;
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(match[1]));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}

function validEnvelope(data) {
  return data && data.alg === 'AES-256-GCM' &&
    typeof data.iv === 'string' && /^[A-Za-z0-9_-]{16}$/.test(data.iv) &&
    typeof data.ciphertext === 'string' &&
    data.ciphertext.length > 40 && data.ciphertext.length < 1500000 &&
    /^[A-Za-z0-9_-]+$/.test(data.ciphertext);
}

async function database(env) {
  if (!env.DB) throw Object.assign(new Error('Banco de dados ainda não configurado.'), { status: 503 });
  // A new Sites D1 starts empty. This idempotent bootstrap owns this table;
  // follow-up schema changes should use versioned migrations.
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)'
  ).run();
  return env.DB;
}

async function snapshot(request, env) {
  const id = await identity(request);
  if (!id) return json({ error: 'Código de recuperação inválido.' }, 401);
  const db = await database(env);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT revision,payload,updated_at FROM snapshots WHERE id=?').bind(id).first();
    return row
      ? json({ revision: row.revision, payload: JSON.parse(row.payload), updatedAt: row.updated_at })
      : json({ error: 'Nenhum backup remoto encontrado para este código.' }, 404);
  }
  if (request.method !== 'PUT') return json({ error: 'Método não permitido.' }, 405);
  const raw = await request.text();
  if (raw.length > 1500000) return json({ error: 'Backup excede o limite do serviço.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !validEnvelope(body.payload))
    return json({ error: 'Revisão ou backup cifrado inválido.' }, 422);
  const existing = await db.prepare('SELECT revision FROM snapshots WHERE id=?').bind(id).first();
  const payload = JSON.stringify(body.payload);
  const now = new Date().toISOString();
  if (!existing) {
    if (body.revision !== 0) return json({ error: 'Revisão remota diferente. Recupere primeiro.' }, 409);
    const result = await db.prepare('INSERT OR IGNORE INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?)')
      .bind(id, payload, now).run();
    return result.meta?.changes === 1
      ? json({ revision: 1, stored: true })
      : json({ error: 'Conflito de escrita. Atualize a versão remota.' }, 409);
  }
  if (existing.revision !== body.revision)
    return json({ error: 'Outro dispositivo atualizou o backup. Recupere a versão remota antes de substituir.' }, 409);
  const result = await db.prepare('UPDATE snapshots SET revision=revision+1,payload=?,updated_at=? WHERE id=? AND revision=?')
    .bind(payload, now, id, body.revision).run();
  return result.meta?.changes === 1
    ? json({ revision: body.revision + 1, stored: true })
    : json({ error: 'Conflito simultâneo de escrita.' }, 409);
}

function craftBase(env) {
  // A stale Craft link from another space must never be queried. This
  // independent, exact-space gate stays closed until MED is configured.
  if (env.CRAFT_SPACE_ID !== MED_SPACE_ID) return null;
  try {
    const u = new URL(env.CRAFT_API_BASE || '');
    if (u.protocol !== 'https:' || u.hostname !== 'connect.craft.do' ||
        !/^\/links\/[A-Za-z0-9_-]+\/api\/v1\/?$/.test(u.pathname) ||
        u.search || u.hash || u.username || u.password) return null;
    return u.toString().replace(/\/$/, '');
  } catch { return null; }
}

function unbox(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    for (const k of ['value', 'text', 'name', 'label', 'title']) {
      if (typeof value[k] === 'string') return value[k];
    }
  }
  return '';
}

function itemList(data) {
  for (const candidate of [data?.items, data?.result?.items, data?.data?.items, data?.collection?.items]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return Array.isArray(data) ? data : null;
}

function publicEditorial(data) {
  const list = itemList(data);
  if (!list) throw new Error('Formato de itens Craft não reconhecido.');
  const published = {};
  for (const item of list.slice(0, 100)) {
    const props = item?.properties || item?.fields || {};
    const key = unbox(item?.chave || item?.title || item?.name || props.chave);
    const state = unbox(props.estado || props.Estado || item?.estado);
    const content = unbox(props.contedo || props['Conteúdo'] || item?.contedo);
    if (/^[a-z][a-z0-9_.-]{1,80}$/.test(key) && state === 'Revisado' &&
        content.length > 0 && content.length <= 1000) published[key] = content;
  }
  return published;
}

async function craftGet(env, resource) {
  const base = craftBase(env);
  if (!base) throw Object.assign(new Error('Integração Craft não configurada.'), { status: 503 });
  const response = await fetch(base + resource, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Object.assign(new Error('Falha de leitura do Craft.'), { status: response.status });
  return response.json();
}

async function craftWrite(env, resource, method, body) {
  const base = craftBase(env);
  if (!base) throw Error('Craft indisponível para escrita.');
  const response = await fetch(base + resource, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Object.assign(new Error('O Craft não confirmou a atualização.'), {
    status: response.status,
  });
  return response.json();
}

async function requireMedConnection(env) {
  // An env label alone is insufficient: Craft itself must attest that this
  // secret URL belongs to the expected MED space before fetching any item.
  const connection = await craftGet(env, '/connection');
  if (connection?.space?.id !== MED_SPACE_ID)
    throw Object.assign(new Error('Conexão Craft pertence a outro espaço.'), { status: 403 });
}

async function editorial(env) {
  try {
    await requireMedConnection(env);
    const source = await craftGet(env, '/collections/' + COLLECT_ID + '/items');
    const items = publicEditorial(source);
    return json({ ok: true, items, count: Object.keys(items).length, updatedBy: 'Craft' });
  } catch (e) {
    return json({ ok: false, error: 'Textos do Craft temporariamente indisponíveis.' }, e.status === 503 ? 503 : 502);
  }
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object') return asBool(value.value);
  return value === 'true';
}

async function profileCatalog(env) {
  await requireMedConnection(env);
  const data = await craftGet(env, '/collections/' + USERS_COLLECT_ID + '/items');
  const items = itemList(data);
  if (!items) throw Object.assign(new Error('Cadastro Craft indisponível.'), { status: 503 });
  const profiles = items.map(item => {
    const props = item.properties || item.fields || {};
    return {
      id: unbox(props.identificador).toLowerCase(),
      name: unbox(item.title || item.name || item.perfil),
      email: unbox(props.email).trim().toLowerCase(),
      enabled: asBool(props.ativo),
      status: unbox(props.acesso),
      reset: asBool(props.redefinirsenha),
      role: unbox(props.papel),
      // The Craft admin collection has a stable "codigo" key. Read the old
      // draft name only as a migration fallback; never expose either publicly.
      accessCode: unbox(props.codigo) || unbox(props.codigoacesso),
      historyPassword: unbox(props.senhahistorico),
      mirrorEnabled: asBool(props.sincronizacao),
      craftItemId: item.id,
    };
  }).filter(item => /^[a-z][a-z0-9_-]{1,32}$/.test(item.id) &&
    item.name.length > 0 && item.name.length <= 40 &&
    // A short value in the technical activation field must never silently
    // erase an established account from the profile chooser. Keep its card
    // visible but unavailable until the Craft record is repaired. The PIN is
    // a separate `senhahistorico` field and may legitimately be short.
    (item.accessCode.length > 0 || item.role === 'Administrador'));
  const seen = new Set();
  for (const item of profiles) {
    if (seen.has(item.id)) throw Object.assign(new Error('Identificadores duplicados.'), { status: 503 });
    seen.add(item.id);
  }
  return profiles;
}

async function authorizedProfile(request, env, requestedId) {
  const profiles = await profileCatalog(env);
  const matches = profiles.filter(p => p.id === requestedId && p.enabled &&
    p.status === 'Ativo' && p.accessCode.length >= 16);
  if (matches.length !== 1)
    throw Object.assign(new Error('Este perfil está indisponível.'), { status: 403 });
  // Picking a name is the entire entry step for this small personal app.
  // Users may opt into a separate history password, managed from Craft.
  // The Craft access-code field remains an owner-managed activation marker,
  // not a credential the four friends have to type on every device.
  return matches[0];
}

function bytesToUrl(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function urlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Valor cifrado inválido.');
  const s = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length / 4) * 4, '=')), ch => ch.charCodeAt(0));
}

function accountId(id) { return 'med-account-v1:' + id; }
function profileDataId(id) { return 'med-data-v1:' + id; }
function mirrorDataId(id) { return 'med-craft-mirror-v1:' + id; }
function blankAccount() { return { v: 1, salt: '', hash: '', resetSeen: false, failures: 0, blockedUntil: 0 }; }
async function fetchAccount(db, id) {
  const row = await db.prepare('SELECT revision,payload FROM snapshots WHERE id=?').bind(accountId(id)).first();
  if (!row) return blankAccount();
  try { return { ...blankAccount(), ...JSON.parse(row.payload) }; }
  catch { throw Object.assign(new Error('Cadastro de segurança inválido.'), { status: 503 }); }
}
async function saveAccount(db, id, account) {
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?) ON CONFLICT(id) DO UPDATE SET revision=revision+1,payload=excluded.payload,updated_at=excluded.updated_at'
  ).bind(accountId(id), JSON.stringify(account), now).run();
}
async function applyCraftReset(db, profile) {
  const account = await fetchAccount(db, profile.id);
  if (profile.reset && !account.resetSeen) {
    account.hash = ''; account.salt = ''; account.failures = 0; account.blockedUntil = 0;
    account.resetSeen = true;
    await saveAccount(db, profile.id, account);
  } else if (!profile.reset && account.resetSeen) {
    account.resetSeen = false;
    await saveAccount(db, profile.id, account);
  }
  return account;
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: urlToBytes(salt), iterations: 135000 }, key, 256
  );
  return bytesToUrl(new Uint8Array(bits));
}
async function authorizeHistory(db, profile, request) {
  const account = await applyCraftReset(db, profile);
  if (!profile.historyPassword || profile.reset) return account;
  if (Date.now() < Number(account.blockedUntil || 0))
    throw Object.assign(new Error('Histórico temporariamente bloqueado após tentativas incorretas.'), { status: 429 });
  const password = request.headers.get('X-Med-History-Password') || '';
  if (password !== profile.historyPassword) {
    account.failures = Number(account.failures || 0) + 1;
    if (account.failures >= 5) { account.blockedUntil = Date.now() + 15 * 60 * 1000; account.failures = 0; }
    await saveAccount(db, profile.id, account);
    throw Object.assign(new Error('Senha do histórico incorreta ou ausente.'), { status: 423 });
  }
  if (account.failures) { account.failures = 0; await saveAccount(db, profile.id, account); }
  return account;
}

async function masterKey(env) {
  const hex = env.MED_JITA_MASTER_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw Object.assign(new Error('Cofre de dados não configurado.'), { status: 503 });
  const raw = Uint8Array.from(hex.match(/../g), pair => parseInt(pair, 16));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function sealProfile(env, id, backup) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(profileDataId(id)) },
    await masterKey(env), enc.encode(JSON.stringify(backup))
  );
  return { alg: 'AES-256-GCM', iv: bytesToUrl(iv), ciphertext: bytesToUrl(new Uint8Array(encrypted)) };
}
async function openProfile(env, id, payload) {
  if (!validEnvelope(payload)) throw Error('Dados remotos danificados ou incompatíveis.');
  const bytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: urlToBytes(payload.iv), additionalData: enc.encode(profileDataId(id)) },
    await masterKey(env), urlToBytes(payload.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}

// A personal, readable Craft mirror sits inside each user's existing Collection
// item. The Site's revisioned database remains authoritative during conflicts;
// an unavailable Craft connection must never discard a successful online save.
const CRAFT_STATUS_MARKER = '**MED JITA · Estado sincronizado**';
const CRAFT_MIRROR_MARKER = 'medJitaMirror';
function craftBlockRoot(value) {
  // GET /blocks returns the requested block itself in Craft's REST API.
  // Some MCP adapters and older clients instead wrap it in data/items.
  // Preserve support for both shapes without requiring a new connection.
  if (value && typeof value.id === 'string') return value;
  for (const candidate of [value?.data, value?.item, value?.block, value?.result, value?.items, value]) {
    if (candidate && typeof candidate.id === 'string') return candidate;
    if (Array.isArray(candidate) && candidate[0] && typeof candidate[0].id === 'string') return candidate[0];
  }
  return null;
}

function craftMirrorText(profile, backup, revision, now) {
  const count = backup.history.length;
  const filled = backup.data && typeof backup.data === 'object'
    ? Object.keys(backup.data).filter(key => key !== 'version').length : 0;
  const brTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(now));
  return `${CRAFT_STATUS_MARKER}\nPerfil: **${profile.name}** · Revisão: **${revision}**\n` +
    `Atualizado: **${brTime}** · Históricos nomeados: **${count}** · Grupos preenchidos: **${filled}**\n` +
    'O bloco JSON abaixo contém o estado integral da calculadora e os históricos. É atualizado automaticamente.';
}

async function mirrorProfileToCraft(env, profile, backup, revision, now) {
  if (!profile.mirrorEnabled) return false;
  let stage = 'prepare';
  try {
    const rawCode = JSON.stringify({ medJitaMirror: 1, id: profile.id, revision, updatedAt: now, backup });
    if (rawCode.length > 900000) return false;
    const resource = '/blocks?id=' + encodeURIComponent(profile.craftItemId) + '&maxDepth=1';
    stage = 'read-item';
    const existing = craftBlockRoot(await craftGet(env, resource));
    if (!existing || existing.id !== profile.craftItemId) {
      console.warn('MED-JITA craft mirror rejected item response', { stage, profile: profile.id });
      return false;
    }
    const children = Array.isArray(existing.content) ? existing.content : [];
    const statusBlock = children.find(block => block.type === 'text' &&
      (block.markdown || '').startsWith(CRAFT_STATUS_MARKER));
    const codeBlock = children.find(block => block.type === 'code' &&
      (block.rawCode || '').startsWith('{"medJitaMirror":1,'));
    if (codeBlock) {
      try {
        const previous = JSON.parse(codeBlock.rawCode);
        if (previous.revision > revision) return false;
      } catch { return false; }
    }
    const statusMarkdown = craftMirrorText(profile, backup, revision, now);
    const changes = [];
    const additions = [];
    if (statusBlock) changes.push({ id: statusBlock.id, markdown: statusMarkdown });
    else additions.push({ type: 'text', markdown: statusMarkdown });
    if (codeBlock) changes.push({ id: codeBlock.id, rawCode, language: 'json' });
    else additions.push({ type: 'code', language: 'json', rawCode });
    stage = 'insert-blocks';
    if (additions.length) await craftWrite(env, '/blocks', 'POST', {
      blocks: additions, position: { position: 'end', pageId: profile.craftItemId },
    });
    stage = 'update-blocks';
    if (changes.length) await craftWrite(env, '/blocks', 'PUT', { blocks: changes });
    // Date is a useful sortable field in the owner's collection. Leave every
    // owner-edited field (code, password, notes, access rights) untouched.
    stage = 'update-collection-date';
    await craftWrite(env, '/collections/' + USERS_COLLECT_ID + '/items', 'PUT', {
      itemsToUpdate: [{ id: profile.craftItemId, properties: {
        ultimasincronizacao: now.slice(0, 10),
      } }],
    });
    stage = 'verify-item';
    const verified = craftBlockRoot(await craftGet(env, resource));
    const published = Array.isArray(verified?.content) ? verified.content : [];
    const full = published.find(block => block.type === 'code' &&
      (block.rawCode || '').startsWith('{"medJitaMirror":1,'));
    const summary = published.find(block => block.type === 'text' &&
      (block.markdown || '').startsWith(CRAFT_STATUS_MARKER));
    const confirmed = !!full && !!summary && JSON.parse(full.rawCode).revision === revision;
    if (!confirmed) console.warn('MED-JITA craft mirror missing verified blocks', { stage, profile: profile.id });
    return confirmed;
  } catch (error) {
    // Preserve data minimization: never log the Craft URL, response body,
    // credentials, password, or the user's calculation/history payload.
    console.warn('MED-JITA craft mirror unsuccessful', {
      stage, profile: profile.id,
      status: Number.isInteger(error?.status) ? error.status : null,
      kind: error?.name === 'TimeoutError' ? 'timeout' : 'request',
    });
    return false;
  }
}

async function mirrorRevision(db, id) {
  const row = await db.prepare('SELECT revision FROM snapshots WHERE id=?').bind(mirrorDataId(id)).first();
  return row ? row.revision : 0;
}

async function rememberMirror(db, id, revision) {
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO snapshots (id,revision,payload,updated_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(id) DO UPDATE SET revision=max(revision,excluded.revision),payload=excluded.payload,updated_at=excluded.updated_at'
  ).bind(mirrorDataId(id), revision, '{}', now).run();
}

async function mirrorAndRemember(db, env, profile, backup, revision, now) {
  const mirrored = await mirrorProfileToCraft(env, profile, backup, revision, now);
  if (mirrored) {
    try { await rememberMirror(db, profile.id, revision); } catch { /* Retry next visit. */ }
  }
  return mirrored;
}

async function profilesApi(request, env) {
  const catalog = await profileCatalog(env);
  return json({ profiles: catalog.map(p => ({ id: p.id, name: p.name,
    available: p.enabled && p.status === 'Ativo' && p.accessCode.length >= 16,
    activationNeedsRepair: p.accessCode.length < 16,
    passwordRequired: !!p.historyPassword && !p.reset })) });
}
async function profileApi(request, env, path, url, context) {
  let body = {};
  if (request.method !== 'GET') {
    const raw = await request.text();
    if (raw.length > 1000000) return json({ error: 'Dados excedem o limite permitido.' }, 413);
    try { body = JSON.parse(raw); } catch { return json({ error: 'Dados inválidos.' }, 400); }
  }
  const id = (request.method === 'GET' ? url.searchParams.get('id') : body.id) || '';
  if (!/^[a-z][a-z0-9_-]{1,32}$/.test(id)) return json({ error: 'Perfil inválido.' }, 400);
  const profile = await authorizedProfile(request, env, id);
  const db = await database(env);
  if (path === '/api/profile/open' && request.method === 'POST') {
    const account = await applyCraftReset(db, profile);
    return json({ id, name: profile.name, role: profile.role, passwordRequired: !!profile.historyPassword && !profile.reset, savedByDefault: true });
  }
  if (path === '/api/profile/password' && request.method === 'PUT') {
    const current = (body.current || '').toString();
    const next = (body.next || '').toString();
    const account = await applyCraftReset(db, profile);
    if (Date.now() < Number(account.blockedUntil || 0))
      return json({ error: 'Proteção temporariamente bloqueada após tentativas incorretas.' }, 429);
    const expected = profile.historyPassword && !profile.reset
      ? profile.historyPassword : profile.accessCode;
    if (!current || current !== expected) {
      account.failures = Number(account.failures || 0) + 1;
      if (account.failures >= 5) {
        account.blockedUntil = Date.now() + 15 * 60 * 1000;
        account.failures = 0;
      }
      await saveAccount(db, profile.id, account);
      return json({ error: 'Senha atual ou código de ativação incorreto.' }, 403);
    }
    if (account.failures) {
      account.failures = 0;
      await saveAccount(db, profile.id, account);
    }
    if (next && (next.length < 4 || next.length > 128))
      return json({ error: 'Use uma senha de 4 a 128 caracteres.' }, 422);
    const base = craftBase(env);
    const update = await fetch(base + '/collections/' + USERS_COLLECT_ID + '/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ itemsToUpdate: [{
        id: profile.craftItemId,
        properties: { senhahistorico: next, protecao: next ? 'Com senha' : 'Sem senha', redefinirsenha: false },
      }] }),
      signal: AbortSignal.timeout(12000),
    });
    if (!update.ok) return json({ error: 'O Craft não autorizou alterar a senha. Edite SenhaHistorico no painel administrativo.' }, 502);
    const fresh = (await profileCatalog(env)).find(p => p.id === id);
    if (!fresh || fresh.historyPassword !== next)
      return json({ error: 'O Craft não confirmou a atualização. Confira o painel antes de usar.' }, 502);
    return json({ updated: true, passwordRequired: !!next });
  }
  if (path !== '/api/profile/backup') return json({ error: 'Rota não encontrada.' }, 404);
  await authorizeHistory(db, profile, request);
  const row = await db.prepare('SELECT revision,payload,updated_at FROM snapshots WHERE id=?').bind(profileDataId(id)).first();
  if (request.method === 'GET') {
    if (!row) return json({ revision: 0, backup: null, updatedAt: null });
    const backup = await openProfile(env, id, JSON.parse(row.payload));
    // Backfill a mirror that was unavailable on the last save. This also
    // covers pre-existing D1 records from before the Craft mirror existed.
    const craftMirrored = profile.mirrorEnabled ? await mirrorRevision(db, id) >= row.revision : null;
    if (profile.mirrorEnabled && !craftMirrored) {
      const repair = mirrorAndRemember(db, env, profile, backup, row.revision, row.updated_at);
      if (typeof context?.waitUntil === 'function') context.waitUntil(repair);
      else await repair;
    }
    return json({ revision: row.revision, backup, updatedAt: row.updated_at, craftMirrored });
  }
  if (request.method !== 'PUT') return json({ error: 'Método não permitido.' }, 405);
  const backup = body.backup;
  if (!backup || backup.version !== 3 || backup.format !== 'med-jita-backup' ||
      !backup.data || typeof backup.data !== 'object' || !Array.isArray(backup.history) ||
      backup.history.length > 60 || !Number.isSafeInteger(body.revision) || body.revision < 0)
    return json({ error: 'Formato de notas ou revisão inválido.' }, 422);
  const sealed = JSON.stringify(await sealProfile(env, id, backup));
  const now = new Date().toISOString();
  if (!row) {
    if (body.revision !== 0) return json({ error: 'A versão mudou em outro aparelho.' }, 409);
    const result = await db.prepare('INSERT OR IGNORE INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?)')
      .bind(profileDataId(id), sealed, now).run();
    if (result.meta?.changes !== 1) return json({ error: 'Conflito: outra versão foi enviada.' }, 409);
    const craftMirrored = await mirrorAndRemember(db, env, profile, backup, 1, now);
    return json({ revision: 1, stored: true, craftMirrored });
  }
  if (row.revision !== body.revision) return json({ error: 'Outra sessão alterou as notas. Os dados locais foram preservados.' }, 409);
  const result = await db.prepare('UPDATE snapshots SET revision=revision+1,payload=?,updated_at=? WHERE id=? AND revision=?')
    .bind(sealed, now, profileDataId(id), body.revision).run();
  if (result.meta?.changes !== 1) return json({ error: 'Conflito simultâneo: envio não efetuado.' }, 409);
  const nextRevision = row.revision + 1;
  const craftMirrored = await mirrorAndRemember(db, env, profile, backup, nextRevision, now);
  return json({ revision: nextRevision, stored: true, craftMirrored });
}

async function craftTest(request, env) {
  if (!await identity(request)) return json({ error: 'Código de recuperação inválido.' }, 401);
  try {
    await requireMedConnection(env);
    return json({ connected: true, editorialCollection: COLLECT_ID });
  } catch (e) {
    return json({ connected: false, reason: e.status === 503 ? 'not_configured' : e.status === 403 ? 'wrong_space' : 'unavailable' });
  }
}

function fileResponse(path, request) {
  const asset = ASSETS[path === '/' ? '/index.html' : path];
  if (!asset) return new Response('Não encontrado.', { status: 404 });
  const binary = atob(asset.base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new Response(request.method === 'HEAD' ? null : bytes, {
    headers: {
      'Content-Type': asset.mime,
      // HTML, scripts and service-worker code must never become a mixed build.
      'Cache-Control': asset.mime.startsWith('text/html') || asset.mime.includes('javascript')
        ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/api/')) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'Origem não autorizada.' }, 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
      try {
        if (path === '/api/health' && request.method === 'GET')
          return json({ ok: true, service: 'med-jita-sync', version: 3, store: !!env.DB, editorial: !!craftBase(env), profiles: !!env.MED_JITA_MASTER_KEY });
        if (path === '/api/profiles' && request.method === 'GET') return await profilesApi(request, env);
        if (path.startsWith('/api/profile/')) return await profileApi(request, env, path, url, context);
        if (path === '/api/craft/test' && request.method === 'GET') return craftTest(request, env);
        if (path === '/api/editorial' && request.method === 'GET') return editorial(env);
        if (path === '/api/snapshot') return snapshot(request, env);
        return json({ error: 'Rota não encontrada.' }, 404);
      } catch (e) {
        if ([401,403,409,423,429,503].includes(e.status)) return json({ error: e.message }, e.status);
        return json({ error: 'Erro interno. Seus dados locais permanecem intactos.' }, 500);
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido.', { status: 405 });
    return fileResponse(path, request);
  },
};
