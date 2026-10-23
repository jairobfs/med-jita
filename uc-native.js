/* MED JITA · UCs do motor V51 dentro da calculadora oficial.
 * Não abre segunda autenticação nem envia dados à Vercel.
 * Mantém o mesmo estado V3 que a sessão do Craft sincroniza.
 */
(() => {
  'use strict';
  const ENGINE=window.MED_UC_ENGINE;
  if(!ENGINE || document.getElementById('mjuc-open'))return;
  const KEY='med_jita_state_v3';
  const safeState=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x?.version===3?x:null}catch{return null}};
  const fallback=()=>({matrix:'2023',period:'7',type:'uct',regime:'rra',instance:'principal',followCohort:false,entries:{}});
  const ucState=()=>{const o=safeState()?.uc;return o&&typeof o==='object'?{...fallback(),...o,entries:o.entries&&typeof o.entries==='object'?o.entries:{}}:fallback()};
  const ucKey=u=>[u.matrix,u.period,u.type].join(':')+(u.instance==='principal'?'':':'+u.instance);
  const el=(tag,props={},children=[])=>{const node=document.createElement(tag);for(const [key,val] of Object.entries(props)){if(key==='text')node.textContent=val;else if(key==='class')node.className=val;else if(key==='htmlFor')node.htmlFor=val;else if(key.startsWith('data-'))node.setAttribute(key,val);else node[key]=val}for(const x of children)node.append(x);return node};
  const options=(select,arr,value)=>{select.replaceChildren();arr.forEach(([id,name])=>select.add(el('option',{value:String(id),text:name})));select.value=String(value)};
  const label=(text,id)=>el('label',{text,htmlFor:id,class:'mjuc-label'});
  const field=(text,id,control)=>el('div',{class:'mjuc-field'},[label(text,id),control]);
  const input=(id,value,opts={})=>el('input',{id,value:String(value??''),type:'text',inputMode:opts.numeric?'numeric':'decimal',maxLength:20,autocomplete:'off',placeholder:opts.placeholder||'—',...opts.props});
  const caption=(msg)=>el('p',{class:'mjuc-caption',text:msg});
  const pretty=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const app=el('div',{id:'mjuc-shell'});
  const trigger=el('button',{id:'mjuc-open',type:'button',text:'Minhas UCs',title:'Abrir módulos curriculares'});
  const screen=el('section',{id:'mjuc-panel',class:'mjuc-panel',role:'dialog','aria-modal':'true','aria-label':'Minhas UCs'});
  screen.hidden=true;
  const content=el('div',{class:'mjuc-content'});
  screen.append(content);app.append(trigger,screen);document.body.append(app);
  const style=el('link',{rel:'stylesheet',href:'./uc-native.css'});document.head.append(style);
  let memo=null;
  const persist=u=>{
    const saved=safeState();
    if(!saved)return false;
    saved.uc=u;
    try{localStorage.setItem(KEY,JSON.stringify(saved));return true}catch{return false}
  };
  const selection=()=>memo||ucState();
  const entryOf=u=>u.entries[ucKey(u)]||{name:'',attendance:'',tracks:1,grades:{},regime:u.regime};
  function resultBody(u,template,entry){
    const outcome=ENGINE.evaluate(template,entry,entry.regime||u.regime);
    const results=el('div',{class:'mjuc-results',id:'mjuc-results','aria-live':'polite'});
    if(outcome.completion){results.append(el('strong',{text:'Estágio por cumprimento, sem média numérica'}),caption('Registre a carga horária conforme a documentação oficial da atividade.'));return results}
    if(!outcome.valid){results.append(el('strong',{text:'Corrigir os lançamentos'}),caption(outcome.error));return results}
    if(outcome.missing===outcome.parts.length){results.append(el('strong',{text:'Nenhuma nota lançada'}),caption('Campos vazios significam notas pendentes, nunca zero.'));return results}
    results.append(el('strong',{text:outcome.complete?('Média '+pretty(outcome.known)+' / 10'):('Parcial '+pretty(outcome.known)+' / 10')}));
    if(!outcome.complete)results.append(caption('Máximo possível com pendências: '+pretty(outcome.maximum)+' / 10'));
    if(outcome.complete){
      const msg=outcome.passing?(outcome.attendance===null?'Nota suficiente; frequência pendente':outcome.attendanceOk?'Nota e frequência atendidas':'Frequência abaixo do mínimo'):'Pontuação abaixo do mínimo informado no motor.';
      results.append(caption(msg));
    }
    if(outcome.target?.possible&&!outcome.complete)results.append(caption('Meta na avaliação pendente: '+pretty(outcome.target.grade)+' / 10 ('+outcome.target.label+').'));
    return results;
  }
  const gradeField=(part,idx,track,entry)=>{
    const key=track+':'+part.id,grade=entry.grades?.[key]||{mode:'score',score:'',hits:'',total:''};
    const row=el('div',{class:'mjuc-grade-row'});
    row.append(el('div',{class:'mjuc-grade-title'},[el('strong',{text:part.label}),el('span',{text:'Peso '+pretty(part.weight)})]));
    if(part.kind==='points'){
      const score=input('mjuc-points-'+idx,grade.score,{placeholder:'Pontos de '+pretty(part.weight)});
      score.setAttribute('data-grade',key);score.setAttribute('data-key','score');
      row.append(field('Pontos obtidos',score.id,score));return row;
    }
    const mode=el('select',{id:'mjuc-mode-'+idx});
    options(mode,[['score','Nota (0 a 10)'],['hits','Acertos / questões']],grade.mode||'score');
    mode.setAttribute('data-grade',key);mode.setAttribute('data-key','mode');
    row.append(field('Formato',mode.id,mode));
    if(grade.mode==='hits'){
      const hits=input('mjuc-hits-'+idx,grade.hits,{numeric:true,placeholder:'Acertos'});
      const total=input('mjuc-total-'+idx,grade.total,{numeric:true,placeholder:'Questões'});
      for(const [node,keyName] of [[hits,'hits'],[total,'total']]){node.setAttribute('data-grade',key);node.setAttribute('data-key',keyName)}
      row.append(el('div',{class:'mjuc-two'},[field('Acertos',hits.id,hits),field('Questões',total.id,total)]));
    }else{
      const score=input('mjuc-score-'+idx,grade.score,{placeholder:'Ex.: 7,5'});
      score.setAttribute('data-grade',key);score.setAttribute('data-key','score');
      row.append(field('Nota / 10',score.id,score));
    }
    return row;
  };
  function render(){
    const u=selection(),list=ENGINE.templates(u.matrix,u.period);
    if(!list.length){content.replaceChildren(caption('Selecione uma matriz e período válidos.'));return}
    if(!list.some(t=>t.id===u.type))u.type=list[0].id;
    const template=list.find(t=>t.id===u.type),entry=entryOf(u);
    const head=el('header',{class:'mjuc-head'},[
      el('div',{},[el('span',{class:'mjuc-eyebrow',text:'MED JITA · CURRÍCULO'}),el('h2',{text:'Minhas UCs'})]),
      el('button',{id:'mjuc-close',type:'button',text:'Fechar','aria-label':'Fechar módulos curriculares'})
    ]);
    const controls=el('div',{class:'mjuc-controls'});
    const matrix=el('select',{id:'mjuc-matrix'});options(matrix,[['2023','Matriz 2023'],['2024','Matriz 2024'],['2025','Matriz 2025']],u.matrix);
    const period=el('select',{id:'mjuc-period'});options(period,Array.from({length:12},(_,i)=>[i+1,(i+1)+'º período']),u.period);
    const typ=el('select',{id:'mjuc-type'});options(typ,list.map(t=>[t.id,t.label]),u.type);
    const regime=el('select',{id:'mjuc-regime'});options(regime,[['rra','RRA · avaliação regular'],['rea','REA · recuperação']],entry.regime||u.regime);
    const instance=el('select',{id:'mjuc-instance'});options(instance,[['principal','Módulo principal'],['m2','Outro módulo 2'],['m3','Outro módulo 3'],['m4','Outro módulo 4']],u.instance);
    controls.append(field('Matriz',matrix.id,matrix),field('Período',period.id,period),field('Unidade curricular',typ.id,typ),field('Situação',regime.id,regime),field('Registro',instance.id,instance));
    const main=el('div',{class:'mjuc-main'},[el('h3',{text:template.label}),caption(template.article+' · pesos conforme o modelo curricular cadastrado')]);
    if(template.notice)main.append(caption(template.notice));
    const attendance=input('mjuc-attendance',entry.attendance,{placeholder:'0 a 100'});
    main.append(field('Frequência (%)',attendance.id,attendance));
    if(!template.completion){
      const trackCount=template.tracks?Math.min(8,Math.max(1,Number(entry.tracks)||1)):1;
      if(template.tracks){const tracks=el('select',{id:'mjuc-tracks'});options(tracks,Array.from({length:8},(_,i)=>[i+1,(i+1)+' trilha(s)']),trackCount);main.append(field('Trilhas avaliativas',tracks.id,tracks))}
      const parts=(entry.regime||u.regime)==='rea'?(template.reaComponents||[{id:'rea',label:'Avaliação de recuperação',weight:10,kind:'score'}]):(template.custom&&entry.customParts?.length?entry.customParts:template.components);
      for(let track=0,idx=0;track<trackCount;track++){
        if(trackCount>1)main.append(el('h4',{text:'Trilha '+(track+1),class:'mjuc-track'}));
        for(const part of parts)main.append(gradeField(part,idx++,track,entry));
      }
    }
    main.append(resultBody(u,template,entry));
    content.replaceChildren(head,controls,main,el('footer',{class:'mjuc-footer',text:'Salvamento automático no mesmo perfil MED JITA · sem novo login'}));
    content.querySelector('#mjuc-close').onclick=close;
    for(const [id,key] of [['mjuc-matrix','matrix'],['mjuc-period','period'],['mjuc-type','type'],['mjuc-instance','instance']]){
      content.querySelector('#'+id).onchange=ev=>{
        u[key]=ev.target.value;
        if(key==='matrix'||key==='period'){const options=ENGINE.templates(u.matrix,u.period);u.type=options[0]?.id||'custom'}
        memo=u;persist(u);render();
      };
    }
    regime.onchange=ev=>{const e=entryOf(u);e.regime=ev.target.value;u.entries[ucKey(u)]=e;u.regime=ev.target.value;memo=u;persist(u);render()};
    const tracks=content.querySelector('#mjuc-tracks');
    if(tracks)tracks.onchange=ev=>{const e=entryOf(u);e.tracks=Number(ev.target.value);u.entries[ucKey(u)]=e;memo=u;persist(u);render()};
    attendance.oninput=ev=>edit(u,e=>{e.attendance=ev.target.value},false);
    for(const ctrl of content.querySelectorAll('[data-grade]')){
      const editGrade=()=>{
        const key=ctrl.getAttribute('data-grade'),fieldKey=ctrl.getAttribute('data-key');
        edit(u,e=>{e.grades||={};e.grades[key]||={mode:'score',score:'',hits:'',total:''};e.grades[key][fieldKey]=ctrl.value},fieldKey==='mode');
      };
      ctrl.addEventListener(ctrl.tagName==='SELECT'?'change':'input',editGrade);
    }
  }
  function edit(u,mutate,rerender){
    const e=entryOf(u);mutate(e);u.entries[ucKey(u)]=e;memo=u;
    if(!persist(u)){content.querySelector('#mjuc-results')?.replaceChildren(caption('Não foi possível salvar neste aparelho.'));return}
    if(rerender){render();return}
    const template=ENGINE.findTemplate(u.matrix,u.period,u.type),current=content.querySelector('#mjuc-results');
    if(current)current.replaceWith(resultBody(u,template,e));
  }
  const open=()=>{memo=ucState();screen.hidden=false;trigger.hidden=true;render();screen.querySelector('#mjuc-close')?.focus()};
  function close(){screen.hidden=true;trigger.hidden=false;memo=null;trigger.focus()}
  trigger.onclick=open;
  screen.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
