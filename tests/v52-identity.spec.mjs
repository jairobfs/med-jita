import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(p,'utf8');
const html=read('site-v51/source/index.html');
const js=read('site-v51/source/integrations/med-brand-system.js');
const css=read('site-v51/source/jita-curricular.css');
const engine=read('site-v51/source/integrations/uc-engine.js');
const build=read('site-v51/scripts/build-assets.mjs');
new vm.Script(js,{filename:'med-brand-system.js'});
assert.match(html,/jita-curricular\.css\?v=\d+/);
assert.match(html,/integrations\/med-brand-system\.js\?v=\d+/);
assert.match(build,/integrations\/med-brand-system\.js/);
assert.match(build,/jita-curricular\.css/);
assert.match(build,/navigation-motion\.css/);
assert.match(css,/prefers-reduced-motion/);
assert.match(js,/speechSynthesis/);
assert.match(js,/AUDIO_KEY='med_jita_audio_optin_v1'/);
assert.match(js,/requestAnimationFrame/);
assert.match(js,/data-uc-open/);
assert.match(js,/data-uc-score/);
const mock={
  document:{body:{},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}},
  window:{matchMedia:()=>({matches:false})},
  MutationObserver:class {observe(){}},
  localStorage:{getItem:()=>null},
  requestAnimationFrame:()=>{},
};
vm.createContext(mock);
vm.runInContext(js,mock);
const declared=mock.window.MED_JITA_BRAND_SYSTEM;
assert.ok(declared);
const moduleIds=[...engine.matchAll(/tpl\(['"]([^'"]+)['"]/g)].map(x=>x[1]);
const gradeIds=[...engine.matchAll(/(?:graded|points)\(['"]([^'"]+)['"]/g)].map(x=>x[1]);
for(const id of new Set(moduleIds))assert.ok(declared.moduleIds.includes(id),'Logo de módulo faltante: '+id);
for(const id of new Set(gradeIds))assert.ok(declared.gradeIds.includes(id),'Logo de avaliação faltante: '+id);
assert.equal(new Set(declared.moduleIds).size,declared.moduleIds.length);
assert.equal(new Set(declared.gradeIds).size,declared.gradeIds.length);
assert.match(js,/initials\(label\)/,'Notas personalizadas precisam de selo de fallback');
console.log('V52 OK:',declared.moduleIds.length,'identidades de módulo e',declared.gradeIds.length,'de avaliações; fallback personalizado, som e movimento opcional.');
