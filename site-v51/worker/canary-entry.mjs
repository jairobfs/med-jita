import original from './index.js';
import { canaryApi } from './canary-api.mjs';

/**
 * Cloudflare MED JITA V58 test stage.
 * The FULL original V52 application is served unchanged.
 * Only a separate per-browser, encrypted D1 test API is enabled.
 * No production accounts, PINs, data, Craft calls or master keys are used.
 */
const NOTICE = `<style id="jita-canary-style">
#jita-canary-notice{position:fixed;bottom:calc(10px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);
z-index:2147483647;box-sizing:border-box;width:max-content;max-width:calc(100vw - 20px);
padding:8px 13px;border:1px solid rgba(105,229,217,.52);border-radius:999px;
background:rgba(8,31,48,.96);color:#e6fffc;
font:600 11px/1.35 system-ui,-apple-system,sans-serif;text-align:center;
box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none}
@media(prefers-reduced-motion:no-preference){#jita-canary-notice{animation:jita-canary-fade .5s ease-out both}
@keyframes jita-canary-fade{from{opacity:0}to{opacity:1}}}
</style><div id="jita-canary-notice" role="status">Prévia de teste · JBFS PIN 0000 · Não use notas reais</div>`;

export default {
  async fetch(request, bindings, context) {
    const url=new URL(request.url);
    const path=url.pathname;
    if(path.startsWith('/api/'))
      return canaryApi(request,bindings.DB);
    // Original source is used only for static assets, never for personal API.
    const safeEnv={ DB:null, CRAFT_API_BASE:'', CRAFT_SPACE_ID:'', MED_JITA_MASTER_KEY:'' };
    const response=await original.fetch(request,safeEnv,context);
    const headers=new Headers(response.headers);
    headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if(request.method==='GET' && (path==='/' || path==='/index.html') && response.ok) {
      const html=await response.text();
      if(!/<\/body>/i.test(html))
        return Response.json({error:'Arquivo principal indisponível.'},{status:503});
      headers.set('Cache-Control','no-store');
      return new Response(html.replace(/<\/body>/i,NOTICE+'</body>'),{status:response.status,headers});
    }
    return new Response(request.method==='HEAD'?null:response.body,
      {status:response.status,headers});
  }
};
