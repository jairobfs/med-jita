import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import '../source/integrations/uc-engine.js';

const html=readFileSync(new URL('../source/index.html',import.meta.url),'utf8');
const UC=globalThis.MED_UC_ENGINE;
const defaultState=()=>({
  theme:'auto',palette:'aurora',cfg:{cabTheory:'2,6',cabPractice:'1,4',tut:'5',form:'1',cut:'5,75'},
  cab:{mode:'without',split:false},tut:{},form:{},rea:{rule:'exclude'},ava:{},
  uc:{matrix:'2023',period:'7',type:'uct',regime:'rra',instance:'principal',followCohort:true,entries:{}}
});
const sanitizer=html.match(/function sanitizedState\(candidate\)\{[\s\S]*?(?=\nlet state=fresh\()/)?.[0];
assert.ok(sanitizer,'Sanitizador de registros obrigatório');
const context={fresh:defaultState,UC};
vm.createContext(context);
vm.runInContext(sanitizer,context);
const data=defaultState();
data.uc.entries={
  '2023:7:uct':{name:'UCT20',regime:'rea',attendance:'75',grades:{'0:rea':{score:'6,5'}}},
  '2023:7:hp':{name:'HP7',regime:'rra',grades:{'0:pratica':{score:'8'},'0:teorica':{score:'7'},'0:desempenho':{score:'1,6'}}},
  '2023:7:custom':{name:'Modelo próprio',customParts:[{id:'tp',label:'TP',weight:3,kind:'points'},{id:'prova',label:'Prova',weight:7,kind:'score'}],grades:{'0:tp':{score:'2,5'}}},
};
const saved=context.sanitizedState(data);
assert.equal(saved.uc.entries['2023:7:uct'].regime,'rea','REA deve permanecer vinculada à UCT20');
assert.equal(saved.uc.entries['2023:7:hp'].regime,'rra','HP deve manter regime regular separado');
assert.equal(saved.uc.entries['2023:7:custom'].customParts[0].kind,'points');
assert.equal(saved.uc.entries['2023:7:custom'].customParts[0].id,'tp','Identificadores de avaliação precisam sobreviver ao carregamento');

const legacy=defaultState();legacy.uc.regime='rea';legacy.uc.entries={'2023:7:uct':{name:'UCT anterior',grades:{'0:rea':{score:'6,2'}}}};
assert.equal(context.sanitizedState(legacy).uc.entries['2023:7:uct'].regime,'rea',
  'Backups anteriores precisam migrar o regime ativo sem perder a REA');

const dashboard=html.match(/function renderHomeCurriculum\(\)\{[\s\S]*?(?=\nfunction renderUc\()/)?.[0];
assert.ok(dashboard,'Painel longitudinal das UCs obrigatório');
const state=defaultState();state.uc.entries=saved.uc.entries;
state.uc.entries['2023:7:uct:m2']={name:'UCT21',regime:'rra',grades:{'0:tut':{score:'6'},'0:cab':{score:'7'},'0:form':{score:'0,8'}}};
const elements={homeUcGrid:{innerHTML:''},homeCurriculumDescription:{textContent:''}};
const safeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current={state,UC,G:{EPS:1e-10},d:id=>elements[id],fmt:n=>Number(n).toFixed(2).replace('.',','),safeHtml};
vm.createContext(current);
vm.runInContext(dashboard,current);
current.renderHomeCurriculum();
const content=elements.homeUcGrid.innerHTML;
assert.match(content,/UCT20/);
assert.match(content,/data-uc-open="2023:7:uct:m2"/,'O segundo módulo deve abrir seu registro, não o principal');
assert.match(content,/6,50/,'A UCT em REA usa somente a avaliação substitutiva');
assert.match(content,/7,60/,'O resultado de HP7 deve aparecer independentemente da UCT');
assert.match(content,/Modelo próprio/,'Módulos de fórmula livre já salvos aparecem no painel');
assert.match(content,/IESC/,'UCs ainda vazias devem permanecer acessíveis');
assert.match(elements.homeCurriculumDescription.textContent,/7º período/);
assert.match(html,/if\(id==='ucRegime'\)ucEntry\(\)\.regime=state\.uc\.regime/,
  'O seletor de REA precisa persistir no módulo ativo');

console.log('MED JITA: regime por módulo, migração de histórico e painel longitudinal com múltiplas UCs OK.');
