import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Divergent changes must open normally, retain the active local state, and
// save the remote state as a recoverable history entry before uploading.
const script = readFileSync(new URL('../source/integrations/profiles-ui.js',import.meta.url),'utf8');
const makeBackup = score => ({version:3,format:'med-jita-backup',data:{version:3,score},history:[],avatar:{kind:'default'}});
const local = makeBackup(2), remote = makeBackup(3), previous = makeBackup(1);
const digest = backup => JSON.stringify({data:backup.data,history:backup.history,avatar:backup.avatar});
const memory = new Map([['med_jita_profile_sync_jbfs',JSON.stringify({revision:1,digest:digest(previous)})]]);
const nodes = new Map(), timers = new Map();
let nextTimer = 0, current = local;
const writes = [];
function node(id='') {
  return {id,hidden:false,value:'',textContent:'',dataset:{},children:[],listeners:{},
    classList:{add(){},remove(){}},setAttribute(){},scrollIntoView(){},
    addEventListener(name,fn){this.listeners[name]=fn;},append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},replaceChildren(...items){this.children=items;},focus(){}};
}
const $ = id => {if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
const bridge = {
  cachedProfile:()=>local,readLocalAvatar:()=>({kind:'default'}),getAvatar:()=>current.avatar,
  setAvatar(){},bindProfile(_id,backup){current=backup||local;},
  exportBackup:()=>current,importBackup:backup=>{current=backup;},
};
const context = {
  window:{MED_JITA_BRIDGE:bridge,addEventListener(){},setInterval(){}},
  document:{getElementById:$,createElement:()=>node(),documentElement:{dataset:{}},
    body:{classList:{add(){},remove(){}}},visibilityState:'visible',hidden:false,addEventListener(){}},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  fetch:async(path,options={})=>{
    if(path==='/api/profiles')return Response.json({profiles:[
      {id:'jbfs',name:'JBFS',available:true},{id:'barba',name:'Barba',available:true},
      {id:'tay',name:'Tay',available:true},{id:'igu',name:'Igu',available:true},
    ]});
    if(path==='/api/profile/open')return Response.json({id:'jbfs',name:'JBFS',passwordRequired:false});
    if(path==='/api/profile/backup?id=jbfs')return Response.json({revision:2,backup:remote});
    if(path==='/api/profile/backup' && options.method==='PUT'){
      writes.push(JSON.parse(options.body));
      return Response.json({revision:3,craftMirrored:true});
    }
    throw Error('Unexpected request '+path);
  },
  setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);},
  Response,Date,JSON,Error,Number,encodeURIComponent,
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
vm.runInNewContext(script,context);
await flush();
assert.deepEqual($('profileChoices').children.map(choice => choice.children[0].children[0].textContent),
  ['J','B','T','I'],'Each profile keeps its own initial instead of the same J icon');
$('profileChoices').children[0].listeners.click();
await flush();
assert.equal(context.document.documentElement.dataset.profileReady,'yes','Conflict must not block entry');
assert.equal($('profileActiveAvatar').children[0].textContent,'J','Active avatar matches the chosen user');
assert.equal(current.data.score,2,'The unsent local grade remains active');
assert.ok(current.history.some(h=>h.data.score===3 && /outro aparelho/i.test(h.name)),
  'The remote grade is preserved in named history');
const [id,timer]=timers.entries().next().value;
timers.delete(id);timer();
await flush();
assert.equal(writes.length,1,'Reconciled state is uploaded automatically');
assert.equal(writes[0].revision,2);
assert.equal(writes[0].backup.data.score,2);
assert.ok(writes[0].backup.history.some(h=>h.data.score===3));
console.log('Profile conflict: both versions retained, access unblocked, cloud updated OK');
