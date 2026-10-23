import assert from 'node:assert/strict';
import {prepareFusion} from '../source/integrations/fusion-archive.mjs';

const make = (score,history=[]) => ({
  version:3,format:'med-jita-backup',
  data:{version:3,cab:{hits:String(score),total:'27'},uc:{period:'7',matrix:'2023'}},
  avatar:{kind:'default'},history,
});
const old = {id:'one',name:'Antes',savedAt:'2026-10-20T10:00:00Z',data:{score:1}};
const left=make(22,[old]);
const right=make(24,[old,{...old,data:{score:2}}]);
const frozen=JSON.stringify({left,right});
const result=prepareFusion({profileId:'jbfs',sites:left,vercel:right});
assert.equal(result.requiresActiveStateDecision,true,'Divergências exigem escolha humana');
assert.equal(result.totalVersions,4,'Ambos estados atuais e versões históricas distintas devem sobreviver');
assert.equal(new Set(result.snapshots.map(item=>item.id)).size,4,'IDs colidentes não podem sobrescrever');
assert.deepEqual(result.snapshots.map(item=>item.origin),['Sites','Vercel','Sites','Vercel']);
assert.equal(JSON.stringify({left,right}),frozen,'A auditoria não pode modificar as fontes');

const identical=prepareFusion({profileId:'jbfs',sites:left,vercel:structuredClone(left)});
assert.equal(identical.sameLiveState,true);
assert.equal(identical.totalVersions,2);

const overflow=prepareFusion({profileId:'jbfs',sites:make(1,Array.from({length:61},(_,i)=>({
  id:`h${i}`,name:`Histórico ${i}`,data:{score:i},savedAt:'2026-10-20T10:00:00Z',
}))),vercel:make(2)});
assert.equal(overflow.needsSeparateArchive,true,'Mais de 60 versões exigem arquivo separado');
assert.equal(overflow.snapshots.length,63,'Nenhum histórico pode ser descartado silenciosamente');

assert.throws(()=>prepareFusion({profileId:'jbfs',sites:{...left,profile:'tay'},vercel:right}),/outro perfil/);
assert.throws(()=>prepareFusion({profileId:'jbfs',sites:left,vercel:{...right,history:[{id:'corrompido'}]}}),/incompatível/);
console.log('Fusão Sites × Vercel: prévia sem escrita, perfis isolados e preservação total OK');
