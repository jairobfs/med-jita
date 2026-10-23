import assert from 'node:assert/strict';
import '../source/integrations/uc-engine.js';

const E=globalThis.MED_UC_ENGINE;
assert.equal(E.cohortPeriod(new Date('2026-10-23T12:00:00')),7,'7º período deve ser o padrão de outubro de 2026');
assert.equal(E.cohortPeriod(new Date('2027-01-15T12:00:00')),7,'Janeiro ainda integra o semestre anterior');
assert.equal(E.cohortPeriod(new Date('2027-02-01T12:00:00')),8,'A turma deve avançar no semestre seguinte');
assert.equal(E.cohortPeriod(new Date('2027-08-01T12:00:00')),9,'O avanço deve acompanhar o internato');
assert.equal(E.termLabel(E.nextAcademicTerm(new Date('2026-10-23T12:00:00'))),'2027.1');
const entry=(components,values)=>({grades:Object.fromEntries(components.map(c=>['0:'+c.id,{mode:'score',score:String(values[c.id]??'')}]))});
const use=(matrix,period,type)=>E.templates(matrix,period).find(x=>x.id===type);
const weights=t=>t.components.reduce((sum,p)=>sum+p.weight,0);

for(const matrix of ['2023','2024','2025'])for(let p=1;p<=12;p++)for(const t of E.templates(matrix,p)){
  assert(Math.abs(weights(t)-10)<1e-9 || t.completion, `Pesos inválidos em ${matrix}/${p}/${t.id}`);
  assert(t.article, 'Artigo normativo ausente');
}

const hp=use('2023',7,'hp');
assert.deepEqual(hp.components.map(x=>x.weight),[4,4,2]);
let e=entry(hp.components,{pratica:8,teorica:7,desempenho:1.6});
let result=E.evaluate(hp,e);
assert.equal(result.valid,true);
assert.equal(result.complete,true);
assert.equal(result.known,7.6);
assert.equal(result.passing,true);
assert.equal(result.attendanceOk,false,'A nota não comprova presença');
e.attendance='74.9';assert.equal(E.evaluate(hp,e).attendanceOk,false);
e.attendance='75';assert.equal(E.evaluate(hp,e).attendanceOk,true);

const iesc=use('2023',7,'iesc');
assert.deepEqual(iesc.components.map(x=>x.weight),[2.5,2.5,3,2]);
result=E.evaluate(iesc,entry(iesc.components,{c1:8,c2:6,tp:2.1,gr:1.5}));
assert.equal(result.known,7.1);

const uct=use('2023',7,'uct');
assert.deepEqual(uct.components.map(x=>x.weight),[5,4,1]);
assert.equal(E.evaluate(uct,entry(uct.components,{tut:6,cab:7.5,form:0.8})).known,6.8);

const hp2=use('2024',2,'ap');
assert.deepEqual(hp2.components.map(x=>x.weight),[3,3.5,3.5]);
assert.deepEqual(use('2025',7,'ap').components.map(x=>x.weight),[4,4,2]);
assert.deepEqual(use('2025',5,'aesc').components.map(x=>x.weight),[2,2,1,3,2]);
assert.deepEqual(use('2025',7,'aesc').components.map(x=>x.weight),[2.5,2.5,3,2]);

const track=use('2024',1,'ucf');
const twoTracks={tracks:2,grades:{}};
for(let i=0;i<2;i++)for(const c of track.components)twoTracks.grades[i+':'+c.id]={mode:'score',score:String(i?6:8)};
result=E.evaluate(track,twoTracks);
assert.equal(result.known,7);
assert.deepEqual(result.trackScores,[8,6]);
assert.equal(result.passing,true);
twoTracks.grades['1:tbl2'].score='4';
assert.equal(E.evaluate(track,twoTracks).failTrack,true);
assert.equal(use('2024',3,'ucm').tracks,true,'UCM de 2024, 3º período, precisa validar todas as trilhas');
for(const type of ['ucf','ucm']){
  const tpl=use('2025',type==='ucf'?3:4,type);
  assert.equal(tpl.tracks,true,`Matriz 2025 ${type} precisa validar cada trilha (art. 32)`);
  const grades={};for(const c of tpl.components){grades['0:'+c.id]={score:'8'};grades['1:'+c.id]={score:'5,9'};}
  const perTrack=E.evaluate(tpl,{tracks:2,grades,attendance:'75'});
  assert(perTrack.known>6,'A média global pode estar acima do corte apesar da trilha insuficiente');
  assert.equal(perTrack.failTrack,true,'Uma trilha com 5,90 não satisfaz o mínimo 6,00');
  assert.equal(perTrack.passing,false,'A média das trilhas não pode mascarar reprovação por trilha');
  for(const c of tpl.components)grades['1:'+c.id].score='6';
  assert.equal(E.evaluate(tpl,{tracks:2,grades}).passing,true);
}
const reaTracks=use('2024',1,'ucf');
assert.equal(reaTracks.reaTracks,true,'REA UCF 2024 preserva a avaliação AVE/TBL por trilha');
const reaData={tracks:2,grades:{
  '0:reaave':{score:'8'},'0:reatbl':{score:'8'},
  '1:reaave':{score:'6'},'1:reatbl':{score:'6'},
}};
let reaResult=E.evaluate(reaTracks,reaData,'rea');
assert.deepEqual(reaResult.trackScores,[8,6]);
assert.equal(reaResult.known,7);
assert.equal(reaResult.passing,true);
const blockedTarget=use('2025',3,'ucf'),blockedGrades={};
for(const c of blockedTarget.components)blockedGrades['0:'+c.id]={score:'5'};
blockedGrades['1:'+blockedTarget.components[0].id]={score:'9'};
const blocked=E.evaluate(blockedTarget,{tracks:2,grades:blockedGrades});
assert.equal(blocked.target.otherTrackFailed,true,'Meta não pode ignorar trilha já reprovada');
assert.equal(blocked.target.possible,false);

const custom=use('2023',7,'custom');
result=E.evaluate(custom,{customParts:[{id:'a',label:'Prova',weight:4},{id:'b',label:'Prática',weight:5}],grades:{}});
assert.equal(result.valid,false,'Não deve aceitar pesos com soma 9');
result=E.evaluate(custom,{customParts:[{id:'a',label:'Prova',weight:6},{id:'b',label:'Prática',weight:5}],grades:{'0:a':{score:'10'},'0:b':{score:'10'}}});
assert.equal(result.valid,false,'Pesos excessivos devem invalidar a nota');
assert.equal(result.passing,false,'Uma fórmula inválida jamais deve aparecer como aprovada');
result=E.evaluate(custom,{customParts:[{id:'cab',label:'CAB',weight:4},{id:'form',label:'Formativa',weight:1,kind:'points'},{id:'tut',label:'Tutoria',weight:5}],grades:{'0:cab':{score:'8'},'0:form':{score:'0,7'},'0:tut':{score:'7'}}});
assert.equal(result.valid,true);
assert(Math.abs(result.known-7.4)<1e-9,'Pesos diretos e notas 0–10 devem coexistir sem converter duas vezes');

const withHits={grades:{'0:pratica':{mode:'hits',hits:'32',total:'40'},'0:teorica':{mode:'score',score:'7'},'0:desempenho':{score:'1,6'}}};
assert.equal(E.evaluate(hp,withHits).known,7.6);
withHits.grades['0:pratica'].hits='41';
assert.equal(E.evaluate(hp,withHits).valid,false,'Acertos acima do total devem ser rejeitados');

const missing=entry(hp.components,{pratica:8,desempenho:1.6});
result=E.evaluate(hp,missing);
assert.equal(result.complete,false);
assert(Math.abs(result.known-4.8)<1e-9);
assert(Math.abs(result.maximum-8.8)<1e-9);
assert.equal(result.target.label,'Avaliação Teórica de Habilidades');

const recovery=E.evaluate(hp,{grades:{'0:rea':{mode:'score',score:'6,5'}}},'rea');
assert.equal(recovery.known,6.5);
assert.equal(recovery.parts.length,1,'REA substitui todas as notas');
const ucfRea=E.evaluate(use('2024',2,'ucf'),{grades:{'0:reaave':{mode:'score',score:'8'},'0:reatbl':{mode:'score',score:'6'}}},'rea');
assert.equal(ucfRea.parts.length,2,'REA da UCF 2024 mantém AVE + TBL com pesos 5/5');
assert.equal(ucfRea.known,7);

const intern=use('2023',9,'internato');
assert.deepEqual(intern.components.map(x=>x.weight),[3,3,4]);
assert.equal(E.evaluate(intern,entry(intern.components,{cognitiva:8,tp:2.4,servico:7.5})).required,100);
const elective=E.evaluate(use('2023',9,'eletivo'),{});
assert.equal(elective.completion,true);

console.log('MED JITA: matrizes, progressão de turma 7→8→9, HP, IESC/AESC, trilhas, internato, REA e metas OK.');
