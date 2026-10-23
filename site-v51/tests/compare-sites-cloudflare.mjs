import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

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
const candidate=await readFile(new URL('../source/index.html',import.meta.url),'utf8');
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
const originalIds=ids(original),originalScripts=scripts(original),originalImages=imgs(original);
const compare=(document)=>({
  ids:[...originalIds].filter(x=>!ids(document).has(x)).sort(),
  scripts:[...originalScripts].filter(x=>!scripts(document).has(x)).sort(),
  images:[...originalImages].filter(x=>!imgs(document).has(x)).sort(),
});
const missingCandidate=compare(candidate);
const missingDeployed=compare(cloud);
summary.sourceParity={
  checked:'full current GitHub candidate against published V52',
  missingCandidate,
  missingDeployed
};
console.log(JSON.stringify(summary,null,2));
const total=Object.values(missingCandidate).reduce((n,arr)=>n+arr.length,0)+
  Object.values(missingDeployed).reduce((n,arr)=>n+arr.length,0);
if(total!==0){
  console.error('MED JITA RELEASE BLOCKED: V52 elements/assets were lost from the GitHub candidate or Cloudflare deployed site. Restore them; do not ship a gateway substitute.');
  process.exitCode=1;
}else{
  console.log('MED JITA PARITY PASS: every published V52 DOM ID, JS entry and image URL is retained in the repository AND the Cloudflare Worker.');
}
