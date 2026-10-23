/** MED JITA · auditoria de transferência D1, sem acesso à produção.
 * Compara exportações completas sem descriptografar os históricos.
 * Não gera instruções SQL nem altera registros.
 */
import { createHash } from 'node:crypto';

const PROFILE = /^med-data-v1:([a-z][a-z0-9_-]{0,31})$/;
const ACCOUNT = /^med-account-v1:([a-z][a-z0-9_-]{0,31})$/;
const MIRROR = /^med-craft-mirror-v1:([a-z][a-z0-9_-]{0,31})$/;
const LEGACY = /^[a-f0-9]{64}$/;

export function auditRows(rows, expectedProfiles = []) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100000)
    throw Error('Exportação ausente ou com quantidade inválida de registros.');
  const seen = new Set();
  const groups = { profiles: [], accounts: [], mirrors: [], legacy: [], other: [] };
  const canonical = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw Error('Registro inválido no índice ' + index);
    const { id, revision, payload, updated_at } = row;
    if (typeof id !== 'string' || !id || id.length > 255 || seen.has(id))
      throw Error('Identificador ausente, duplicado ou inválido no índice ' + index);
    seen.add(id);
    if (!Number.isSafeInteger(revision) || revision < 1)
      throw Error('Revisão inválida para ' + id);
    if (typeof updated_at !== 'string' || !Number.isFinite(Date.parse(updated_at)))
      throw Error('Data inválida para ' + id);
    if (typeof payload !== 'string' || payload.length < 2 || payload.length > 2000000 ||
        payload.includes('[truncated for model]'))
      throw Error('Payload incompleto para ' + id);
    let parsed;
    try { parsed = JSON.parse(payload); } catch { throw Error('JSON incompleto para ' + id); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw Error('Payload incompatível para ' + id);
    const group = PROFILE.test(id) ? 'profiles' :
      ACCOUNT.test(id) ? 'accounts' :
      MIRROR.test(id) ? 'mirrors' :
      LEGACY.test(id) ? 'legacy' : 'other';
    groups[group].push(id);
    if (group === 'profiles' || group === 'legacy') {
      if (parsed.alg !== 'AES-256-GCM' ||
          typeof parsed.iv !== 'string' || !/^[A-Za-z0-9_-]{16}$/.test(parsed.iv) ||
          typeof parsed.ciphertext !== 'string' ||
          parsed.ciphertext.length <= 40 || parsed.ciphertext.length >= 1500000 ||
          !/^[A-Za-z0-9_-]+$/.test(parsed.ciphertext))
        throw Error('Envelope cifrado incompleto para ' + id);
    }
    return { id, revision, payload, updated_at };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const profile of expectedProfiles) {
    if (typeof profile !== 'string' || !PROFILE.test('med-data-v1:' + profile))
      throw Error('Perfil esperado inválido.');
    if (!seen.has('med-data-v1:' + profile))
      throw Error('Histórico obrigatório ausente: ' + profile);
  }
  const sha256 = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return { format: 'med-jita-d1-audit-v1', rowCount: canonical.length, sha256,
    counts: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
    profiles: groups.profiles.map(id => id.slice('med-data-v1:'.length)).sort(),
    revisions: canonical.map(({ id, revision }) => ({ id, revision })) };
}

export function compareRows(sourceRows, targetRows, expectedProfiles = []) {
  const source = auditRows(sourceRows, expectedProfiles);
  const target = auditRows(targetRows, expectedProfiles);
  const sourceMap = new Map(sourceRows.map(row => [row.id, row]));
  const targetMap = new Map(targetRows.map(row => [row.id, row]));
  const missing = [], additional = [], changed = [];
  for (const [id, row] of sourceMap) {
    const other = targetMap.get(id);
    if (!other) missing.push(id);
    else if (other.revision !== row.revision || other.payload !== row.payload ||
             other.updated_at !== row.updated_at) changed.push(id);
  }
  for (const id of targetMap.keys()) if (!sourceMap.has(id)) additional.push(id);
  return { identical: source.sha256 === target.sha256,
    source: { rowCount: source.rowCount, sha256: source.sha256, counts: source.counts },
    target: { rowCount: target.rowCount, sha256: target.sha256, counts: target.counts },
    missing: missing.sort(), additional: additional.sort(), changed: changed.sort() };
}
