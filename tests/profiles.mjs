import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import worker from '../worker/index.js';

const origin = 'https://med-jita.test';
const craftBase = 'https://connect.craft.do/links/testConnection/api/v1';
const master = randomBytes(32).toString('hex');
const accountCode = 'a'.repeat(24);
const barbaCode = 'b'.repeat(24);
const records = new Map();
const items = [
  { id:'craft-jbfs', title:'JBFS', properties:{ identificador:'jbfs',email:'jairobfs7@gmail.com',ativo:true,
    acesso:'Ativo',papel:'Administrador',codigo:accountCode,senhahistorico:'',redefinirsenha:false,sincronizacao:true } },
  { id:'craft-barba', title:'Barba', properties:{ identificador:'barba',email:'barba@example.com',ativo:true,
    acesso:'Ativo',papel:'Participante',codigo:barbaCode,senhahistorico:'',redefinirsenha:false,sincronizacao:true } },
  { id:'craft-tay', title:'Tay', properties:{ identificador:'tay',ativo:false,
    acesso:'Pendente',papel:'Participante',codigoacesso:'c'.repeat(24) } },
  { id:'craft-igu', title:'Igu', properties:{ identificador:'igu',ativo:false,
    acesso:'Pendente',papel:'Participante',codigoacesso:'d'.repeat(24) } },
  { id:'craft-draft', title:'Teste novo user', properties:{ identificador:'teste',ativo:true,
    acesso:'Ativo',papel:'Participante',codigo:'' } },
];
const craftBlocks=new Map(items.map(item=>[item.id, [{
  id:'initial-'+item.id,type:'text',markdown:'**MED JITA · Estado sincronizado** — aguardando primeiro acesso.',
}]]));
let nextCraftBlock=0;
let failNextCraftBlockUpdate=false;
const db = {
  prepare(sql) {
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        const id=this.args[0];return records.has(id)?{...records.get(id)}:null;
      },
      async run(){
        if(sql.startsWith('CREATE TABLE'))return {meta:{changes:0}};
        if(sql.startsWith('INSERT OR IGNORE')){
          const [id,payload,updated_at]=this.args;
          if(records.has(id))return {meta:{changes:0}};
          records.set(id,{revision:1,payload,updated_at});return {meta:{changes:1}};
        }
        if(sql.startsWith('INSERT INTO snapshots') && sql.includes('VALUES (?,?,?,?)')){
          const [id,revision,payload,updated_at]=this.args;
          records.set(id,{revision:Math.max(revision,records.get(id)?.revision||0),payload,updated_at});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('INSERT INTO snapshots')){
          const [id,payload,updated_at]=this.args;
          records.set(id,{revision:(records.get(id)?.revision||0)+1,payload,updated_at});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('UPDATE snapshots')){
          const [payload,updated_at,id,revision]=this.args;
          const row=records.get(id);
          if(!row||row.revision!==revision)return {meta:{changes:0}};
          records.set(id,{revision:revision+1,payload,updated_at});
          return {meta:{changes:1}};
        }
        throw Error('Unexpected SQL: '+sql);
      },
    };
  },
};
const env={DB:db,CRAFT_API_BASE:craftBase,CRAFT_SPACE_ID:'6606bf28-79b6-7415-c5c5-6d0a79f7f279',MED_JITA_MASTER_KEY:master};
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
  if(String(url).endsWith('/connection'))
    return Response.json({space:{id:env.CRAFT_SPACE_ID}});
  if(String(url).includes('/collections/c4a350de-9e9d-4e29-6f0c-ec31cc6b4ba7/items')){
    if(options.method==='PUT'){
      const changes=JSON.parse(options.body).itemsToUpdate;
      for(const change of changes) Object.assign(items.find(i=>i.id===change.id).properties,change.properties);
      return Response.json({updated:changes.length});
    }
    return Response.json({items});
  }
  if(String(url).includes('/blocks?id=')){
    const target=new URL(url).searchParams.get('id');
    const block={id:target,type:'collectionItem',content:craftBlocks.get(target)||[]};
    // Real REST returns an individual block; retain compatibility with
    // older adapters that return an array inside `data`.
    return Response.json(target==='craft-jbfs'?block:{data:[block]});
  }
  if(String(url).endsWith('/blocks')){
    const body=JSON.parse(options.body||'{}');
    if(options.method==='POST'){
      const collectionItem=body.position.pageId;
      const added=body.blocks.map(block=>({id:'new-'+(++nextCraftBlock),...block}));
      craftBlocks.get(collectionItem).push(...added);
      return Response.json({items:added});
    }
    if(options.method==='PUT'){
      if(failNextCraftBlockUpdate){failNextCraftBlockUpdate=false;return Response.json({error:'offline'},{status:503});}
      for(const change of body.blocks){
        const current=[...craftBlocks.values()].flat().find(block=>block.id===change.id);
        assert.ok(current,'Only existing Craft blocks may be updated.');
        Object.assign(current,change);
      }
      return Response.json({items:body.blocks});
    }
  }
  throw Error('Unexpected Craft URL');
};
function req(path,{method='GET',code=accountCode,password='',body}={}){
  const headers={
    'X-Med-Access-Code':code,
    ...(password?{'X-Med-History-Password':password}:{}),
    ...(body?{'Content-Type':'application/json'}:{}),
  };
  return worker.fetch(new Request(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env);
}
const backup={version:3,format:'med-jita-backup',data:{version:3,cab:{hits:'21'}},history:[]};
try {
  let r=await req('/api/profiles');
  assert.equal(r.status,200);
  let names=await r.json();
  assert.equal(names.profiles.length,4);
  assert.equal(names.profiles.find(p=>p.id==='tay').available,false);
  assert.equal(names.profiles.find(p=>p.id==='jbfs').passwordRequired,false);
  assert.equal(JSON.stringify(names).includes(accountCode),false,'No codes in public profile listing');

  // A mistaken PIN edit in Craft's technical Code field must not make the
  // administrator vanish again. Keep the account visible but not accessible
  // until the technical marker is corrected; never leak that marker publicly.
  items[0].properties.codigo='jbfs123';
  r=await req('/api/profiles');
  const shortCodeCatalog=await r.json();
  assert.equal(shortCodeCatalog.profiles.length,4);
  assert.equal(shortCodeCatalog.profiles.find(p=>p.id==='jbfs').available,false);
  assert.equal(shortCodeCatalog.profiles.find(p=>p.id==='jbfs').activationNeedsRepair,true);
  assert.equal((await req('/api/profile/open',{method:'POST',body:{id:'jbfs'}})).status,403);
  items[0].properties.codigo=accountCode;

  r=await req('/api/profile/open',{method:'POST',body:{id:'jbfs'}});
  assert.equal(r.status,200);
  assert.equal((await r.json()).passwordRequired,false);
  r=await req('/api/profile/open',{method:'POST',code:'wrong',body:{id:'jbfs'}});
  assert.equal(r.status,200,'A profile is selected by name, without a code');
  r=await req('/api/profile/open',{method:'POST',code:barbaCode,body:{id:'barba'}});
  assert.equal(r.status,200);
  r=await req('/api/profile/open',{method:'POST',code:barbaCode,body:{id:'jbfs'}});
  assert.equal(r.status,200,'The old access-code header is no longer a required login step');

  r=await req('/api/profile/backup',{method:'PUT',body:{id:'jbfs',revision:0,backup}});
  assert.equal(r.status,200);
  let saveResult=await r.json();
  assert.equal(saveResult.revision,1);
  assert.equal(saveResult.craftMirrored,true,'First online save should also write into Craft.');
  let mirrored=craftBlocks.get('craft-jbfs');
  assert.equal(mirrored.filter(b=>b.type==='code').length,1);
  assert.equal(JSON.parse(mirrored.find(b=>b.type==='code').rawCode).backup.data.cab.hits,'21');
  assert.match(mirrored.find(b=>b.type==='text').markdown,/Históricos nomeados:/);
  assert.match(items[0].properties.ultimasincronizacao,/^\d{4}-\d\d-\d\d$/);
  r=await req('/api/profile/backup',{method:'PUT',body:{id:'jbfs',revision:1,backup:{...backup,history:[{name:'Tentativa A'}]}}});
  saveResult=await r.json();
  assert.equal(saveResult.revision,2);
  assert.equal(saveResult.craftMirrored,true);
  mirrored=craftBlocks.get('craft-jbfs');
  assert.equal(mirrored.filter(b=>b.type==='code').length,1,'Subsequent saves update the original mirror.');
  assert.equal(JSON.parse(mirrored.find(b=>b.type==='code').rawCode).backup.history.length,1);
  assert.equal(records.get('med-craft-mirror-v1:jbfs').revision,2);
  assert.equal((await req('/api/profile/backup?id=jbfs')).status,200);
  failNextCraftBlockUpdate=true;
  r=await req('/api/profile/backup',{method:'PUT',code:barbaCode,
    body:{id:'barba',revision:0,backup}});
  assert.equal(r.status,200,'A Craft outage must not lose the online save.');
  assert.equal((await r.json()).craftMirrored,false);
  r=await req('/api/profile/backup?id=barba',{code:barbaCode});
  assert.equal(r.status,200,'Subsequent access retries the Craft mirror.');
  assert.equal(records.get('med-craft-mirror-v1:barba').revision,1);
  assert.equal(craftBlocks.get('craft-barba').filter(b=>b.type==='code').length,1);
  const stored=records.get('med-data-v1:jbfs').payload;
  assert.equal(stored.includes('"hits"'),false,'History encrypted in D1');
  r=await req('/api/profile/backup?id=jbfs');
  assert.equal((await r.json()).backup.data.cab.hits,'21');
  r=await req('/api/profile/backup',{method:'PUT',body:{id:'jbfs',revision:0,backup}});
  assert.equal(r.status,409);

  r=await req('/api/profile/password',{method:'PUT',body:{id:'jbfs',next:'VisivelNoCraft2026',current:''}});
  assert.equal(r.status,403,'Initial protection requires the private Craft activation code');
  r=await req('/api/profile/password',{method:'PUT',body:{id:'jbfs',next:'VisivelNoCraft2026',current:accountCode}});
  assert.equal(r.status,200);
  assert.equal(items[0].properties.senhahistorico,'VisivelNoCraft2026');
  r=await req('/api/profile/backup?id=jbfs');
  assert.equal(r.status,423);
  r=await req('/api/profile/backup?id=jbfs',{password:'VisivelNoCraft2026'});
  assert.equal(r.status,200);

  items[0].properties.codigo='f'.repeat(24);
  r=await req('/api/profile/backup?id=jbfs',{code:accountCode,password:'VisivelNoCraft2026'});
  assert.equal(r.status,200,'Codes maintained in Craft do not block simple profile entry');
  r=await req('/api/profile/backup?id=jbfs',{code:'f'.repeat(24),password:'VisivelNoCraft2026'});
  assert.equal(r.status,200);
  items[0].properties.senhahistorico='';
  r=await req('/api/profile/backup?id=jbfs',{code:'f'.repeat(24)});
  assert.equal(r.status,200,'Admin may remove optional password directly in Craft');
  r=await req('/api/profile/password',{method:'PUT',code:'f'.repeat(24),body:{id:'jbfs',current:'',next:'1234'}});
  assert.equal(r.status,403,'The deprecated access-code header cannot establish password ownership');
  r=await req('/api/profile/password',{method:'PUT',code:'f'.repeat(24),body:{id:'jbfs',current:'f'.repeat(24),next:'1234'}});
  assert.equal(r.status,200,'Short optional PIN accepted for this personal project');
  r=await req('/api/profile/backup?id=jbfs',{code:'f'.repeat(24),password:'1234'});
  assert.equal(r.status,200);
  r=await req('/api/profile/password',{method:'PUT',code:'f'.repeat(24),body:{id:'jbfs',current:'1234',next:'123'}});
  assert.equal(r.status,422,'Optional PIN must contain at least four characters');
  items[0].properties.senhahistorico='';
} finally {
  globalThis.fetch=originalFetch;
}
console.log('MED JITA profiles: names, simple access, optional passwords, Craft mirror and conflicts OK.');
