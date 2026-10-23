import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// A second edit must not be lost when its debounce expires while the first
// cloud upload is still in flight. No real profile or Craft record is touched.
const script = readFileSync(new URL('../source/integrations/profiles-ui.js',import.meta.url),'utf8');
const nodes = new Map(), listeners = {}, timers = new Map(), memory = new Map();
let nextTimer = 0, score = 1, remoteRevision = 0, releaseFirstUpload;
const writes = [];
const flush = async () => { for (let i=0; i<8; i++) await new Promise(setImmediate); };
function node(id='') {
  return {id,hidden:false,value:'',textContent:'',dataset:{},children:[],listeners:{},
    classList:{add(){},remove(){}},addEventListener(name,fn){this.listeners[name]=fn;},
    setAttribute(name,value){this[name]=value;},scrollIntoView(){},
    append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},
    replaceChildren(){this.children=[];},focus(){}};
}
const $ = id => {if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
const current = () => ({version:3,format:'med-jita-backup',data:{score},history:[]});
const bridge = {cachedProfile:()=>null,readLocalAvatar:()=>({kind:'default'}),getAvatar:()=>({kind:'default'}),setAvatar(){},bindProfile(){},exportBackup:current,importBackup(){}};
const context = {
  window:{MED_JITA_BRIDGE:bridge,addEventListener:(name,fn)=>{listeners[name]=fn;},setInterval(){}},
  document:{getElementById:$,createElement:()=>node(),documentElement:{dataset:{}},
    body:{classList:{add(){},remove(){}}},visibilityState:'visible',hidden:false,addEventListener(){}},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  fetch:async(path,options={})=>{
    if(path==='/api/profiles')return Response.json({profiles:[{id:'jbfs',name:'JBFS',available:true}]});
    if(path==='/api/profile/open')return Response.json({id:'jbfs',name:'JBFS',passwordRequired:false});
    if(path==='/api/profile/backup?id=jbfs')return Response.json({revision:remoteRevision,backup:null});
    if(path==='/api/profile/backup' && options.method==='PUT') {
      const payload=JSON.parse(options.body);
      writes.push(payload);
      if(writes.length===1)await new Promise(resolve=>{releaseFirstUpload=resolve;});
      remoteRevision++;
      return Response.json({revision:remoteRevision,craftMirrored:true});
    }
    throw Error('Unexpected request '+path);
  },
  setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);},
  Response,Date,JSON,Error,Number,encodeURIComponent,
};
const advanceTimer = async () => {
  assert.ok(timers.size>0,'Expected a scheduled autosave');
  const [id,callback] = timers.entries().next().value;
  timers.delete(id);
  callback();
  await flush();
};

vm.runInNewContext(script,context);
await flush();
assert.equal($('profileChoices').children.length,1);
$('profileChoices').children[0].listeners.click();
await flush();
await advanceTimer();
assert.equal(writes.length,1,'The first upload should be in flight');
assert.equal(writes[0].backup.data.score,1);

score=2;
listeners['med-jita:changed']();
// Simulate the debounce expiring before the first request completes.
if(timers.size)await advanceTimer();
releaseFirstUpload();
await flush();
await advanceTimer();

assert.equal(writes.length,2,'A fresh upload must run after the in-flight one');
assert.equal(writes[1].backup.data.score,2,'The latest edit must reach the server');
assert.equal(writes[1].revision,1,'The second upload must use the new revision');
assert.match($('accountSyncStatus').textContent,/Salvo online e no Craft/);
console.log('Profile autosave: in-flight edit is queued and saved with the correct revision OK');
