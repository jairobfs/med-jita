import original from './index.js';

/**
 * Cloudflare canary: identical MED JITA interface, without access to real
 * student records or to Craft. No personal data can be stored in this stage.
 * The production original is NOT changed by this wrapper.
 */
const PROFILES = Object.freeze([
  { id: 'jbfs', name: 'JBFS', available: false, passwordRequired: false },
  { id: 'barba', name: 'Barba', available: false, passwordRequired: false },
  { id: 'tay', name: 'Tay', available: false, passwordRequired: false },
  { id: 'igu', name: 'Igu', available: false, passwordRequired: false },
]);
function safeJson(body, status=200) {
  return Response.json(body,{status,headers:{
    'Cache-Control':'no-store',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
  }});
}
const notice=`<style>
#jita-canary-notice{position:fixed;bottom:calc(10px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);
z-index:2147483647;box-sizing:border-box;width:max-content;max-width:calc(100vw - 24px);
padding:8px 14px;border:1px solid rgba(123,231,225,.55);border-radius:999px;
background:rgba(8,31,48,.96);color:#e6fffc;
font:600 12px/1.35 system-ui,-apple-system,sans-serif;text-align:center;
box-shadow:0 8px 24px rgba(0,0,0,.2);pointer-events:none}
@media(prefers-reduced-motion:no-preference){#jita-canary-notice{animation:jita-canary-fade .5s ease-out both}
@keyframes jita-canary-fade{from{opacity:0}to{opacity:1}}}
</style><div id="jita-canary-notice" role="status">Prévia técnica · Notas e histórico desativados</div>`;

export default {
  async fetch(request, bindings, context) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/profiles' && request.method === 'GET')
      return safeJson({ profiles: PROFILES });
    if (path.startsWith('/api/') && path !== '/api/health')
      return safeJson({error:'Prévia isolada: operações pessoais e editorial desativados.'},503);
    const env = { ...bindings, MED_JITA_MASTER_KEY: '', CRAFT_API_BASE: '', CRAFT_SPACE_ID: '' };
    const response = await original.fetch(request,env,context);
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if (request.method === 'GET' && (path==='/' || path==='/index.html') && response.ok) {
      const html=await response.text();
      if (!/<\/body>/i.test(html)) return safeJson({error:'Documento inicial incompatível.'},503);
      headers.set('Cache-Control','no-store');
      return new Response(html.replace(/<\/body>/i,notice+'</body>'),{status:response.status,headers});
    }
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  },
};
