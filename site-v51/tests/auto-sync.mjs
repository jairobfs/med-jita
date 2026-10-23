import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, randomBytes } from 'node:crypto';
import vm from 'node:vm';

const script = readFileSync(new URL('../source/integrations/sync-ui.js',import.meta.url),'utf8');
const origin = 'https://med-jita.example.test';
const recovery = randomBytes(32).toString('base64url');
let remote = null;
let networkCalls = 0;
let uploadedPlaintext = false;

class Control {
  constructor() { this.value=''; this.checked=false; this.disabled=false; this.dataset={}; this.listeners={}; }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  trigger(name) { return this.listeners[name]?.(); }
}
async function fakeFetch(url,init={}) {
  networkCalls++;
  const path = new URL(url).pathname;
  if (path !== '/api/snapshot') throw Error('Unexpected network route: '+path);
  if (!init.headers?.Authorization?.startsWith('Bearer ')) throw Error('Missing derived authentication.');
  if (init.headers.Authorization.includes(recovery)) throw Error('Raw recovery code was transmitted.');
  if (init.method === 'PUT') {
    if (init.body.includes('grade')) uploadedPlaintext=true;
    const input = JSON.parse(init.body);
    if (input.revision !== (remote?.revision??0))
      return Response.json({error:'Revision conflict'},{status:409});
    remote={revision:(remote?.revision??0)+1,payload:input.payload};
    return Response.json({revision:remote.revision});
  }
  return remote ? Response.json(remote) : Response.json({error:'Not found'},{status:404});
}
function client(name,existingKey='') {
  const controls = new Map();
  const $ = id => controls.get(id)??controls.set(id,new Control()).get(id);
  const timerJobs = new Map();
  const intervalJobs = [];
  const handlers = {};
  let timerId=0;
  const backing=new Map();
  const local={data:{version:3,grade:name},history:[]};
  if (existingKey) backing.set('med_jita_sync_config_v1',JSON.stringify({server:origin,key:existingKey,revision:0}));
  const bridge={
    exportBackup:()=>({version:3,format:'med-jita-backup',exportedAt:new Date().toISOString(),data:structuredClone(local.data),history:structuredClone(local.history)}),
    importBackup:(payload)=>{local.data=structuredClone(payload.data);local.history=structuredClone(payload.history);},
  };
  const window={MED_JITA_BRIDGE:bridge,
    addEventListener:(type,callback)=>{handlers[type]=callback;},
    dispatchEvent:event=>handlers[event.type]?.(event)};
  const document={getElementById:$,visibilityState:'visible',addEventListener:(type,callback)=>{handlers[type]=callback;}};
  const localStorage={getItem:key=>backing.get(key)??null,setItem:(key,value)=>backing.set(key,value)};
  const sandbox={window,document,localStorage,location:{origin},crypto:webcrypto,TextEncoder,TextDecoder,URL,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    fetch:fakeFetch,navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>true,
    setTimeout:(fn,delay)=>{const id=++timerId;timerJobs.set(id,{fn,delay});return id;},
    clearTimeout:id=>timerJobs.delete(id),setInterval:fn=>intervalJobs.push(fn)};
  for(const id of ['syncPane','syncServer','syncRecovery','syncStatus','syncAutoBackup','syncCreateKey','syncCopyKey','syncTest','syncUpload','syncDownload']) $(id);
  vm.runInNewContext(script,sandbox,{filename:'sync-ui.js'});
  return {local,window,$,backing,intervalJobs,
    changeLocal:grade=>{local.data.grade=grade;window.dispatchEvent({type:'med-jita:changed'});},
    async runTimer(){const items=[...timerJobs];assert.ok(items.length,'Expected a scheduled background check.');const [id,job]=items.at(-1);timerJobs.delete(id);job.fn();await waitUntil(()=>!$("syncStatus").textContent.includes('Verificando'));},
  };
}
async function waitUntil(predicate,timeout=2500) {
  const limit=Date.now()+timeout;
  while(!predicate()) {
    if(Date.now()>limit) throw Error('Timed out waiting for async sync operation.');
    await new Promise(resolve=>setTimeout(resolve,10));
  }
}
async function toggleOn(device) {
  device.$('syncAutoBackup').checked=true;
  device.$('syncAutoBackup').trigger('change');
  await waitUntil(()=>device.$('syncAutoBackup').disabled===false);
}

const first=client('primeiro');
assert.equal(networkCalls,0,'No background transfers before consent.');
first.$('syncRecovery').value=recovery;
first.$('syncRecovery').trigger('change');
await toggleOn(first);
assert.equal(first.$('syncAutoBackup').checked,true);
assert.equal(remote.revision,1,'Opt-in creates first encrypted backup.');
assert.equal(uploadedPlaintext,false,'Grades must never be sent as plaintext.');
first.changeLocal('segunda nota');
await first.runTimer();
await waitUntil(()=>remote.revision===2);

const second=client('segundo',recovery);
const initialCalls=networkCalls;
assert.equal(second.$('syncAutoBackup').checked,false);
assert.equal(networkCalls,initialCalls,'Entering the code does not automatically fetch private data.');
await second.$('syncDownload').trigger('click');
assert.equal(second.local.data.grade,'segunda nota','A different device can recover a remote backup.');
await toggleOn(second);
assert.equal(second.$('syncAutoBackup').checked,true);

first.changeLocal('terceira nota');
await first.runTimer();
await waitUntil(()=>remote.revision===3);
for(const poll of second.intervalJobs) poll();
await waitUntil(()=>second.local.data.grade==='terceira nota');
assert.equal(second.$('syncAutoBackup').checked,true,'A clean device can accept remote updates.');

first.changeLocal('edição conflitante local');
second.changeLocal('edição remota');
await second.runTimer();
await waitUntil(()=>remote.revision===4);
await first.runTimer();
await waitUntil(()=>first.$('syncAutoBackup').checked===false);
assert.equal(first.local.data.grade,'edição conflitante local','A concurrent local edit must never be overwritten.');
assert.match(first.$('syncStatus').textContent,/pausada/i);

console.log('MED JITA: explicit opt-in, encrypted auto-backup, cross-device retrieval, remote polling and non-destructive conflicts OK.');
