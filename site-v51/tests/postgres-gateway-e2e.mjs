import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';

const database = process.env.MED_JITA_TEST_DATABASE_URL;
if (!database || !/^postgres(?:ql)?:\/\/[^/]+\/jita_ci$/.test(database))
 throw Error('A validação HTTP só pode acessar jita_ci isolado.');
const master = randomBytes(32).toString('hex');
const token = randomBytes(32).toString('base64url');
const envelope = {alg:'AES-256-GCM',iv:randomBytes(12).toString('base64url'),
 ciphertext:randomBytes(70).toString('base64url')};
const serverFile = resolve('render-production/server.mjs');
async function freePort() {
 const tmp=createServer();
 tmp.listen(0,'127.0.0.1');
 await once(tmp,'listening');
 const port=tmp.address().port;
 await new Promise((resolve,reject)=>tmp.close(err=>err?reject(err):resolve()));
 return port;
}
async function start(writes) {
 const port=await freePort(), base='http://localhost:'+port;
 const app=spawn(process.execPath,[serverFile],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
  env:{...process.env, PORT:String(port),DATABASE_URL:database,
   MED_JITA_MASTER_KEY:master,MED_JITA_WRITE_ENABLED:String(writes),
   CRAFT_API_BASE:'',CRAFT_SPACE_ID:''}
 });
 let log='';
 app.stdout.on('data', data=>{log+=data.toString().slice(0,1000)});
 app.stderr.on('data', data=>{log+=data.toString().slice(0,1000)});
 for(let i=0;i<70;i++){
  if(app.exitCode!==null) throw Error('Gateway encerrou antes de abrir: '+log);
  try{
   const ping=await fetch(base+'/api/health',{signal:AbortSignal.timeout(900)});
   if(ping.ok) return {app,base};
  }catch {}
  await new Promise(ok=>setTimeout(ok,110));
 }
 app.kill('SIGTERM');
 throw Error('Gateway não respondeu ao health check: '+log);
}
async function stop(app) {
 if(app.exitCode!==null)return;
 const completed=once(app,'exit');
 app.kill('SIGTERM');
 await completed;
}
async function request(base,path,method='GET',payload=null,auth=false) {
 const response=await fetch(base+path,{method,
   headers:{ ...(auth?{Authorization:'Bearer '+token}:{}),
   ...(payload?{'Content-Type':'application/json'}:{}) },
   ...(payload?{body:JSON.stringify(payload)}:{})
 });
 const raw=await response.text(), ct=response.headers.get('content-type')||'';
 return {status:response.status, value:ct.includes('json')?JSON.parse(raw):raw};
}
let service;
try {
 service=await start(false);
 let r=await request(service.base,'/api/health');
 assert.equal(r.status,200);
 assert.equal(r.value.store,true);
 assert.equal(r.value.profiles,true);
 r=await request(service.base,'/');
 assert.equal(r.status,200);
 assert.match(r.value,/MED JITA/i);
 r=await request(service.base,'/api/snapshot','PUT',{revision:0,payload:envelope},true);
 assert.equal(r.status,503,'Default server must refuse writes.');
 assert.equal((await request(service.base,'/api/profile/backup?id=jbfs')).status,503,
  'Read-only mode must never permit hidden profile reset or Craft mirror writes.');
 await stop(service.app);
 service=await start(true);
 r=await request(service.base,'/api/snapshot','GET',null,false);
 assert.equal(r.status,401);
 r=await request(service.base,'/api/snapshot','PUT',{revision:0,payload:envelope},true);
 assert.equal(r.status,200,JSON.stringify(r.value));
 assert.equal(r.value.revision,1);
 assert.equal((await request(service.base,'/api/snapshot','PUT',
  {revision:0,payload:envelope},true)).status,409);
 r=await request(service.base,'/api/snapshot','GET',null,true);
 assert.equal(r.status,200);
 assert.deepEqual(r.value.payload,envelope);
 assert.equal(r.value.revision,1);
 await stop(service.app);
 service=await start(false);
 r=await request(service.base,'/api/snapshot','GET',null,true);
 assert.equal(r.status,200);
 assert.equal(r.value.revision,1,'Saved data remains after gateway restart.');
 assert.equal((await request(service.base,'/api/snapshot','PUT',
  {revision:1,payload:envelope},true)).status,503);
 console.log('REAL GATEWAY E2E PASS: HTML, health, fail-closed writes, authenticated snapshot, conflict, restart persistence.');
} finally {
 if(service) await stop(service.app);
}
