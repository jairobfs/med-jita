import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareMigration} from '../integrations/fusion-archive.mjs';

const make = (profile, grade) => ({
  version: 3, format: 'med-jita-backup', profile,
  data: {version: 3, cab: {hits: grade}},
  history: [{id: 'h1', name: 'Avaliação', data: {cab: {hits: grade}}}],
});

test('preserva estados divergentes sem modificar as entradas', () => {
  const current=make('jbfs', 7), incoming=make('jbfs', 9);
  const before=[JSON.stringify(current), JSON.stringify(incoming)];
  const plan=prepareMigration({profileId:'jbfs',current,incoming,
    currentOrigin:'GitHub',incomingOrigin:'Sites'});
  assert.equal(plan.sameLiveState,false);
  assert.equal(plan.requiresActiveStateDecision,true);
  assert.equal(plan.completeArchive.current.backup.data.cab.hits,7);
  assert.equal(plan.completeArchive.incoming.backup.data.cab.hits,9);
  assert.deepEqual([JSON.stringify(current),JSON.stringify(incoming)],before);
});

test('não aceita arquivo que declare um perfil diferente',()=>{
  assert.throws(()=>prepareMigration({
    profileId:'jbfs',current:make('jbfs',7),incoming:make('tay',9),
  }),/outro perfil/);
});

test('não trunca histórico ao ultrapassar capacidade da UI',()=>{
  const a=make('jbfs',7), b=make('jbfs',9);
  a.history=Array.from({length:75},(_,i)=>({
    id:'a'+i,name:'Nota '+i,data:{value:i}
  }));
  const result=prepareMigration({profileId:'jbfs',current:a,incoming:b,historyLimit:60});
  assert.equal(result.needsSeparateArchive,true);
  assert.equal(result.completeArchive.current.backup.history.length,75);
});

test('arquivo de comparação não executa gravação ou rede',()=>{
  const text=readFileSync(new URL('../integrations/fusion-archive.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(text,/\b(fetch|localStorage|indexedDB|XMLHttpRequest)\s*\(/);
});
