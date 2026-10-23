import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../source/integrations/profiles-ui.js',import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function scenario(blockStage){
  const nodes=new Map(),memory=new Map([['med_jita_last_profile','jbfs']]);
  function el(id=''){return {id,hidden:false,value:'',dataset:{},children:[],listeners:{},textContent:'',classList:{add(){},remove(){}},
    setAttribute(name,value){this[name]=value;},addEventListener(type,fn){this.listeners[type]=fn;},
    append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},
    replaceChildren(){this.children=[];},focus(){},scrollIntoView(){}};}
  const $=id=>{if(!nodes.has(id))nodes.set(id,el(id));return nodes.get(id);};
  const gate=deferred(),requests=[],binds=[];
  const bridge={cachedProfile:()=>null,readLocalAvatar:()=>({kind:'default'}),getAvatar:()=>({kind:'default'}),
    setAvatar(){},bindProfile(id,backup){binds.push({id,backup});},exportBackup:()=>({data:{},history:[]}),importBackup(){}};
  const context={window:{MED_JITA_BRIDGE:bridge,addEventListener(){},setInterval(){}},
    document:{getElementById:$,createElement:()=>el(),documentElement:{dataset:{}},body:{classList:{add(){},remove(){}}},visibilityState:'visible',hidden:false,addEventListener(){}},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
    fetch:async(path,options={})=>{
      requests.push(path);
      if(path==='/api/profiles')return Response.json({profiles:[{id:'jbfs',name:'JBFS',available:true},{id:'barba',name:'Barba',available:true}]});
      if(path==='/api/profile/open'){
        const id=JSON.parse(options.body).id;
        if(id==='jbfs'&&blockStage==='open')await gate.promise;
        return Response.json({id,name:id==='jbfs'?'JBFS':'Barba',passwordRequired:false});
      }
      if(path.startsWith('/api/profile/backup?id=')){
        const id=new URL('https://med-jita.test'+path).searchParams.get('id');
        if(id==='jbfs'&&blockStage==='backup')await gate.promise;
        return Response.json({revision:1,backup:{version:3,format:'med-jita-backup',data:{version:3,profileOwner:id},history:[]}});
      }
      throw Error('Requisição inesperada: '+path);
    },Response,setTimeout(){return 1;},clearTimeout(){},Date,JSON,Error,Number,encodeURIComponent};
  vm.runInNewContext(script,context);
  await tick();
  assert.deepEqual(requests,['/api/profiles'],'O último perfil salvo nunca deve abrir automaticamente');
  const [first,second]=$('profileChoices').children;
  first.listeners.click();
  await tick();
  second.listeners.click();
  await tick();
  assert.deepEqual(binds.map(x=>x.id),['barba'],'A última escolha deve abrir sem aguardar a resposta obsoleta');
  gate.resolve();
  await tick();
  assert.deepEqual(binds.map(x=>x.id),['barba'],'Somente a última pessoa escolhida pode abrir o histórico');
  assert.equal(binds[0].backup.data.profileOwner,'barba','Os dados importados devem pertencer ao mesmo perfil');
  assert.equal($('profileActiveName').textContent,'Barba');
  assert.equal(context.document.documentElement.dataset.profileReady,'yes');
  assert.equal(memory.get('med_jita_last_profile'),'barba');
  assert.equal(first['aria-pressed'],'false');
  assert.equal(second['aria-pressed'],'true');
}
await scenario('open');
await scenario('backup');
console.log('MED JITA: escolha explícita e corrida entre perfis durante autenticação e recuperação de notas OK.');
