import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base='https://med-jita-v57-canario.jairobfs7.workers.dev';
if(process.env.MED_JITA_CANARY_BASE && process.env.MED_JITA_CANARY_BASE!==base)
  throw Error('Live tests restricted to isolated Cloudflare canary.');
const cookieRe=/^jita_canary_session=[a-f0-9-]{36}$/i;
const backup=hits=>({format:'med-jita-backup',version:3,
  data:{version:3,cab:{hits}},history:[]});
async function call(path,method='GET',body=null,cookie='',pin='') {
  const res=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(18000),
    headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),
      ...(cookie?{Cookie:cookie}:{}),...(pin?{'X-Med-History-Password':pin}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const ct=res.headers.get('content-type')||'';
  return {status:res.status,data:ct.includes('json')?await res.json():await res.text(),
    cookie:res.headers.get('set-cookie')||'',headers:res.headers};
}
const home=await call('/');
assert.equal(home.status,200);
assert.match(home.data,/MED JITA/);
const noticePattern = process.env.MED_JITA_V59_LIVE==='1'
  ? /Prévia · não use notas reais · PIN 0000/
  : /(?:Prévia · não use notas reais · PIN 0000|Prévia de teste · JBFS PIN 0000)/;
assert.match(home.data,noticePattern);
const health=await call('/api/health');
assert.equal(health.status,200);
assert.equal(health.data.version,'V58');
assert.equal(health.data.profiles,true);
assert.equal(health.data.production,false);
assert.equal(health.data.craft,false);
assert.equal(health.data.store,true);

let r=await call('/api/profiles');
assert.equal(r.status,200);
assert.deepEqual(r.data.profiles.map(p=>p.id),['jbfs','barba','tay','igu']);
assert.equal(r.data.profiles.every(p=>p.available),true);
assert.equal(r.data.profiles[0].passwordRequired,true);
const cookie=r.cookie.split(';')[0];
assert.match(cookie,cookieRe);
assert.match(r.cookie,/HttpOnly; Secure; SameSite=Lax/);
assert.equal((await call('/api/profile/open','POST',{id:'jbfs'},cookie)).data.id,'jbfs');
assert.equal((await call('/api/profile/backup?id=jbfs','GET',null,cookie)).status,423);
assert.equal((await call('/api/profile/backup?id=jbfs','GET',null,cookie,'9999')).status,423);
assert.equal((await call('/api/profile/backup?id=jbfs','GET',null,cookie,'0000')).data.revision,0);
const caseID='CI-TEST-'+randomUUID();
r=await call('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup:backup(caseID)},cookie,'0000');
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(r.data.revision,1);
r=await call('/api/profile/backup?id=jbfs','GET',null,cookie,'0000');
assert.equal(r.status,200);
assert.equal(r.data.backup.data.cab.hits,caseID);
assert.equal((await call('/api/profile/backup','PUT',
  {id:'jbfs',revision:0,backup:backup('INVALID-CONFLICT')},cookie,'0000')).status,409);
r=await call('/api/profile/backup','PUT',{id:'jbfs',revision:1,backup:backup(caseID+'-2')},cookie,'0000');
assert.equal(r.status,200);
assert.equal(r.data.revision,2);
assert.equal((await call('/api/profile/backup?id=jbfs','GET',null,cookie,'0000')).data.backup.data.cab.hits,caseID+'-2');

r=await call('/api/profile/backup','PUT',{id:'barba',revision:0,backup:backup('BARBA-'+caseID)},cookie);
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await call('/api/profile/backup?id=barba','GET',null,cookie)).data.backup.data.cab.hits,'BARBA-'+caseID);
assert.equal((await call('/api/profile/backup?id=tay','GET',null,cookie)).data.backup,null);
assert.equal((await call('/api/profile/backup?id=igu','GET',null,cookie)).data.backup,null);

const another=(await call('/api/profiles')).cookie.split(';')[0];
assert.match(another,cookieRe);
assert.notEqual(another,cookie);
assert.equal((await call('/api/profile/backup?id=jbfs','GET',null,another,'0000')).data.revision,0);
assert.equal((await call('/api/profile/backup?id=barba','GET',null,another)).data.revision,0);
for(const protectedApi of ['/api/editorial','/api/craft/test','/api/snapshot','/api/profile/password']) {
  assert.equal((await call(protectedApi)).status,503);
}
assert.equal((await call('/assets/jita-cartola-avatar.svg')).status,200);
console.log('LIVE MED JITA V58 PASS: complete home, 4 profiles, fake PIN, encrypted canary D1 save and restore, revision conflict, cross-profile and session isolation; original unavailable.');
