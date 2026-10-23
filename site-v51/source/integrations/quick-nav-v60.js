/* MED JITA V60 — fast, accessible navigation and real save-status display.
   Never reads, writes, or serializes academic grades or credentials. */
(() => {
  'use strict';
  if (document.getElementById('jitaQuickOpen')) return;

  const actions = Object.freeze([
    { id:'home',label:'Painel geral',desc:'Visão do semestre e notas',tokens:'inicio resumo principal dashboard',type:'page',icon:'⌂' },
    { id:'uc',label:'Minhas UCs',desc:'Módulos, habilidades e períodos',tokens:'materias unidades curriculares disciplinas uc periodo notas',type:'page',icon:'▦' },
    { id:'cab',label:'CAB · Integrado',desc:'Acertos, RC, Macro e Morfo',tokens:'calculadora prova avaliacao acertos macro micro morfo raciocinio',type:'page',icon:'◫' },
    { id:'tut',label:'Tutoria e metas',desc:'Contribuições e média necessária',tokens:'tutoria objetivo meta formativa nota',type:'page',icon:'◎' },
    { id:'sim',label:'Simulações',desc:'Cenários e quanto falta',tokens:'simular cenarios meta simulacao previsao',type:'page',icon:'◈' },
    { id:'history',label:'Meu histórico',desc:'Versões nomeadas e recuperação',tokens:'backup historico arquivo versoes recuperacao',type:'page',icon:'◷' },
    { id:'settings',label:'Critérios e arquivos',desc:'Pesos, aparência e backups',tokens:'ajustes configuracao peso criterios arquivos',type:'button',target:'openSettings',icon:'⚙' },
    { id:'switch',label:'Trocar pessoa',desc:'Voltar aos quatro perfis',tokens:'perfil jairo jbfs barba tay igu sair usuario',type:'button',target:'profileSwitch',icon:'↔' },
    { id:'install',label:'Instalar no iPhone',desc:'Adicionar à tela inicial',tokens:'pwa safari ios iphone instalar adicionar app',type:'button',target:'installApp',icon:'↓' },
    { id:'export',label:'Exportar backup',desc:'Guardar uma cópia do preenchimento',tokens:'exportar download salvar arquivo dados',type:'button',target:'topExport',icon:'⇩' },
    { id:'theme',label:'Mudar aparência',desc:'Alternar tema claro e escuro',tokens:'tema dark mode claro escuro cores',type:'button',target:'themeToggle',icon:'◐' }
  ]);

  const trim = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
  const isEditing = element => element?.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName || '');

  const toolbar = document.querySelector('.topbar .toolbar');
  const themeButton = document.getElementById('themeToggle');
  if (!toolbar || !themeButton) return;

  const launcher=document.createElement('button');
  launcher.type='button';
  launcher.id='jitaQuickOpen';
  launcher.className='icon-btn jita-quick-launch';
  launcher.title='Navegar e localizar funções (⌘K / Ctrl+K)';
  launcher.setAttribute('aria-label','Pesquisar telas e ações do MED JITA');
  launcher.setAttribute('aria-haspopup','dialog');
  launcher.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/></svg><span class="jita-quick-dot" aria-hidden="true"></span>';
  toolbar.insertBefore(launcher,themeButton);

  const dialog=document.createElement('dialog');
  dialog.id='jitaQuickDialog';
  dialog.className='jita-quick-dialog';
  dialog.setAttribute('aria-label','Navegação rápida MED JITA');
  dialog.innerHTML=`
    <div class="jita-quick-surface">
      <div class="jita-quick-head">
        <span class="jita-quick-eyebrow">MED JITA · Acesso rápido</span>
        <button id="jitaQuickClose" type="button" aria-label="Fechar busca" class="jita-quick-close">✕</button>
      </div>
      <label class="jita-quick-field" for="jitaQuickSearch">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.3"/><path d="m16 16 5 5"/></svg>
        <input id="jitaQuickSearch" type="search" placeholder="Buscar página, CAB, histórico..." autocomplete="off" autocapitalize="none" spellcheck="false" aria-controls="jitaQuickList">
        <kbd class="jita-quick-shortcut">ESC</kbd>
      </label>
      <div id="jitaQuickStatus" class="jita-quick-status" role="status" aria-live="polite"></div>
      <div id="jitaQuickList" class="jita-quick-list" role="listbox" aria-label="Páginas e ações disponíveis"></div>
      <div class="jita-quick-foot">↑↓ navegar <span>·</span> Enter abrir <span>·</span> Esc fechar</div>
    </div>`;
  document.body.appendChild(dialog);
  const input=dialog.querySelector('#jitaQuickSearch');
  const list=dialog.querySelector('#jitaQuickList');
  const statusText=dialog.querySelector('#jitaQuickStatus');
  let matching=actions.slice(),index=0,previousFocus=null;

  function signedIn() {
    return document.documentElement.dataset.profileReady==='yes';
  }
  function reflectSync() {
    const source=document.getElementById('accountSyncStatus');
    const message=source?.textContent?.trim() || '';
    const isError=source?.dataset.status==='error';
    const ready=signedIn();
    const value=!ready?'Entre em um perfil para começar.':
      message || 'Pronto para salvar automaticamente.';
    launcher.dataset.syncState=!ready?'idle':isError?'error':
      /salvo|sincronizad|atualizad|conectado/i.test(message)?'saved':'pending';
    launcher.title='Busca rápida · '+value;
    statusText.textContent=value;
    statusText.dataset.state=launcher.dataset.syncState;
  }
  const source=document.getElementById('accountSyncStatus');
  if (source) new MutationObserver(reflectSync).observe(source,{
    childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-status']
  });
  new MutationObserver(reflectSync).observe(document.documentElement,{
    attributes:true,attributeFilter:['data-profile-ready']
  });

  function render() {
    const query=trim(input.value);
    const words=query.split(' ').filter(Boolean);
    matching=actions.filter(action=>!words.length ||
      words.every(word=>trim(action.label+' '+action.desc+' '+action.tokens).includes(word)));
    index=0;
    list.replaceChildren();
    if (!matching.length) {
      const empty=document.createElement('p');
      empty.className='jita-quick-empty';
      empty.textContent='Nenhum resultado. Tente “CAB”, “histórico”, “UC” ou “tema”.';
      list.appendChild(empty);
      return;
    }
    matching.forEach((action,i)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='jita-quick-item';
      button.dataset.command=action.id;
      button.dataset.selected=String(i===index);
      button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(i===index));
      const glyph=document.createElement('span');
      glyph.className='jita-quick-glyph';
      glyph.setAttribute('aria-hidden','true');
      glyph.textContent=action.icon;
      const copy=document.createElement('span');
      copy.className='jita-quick-copy';
      const title=document.createElement('strong');title.textContent=action.label;
      const subtitle=document.createElement('small');subtitle.textContent=action.desc;
      copy.append(title,subtitle);
      const arrow=document.createElement('span');
      arrow.className='jita-quick-arrow';arrow.textContent='↗';
      arrow.setAttribute('aria-hidden','true');
      button.append(glyph,copy,arrow);
      button.addEventListener('click',()=>activate(action));
      list.appendChild(button);
    });
  }

  function highlight(next) {
    if(!matching.length)return;
    index=(next+matching.length)%matching.length;
    for(const [i,button] of [...list.querySelectorAll('.jita-quick-item')].entries()){
      button.dataset.selected=String(i===index);
      button.setAttribute('aria-selected',String(i===index));
      if(i===index)button.scrollIntoView({block:'nearest',behavior:'instant'});
    }
  }
  function activate(action) {
    if(!signedIn())return;
    dialog.close();
    if(action.type==='page') {
      const target=document.querySelector('.side-nav [data-page="'+action.id+'"]') ||
        document.querySelector('[data-page="'+action.id+'"]');
      target?.click();
    } else {
      document.getElementById(action.target)?.click();
    }
  }
  function open() {
    if(!signedIn())return;
    if(dialog.open)return;
    previousFocus=document.activeElement;
    input.value='';
    reflectSync();
    render();
    dialog.showModal();
    input.focus({preventScroll:true});
  }
  launcher.addEventListener('click',open);
  dialog.querySelector('#jitaQuickClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>previousFocus?.focus?.({preventScroll:true}));
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{
    // On iPhone/Chrome, Escape first clears a search field rather than
    // closing its native dialog. Give the explicit app close priority.
    if(event.key==='Escape') {
      event.preventDefault();dialog.close();return;
    }
    if(event.key==='ArrowDown'||event.key==='ArrowUp') {
      event.preventDefault();highlight(index+(event.key==='ArrowDown'?1:-1));
    }
    if(event.key==='Enter') {
      event.preventDefault();
      if(matching[index])activate(matching[index]);
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.altKey)return;
    const key=event.key.toLowerCase();
    if((event.ctrlKey||event.metaKey)&&key==='k') {
      event.preventDefault();if(dialog.open)dialog.close();else open();
    }else if(event.key==='/'&&!isEditing(event.target)&&!dialog.open&&signedIn()) {
      event.preventDefault();open();
    }
  });
  reflectSync();
})();
