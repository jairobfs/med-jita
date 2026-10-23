import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCanaryServer } from './server.mjs';

const server=createCanaryServer();
server.listen(0,'127.0.0.1');
await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const backup={format:'med-jita-backup',version:3,data:{version:3,cab:{hits:'21'}},history:[]};
async function request(path,method='GET',body=null,cookie='',pin='') {
  const response=await fetch(base+path,{
    method,
    headers:{ ...(body?{'Content-Type':'application/json'}:{}),
      ...(cookie?{Cookie:cookie}:{}),
      ...(pin?{'X-Med-History-Password':pin}:{}) },
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const cookieOut=response.headers.get('set-cookie')?.split(';')[0]||'';
  const type=response.headers.get('content-type')||'';
  const payload=type.includes('application/json')?await response.json():await response.text();
  return {response,cookie:cookieOut,payload};
}
try {
  let r=await request('/api/health');
  assert.equal(r.response.status,200);
  assert.equal(r.payload.production,false);
  assert.equal(r.payload.craft,false);
  assert.equal(r.payload.mode,'demonstracao-isolada');

  r=await request('/');
  assert.equal(r.response.status,200);
  assert.match(r.payload,/PRÉVIA ISOLADA/);
  assert.match(r.payload,/MED JITA/i);
  assert.equal(r.response.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
  assert.equal((await request('/integrations/profiles-ui.js')).response.status,200);
  assert.equal((await request('/../render-preview/server.mjs')).response.status,404);

  r=await request('/api/profiles');
  assert.deepEqual(r.payload.profiles.map(p=>p.id),['jbfs','barba','tay','igu']);
  assert.equal(r.payload.profiles.every(p=>p.available),true);
  assert.equal(r.payload.profiles.find(p=>p.id==='jbfs').passwordRequired,true);
  const cookie=r.cookie;
  assert.ok(cookie.startsWith('jita_canary_sid='));

  r=await request('/api/profile/open','POST',{id:'jbfs'},cookie);
  assert.equal(r.response.status,200);
  assert.equal(r.payload.name,'JBFS');
  assert.equal(r.payload.passwordRequired,true);
  assert.equal((await request('/api/profile/backup?id=jbfs','GET',null,cookie)).response.status,423);
  assert.equal((await request('/api/profile/backup?id=jbfs','GET',null,cookie,'1234')).response.status,423);
  r=await request('/api/profile/backup?id=jbfs','GET',null,cookie,'0000');
  assert.equal(r.payload.revision,0);
  r=await request('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup},cookie,'0000');
  assert.equal(r.response.status,200);
  assert.equal(r.payload.revision,1);
  assert.equal(r.payload.craftMirrored,false);
  r=await request('/api/profile/backup?id=jbfs','GET',null,cookie,'0000');
  assert.equal(r.payload.backup.data.cab.hits,'21');
  assert.equal((await request('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup},cookie,'0000')).response.status,409);

  r=await request('/api/profile/backup?id=barba','GET',null,cookie);
  assert.equal(r.payload.backup,null,'A second profile must have no JBFS history.');
  r=await request('/api/profile/backup','PUT',{id:'barba',revision:0,backup:{...backup,data:{version:3,cab:{hits:'17'}}}},cookie);
  assert.equal(r.payload.revision,1);
  assert.equal((await request('/api/profile/backup?id=tay','GET',null,cookie)).payload.revision,0);
  assert.equal((await request('/api/profile/backup?id=igu','GET',null,cookie)).payload.revision,0);

  // A different browser/session has no access to this visitor's canary data.
  r=await request('/api/profile/backup?id=jbfs','GET',null,'','0000');
  assert.equal(r.payload.revision,0);
  assert.equal((await request('/api/editorial','GET',null,cookie)).response.status,503);
  assert.equal((await request('/api/profile/password','PUT',{id:'jbfs',current:'0000',next:'secret'},cookie)).response.status,403);
  assert.equal((await request('/api/snapshot','POST',{test:true},cookie)).response.status,403);
  assert.equal((await request('/robots.txt')).payload.includes('Disallow: /'),true);
  console.log('PASS: canary health, full source, 4 profiles, PIN, revision conflicts, session isolation, disabled Craft/production.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
