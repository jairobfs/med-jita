import assert from 'node:assert/strict';
import app from '../worker/canary-entry.mjs';

class D1CanaryMock {
  rows=new Map();
  queries=[];
  prepare(sql) {
    this.queries.push(sql);
    assert.match(sql,/med_jita_canary_only/, 'Canary must never access production snapshot tables');
    const db=this;
    function exec(params) {
      if(sql.startsWith('CREATE TABLE')) return {run:async()=>({meta:{changes:0}})};
      if(sql.startsWith('SELECT')) return {first:async()=>{
        const row=db.rows.get(params[0]+'|'+params[1]);
        return row ? {...row} : null;
      }};
      if(sql.startsWith('INSERT')) return {run:async()=>{
        const id=params[0]+'|'+params[1];
        if(db.rows.has(id))return {meta:{changes:0}};
        db.rows.set(id,{revision:1,payload:params[2],updated_at:params[3],expires_at:params[4]});
        return {meta:{changes:1}};
      }};
      if(sql.startsWith('UPDATE')) return {run:async()=>{
        const id=params[3]+'|'+params[4], row=db.rows.get(id);
        if(!row || row.revision!==params[5] || row.expires_at<=params[6])return {meta:{changes:0}};
        db.rows.set(id,{revision:row.revision+1,payload:params[0],updated_at:params[1],expires_at:params[2]});
        return {meta:{changes:1}};
      }};
      throw Error('Unexpected statement: '+sql);
    }
    return {run:async()=>exec([]).run(),bind:(...params)=>exec(params)};
  }
}
const db=new D1CanaryMock(), base='https://med-jita-v57-canario.example';
const backup=value=>({version:3,format:'med-jita-backup',data:{version:3,cab:{hits:value}},history:[]});
async function fetchApi(path,method='GET',data=null,cookie='',pin='',origin='') {
  const headers={...(cookie?{Cookie:cookie}:{}),...(pin?{'X-Med-History-Password':pin}:{}),
    ...(origin?{Origin:origin}:{}),...(data?{'Content-Type':'application/json'}:{})};
  const req=new Request(base+path,{method,headers,...(data?{body:JSON.stringify(data)}:{})});
  const res=await app.fetch(req,{DB:db},{});
  return {status:res.status,data:res.headers.get('content-type')?.includes('json')?
    await res.json():await res.text(),cookie:res.headers.get('set-cookie')||'',
    headers:res.headers};
}

let result=await fetchApi('/');
assert.equal(result.status,200);
assert.match(result.data,/Prévia · não use notas reais · PIN 0000/);
assert.equal(result.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
assert.equal((await fetchApi('/assets/jita-cartola-avatar.svg')).status,200);

result=await fetchApi('/api/health');
assert.equal(result.status,200);
assert.equal(result.data.profiles,true);
assert.equal(result.data.store,true);
assert.equal(result.data.production,false);
assert.equal(result.data.editorial,false);

result=await fetchApi('/api/profiles');
assert.equal(result.status,200);
assert.deepEqual(result.data.profiles.map(p=>p.id),['jbfs','barba','tay','igu']);
assert.equal(result.data.profiles.every(p=>p.available===true),true);
assert.equal(result.data.profiles[0].passwordRequired,true);
let cookie=result.cookie.split(';')[0];
assert.match(cookie,/^jita_canary_session=[a-f0-9-]{36}$/);
assert.match(result.cookie,/HttpOnly; Secure; SameSite=Lax/);

result=await fetchApi('/api/profile/open','POST',{id:'jbfs'},cookie);
assert.equal(result.status,200);
assert.equal(result.data.id,'jbfs');
assert.equal(result.data.savedByDefault,true);
assert.equal(result.data.passwordRequired,true);
assert.equal((await fetchApi('/api/profile/backup?id=jbfs','GET',null,cookie)).status,423);
assert.equal((await fetchApi('/api/profile/backup?id=jbfs','GET',null,cookie,'1234')).status,423);

result=await fetchApi('/api/profile/backup?id=jbfs','GET',null,cookie,'0000');
assert.equal(result.status,200);
assert.equal(result.data.revision,0);
assert.equal(result.data.backup,null);
const testBackup=backup('21');
result=await fetchApi('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup:testBackup},cookie,'0000');
assert.equal(result.status,200,JSON.stringify(result.data));
assert.equal(result.data.revision,1);
const record=[...db.rows.values()][0];
assert.equal(record.payload.includes('"hits":"21"'),false,'D1 test data must be encrypted.');
assert.match(record.payload,/"AES-256-GCM"/);

result=await fetchApi('/api/profile/backup?id=jbfs','GET',null,cookie,'0000');
assert.equal(result.data.revision,1);
assert.equal(result.data.backup.data.cab.hits,'21');
assert.equal((await fetchApi('/api/profile/backup','PUT',{id:'jbfs',revision:0,backup:backup('22')},cookie,'0000')).status,409);
result=await fetchApi('/api/profile/backup','PUT',{id:'jbfs',revision:1,backup:backup('22')},cookie,'0000');
assert.equal(result.data.revision,2);
assert.equal((await fetchApi('/api/profile/backup?id=jbfs','GET',null,cookie,'0000')).data.backup.data.cab.hits,'22');

result=await fetchApi('/api/profile/backup','PUT',{id:'barba',revision:0,backup:backup('17')},cookie);
assert.equal(result.status,200);
assert.equal((await fetchApi('/api/profile/backup?id=barba','GET',null,cookie)).data.backup.data.cab.hits,'17');
assert.equal((await fetchApi('/api/profile/backup?id=tay','GET',null,cookie)).data.backup,null);
assert.equal((await fetchApi('/api/profile/backup?id=igu','GET',null,cookie)).data.backup,null);

const other=(await fetchApi('/api/profiles')).cookie.split(';')[0];
assert.notEqual(other,cookie);
assert.equal((await fetchApi('/api/profile/backup?id=jbfs','GET',null,other,'0000')).data.revision,0);
assert.equal((await fetchApi('/api/profile/backup?id=barba','GET',null,other)).data.revision,0);

for(const forbidden of ['/api/editorial','/api/profile/password','/api/snapshot','/api/craft/test']) {
  result=await fetchApi(forbidden);
  assert.equal(result.status,503,forbidden);
}
assert.equal((await fetchApi('/api/profile/open','POST',{id:'igu'},cookie,'','https://evil.example')).status,403);
assert.equal((await fetchApi('/api/profile/backup','PUT',
  {id:'igu',revision:0,backup:{format:'med-jita-backup',version:3,data:{},history:'bad'}},cookie)).status,422);
assert.equal(db.queries.every(sql=>!/(?:^|[^a-z_])snapshots(?:$|[^a-z_])/i.test(sql)),true);
console.log('Cloudflare canary V58 E2E: full app, 4 profiles, fake PIN, isolated encrypted D1, saved revisions, conflict, separate browsers, no Craft/real records.');
