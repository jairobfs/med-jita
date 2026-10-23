import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const html = readFileSync('independente.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Código de perfis não encontrado');
new vm.Script(script,{filename:'independente.html'});

const nodes = new Map();
const listeners = {};
const element = () => ({
  value:'',hidden:false,style:{},dataset:{},children:[],attributes:{},
  replaceChildren(){this.children=[]},
  append(child){this.children.push(child)},
  setAttribute(key,value){this.attributes[key]=String(value)},
  focus(){},showModal(){},close(){},
  set textContent(value){this.text=String(value)},
  get textContent(){return this.text||''}
});
const getNode = id => {
  if(!nodes.has(id))nodes.set(id,element());
  return nodes.get(id);
};
const local = new Map();
const storage = {
  getItem:key=>local.get(key)??null,
  setItem:(key,value)=>local.set(key,String(value)),
  removeItem:key=>local.delete(key)
};
const ctx = {
  console,crypto:webcrypto,TextEncoder,encodeURIComponent,decodeURIComponent,
  escape,unescape,btoa,atob,URL,URLSearchParams,
  localStorage:storage,
  fetch:async()=>{throw Error('Craft não configurado neste teste')},
  window:{addEventListener:(name,fn)=>listeners[name]=fn},
  document:{hidden:false,getElementById:getNode,createElement:element,addEventListener:(name,fn)=>listeners[name]=fn},
  navigator:{clipboard:{}},history:{replaceState(){}},
  location:{hash:'',pathname:'/med-jita/',search:''},
  setTimeout,clearTimeout,setInterval:()=>0
};
vm.runInNewContext(script,ctx,{filename:'independente.html'});
const profiles = [
  {id:'jbfs',name:'JBFS',pin:'4101',hits:'11'},
  {id:'barba',name:'Barba',pin:'4202',hits:'22'},
  {id:'tay',name:'Tay',pin:'4303',hits:'33'},
  {id:'igu',name:'Igu',pin:'4404',hits:'44'}
];
const stateKey = 'med_jita_state_v3';
const historyKey = 'med_jita_history_v1';
assert.equal(getNode('avatars').children.length,4);
for(const [index,user] of profiles.entries()){
  getNode('avatars').children[index].onclick();
  assert.equal(getNode('pinConfirmWrap').hidden,false,'Primeiro acesso local exige confirmação');
  getNode('pin').value=user.pin;
  getNode('pinConfirm').value=user.pin;
  await getNode('enter').onclick();
  assert.equal(getNode('gate').hidden,true,'Perfil deve abrir: '+user.id);
  assert.equal(storage.getItem(stateKey),null,'O estado de outro usuário não deve aparecer no primeiro acesso');
  const state={version:3,cab:{hits:user.hits},uc:{entries:{['2023:7:'+user.id]:{name:user.name}}}};
  const history=[{id:'version-'+user.id,name:user.name,data:state}];
  storage.setItem(stateKey,JSON.stringify(state));
  storage.setItem(historyKey,JSON.stringify(history));
  listeners.storage({key:stateKey,storageArea:storage});
  await getNode('switch').onclick();
  assert.equal(JSON.parse(storage.getItem('jita_autonomo_v1_state_'+user.id)).cab.hits,user.hits);
  assert.equal(JSON.parse(storage.getItem('jita_autonomo_v1_history_'+user.id))[0].id,'version-'+user.id);
}
for(const [index,user] of profiles.entries()){
  getNode('avatars').children[index].onclick();
  getNode('pin').value='9999';
  await getNode('enter').onclick();
  assert.equal(getNode('gate').hidden,false,'PIN incorreto não abre perfil '+user.id);
  getNode('pin').value=user.pin;
  await getNode('enter').onclick();
  assert.equal(getNode('gate').hidden,true,'PIN correto reabre perfil '+user.id);
  const state=JSON.parse(storage.getItem(stateKey));
  const history=JSON.parse(storage.getItem(historyKey));
  assert.equal(state.cab.hits,user.hits,'Nota isolada de '+user.id);
  assert.ok(state.uc.entries['2023:7:'+user.id],'UC preservada de '+user.id);
  assert.equal(history.length,1,'Histórico pessoal preservado');
  assert.equal(history[0].id,'version-'+user.id);
  await getNode('switch').onclick();
}
assert.equal(profiles.length,4);
console.log('MED JITA: 4 perfis isolados, PINs distintos, UC e históricos restaurados sem vazamento.');
