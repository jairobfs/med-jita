import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../source/integrations/profiles-ui.js',import.meta.url),'utf8');
const tick = async () => { for(let i=0;i<7;i++) await new Promise(setImmediate); };

async function scenario(delayedStage) {
  const nodes = new Map();
  const binds = [];
  const pending = {};
  const memory = new Map([['med_jita_last_profile','jbfs']]);
  function node(id='') {
    return {id,hidden:false,value:'',textContent:'',dataset:{},children:[],listeners:{},
      classList:{add(){},remove(){}},
      addEventListener(name,fn){this.listeners[name]=fn;},
      setAttribute(name,value){this[name]=value;},
      append(...items){this.children.push(...items);},
      appendChild(item){this.children.push(item);},
      replaceChildren(){this.children=[];},scrollIntoView(){},focus(){}};
  }
  const $=id=>{ if(!nodes.has(id))nodes.set(id,node(id)); return nodes.get(id); };
  const bridge={cachedProfile:()=>null,readLocalAvatar:()=>({kind:'default'}),
    getAvatar:()=>({kind:'default'}),setAvatar(){},bindProfile(id){binds.push(id);},
    exportBackup:()=>({data:{},history:[]}),importBackup(){}};
  const context={
    window:{MED_JITA_BRIDGE:bridge,addEventListener(){},setInterval(){}},
    document:{getElementById:$,createElement:()=>node(),documentElement:{dataset:{}},
      body:{classList:{add(){},remove(){}}},visibilityState:'visible',hidden:false,addEventListener(){}},
    localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
    fetch:async(path,options={})=>{
      if(path==='/api/profiles')return Response.json({profiles:[
        {id:'jbfs',name:'JBFS',available:true},{id:'barba',name:'Barba',available:true}]});
      const id=path==='/api/profile/open'?JSON.parse(options.body).id:
        path.startsWith('/api/profile/backup?id=')?new URL('https://test.local'+path).searchParams.get('id'):'';
      if(id==='jbfs' && path.includes(delayedStage))
        return new Promise(resolve=>{pending.release=()=>resolve(path==='/api/profile/open'?
          Response.json({id,name:'JBFS',passwordRequired:false}):Response.json({revision:0,backup:null}));});
      if(path==='/api/profile/open')return Response.json({id,name:id==='barba'?'Barba':'JBFS',passwordRequired:false});
      if(path.startsWith('/api/profile/backup?id='))return Response.json({revision:0,backup:null});
      throw Error('Unexpected request: '+path);
    },
    Response,Date,JSON,Error,Number,encodeURIComponent,setTimeout:()=>1,clearTimeout(){},
  };
  vm.runInNewContext(script,context);
  await tick();
  assert.equal($('profileChoices').children.length,2);
  assert.deepEqual(binds,[],'Remembered identity cannot enter automatically');
  const [jbfs,barba]=$('profileChoices').children;
  jbfs.listeners.click();
  await tick();
  assert.equal(typeof pending.release,'function','The JBFS response is pending');
  barba.listeners.click();
  await tick();
  assert.equal($('profileActiveName').textContent,'Barba');
  assert.equal(barba['aria-pressed'],'true');
  assert.equal(jbfs['aria-pressed'],'false');
  pending.release();
  await tick();
  assert.deepEqual(binds,['barba'],"An obsolete response must never bind the wrong person's notes");
  assert.equal(memory.get('med_jita_last_profile'),'barba');
  assert.equal($('profileActiveName').textContent,'Barba');
}

await scenario('/api/profile/open');
await scenario('/api/profile/backup?id=jbfs');
console.log('Rapid profile switching: stale open and backup responses discarded; correct person entered OK');
