import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(p,'utf8');
const html=read('source/index.html');
const js=read('source/integrations/med-brand-system.js');
const css=read('source/jita-curricular.css');
const engine=read('source/integrations/uc-engine.js');
const build=read('scripts/build-assets.mjs');
new vm.Script(js,{filename:'med-brand-system.js'});
assert.match(html,/jita-curricular\.css\?v=52/);
assert.match(html,/integrations\/med-brand-system\.js\?v=52/);
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

const catalog=JSON.parse(read('source/catalog.json'));
const gallery=read('source/identidade.html');
const serviceWorker=read('source/sw.js');
assert.ok(catalog.modules.length>=16 && catalog.grades.length>=30, 'Galeria curricular incompleta.');
assert.match(gallery,/catalog\.json/,'Galeria deve carregar seu catálogo editável.');
assert.match(build,/identidade\.html/);
assert.match(build,/catalog\.json/);
assert.match(serviceWorker,/integrations\/med-brand-system\.js/);
assert.match(serviceWorker,/jita-curricular\.css/);
assert.match(html,/id="headerProfileMark"/,'Marca no topo deve refletir a pessoa.');
assert.match(html,/id="profileKeyboardMode"/,'Compatibilidade com senhas antigas.');
assert.match(html,/id="profileUnlockPassword"[^>]*inputmode="numeric"/,'iOS numérico por padrão.');
console.log('Biblioteca curricular e tela de login preservadas na versão independente.');

console.log('V52 OK:',declared.moduleIds.length,'identidades de módulo e',declared.gradeIds.length,'de avaliações; fallback personalizado, som e movimento opcional.');
