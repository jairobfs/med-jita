import { createHash } from 'node:crypto';

const source='https://med-jita.jairobfs7.chatgpt.site/';
const target='https://med-jita-v57-canario.jairobfs7.workers.dev/';
async function html(url) {
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000),
    headers:{Accept:'text/html','Cache-Control':'no-cache'}});
  if(!r.ok || !(r.headers.get('content-type')||'').includes('text/html'))
    throw Error('Documento indisponível: '+new URL(url).hostname+' HTTP '+r.status);
  return await r.text();
}
const [original,cloud]=await Promise.all([html(source),html(target)]);
const ids=s=>new Set([...s.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(x=>x[1]));
const scripts=s=>new Set([...s.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1].split('?')[0]));
const imgs=s=>new Set([...s.matchAll(/<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1].split('?')[0]));
const summary={
  source:{bytes:Buffer.byteLength(original),sha256:createHash('sha256').update(original).digest('hex').slice(0,16),
    ids:ids(original).size,scripts:scripts(original).size,images:imgs(original).size},
  cloud:{bytes:Buffer.byteLength(cloud),sha256:createHash('sha256').update(cloud).digest('hex').slice(0,16),
    ids:ids(cloud).size,scripts:scripts(cloud).size,images:imgs(cloud).size},
  absentFromCloudflare:{
    ids:[...ids(original)].filter(x=>!ids(cloud).has(x)).sort(),
    scripts:[...scripts(original)].filter(x=>!scripts(cloud).has(x)).sort(),
    images:[...imgs(original)].filter(x=>!imgs(cloud).has(x)).sort()
  },
  newInCloudflare:{
    ids:[...ids(cloud)].filter(x=>!ids(original).has(x)).sort(),
    scripts:[...scripts(cloud)].filter(x=>!scripts(original).has(x)).sort()
  }
};
console.log(JSON.stringify(summary,null,2));
