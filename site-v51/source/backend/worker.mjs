/* MED JITA · passwordless bridge (Cloudflare Worker + D1).
   Stores only encrypted bytes; recovery key and Craft secret never reach JS in GitHub. */
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
const enc=new TextEncoder();
function cors(origin,env){const allowed=(env.SITE_ORIGIN||'').replace(/\/$/,'');return origin&&origin===allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Max-Age':'3600',Vary:'Origin'}:{Vary:'Origin'};}
async function identity(request){const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization')||'');if(!match)return null;const hash=await crypto.subtle.digest('SHA-256',enc.encode(match[1]));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
const validEnvelope=x=>x&&x.alg==='AES-256-GCM'&&typeof x.iv==='string'&&/^[A-Za-z0-9_-]{16}$/.test(x.iv)&&typeof x.ciphertext==='string'&&x.ciphertext.length>40&&x.ciphertext.length<1500000&&/^[A-Za-z0-9_-]+$/.test(x.ciphertext);
async function craftReadProbe(env){
  if(!env.CRAFT_API_BASE)return {connected:false,reason:'not_configured'};
  try {const base=new URL(env.CRAFT_API_BASE);if(base.protocol!=='https:'||base.search||base.hash)return {connected:false,reason:'invalid_configuration'};
    const response=await fetch(base.toString().replace(/\/$/,'')+'/connection',{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    return response.ok?{connected:true}:{connected:false,reason:'permission_or_network',status:response.status};
  }catch(_){return {connected:false,reason:'unreachable'};}
}
async function route(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/health'&&request.method==='GET')return json({ok:true,service:'med-jita-sync',version:1,store:!!env.DB});
  if(!['/api/snapshot','/api/craft/test'].includes(path))return json({error:'Rota não encontrada.'},404);
  const id=await identity(request);if(!id)return json({error:'Código de recuperação inválido.'},401);
  if(path==='/api/craft/test'&&request.method==='GET')return json(await craftReadProbe(env));
  if(!env.DB)return json({error:'Banco D1 não configurado no servidor.'},503);
  if(path==='/api/snapshot'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT revision,payload,updated_at FROM snapshots WHERE id=?').bind(id).first();
    return row?json({revision:row.revision,payload:JSON.parse(row.payload),updatedAt:row.updated_at}):json({error:'Nenhum backup remoto encontrado para este código.'},404);
  }
  if(path==='/api/snapshot'&&request.method==='PUT'){
    const raw=await request.text();if(raw.length>1500000)return json({error:'Backup excede o limite seguro do serviço.'},413);
    let body;try{body=JSON.parse(raw);}catch(_){return json({error:'JSON inválido.'},400);}
    if(!Number.isSafeInteger(body.revision)||body.revision<0||!validEnvelope(body.payload))return json({error:'Envelope cifrado ou revisão inválidos.'},422);
    const existing=await env.DB.prepare('SELECT revision FROM snapshots WHERE id=?').bind(id).first();
    if(!existing){
      if(body.revision!==0)return json({error:'Revisão remota diferente. Recupere primeiro o backup.'},409);
      const result=await env.DB.prepare('INSERT OR IGNORE INTO snapshots (id,revision,payload,updated_at) VALUES (?,1,?,?)').bind(id,JSON.stringify(body.payload),new Date().toISOString()).run();
      return result.meta?.changes===1?json({revision:1,stored:true}):json({error:'Conflito de escrita; atualize a versão remota.'},409);
    }
    if(existing.revision!==body.revision)return json({error:'Conflito de versões; baixe o backup remoto antes de sobrescrever.'},409);
    const result=await env.DB.prepare('UPDATE snapshots SET revision=revision+1,payload=?,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(body.payload),new Date().toISOString(),id,body.revision).run();
    return result.meta?.changes===1?json({revision:body.revision+1,stored:true}):json({error:'Outro dispositivo atualizou antes deste envio.'},409);
  }
  return json({error:'Método não permitido.'},405);
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin'),headers=cors(origin,env);
  if(origin&&origin!==(env.SITE_ORIGIN||'').replace(/\/$/,''))return json({error:'Origem não autorizada.'},403,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  try {const response=await route(request,env);for(const [k,v] of Object.entries(headers))response.headers.set(k,v);return response;}
  catch(_){return json({error:'Falha interna da ponte; verifique os logs privados do Worker.'},500,headers);}
}};
