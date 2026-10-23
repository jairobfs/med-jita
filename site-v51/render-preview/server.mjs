/**
 * MED JITA · isolated Render canary.
 * This server serves the exact versioned site-v51/source experience. It never
 * imports the production Worker, opens D1, requests Craft, or needs secrets.
 * Records live in memory and are scoped to a browser's random session cookie.
 * Nothing is persisted remotely; do NOT use real grades, histories or PINs.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../source/', import.meta.url)));
const sessions = new Map();
const profileList = Object.freeze([
  { id: 'jbfs', name: 'JBFS', role: 'Administrador', passwordRequired: true },
  { id: 'barba', name: 'Barba', role: 'Participante', passwordRequired: false },
  { id: 'tay', name: 'Tay', role: 'Participante', passwordRequired: false },
  { id: 'igu', name: 'Igu', role: 'Participante', passwordRequired: false }
]);
const contentTypes = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.woff':'font/woff',
  '.woff2':'font/woff2',
  '.mp3':'audio/mpeg',
  '.wav':'audio/wav',
  '.usdz':'model/vnd.usdz+zip'
};
const canaryBanner = String.raw`
<style id="jita-canary-style">
#jita-canary-notice{position:fixed;z-index:2000;top:env(safe-area-inset-top,0);left:8px;right:8px;width:max-content;max-width:calc(100% - 16px);margin:8px auto 0;padding:9px 14px;border-radius:14px;background:#123e42;color:#fff;box-shadow:0 8px 30px #0005;border:1px solid #66cdc5;font:700 12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}
#jita-canary-notice strong{color:#9af5df}#jita-canary-notice small{font-size:11px;font-weight:500;color:#dbf4f0}
@media(max-width:430px){#jita-canary-notice{font-size:11px;padding:8px 10px}#jita-canary-notice small{font-size:10px}}
</style>
<div id="jita-canary-notice" role="status" aria-label="Ambiente de demonstração isolado"><strong>PRÉVIA ISOLADA</strong> · Não digite seu PIN ou notas reais.<br><small>JBFS: PIN fictício 0000 · Dados descartados quando o servidor reiniciar.</small></div>
`;

function respond(res,status,data,extra={}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', ...extra });
  res.end(JSON.stringify(data));
}
function getSession(req,res) {
  const cookie = String(req.headers.cookie||'');
  const match = /(?:^|;\s*)jita_canary_sid=([a-f0-9-]{36})(?:;|$)/.exec(cookie);
  let id = match && sessions.has(match[1]) ? match[1] : null;
  if (!id) {
    id = randomUUID();
    sessions.set(id,{ profiles:new Map(), seen:Date.now() });
    res.setHeader('Set-Cookie','jita_canary_sid='+id+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=21600');
  }
  return sessions.get(id);
}
function findProfile(id) {
  return profileList.find(p => p.id === id);
}
function authorized(req,p) {
  return !p.passwordRequired || req.headers['x-med-history-password'] === '0000';
}
async function bodyJson(req) {
  let raw = '', bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 3*1024*1024) {
      const err = new Error('Arquivo de teste acima do limite de 3 MB.');
      err.statusCode=413;
      throw err;
    }
    raw += chunk.toString('utf8');
  }
  try { return JSON.parse(raw||'{}'); }
  catch {
    const err=new Error('JSON inválido.');
    err.statusCode=400;
    throw err;
  }
}
async function api(req,res,url) {
  const session = getSession(req,res);
  const pathname = url.pathname, method = req.method;
  if (pathname === '/api/health' && method === 'GET') {
    return respond(res,200,{ok:true,service:'med-jita-render-canario',version:'V56',mode:'demonstracao-isolada',storage:'memoria-volatil',craft:false,production:false});
  }
  if (pathname === '/api/profiles' && method === 'GET') {
    return respond(res,200,{profiles:profileList.map(p=>({
      id:p.id,name:p.name,role:p.role,available:true,
      passwordRequired:p.passwordRequired,activationNeedsRepair:false
    }))});
  }
  if (pathname === '/api/profile/open' && method === 'POST') {
    const input = await bodyJson(req);
    const p = findProfile(input.id);
    if (!p) return respond(res,404,{error:'Perfil de teste não encontrado.'});
    return respond(res,200,{...p,savedByDefault:true,mode:'demonstracao'});
  }
  if (pathname === '/api/profile/backup' && method === 'GET') {
    const p = findProfile(url.searchParams.get('id'));
    if (!p) return respond(res,404,{error:'Perfil de teste não encontrado.'});
    if (!authorized(req,p)) return respond(res,423,{error:'PIN de teste incorreto. Para JBFS, use apenas 0000.'});
    const record = session.profiles.get(p.id);
    return respond(res,200,record ?
      {revision:record.revision,backup:record.backup,updatedAt:record.updatedAt,craftMirrored:false} :
      {revision:0,backup:null,updatedAt:null,craftMirrored:false});
  }
  if (pathname === '/api/profile/backup' && method === 'PUT') {
    const input = await bodyJson(req);
    const p = findProfile(input.id);
    if (!p) return respond(res,404,{error:'Perfil de teste não encontrado.'});
    if (!authorized(req,p)) return respond(res,423,{error:'PIN de teste incorreto. Para JBFS, use apenas 0000.'});
    const existing = session.profiles.get(p.id);
    const currentRevision = existing?.revision ?? 0;
    if (!Number.isSafeInteger(input.revision) || input.revision!==currentRevision)
      return respond(res,409,{error:'Outra versão de teste foi salva. Atualize antes de gravar.'});
    if (!input.backup || input.backup.format!=='med-jita-backup' ||
        !input.backup.data || !Array.isArray(input.backup.history) || input.backup.history.length>60)
      return respond(res,400,{error:'Backup inválido para esta prévia.'});
    const updatedAt = new Date().toISOString();
    // JSON round trip drops prototype pollution attempts and shared references.
    session.profiles.set(p.id,{revision:currentRevision+1,backup:JSON.parse(JSON.stringify(input.backup)),updatedAt});
    return respond(res,200,{revision:currentRevision+1,stored:true,craftMirrored:false,
      mode:'demonstracao-isolada',expires:'no-restart'});
  }
  if (pathname === '/api/editorial' && method === 'GET') {
    return respond(res,503,{error:'Integração com Craft desativada na prévia isolada.'});
  }
  return respond(res,403,{error:'Funcionalidade de produção desativada nesta prévia. Nenhum dado será enviado ao Craft.'});
}
async function asset(req,res,url) {
  let relative;
  try { relative = decodeURIComponent(url.pathname); }
  catch { return respond(res,400,{error:'Caminho inválido.'}); }
  if (relative === '/') relative='/index.html';
  if (relative.split('/').some(segment=>segment==='..'||segment.startsWith('.')))
    return respond(res,404,{error:'Arquivo não encontrado.'});
  const filename = resolve(root,'.'+relative);
  if (filename!==root && !filename.startsWith(root+sep)) return respond(res,404,{error:'Arquivo não encontrado.'});
  try {
    if (!(await stat(filename)).isFile()) return respond(res,404,{error:'Arquivo não encontrado.'});
    let data = await readFile(filename);
    if (relative==='/index.html') {
      const html = data.toString('utf8');
      data = Buffer.from(html.includes('</body>') ?
        html.replace('</body>',canaryBanner+'</body>') : html+canaryBanner);
    }
    res.writeHead(200,{
      'Content-Type':contentTypes[extname(filename).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-store',
      'Content-Length':String(data.length)
    });
    res.end(req.method==='HEAD' ? undefined : data);
  } catch (error) {
    if (error.code==='ENOENT') return respond(res,404,{error:'Arquivo não encontrado.'});
    return respond(res,500,{error:'Falha ao carregar componente da prévia.'});
  }
}
export function createCanaryServer() {
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    try {
      const host=req.headers.host||'localhost';
      const url = new URL(req.url,'http://'+host);
      if (url.pathname==='/robots.txt') {
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
        return res.end('User-agent: *\nDisallow: /\n');
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method!=='GET' && req.headers.origin) {
          const expected=new URL('https://'+host).origin;
          const actual=new URL(req.headers.origin).origin;
          if (actual!==expected && actual!==('http://'+host))
            return respond(res,403,{error:'Origem externa bloqueada.'});
        }
        return await api(req,res,url);
      }
      if (!['GET','HEAD'].includes(req.method)) return respond(res,405,{error:'Método indisponível.'});
      return await asset(req,res,url);
    } catch(error) {
      return respond(res,error.statusCode||400,{error:error.message||'Requisição de teste inválida.'});
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||10000);
  createCanaryServer().listen(port,'0.0.0.0',()=>{
    process.stdout.write('MED JITA canary listening on port '+port+'; no production data services connected\n');
  });
}
