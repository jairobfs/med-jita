import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../source/integrations/profiles-ui.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
for (const match of script.matchAll(/\$\('([A-Za-z][A-Za-z0-9_-]*)'\)/g)) {
  assert.match(page,new RegExp('id="'+match[1]+'"'),
    'The page is missing a UI element required by the profile script: '+match[1]);
}
assert.match(page,/profiles-ui\.js\?v=\d+/, 'New HTML must request a versioned login script');
const profile = { id:'jbfs', name:'JBFS', available:true };

async function scenario({ remembered=false, passwordRequired=false, rejectOpen=false }={}) {
  const nodes = new Map();
  function element(id='') {
    return { id, hidden:false, value:'', textContent:'', dataset:{}, children:[],
      listeners:{}, classList:{ add(){}, remove(){} },
      setAttribute(name,value){this[name]=value;},scrollIntoView(){},
      addEventListener(type,fn){ this.listeners[type]=fn; },
      append(...children){ this.children.push(...children); },
      appendChild(child){ this.children.push(child); },
      replaceChildren(){ this.children=[]; },
      focus(){this.focused=true;},
    };
  }
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id,element(id));
    return nodes.get(id);
  };
  const memory = new Map(remembered ? [['med_jita_last_profile','jbfs']] : []);
  const requests=[];
  const binds=[];
  const bridge={
    cachedProfile(){return null;},
    readLocalAvatar(){return {kind:'default'};},
    getAvatar(){return {kind:'default'};},
    setAvatar(){},
    bindProfile(id,backup){binds.push({id,backup});},
    exportBackup(){return {data:{},history:[]};},
    importBackup(){},
  };
  const context={
    window:{MED_JITA_BRIDGE:bridge,addEventListener(){},setInterval(){}},
    document:{getElementById:$,createElement:()=>element(),
      documentElement:{dataset:{}},body:{classList:{add(){},remove(){}}},
      visibilityState:'visible',hidden:false,addEventListener(){}},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,v)=>memory.set(key,v),removeItem:key=>memory.delete(key)},
    fetch:async (path,options={})=>{
      requests.push({path,options});
      if(path==='/api/profiles') return Response.json({profiles:[profile]});
      if(path==='/api/profile/open') {
        assert.equal(options.headers['X-Med-Access-Code'],undefined);
        return rejectOpen ? Response.json({error:'Perfil desativado'},{status:403}) :
          Response.json({id:'jbfs',name:'JBFS',passwordRequired});
      }
      if(path==='/api/profile/backup?id=jbfs') return Response.json({revision:0,backup:null});
      if(path==='/api/profile/backup' && options.method==='PUT') return Response.json({revision:1,craftMirrored:true});
      throw new Error('Unexpected request: '+path);
    },
    Response, setTimeout(){return 1;}, clearTimeout(){},
    Date,JSON,Error,Number,encodeURIComponent,
  };
  vm.runInNewContext(script,context);
  for(let i=0;i<5;i++)await new Promise(setImmediate);
  return { nodes,requests,binds,memory,context };
}

const first=await scenario();
assert.deepEqual(first.requests.map(r=>r.path),['/api/profiles']);
assert.equal(first.context.document.documentElement.dataset.profileReady,undefined);
assert.equal(first.nodes.get('profileChoices').children.length,1);
assert.ok(first.nodes.get('profileChoices').children[0].children[0].className.includes('profile-choice-avatar'),
  'Every profile needs its own visual avatar placeholder');
first.nodes.get('profileChoices').children[0].listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
assert.equal(first.context.document.documentElement.dataset.profileReady,'yes',
  'Choosing a name must open the calculator without a code');

const returning=await scenario({remembered:true});
assert.deepEqual(returning.requests.map(r=>r.path),['/api/profiles'],
  'Um perfil lembrado não deve abrir sem um toque explícito do usuário');
assert.equal(returning.binds.length,0,'A lembrança do perfil não deve importar dados de outra pessoa');
returning.nodes.get('profileChoices').children[0].listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
assert.equal(returning.binds[0].id,'jbfs');
assert.equal(returning.context.document.documentElement.dataset.profileReady,'yes');
assert.equal(returning.nodes.get('profileActiveName').textContent,'JBFS');

const locked=await scenario({remembered:true,passwordRequired:true});
locked.nodes.get('profileChoices').children[0].listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
assert.equal(locked.nodes.get('profilePasswordSection').hidden,false);
assert.equal(locked.nodes.get('profileChoices').hidden,true,'A senha deve ter uma tela própria, sem os cartões competindo com o formulário');
assert.equal(locked.nodes.get('profileGatewayHint').hidden,true);
assert.equal(locked.nodes.get('profileGatewayPanel').dataset.stage,'password');
assert.equal(locked.nodes.get('profileUnlockAvatar').dataset.profile,'jbfs','A confirmação deve mostrar o avatar do perfil selecionado');
assert.equal(locked.binds.length,0);
locked.nodes.get('profileUnlockBack').listeners.click();
assert.equal(locked.nodes.get('profileChoices').hidden,false,'Trocar perfil deve restaurar a seleção');
assert.equal(locked.nodes.get('profileGatewayPanel').dataset.stage,'choose');
assert.equal(locked.nodes.get('profilePasswordSection').hidden,true);

const escape=await scenario({passwordRequired:true});
escape.nodes.get('profileChoices').children[0].listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
let escaped=false;
escape.nodes.get('profileGateway').listeners.keydown({key:'Escape',preventDefault(){escaped=true;}});
assert.equal(escaped,true,'Escape deve permitir voltar da senha sem autenticar');
assert.equal(escape.nodes.get('profilePasswordSection').hidden,true);
assert.equal(escape.binds.length,0);

const disabled=await scenario({remembered:true,rejectOpen:true});
disabled.nodes.get('profileChoices').children[0].listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
assert.equal(disabled.context.document.documentElement.dataset.profileReady,undefined);
assert.match(disabled.nodes.get('profileMessage').textContent,/desativado/);

// Switching manually shows the chooser, without auto-logging in again.
await returning.nodes.get('profileSwitch').listeners.click();
for(let i=0;i<5;i++)await new Promise(setImmediate);
assert.equal(returning.requests.filter(r=>r.path==='/api/profile/open').length,1);
assert.equal(returning.context.document.documentElement.dataset.profileReady,'no');

console.log('Explicit profile selection, optional password, remembered choice and manual switch OK');
