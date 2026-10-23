import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import '../source/integrations/uc-engine.js';

const html = readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
const core = html.match(/<script id="grade-core-v2">([\s\S]*?)<\/script>/)?.[1];
assert.ok(core, 'O motor legado de CAB/Tutoria precisa estar presente');
const context = { globalThis: {}, Number, Math, String };
vm.runInNewContext(core,context);
const G = context.globalThis.MED_ENGINE, U = globalThis.MED_UC_ENGINE;
const near = (actual,expected,label) => assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} vs ${expected}`);
const legacy = () => ({
  cfg:{cabTheory:'2,6',cabPractice:'1,4',tut:'5',form:'1',cut:'5,75'},
  cab:{mode:'without',split:false,hits:'',total:'',practice:''},
  tut:{hits:'',total:''},form:{score:''},
});

let state = legacy();
state.cab.hits='32';state.cab.total='40';state.tut.hits='18';state.tut.total='30';state.form.score='0,8';
let result=G.model(state);
assert(result.valid&&result.complete);
near(result.known,7,'UCT: CAB integrado 3,2 + Tutoria 3,0 + Formativa 0,8');
near(result.maximum,7,'UCT completa não pode projetar pontos fictícios');
state.tut.hits='';
assert.equal(G.model(state).complete,false);
assert.equal(G.reverse(state,'tut').count,11,'Com 30 questões, a Tutoria exige 11 acertos');
state.tut.total='20';
const goal=G.reverse(state,'tut');
assert.equal(goal.kind,'possible');
assert.equal(goal.count,7,'CAB 3,2 + Formativa 0,8 exigem 1,75 ponto em Tutoria de peso 5');
state.cab.mode='with';state.cab.hits='20';state.cab.total='25';state.cab.practice='9';
state.tut.hits='6';state.tut.total='10';state.form.score='1';
result=G.model(state);
near(result.known,7.34,'UCT: CAB 2,08 + Macro 1,26 + Tutoria 3 + Formativa 1');
assert(result.complete);
state.cfg.form='2';
assert.equal(G.weights(state).good,false,'Pesos que somam 11 não são admitidos');

const cancellation=G.cancelled({hits:'28',total:'40',cancelled:'4',already:'1'},5.75);
assert(cancellation.valid);
near(cancellation.credit,7.75,'Anulações: crédito universal');
near(cancellation.exclude,7.5,'Anulações: exclusão do denominador');
assert.equal(G.cancelled({hits:'28',total:'40',cancelled:'4',already:'5'},5.75).valid,false);
let ava=G.ava({ava:{hits1:'16',total1:'20',hits2:'12',total2:'20'}},5.75);
near(ava.grade,7,'Duas avaliações com peso igual');
ava=G.ava({ava:{hits1:'16',total1:'20',hits2:'',total2:'20'}},5.75);
assert.equal(ava.goal.count,7,'Após AVA1 8,0 são necessários 7/20 acertos na AVA2');

for(const matrix of ['2023','2024','2025'])for(let p=1;p<=12;p++)for(const template of U.templates(matrix,p)){
  if(template.completion){assert.equal(U.evaluate(template,{}).completion,true);continue;}
  const grades={};
  for(const part of template.components)grades['0:'+part.id]={mode:'score',score:String(part.kind==='points'?part.weight*.75:7.5)};
  result=U.evaluate(template,{grades,attendance:p>=9?'100':'75'});
  assert.equal(result.valid,true,`Regra inválida ${matrix}/${p}/${template.id}`);
  assert(result.complete,`Componente ignorado ${matrix}/${p}/${template.id}`);
  near(result.known,7.5,`Média 7,5 em ${matrix}/${p}/${template.id}`);
  assert(result.passing,`Média 7,5 deve atingir nota ${matrix}/${p}/${template.id}`);
  assert(result.attendanceOk,`Frequência mínima não reconhecida em ${matrix}/${p}/${template.id}`);
}
const hp=U.findTemplate('2023',7,'hp');
for(const value of ['5,74','5,75','5,99','6','10']){
  const grades=Object.fromEntries(hp.components.map(part=>['0:'+part.id,{mode:'score',score:part.kind==='points'?String(part.weight*Number(value.replace(',','.'))/10):value}]));
  const r=U.evaluate(hp,{grades,attendance:'75'});
  near(r.known,Number(value.replace(',','.')),'Arredondamento normativo sem perda de precisão');
  assert.equal(r.passing,Number(value.replace(',','.'))>=5.75);
}
const partial=U.evaluate(hp,{grades:{'0:pratica':{score:'8'},'0:desempenho':{score:'1,6'}}});
assert.equal(partial.missing,1);
near(partial.target.grade,2.375,'Reverso HP7 para atingir 5,75 pontos');
assert.equal(U.evaluate(hp,{grades:{'0:rea':{score:'5,75'}}},'rea').passing,true);
assert.equal(U.evaluate(hp,{grades:{'0:rea':{score:'5,74'}}},'rea').passing,false);

console.log('MED JITA: cálculos independentes de CAB, Tutoria, HP, IESC, anulações, AVA, REA, frequência, metas e 36 matrizes/períodos OK.');
