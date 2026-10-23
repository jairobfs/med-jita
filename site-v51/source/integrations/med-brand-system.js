/* MED JITA · Identidade curricular dinâmica · v52
 * Vector geometry authored for modules/grade components.
 * Keeps the original Jita artwork entirely untouched.
 */
(()=>{
  'use strict';
  const MODULES={
    uct:['UCT','Transversal','#0AA5AD','M3 12h5l4-10 4 6 3-6 4 10 5-7'],
    hp:['HP','Habilidades Profissionais','#347CBE','M8 3v6a4 4 0 0 0 8 0V3M6 3h4m4 0h4M12 13v2a5 5 0 0 0 10 0v-2m0-1a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
    'hp-cir':['HP-CIR','Técnicas Cirúrgicas','#347CBE','M5 20 19 6M5 6l13 13M4 4l4 4m8 8 4 4M18 5l2-2M5 18l-2 2'],
    'hp-us':['HP-US','Ultrassonografia','#347CBE','M4 6v12h16V6M7 10q5-6 10 0q-5 6-10 0M7 15h10'],
    iesc:['IESC','Saúde Coletiva','#1E7B48','M3 12 12 4l9 8M6 10v10h12V10M9 15h6M12 12v6'],
    ugc:['UGC','Conhecimento Integrado','#7356BD','M12 3a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5M12 13v8m-5-4h10'],
    uce:['UCE','Extensão','#1E7B48','M4 16V8l8-5 8 5v8l-8 5-8-5M9 10h6m-3-3v6'],
    ucf:['UCF','Fundamentos','#0AA5AD','M4 6h16M4 12h16M4 18h16M8 4v16m8-16v16'],
    ucm:['UCM','Sistemas Médicos','#7356BD','M12 3v5m0 8v5M3 12h5m8 0h5M8 8l8 8M16 8l-8 8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
    ude:['UDE','Desenvolvimento','#A86B18','M4 20h16M5 18l5-6 4 3 5-10m-6 0h6v6'],
    era:['ERA','Raciocínio e Aprendizagem','#7356BD','M4 18h16M7 14l5-10 5 10-5 6-5-6m0 0h10'],
    ap:['AP','Atividade Prática','#347CBE','M12 20v-5m-5 0a5 5 0 0 1 10 0v5M5 8a7 7 0 0 1 14 0M8 8v2m8-2v2'],
    'ap-cir':['AP-CIR','Prática Cirúrgica','#347CBE','M12 3v18M3 12h18M7 7l10 10M17 7 7 17'],
    'ap-us':['AP-US','Prática em Ultrassom','#347CBE','M5 4h14v16H5zM8 8q4-3 8 0m-8 4q4-3 8 0m-8 4h8'],
    aesc:['AESC','Comunidade','#1E7B48','M12 20s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
    internato:['INT','Internato','#B93845','M8 3h8v5h5v13H3V8h5zM8 3v6h8V3M12 12v6m-3-3h6'],
    eletivo:['ELE','Eletivo','#A86B18','M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z'],
    custom:['UC','Módulo personalizado','#0AA5AD','M3 6h18M6 3v18M12 3v18M18 3v18M3 18h18']
  };
  const GRADES={
    b1:['1º bimestre','M4 6h16v12H4zM8 10h8m-5-2v8'],
    b2:['2º bimestre','M4 6h16v12H4zM8 10h8m-7 3h6m-6 3h6'],
    c1:['Cognitiva I','M6 5h12v14H6zM9 9h6m-6 4h4m-4 3h6'],
    c2:['Cognitiva II','M6 5h12v14H6zM9 9h6m-6 4h6m-6 3h4'],
    tut:['Tutoria','M4 5h16v13H4zM8 9h8m-8 4h8m-8 3h5'],
    cab:['CAB','M4 7h16v12H4zM8 4v6m8-6v6M8 14h8m-8 3h5'],
    form:['Formativa','M12 3 15 9l7 3-7 3-3 7-3-7-7-3 7-3z'],
    pic:['Intervenção','M4 18l5-5 4 3 6-9m-5 0h5v5M3 21h18'],
    tp:['Teste de progresso','M3 20h18M6 16l4-6 4 3 4-9m-4 0h4v4'],
    ir:['Reflexão','M12 3a8 8 0 0 1 0 16m0-16a8 8 0 0 0 0 16M8 8h8m-4 0v8'],
    semi:['Semiologia','M12 20v-7m-5 0a5 5 0 0 1 10 0v7M8 4v7m8-7v7'],
    gr:['Global Rating','M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'],
    pratica:['Prática','M4 20h16M6 16l6-12 6 12m-10-3h8'],
    info:['Informação','M4 6h16v14H4zM8 11h8m-8 4h6'],
    interp:['Interpessoal','M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6M5 20v-2a7 7 0 0 1 14 0v2'],
    teorica:['Teórica','M5 3h14v18H5zM9 8h6m-6 4h6m-6 4h4'],
    pacientes:['Pacientes simulados','M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6M16 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6M3 20a5 5 0 0 1 10 0m-2 0a5 5 0 0 1 10 0'],
    desempenho:['Desempenho','M5 18l5-5 3 3 6-9M5 21h14'],
    integral:['Avaliação integrada','M12 3v18M3 12h18m-15-6 12 12m0-12-12 12'],
    ave1:['AVE I','M4 6h16v12H4zM8 13l3 3 5-7'],
    ave2:['AVE II','M4 6h16v12H4zM8 11l2 3 2-4 2 4 2-3'],
    tbl1:['TBL I','M4 5h16v14H4zM8 9h8M8 13h8M8 17h5'],
    tbl2:['TBL II','M4 5h16v14H4zM8 9h8M8 13h5m-5 4h8'],
    reaave:['Recuperação AVE','M20 8a8 8 0 1 0 1 5M20 3v5h-5M9 15l3-6 3 6'],
    reatbl:['Recuperação TBL','M20 8a8 8 0 1 0 1 5M9 9h6m-3 0v6'],
    rea:['Recuperação','M20 8a8 8 0 1 0 1 5M20 3v5h-5M8 12h8'],
    cognitiva:['Cognição','M9 5a4 4 0 1 0 0 8M15 5a4 4 0 1 1 0 8M9 13v5m6-5v5M6 18h12'],
    servico:['Serviço','M3 10h18M7 7V4h10v3M5 10v10h14V10m-9 4h4m-2-2v4'],
    item1:['Componente I','M5 5h14v14H5zM9 9h6m-3-2v10'],
    item2:['Componente II','M5 5h14v14H5zM9 9h6m-6 3h6m-6 3h6']
  };
  const SIZE=24;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function initials(label){return String(label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase().slice(0,2)||'UC';}
  function icon(kind,label,scope){
    const item=scope==='module'?MODULES[kind]:GRADES[kind];
    const unknown=!item;
    const art=item?(scope==='module'?item[3]:item[1]):'M5 5h14v14H5z';
    const color=scope==='module'?(item?.[2]||'#0AA5AD'):'var(--brand2,#0AA5AD)';
    const monogram=unknown?'<text x="12" y="15.1" text-anchor="middle" font-size="7.1" font-weight="850" fill="currentColor" stroke="none">'+esc(initials(label))+'</text>':'';
    return '<svg class="med-curricular-mark" viewBox="0 0 24 24" width="'+SIZE+'" height="'+SIZE+'" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="'+esc(label)+'"><path d="'+art+'"/>'+monogram+'</svg>';
  }
  function seal(scope,kind,label){
    const outer=document.createElement('span');
    outer.className='med-identity-seal med-identity-'+scope;
    outer.style.setProperty('--identity-accent',scope==='module'?(MODULES[kind]?.[2]||'#0AA5AD'):'var(--brand2,#0AA5AD)');
    outer.innerHTML=icon(kind,label,scope);
    outer.setAttribute('aria-hidden','true');
    return outer;
  }
  function apply(){
    for(const card of document.querySelectorAll('.home-uc-card[data-uc-open]')){
      const key=card.getAttribute('data-uc-open')||'';
      const kind=key.split(':')[2]||'custom';
      const target=card.querySelector('.home-uc-card-top strong');
      if(target&&!target.querySelector('.med-identity-seal'))target.prepend(seal('module',kind,MODULES[kind]?.[1]||'UC personalizada'));
    }
    for(const card of document.querySelectorAll('.uc-component')){
      const target=card.querySelector('.uc-component-head h3');
      if(!target||target.querySelector('.med-identity-seal'))continue;
      const gradeField=card.querySelector('[data-uc-score],[data-uc-hits],[data-uc-total]');
      const track=gradeField?.getAttribute('data-uc-score')||gradeField?.getAttribute('data-uc-hits')||gradeField?.getAttribute('data-uc-total')||'';
      const kind=track.split(':').at(-1)||'custom';
      target.prepend(seal('grade',kind,GRADES[kind]?.[0]||target.textContent));
    }
    const current=document.querySelector('#ucCurrentName');
    const type=document.querySelector('#ucType');
    if(current&&type){
      const kind=type.value;
      const stamp=current.querySelector('.med-identity-seal');
      if(stamp?.dataset.kind!==kind){stamp?.remove();const node=seal('module',kind,MODULES[kind]?.[1]||type.selectedOptions[0]?.textContent||'UC');node.dataset.kind=kind;current.prepend(node);}
    }
  }
  let queued=false;
  function queueApply(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  }
  const watch=new MutationObserver(records=>{
    if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('med-identity-seal'))||r.type==='characterData'))queueApply();
  });
  watch.observe(document.body,{childList:true,subtree:true,characterData:true});
  apply();

  /* Sound is off until a person explicitly enables it. This never touches grade/profile storage. */
  const AUDIO_KEY='med_jita_audio_optin_v1';
  let enabled=false,ctx=null;
  try{enabled=localStorage.getItem(AUDIO_KEY)==='on';}catch{}
  const audioButtons=[];
  function updateButtons(){
    for(const b of audioButtons){b.setAttribute('aria-pressed',String(enabled));b.setAttribute('aria-label',enabled?'Desativar sons do Jita':'Ativar sons do Jita');b.title=enabled?'Desativar sons':'Ativar sons';b.classList.toggle('is-on',enabled);}
  }
  function play(tone='tap'){
    if(!enabled)return;
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    try{
      ctx=ctx||new C();
      if(ctx.state==='suspended')void ctx.resume();
      const now=ctx.currentTime,notes=tone==='success'?[[660,0],[880,.085]]:tone==='jita'?[[523,0],[659,.09],[784,.18]]:[[540,0]];
      for(const [hz,delay] of notes){
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(hz,now+delay);
        gain.gain.setValueAtTime(.0001,now+delay);
        gain.gain.exponentialRampToValueAtTime(.065,now+delay+.012);
        gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.13);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now+delay);osc.stop(now+delay+.14);
      }
    }catch{}
  }
  function makeToggle(mobile){
    const b=document.createElement('button');
    b.type='button';b.className=mobile?'jita-audio-toggle gateway-audio-toggle':'icon-btn jita-audio-toggle';
    b.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="jita-sound-wave" d="M17 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></svg>';
    b.addEventListener('click',event=>{event.stopPropagation();enabled=!enabled;try{localStorage.setItem(AUDIO_KEY,enabled?'on':'off');}catch{}updateButtons();if(enabled)play('success');});
    audioButtons.push(b);updateButtons();return b;
  }
  const toolbar=document.querySelector('.topbar .toolbar');
  const theme=document.querySelector('#themeToggle');
  if(toolbar){const b=makeToggle(false);toolbar.insertBefore(b,theme||toolbar.firstChild);}
  const coverActions=document.querySelector('#page-home .cover-actions');
  if(coverActions)coverActions.appendChild(makeToggle(true));
  const gatewayIntro=document.querySelector('.gateway-intro');
  const motionButton=document.querySelector('#gatewayMotionToggle');
  if(gatewayIntro){
    const wrapper=document.createElement('div');wrapper.className='jita-audio-tools';
    wrapper.appendChild(makeToggle(true));
    const voice=document.createElement('button');voice.type='button';voice.className='jita-voice-button';
    voice.textContent='Ouvir o Jita';voice.setAttribute('aria-label','Ouvir apresentação do Jita em voz alta');
    if(!('speechSynthesis' in window))voice.hidden=true;
    voice.addEventListener('click',()=>{
      if(!window.speechSynthesis)return;
      window.speechSynthesis.cancel();
      const greeting=new SpeechSynthesisUtterance('Olá! Eu sou o Jita. Vamos organizar suas notas e descobrir seus próximos passos.');
      greeting.lang='pt-BR';greeting.rate=.97;greeting.pitch=1.12;
      const voices=window.speechSynthesis.getVoices();
      const voicePt=voices.find(v=>v.lang.toLowerCase()==='pt-br')||voices.find(v=>v.lang.toLowerCase().startsWith('pt'));
      if(voicePt)greeting.voice=voicePt;
      window.speechSynthesis.speak(greeting);
    });
    wrapper.appendChild(voice);
    if(motionButton)motionButton.insertAdjacentElement('afterend',wrapper);else gatewayIntro.appendChild(wrapper);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('.jita-audio-toggle,.jita-voice-button'))return;
    const active=event.target.closest('.jita-reactive');
    if(active){play('jita');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(let i=0;i<5;i++){const sparkle=document.createElement('i');sparkle.className='jita-sonic-spark';sparkle.style.setProperty('--spark-angle',i*72+'deg');sparkle.style.setProperty('--spark-delay',i*30+'ms');active.appendChild(sparkle);setTimeout(()=>sparkle.remove(),850);}
    }return;}
    if(event.target.closest('[data-uc-open],.uc-switch button,[data-page],.profile-choice'))play('tap');
    else if(event.target.closest('#profileUnlockButton,#saveSettings,[data-uc-save]'))play('success');
  },{passive:true});
  document.addEventListener('change',event=>{if(event.target.matches('[data-uc-score],[data-uc-hits],[data-uc-total]'))play('success');});
  window.MED_JITA_BRAND_SYSTEM=Object.freeze({moduleIds:Object.keys(MODULES),gradeIds:Object.keys(GRADES),version:'52'});
})();