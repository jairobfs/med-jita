import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const engineSource=readFileSync('site-v51/source/integrations/uc-engine.js','utf8');
const clientSource=readFileSync('uc-native.js','utf8');
new vm.Script(engineSource,{filename:'uc-engine.js'});
new vm.Script(clientSource,{filename:'uc-native.js'});
const ctx={module:{exports:{}}};
vm.runInNewContext(engineSource,ctx);
const UC=ctx.module.exports;
assert.equal(typeof UC.templates,'function');
assert.equal(typeof UC.evaluate,'function');
for(const matrix of ['2023','2024','2025']){
 for(let period=1;period<=12;period++){
  const all=UC.templates(matrix,period);
  assert.ok(all.length>=1,matrix+'/'+period+' must have curricular templates');
  assert.ok(all.some(t=>t.id==='custom'),'Manual template missing '+matrix+'/'+period);
 }
}
const uct=UC.findTemplate('2023',7,'uct');
assert.deepEqual(Array.from(uct.components,c=>[c.id,c.weight]),[['tut',5],['cab',4],['form',1]]);
const empty=UC.evaluate(uct,{grades:{}},'rra');
assert.equal(empty.complete,false);
assert.equal(empty.maximum,10);
assert.equal(empty.missing,3);
assert.equal(empty.known,0); // UI displays pending, never an actual zero
const grades={'0:tut':{mode:'score',score:'8'},'0:cab':{mode:'score',score:'7'},'0:form':{mode:'score',score:'0,8'}};
const result=UC.evaluate(uct,{grades,attendance:'85'},'rra');
assert.equal(result.valid,true);
assert.equal(result.complete,true);
assert.ok(Math.abs(result.known-7.6)<1e-8);
assert.equal(result.passing,true);
assert.equal(result.attendanceOk,true);
const error=UC.evaluate(uct,{grades:{...grades,'0:tut':{mode:'score',score:'11'}},attendance:'85'},'rra');
assert.equal(error.valid,false);
assert.ok(error.error.includes('0 a 10'));
const trackTpl=UC.findTemplate('2024',3,'ucf');
assert.equal(trackTpl.tracks,true);
const trackGrades={};
for(const part of trackTpl.components){
 trackGrades['0:'+part.id]={mode:'score',score:'5'};
 trackGrades['1:'+part.id]={mode:'score',score:'10'};
}
const tracks=UC.evaluate(trackTpl,{grades:trackGrades,tracks:2,attendance:'80'},'rra');
assert.equal(tracks.complete,true);
assert.ok(tracks.known>5.75);
assert.equal(tracks.failTrack,true);
const shell=readFileSync('independente.html','utf8');
assert.match(shell,/previous\?\.uc&&updated/,'Outer profile state must retain curricular data');
assert.match(clientSource,/med_jita_state_v3/,'UC writes through existing Craft-backed state');
assert.match(clientSource,/Minhas UCs/);
assert.doesNotMatch(clientSource,/\/api\/identity|med_jita_session|profileUnlockPassword|Vercel/,'No second login or backend');
assert.match(clientSource,/Nenhuma nota lançada/,'Incomplete grades must not be treated as zero');
assert.match(clientSource,/Frequência \(%\)/);
console.log('PASS UC V51: 3 matrices × 12 periods, original curricular formulas, pending grades, RRA/REA and state compatibility.');
