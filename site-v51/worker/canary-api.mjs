/**
 * MED JITA · isolated Cloudflare demonstration API.
 * No production master key, no Craft requests, no access to the 'snapshots' table.
 * Test data are AES-GCM encrypted and scoped to an unguessable per-browser cookie.
 */
export const CANARY_PROFILES = Object.freeze([
  { id:'jbfs', name:'JBFS', role:'Administrador', available:true, passwordRequired:true, activationNeedsRepair:false },
  { id:'barba', name:'Barba', role:'Participante', available:true, passwordRequired:false, activationNeedsRepair:false },
  { id:'tay', name:'Tay', role:'Participante', available:true, passwordRequired:false, activationNeedsRepair:false },
  { id:'igu', name:'Igu', role:'Participante', available:true, passwordRequired:false, activationNeedsRepair:false },
]);
const TTL_SECONDS = 7 * 86400;
const TABLE = 'med_jita_canary_only';
const validSession = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(body,status=200,extra={}) {
  return Response.json(body,{status,headers:{
    'Cache-Control':'no-store',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',...extra
  }});
}
function getProfile(id) { return CANARY_PROFILES.find(p=>p.id===id) || null; }
function sessionFromCookie(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = /(?:^|;\s*)jita_canary_session=([^;]+)/.exec(cookie);
  return match && validSession.test(match[1]) ? match[1] : null;
}
function resolveSession(request) {
  const existing = sessionFromCookie(request);
  const id = existing || crypto.randomUUID();
  const headers = existing ? {} : {
    'Set-Cookie':'jita_canary_session='+id+
      '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+TTL_SECONDS
  };
  return { id, headers };
}
function authorized(request, profile) {
  return !profile.passwordRequired ||
    request.headers.get('X-Med-History-Password') === '0000';
}
function assertOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}
async function boot(db) {
  if (!db || typeof db.prepare !== 'function')
    throw Error('Banco de demonstração não configurado.');
  await db.prepare('CREATE TABLE IF NOT EXISTS '+TABLE+
    ' (session_id TEXT NOT NULL, profile_id TEXT NOT NULL, revision INTEGER NOT NULL, '+
    'payload TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL, '+
    'PRIMARY KEY(session_id, profile_id))').run();
}
async function keyForSession(id) {
  const digest = await crypto.subtle.digest('SHA-256',encoder.encode('MED-JITA-CANARY-ONLY|'+id));
  return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
function url64(bytes) {
  const raw = Array.from(bytes, byte=>String.fromCharCode(byte)).join('');
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function bytes64(encoded) {
  if(typeof encoded!=='string' || !/^[A-Za-z0-9_-]+$/.test(encoded))
    throw Error('Envelope de teste inválido.');
  return Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(
    Math.ceil(encoded.length/4)*4,'=')),c=>c.charCodeAt(0));
}
async function encryptDemo(session,profile,backup) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(backup));
  const encrypted = await crypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:encoder.encode(profile)},
    await keyForSession(session),plaintext);
  return JSON.stringify({alg:'AES-256-GCM',iv:url64(iv),ciphertext:url64(new Uint8Array(encrypted))});
}
async function decryptDemo(session,profile,encoded) {
  const box=JSON.parse(encoded);
  if(box.alg!=='AES-256-GCM')throw Error('Formato do histórico de teste inválido.');
  const raw=await crypto.subtle.decrypt({
    name:'AES-GCM',iv:bytes64(box.iv),additionalData:encoder.encode(profile)},
    await keyForSession(session),bytes64(box.ciphertext));
  return JSON.parse(decoder.decode(raw));
}
function validateBackup(body) {
  const backup=body.backup;
  return Number.isSafeInteger(body.revision) && body.revision>=0 &&
    backup?.format==='med-jita-backup' && backup.version===3 &&
    backup.data && typeof backup.data==='object' &&
    Array.isArray(backup.history) && backup.history.length<=60;
}

export async function canaryApi(request,db) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (!assertOrigin(request))
    return json({error:'Origem externa não autorizada.'},403);
  if(path==='/api/health' && method==='GET')
    return json({ok:true,service:'med-jita-cloudflare-canary',version:'V58',
      mode:'demonstracao-isolada',production:false,store:!!db,
      editorial:false,profiles:true,craft:false,storage:'d1-canario-cifrado'});
  if(path==='/api/profiles' && method==='GET') {
    const session=resolveSession(request);
    return json({profiles:CANARY_PROFILES},200,session.headers);
  }
  if(path==='/api/editorial' || path==='/api/craft/test' ||
      path==='/api/snapshot' || path==='/api/profile/password')
    return json({error:'Produção e Craft indisponíveis na demonstração.'},503);
  if(path!=='/api/profile/open' && path!=='/api/profile/backup')
    return json({error:'Rota indisponível na demonstração.'},404);
  if(path==='/api/profile/open' && method!=='POST')
    return json({error:'Método indisponível.'},405);
  if(path==='/api/profile/backup' && method!=='GET' && method!=='PUT')
    return json({error:'Método indisponível.'},405);
  let body={};
  if(method==='PUT'||method==='POST') {
    if(Number(request.headers.get('content-length')||0)>1100000)
      return json({error:'Backup de teste acima do limite.'},413);
    const raw=await request.text();
    if(encoder.encode(raw).length>1100000)
      return json({error:'Backup de teste acima do limite.'},413);
    try {body=JSON.parse(raw||'{}');}
    catch{return json({error:'JSON inválido.'},400);}
  }
  const profile=getProfile(method==='GET' ? url.searchParams.get('id'):body.id);
  if(!profile)return json({error:'Perfil de demonstração desconhecido.'},404);
  const session=resolveSession(request);
  if(path==='/api/profile/open') return json({
    id:profile.id,name:profile.name,role:profile.role,
    passwordRequired:profile.passwordRequired,savedByDefault:true,
    mode:'demonstracao-isolada'
  },200,session.headers);
  if(!authorized(request,profile))
    return json({error:'PIN de teste incorreto. JBFS: 0000.'},423,session.headers);
  try {
    await boot(db);
    const now=Date.now();
    if(method==='GET') {
      const row=await db.prepare('SELECT revision,payload,updated_at,expires_at FROM '+TABLE+
        ' WHERE session_id=? AND profile_id=?')
        .bind(session.id,profile.id).first();
      if(!row || row.expires_at <= now)
        return json({revision:0,backup:null,updatedAt:null,craftMirrored:false},200,session.headers);
      const backup=await decryptDemo(session.id,profile.id,row.payload);
      return json({revision:row.revision,backup,updatedAt:row.updated_at,craftMirrored:false},
        200,session.headers);
    }
    if(!validateBackup(body))
      return json({error:'Formato de histórico de teste inválido.'},422,session.headers);
    const sealed=await encryptDemo(session.id,profile.id,body.backup);
    const updatedAt=new Date().toISOString(),expiresAt=now+TTL_SECONDS*1000;
    if(body.revision===0) {
      const result=await db.prepare('INSERT OR IGNORE INTO '+TABLE+
        ' (session_id,profile_id,revision,payload,updated_at,expires_at) VALUES (?,?,1,?,?,?)')
        .bind(session.id,profile.id,sealed,updatedAt,expiresAt).run();
      if(result.meta?.changes!==1)
        return json({error:'Outra versão de teste foi gravada. Atualize para conciliar.'},409,session.headers);
      return json({revision:1,stored:true,craftMirrored:false,mode:'demonstracao-isolada'},
        200,session.headers);
    }
    const result=await db.prepare('UPDATE '+TABLE+
      ' SET revision=revision+1,payload=?,updated_at=?,expires_at=? '+
      'WHERE session_id=? AND profile_id=? AND revision=? AND expires_at>?')
      .bind(sealed,updatedAt,expiresAt,session.id,profile.id,body.revision,now).run();
    if(result.meta?.changes!==1)
      return json({error:'Histórico de teste alterado ou expirado. Atualize antes de salvar.'},
        409,session.headers);
    return json({revision:body.revision+1,stored:true,craftMirrored:false,
      mode:'demonstracao-isolada'},200,session.headers);
  } catch(error) {
    console.warn('MED JITA isolated demo storage failure',error?.name||'Error');
    return json({error:'Histórico de teste indisponível; nenhuma nota real foi acessada.'},
      503,session.headers);
  }
}
