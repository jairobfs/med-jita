import original from './index.js';
import { canaryApi } from './canary-api.mjs';

/**
 * Cloudflare MED JITA V58 test stage.
 * The FULL original V52 application is served unchanged.
 * Only a separate per-browser, encrypted D1 test API is enabled.
 * No production accounts, PINs, data, Craft calls or master keys are used.
 */
const NOTICE = `<style id="jita-canary-style">
#jita-canary-notice{position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
margin:13px 37px 0;padding:8px 13px;min-height:34px;
border:1px solid color-mix(in srgb,var(--brand,#0AA5AD) 33%,transparent);border-radius:13px;
background:color-mix(in srgb,var(--brand,#0AA5AD) 8%,var(--card,#102D3C));
color:var(--secondary,#d3f2eb);font:650 11px/1.45 system-ui,-apple-system,sans-serif;
letter-spacing:.012em;text-align:center}
#jita-gateway-canary{font:650 10px/1.4 system-ui,-apple-system,sans-serif;
border-radius:11px;padding:8px 10px;margin:12px 0 6px;
background:rgba(10,165,173,.10);border:1px solid rgba(10,165,173,.24);
color:var(--ink,#f1faf9);text-align:center}
@media(max-width:760px){#jita-canary-notice{margin:10px 14px 0;padding:7px 9px;font-size:10px}}
</style><div id="jita-canary-notice" role="status">Prévia de teste · JBFS PIN 0000 · Não use notas reais</div>`;
const GATEWAY_NOTICE = `<div id="jita-gateway-canary" role="note">Ambiente de teste · JBFS: 0000 · Não use notas reais</div>`
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
      // Both notices are in normal layout: never cover the mobile tab bar or inputs.
      const positioned=html
        .replace(/(<header class="topbar">[\\s\\S]*?<\\/header>)/i,'$1'+NOTICE)
        .replace(/(<button id="gatewayInstallApp")/i,GATEWAY_NOTICE+'$1');
      if(!positioned.includes('id="jita-canary-notice"'))
        return Response.json({error:'Cabeçalho da prévia indisponível.'},{status:503});
      return new Response(positioned,{status:response.status,headers});
    }
    return new Response(request.method==='HEAD'?null:response.body,
      {status:response.status,headers});
  }
};
