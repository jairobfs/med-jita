import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareFusion } from '../source/integrations/fusion-archive.mjs';

const backup=(score,history=[])=>({
  version:3,format:'med-jita-backup',data:{version:3,cab:{hits:score}},
  history,avatar:{kind:'default'}
});
const origin=backup('21',[
 {id:'a',name:'Nota anterior',savedAt:'2026-10-20T10:00:00Z',data:{cab:{hits:'18'}}}
]);
const legacy=backup('17',[
 {id:'a',name:'Nota Vercel',savedAt:'2026-10-18T10:00:00Z',data:{cab:{hits:'16'}}}
]);
const originRaw=JSON.stringify(origin),legacyRaw=JSON.stringify(legacy);
const plan=prepareFusion({profileId:'barba',sites:origin,vercel:legacy});
assert.equal(plan.profileId,'barba');
assert.equal(plan.sameLiveState,false);
assert.equal(plan.requiresActiveStateDecision,true);
assert.equal(plan.totalVersions,4,'Both live states and both histories must survive.');
assert.equal(plan.completeArchive.sites.data.cab.hits,'21');
assert.equal(plan.completeArchive.vercel.data.cab.hits,'17');
assert.equal(new Set(plan.snapshots.map(x=>x.id)).size,4);
assert.equal(JSON.stringify(origin),originRaw,'Dry run may not mutate Sites');
assert.equal(JSON.stringify(legacy),legacyRaw,'Dry run may not mutate Vercel');
const same=prepareFusion({profileId:'barba',sites:origin,vercel:origin});
assert.equal(same.sameLiveState,true);
assert.ok(same.totalVersions<=plan.totalVersions);
const tooMany=backup('3',Array.from({length:65},(_,i)=>({
  id:'version-'+i,name:'Teste '+i,data:{cab:{hits:i.toString()}}
})));
const large=prepareFusion({profileId:'barba',sites:origin,vercel:tooMany});
assert.equal(large.needsSeparateArchive,true);
assert.equal(large.completeArchive.vercel.history.length,65,'Archive must not silently truncate.');
assert.throws(()=>prepareFusion({profileId:'igu',sites:origin,vercel:{...legacy,profile:'barba'}}),
  /outro perfil/);
assert.throws(()=>prepareFusion({profileId:'jbfs',sites:origin,vercel:{format:'broken'}}),
  /incompatível/);

const html=await readFile(new URL('../source/index.html',import.meta.url),'utf8');
const built=await readFile(new URL('../worker/index.js',import.meta.url),'utf8');
for(const value of ['vercelExitPanel','vercelExitFile','vercelExitResult','vercelExitConfirm','vercelExitDownload',
 'integrations/vercel-exit.js','vercel-exit.css'])assert.ok(html.includes(value),'Missing V52 element '+value);
for(const value of ['"/integrations/vercel-exit.js"','"/integrations/fusion-archive.mjs"','"/vercel-exit.css"'])
  assert.ok(built.includes(value),'Build lacks V52 asset '+value);
assert.ok(built.includes('text/javascript; charset=utf-8'));
console.log('V52 Vercel exit restored: full non-destructive backup comparison, owner attribution, asset bundling and parity.');
