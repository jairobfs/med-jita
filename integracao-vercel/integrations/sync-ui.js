/* MED JITA · Four-profile sign-in, server sessions, autosave, Craft mirror. */
(() => {
  'use strict';
  const BRIDGE=window.MED_JITA_BRIDGE;
  if(!BRIDGE)return;
  const KEY='med_jita_state_v3',HISTORY='med_jita_history_v1',USER_CACHE='med_jita_usercache_v1_',MIGRATION='med_jita_original_cache_v1';
  const $$=(q,p=document)=>p.querySelector(q);
  const $=$$; // Legacy selector alias for login and status controls.
  const escape=s=>String(s).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  let user=null,revision=null,remoteSaving=false,pending=false,writeTimer=null,lastDigest='',errorCount=0,visibleProfiles=[],selected=null;
  let overlay=null,profileBadge=null,remoteStatus=null;
  const themeCSS=String.raw`
    #mj-login{position:fixed;inset:0;z-index:100000;overflow:auto;background:radial-gradient(circle at 16% 12%,#d3f3ed 0%,transparent 36%),radial-gradient(circle at 86% 84%,#e3eefa 0%,transparent 40%),#f2f7f7;color:#17393a;display:grid;place-items:center;padding:22px 16px;padding-bottom:max(28px,env(safe-area-inset-bottom));font-family:inherit}
    #mj-login[hidden]{display:none}
    #mj-login .mj-panel{width:min(100%,540px);border:1px solid #d1e4e3;background:rgba(255,255,255,.96);border-radius:28px;box-shadow:0 24px 90px #0f464323;padding:31px 28px 25px;position:relative;overflow:hidden}
    #mj-login .mj-panel:before{content:"";position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,#0aa5ad,#56c9c7,#102d3c)}
    #mj-login .mj-logo{display:block;max-width:240px;width:73%;height:auto;margin:5px auto 17px;object-fit:contain}
    #mj-login .mj-eyebrow{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#08786f;font-weight:800;text-align:center}
    #mj-login h1{margin:7px 0 6px;text-align:center;font-size:clamp(24px,6vw,30px);letter-spacing:-.045em;line-height:1.1;color:inherit}
    #mj-login .mj-sub{font-size:13px;color:#507372;text-align:center;line-height:1.6;margin:0 auto 22px;max-width:360px}
    #mj-login .mj-users{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    #mj-login .mj-user{border:1px solid #d8e8e7;border-radius:18px;background:#f9fdfb;padding:17px 12px;display:flex;gap:12px;align-items:center;text-align:left;min-height:90px;color:inherit;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}
    #mj-login .mj-user:hover,#mj-login .mj-user:focus-visible{border-color:#007d87;transform:translateY(-2px);outline-offset:2px}
    #mj-login .mj-user[aria-pressed="true"]{background:#e1f4f1;border-color:#0aa5ad;box-shadow:inset 0 0 0 1px #0aa5ad}
    #mj-login .mj-user:disabled{opacity:.45;cursor:not-allowed;transform:none}
    #mj-login .mj-avatar{width:45px;height:45px;flex:none;border-radius:15px;display:grid;place-items:center;background:#0a5860;color:#fff;font-size:13px;font-weight:800;letter-spacing:-.04em}
    #mj-login .mj-user:nth-child(2) .mj-avatar{background:#395783}#mj-login .mj-user:nth-child(3) .mj-avatar{background:#7b555e}#mj-login .mj-user:nth-child(4) .mj-avatar{background:#8a681f}
    #mj-login .mj-name{font-weight:800;display:block;font-size:15px}
    #mj-login .mj-hint{display:block;font-size:11px;color:#688381;margin-top:3px}
    #mj-login .mj-auth{margin-top:17px;border-top:1px solid #dceae7;padding-top:17px}
    #mj-login label{font-size:12px;font-weight:750;display:block;margin-bottom:6px}
    #mj-login input{height:48px;width:100%;border:1px solid #bad8d5;border-radius:13px;padding:0 13px;color:#153b3b;background:white;font:inherit;font-size:13px;outline:none}
    #mj-login input:focus{border-color:#007d87;box-shadow:0 0 0 3px #56c9c73d}
    #mj-login .mj-action{width:100%;border:0;border-radius:13px;background:#007d87;color:#fff;min-height:48px;font:inherit;font-weight:800;cursor:pointer;margin-top:12px;box-shadow:0 10px 23px #007d8730}
    #mj-login .mj-action:disabled{opacity:.5;cursor:wait}
    #mj-login .mj-error{min-height:18px;margin-top:9px;font-size:12px;color:#a42d42;text-align:center}
    #mj-login .mj-foot{margin:14px 0 0;text-align:center;font-size:11px;color:#627f7e}
    #mj-profile-badge{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border,#d6e4e4);border-radius:999px;padding:4px 8px;background:var(--card-soft,#fff);font-size:11px;line-height:1.3;color:var(--text,#183b3a)}
    #mj-profile-badge strong{font-size:11px}
    #mj-profile-badge button{border:0;background:transparent;cursor:pointer;color:var(--secondary,#446);font-size:10px;text-decoration:underline;padding:4px}
    #mj-remote-status{padding:13px 15px;border:1px solid var(--border,#ccc);background:var(--card-soft,#fff);border-radius:13px;font-size:12px;line-height:1.55;color:var(--secondary,#556)}
    #mj-remote-status[data-kind="ok"]{border-left:3px solid #1e7b48}#mj-remote-status[data-kind="warn"]{border-left:3px solid #a86b18}#mj-remote-status[data-kind="error"]{border-left:3px solid #b93845}
    @media(max-width:510px){#mj-login{padding:13px 11px;padding-bottom:max(20px,env(safe-area-inset-bottom))}#mj-login .mj-panel{padding:27px 17px 23px;border-radius:23px}#mj-login .mj-users{gap:9px}#mj-login .mj-user{padding:14px 10px;gap:9px;min-height:83px}#mj-login .mj-avatar{width:39px;height:41px}#mj-profile-badge{max-width:156px;overflow:hidden}#mj-profile-badge button{font-size:10px}}
    :root[data-theme=dark] #mj-login{background:radial-gradient(circle at 18% 12%,#11414b 0%,transparent 39%),radial-gradient(circle at 90% 87%,#173045 0%,transparent 40%),#071923;color:#e7f5ef}
    :root[data-theme=dark] #mj-login .mj-panel{background:#102a32;border-color:#28535a;box-shadow:0 25px 70px #0008}
    :root[data-theme=dark] #mj-login .mj-sub,:root[data-theme=dark] #mj-login .mj-foot,:root[data-theme=dark] #mj-login .mj-hint{color:#accbc6}
    :root[data-theme=dark] #mj-login .mj-eyebrow{color:#60d6c8}
    :root[data-theme=dark] #mj-login .mj-user{background:#173741;border-color:#28565b}
    :root[data-theme=dark] #mj-login .mj-user[aria-pressed="true"]{background:#1b5255;border-color:#56c9c7}
    :root[data-theme=dark] #mj-login .mj-auth{border-color:#28565b}
    :root[data-theme=dark] #mj-login input{background:#0b222d;color:#edf9f5;border-color:#2e5c61}
    :root[data-theme=dark] #mj-login .mj-action{background:#0aa5ad;color:#061a1d}
    :root[data-theme=dark] #mj-login .mj-logo{filter:brightness(0) invert(1);opacity:.95}
    @media(prefers-reduced-motion:reduce){#mj-login .mj-user{transition:none}}
  `;
  const style=document.createElement('style');style.textContent=themeCSS;document.head.appendChild(style);
  const oldPane=$$('#syncPane');if(oldPane){oldPane.innerHTML='<div id="mj-remote-status" aria-live="polite">Conectando seu perfil…</div>';remoteStatus=$$('#mj-remote-status')}
  const subtitle=$$('#page-history .page-head p.eyebrow');if(subtitle)subtitle.textContent='Histórico individual · sincronização automática';
  const sideInfo=$$('.side-footer > div:nth-child(2)');if(sideInfo)sideInfo.textContent='Histórico individual salvo automaticamente online. Cópia local de segurança.';
  overlay=document.createElement('div');overlay.id='mj-login';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Entrar no MED JITA');
  overlay.innerHTML='<div class="mj-panel"><img class="mj-logo" src="/assets/med-jita-logo.svg" alt="MED JITA — identidade original"><div class="mj-eyebrow">Sua calculadora, suas notas</div><h1>Quem é você?</h1><p class="mj-sub">Escolha seu perfil e entre com seu código individual. Depois, o Jita cuida do histórico automaticamente.</p><div class="mj-users" id="mj-users"></div><form class="mj-auth" id="mj-auth" hidden><label for="mj-code">Código de acesso de <span id="mj-selected"></span></label><input id="mj-code" name="accessCode" type="password" autocomplete="one-time-code" spellcheck="false" autocapitalize="off" required maxlength="120" placeholder="Seu código de acesso"><div id="mj-password-extra" hidden><label for="mj-history-password" style="margin-top:12px">Senha opcional do histórico</label><input id="mj-history-password" type="password" autocomplete="current-password" maxlength="120" placeholder="Definida pelo JBFS no Craft"></div><button class="mj-action" id="mj-login-button" type="submit">Entrar e recuperar minhas notas</button><div class="mj-error" id="mj-login-error" aria-live="polite"></div></form><p class="mj-foot">Não sabe o código? JBFS pode consultá-lo no <a href="craftdocs://open?spaceId=6606bf28-79b6-7415-c5c5-6d0a79f7f279&blockId=9a843032-d368-99c4-034e-8d16fb8534f1" style="color:inherit;text-decoration:underline">painel de contas no Craft</a> e compartilhar o individual de cada pessoa. O laboratório fica disponível após a entrada.</p></div>';
  document.body.appendChild(overlay);
  function status(message,kind='info'){if(remoteStatus){remoteStatus.textContent=message;remoteStatus.dataset.kind=kind}}
  async function loadEditorial(){
    try{
      const r=await fetch('/api/editorial',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return;
      const {content={}}=await r.json();
      const notice=$('#localStatus');
      if(notice)notice.textContent=content['aviso.sincronizacao']||'Seu histórico é salvo online automaticamente.';
      const settings=$('#settingsDialog .modal-inner');
      if(settings){
        const stale=[...settings.querySelectorAll('.callout')].find(x=>x.textContent.includes('A sincronização em nuvem ainda não está ativada'));
        if(stale)stale.textContent=content['ajuda.privacidade']||'Seus dados são separados por perfil e sincronizados online.';
      }
    }catch{}
  }
  loadEditorial();
  function localBackup(){try{return BRIDGE.exportBackup()}catch{return null}}
  function digest(b){if(!b)return '';return JSON.stringify({data:b.data,history:b.history})}
  function putLocal(id,b){try{localStorage.setItem(USER_CACHE+id,JSON.stringify(b))}catch{}}
  function getLocal(id){try{const b=JSON.parse(localStorage.getItem(USER_CACHE+id)||'null');return b?.version===3?b:null}catch{return null}}
  function isolate(b){localStorage.setItem(KEY,JSON.stringify(b?.data?.version===3?b.data:{version:3}));localStorage.setItem(HISTORY,JSON.stringify(Array.isArray(b?.history)?b.history:[]))}
  function collectLegacy(){
    if(localStorage.getItem('med_jita_migration_seen_v1'))return;
    const b=localBackup();if(b&&digest(b)&&!localStorage.getItem(MIGRATION))localStorage.setItem(MIGRATION,JSON.stringify(b));
    localStorage.setItem('med_jita_migration_seen_v1','yes');
  }
  function renderProfiles(){
    const box=$$('#mj-users');
    if(!visibleProfiles.length){box.innerHTML='<p class="mj-error">Não foi possível consultar os perfis no momento.</p>';return}
    box.innerHTML=visibleProfiles.map((p,i)=>'<button type="button" class="mj-user" data-profile="'+escape(p.id)+'" aria-pressed="'+(selected===p.id)+'" '+(p.active?'':'disabled')+'><span class="mj-avatar">'+escape(p.name.slice(0,2).toUpperCase())+'</span><span><span class="mj-name">'+escape(p.name)+'</span><span class="mj-hint">'+(p.active?(p.locked?'Histórico com senha adicional':'Perfil autorizado'):'Acesso pendente')+'</span></span></button>').join('');
  }
  function choose(id){
    const p=visibleProfiles.find(x=>x.id===id&&x.active);if(!p)return;
    selected=p.id;renderProfiles();$$('#mj-auth').hidden=false;$$('#mj-selected').textContent=p.name;$$('#mj-login-error').textContent='';$('#mj-code').value='';const extra=$('#mj-password-extra'),pass=$('#mj-history-password');extra.hidden=!p.locked;pass.required=!!p.locked;pass.value='';$('#mj-code').focus({preventScroll:true});
  }
  $$('#mj-users').addEventListener('click',e=>{const target=e.target.closest('[data-profile]');if(target)choose(target.dataset.profile)});
  async function api(url,method='GET',body){
    const response=await fetch(url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const out=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(out.error||'Falha ao conectar');error.status=response.status;error.remoteRevision=out.revision;throw error}
    return out;
  }
  async function activate(me){
    const result=await api('/api/profile-data');revision=result.revision||null;
    const locallySaved=getLocal(me.id);
    let b=result.bundle||locallySaved;
    if(result.bundle&&locallySaved&&digest(result.bundle)!==digest(locallySaved)){
      const useCloud=window.confirm('Há dados diferentes neste aparelho e na nuvem para '+me.name+'. OK recupera a nuvem; Cancelar preserva as notas locais. Nenhuma versão será apagada.');
      b=useCloud?result.bundle:locallySaved;
      try{localStorage.setItem(USER_CACHE+me.id+'_alternativa',JSON.stringify(useCloud?locallySaved:result.bundle))}catch{}
    }
    if(!b){
      if(me.id==='jbfs'){
        let legacy=null;try{legacy=JSON.parse(localStorage.getItem(MIGRATION)||'null')}catch{}
        if(legacy?.version===3&&window.confirm('Encontramos notas antigas neste aparelho. Deseja vinculá-las ao seu perfil JBFS?'))b=legacy;
      }
      if(!b)b={version:3,data:{version:3},history:[]};
    }
    putLocal(me.id,b);
    const previous=sessionStorage.getItem('med_jita_loaded_profile');
    const prevRevision=sessionStorage.getItem('med_jita_loaded_revision')||'';
    const needsReload=previous!==me.id||prevRevision!==(revision||'');
    sessionStorage.setItem('med_jita_loaded_profile',me.id);
    sessionStorage.setItem('med_jita_loaded_revision',revision||'');
    if(needsReload){isolate(b);location.reload();return}
    user=me;lastDigest=digest(localBackup());overlay.hidden=true;setupBadge();
    status('Salvo automaticamente no MED JITA online · espelho editorial no Craft','ok');
    if(!result.bundle){pending=true;schedule(300)}
  }
/* MED JITA: in-app admin for the JBFS/Jairo account only. */
function setupJairoStudio(){
  if(!user||user.id!=='jbfs') return;
  const badgeButton=$$('#mj-open-studio');
  if(!badgeButton)return;
  if(!$$('#mj-studio-style')){
    const st=document.createElement('style');st.id='mj-studio-style';
    st.textContent=`
    #mj-profile-badge #mj-open-studio{border:0;background:var(--brand,#087e86);color:#fff;border-radius:12px;padding:7px 9px;font-size:11px;font-weight:800;text-decoration:none;white-space:nowrap}
    #mj-studio-side{margin:7px 0;border:1px solid #82aaa6;background:#143f47;color:#fff}
    #mj-studio[hidden]{display:none!important}#mj-studio{position:fixed;inset:0;z-index:2147483000;background:rgba(4,24,28,.80);backdrop-filter:blur(5px);display:grid;place-items:center;padding:12px}
    #mj-studio-window{background:#f4faf8;width:min(1240px,100%);height:min(920px,calc(100dvh - 24px));border-radius:20px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #92c9c7;box-shadow:0 15px 65px #0007}
    #mj-studio-header{background:#102d3c;padding:12px 17px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:white}#mj-studio-header strong{font-size:16px;display:block}#mj-studio-header small{font-size:11px;color:#b7e4e2;display:block}
    #mj-studio-close{background:#235661;color:white;border:1px solid #4b8187;border-radius:11px;padding:9px 12px;min-height:42px;cursor:pointer;font-weight:750}
    #mj-studio-nav{background:#e4f2f0;padding:10px 12px;display:flex;gap:9px}#mj-studio-nav button{flex:1;background:#fff;border:1px solid #c1dcda;color:#1a4751;border-radius:11px;min-height:44px;padding:9px 12px;font-weight:800;cursor:pointer}#mj-studio-nav button[aria-selected=true]{background:#00636c;color:#fff;border-color:#00636c}
    #mj-studio-frame{border:0;display:block;flex:1;width:100%;min-height:0;background:white}
    @media(max-width:640px){#mj-studio{padding:0}#mj-studio-window{width:100%;height:100dvh;border:0;border-radius:0}#mj-studio-header{padding:calc(9px + env(safe-area-inset-top)) 12px 9px}#mj-studio-nav{padding:8px 10px;gap:6px}#mj-studio-nav button{font-size:12px}}
    `;
    document.head.appendChild(st);
  }
  let panel=$$('#mj-studio');
  if(!panel){
    panel=document.createElement('section');panel.id='mj-studio';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Painel Jairo · Administração e laboratório');
    panel.innerHTML='<div id="mj-studio-window"><header id="mj-studio-header"><div><strong>MED JITA · Painel Jairo</strong><small>Administrador JBFS · edição e sincronização Craft</small></div><button type="button" id="mj-studio-close">Voltar</button></header><nav id="mj-studio-nav" aria-label="Áreas do painel"><button type="button" data-studio="admin" aria-selected="true">Usuários e resultados</button><button type="button" data-studio="lab" aria-selected="false">Laboratório Craft</button></nav><iframe id="mj-studio-frame" loading="lazy" title="Ferramentas MED JITA" referrerpolicy="same-origin"></iframe></div>';
    document.body.appendChild(panel);
    panel.querySelector('#mj-studio-nav').addEventListener('click',event=>{
      const b=event.target.closest('button[data-studio]');if(!b)return;
      const lab=b.dataset.studio==='lab',frame=panel.querySelector('#mj-studio-frame');
      panel.querySelectorAll('button[data-studio]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      const src=lab?'/craft-lab.html':'/admin.html';if(frame.getAttribute('src')!==src)frame.setAttribute('src',src);
      frame.title=lab?'Laboratório Craft':'Administração MED JITA';
    });
    const close=()=>{panel.hidden=true;document.body.style.overflow=panel.dataset.oldOverflow||'';badgeButton.focus()};
    panel.querySelector('#mj-studio-close').addEventListener('click',close);
    panel.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
  const open=async()=>{
    try{
      const info=await api('/api/identity');
      if(info?.me?.id!=='jbfs')throw new Error('Entre como Jairo/JBFS para editar.');
      panel.dataset.oldOverflow=document.body.style.overflow||'';
      panel.hidden=false;document.body.style.overflow='hidden';
      panel.querySelector('button[data-studio="admin"]').click();
      panel.querySelector('#mj-studio-close').focus();
    }catch(err){window.alert(err?.message||'Acesso administrativo indisponível.')}
  };
  badgeButton.onclick=open;
  if(!$$('#mj-studio-side')){
    const host=$$('.side-nav')||$$('#sidebarSettings')?.parentElement;
    if(host){const b=document.createElement('button');b.type='button';b.id='mj-studio-side';b.className='navbtn';b.textContent='Laboratório Jairo';b.onclick=open;host.appendChild(b)}
  }
}
  function setupBadge(){
    if(!profileBadge){
      profileBadge=document.createElement('div');profileBadge.id='mj-profile-badge';
      const toolbar=$$('.topbar .toolbar')||$$('.topbar')||document.body;
      toolbar.prepend(profileBadge);
    }
    profileBadge.innerHTML='<strong>'+escape(user.name)+'</strong>'+(user.id==='jbfs'?'<button type="button" id="mj-open-studio" aria-label="Abrir o laboratório Jairo">Laboratório Jairo</button>':'')+'<button type="button" id="mj-logout" aria-label="Trocar usuário">Trocar</button>';
    $$('#mj-logout').onclick=signOut;
    if(user.id==='jbfs')setupJairoStudio();
  }
  async function signOut(){
    const b=localBackup();if(user&&b)putLocal(user.id,b);
    clearTimeout(writeTimer);
    if(pending)try{await flush()}catch{}
    try{await api('/api/identity','DELETE')}catch{}
    user=null;revision=null;pending=false;
    sessionStorage.removeItem('med_jita_loaded_profile');
    sessionStorage.removeItem('med_jita_loaded_revision');
    isolate({version:3,data:{version:3},history:[]});
    location.reload();
  }
  async function start(){
    try{
      collectLegacy();
      const identity=await api('/api/identity');
      visibleProfiles=identity.profiles||[];renderProfiles();
      if(identity.me){await activate(identity.me);return}
      overlay.hidden=false;
    }catch(e){overlay.hidden=false;$$('#mj-login-error').textContent='O serviço está indisponível. Tente novamente com a internet ativa.';status('Não foi possível verificar a sessão.','error')}
  }
  $$('#mj-auth').addEventListener('submit',async e=>{
    e.preventDefault();if(!selected)return;
    const button=$$('#mj-login-button');button.disabled=true;$$('#mj-login-error').textContent='Verificando código…';
    try{
      const b=await api('/api/identity','POST',{profile:selected,code:$('#mj-code').value,historyPassword:$('#mj-history-password').value});
      $('#mj-code').value='';$('#mj-history-password').value='';$('#mj-login-error').textContent='';
      await activate(b.me);
    }catch(err){$$('#mj-login-error').textContent=err.status===401?'Código ou senha incorretos, revogados ou perfil bloqueado. Confira o campo Codigo no Craft.':'Não foi possível conectar agora. Tente novamente.'}
    finally{button.disabled=false}
  });
  function schedule(ms=1300){if(!user)return;pending=true;clearTimeout(writeTimer);writeTimer=setTimeout(flush,ms)}
  function observe(){
    if(!user||overlay.hidden!==true)return;
    const b=localBackup(),now=digest(b);
    if(!b||now===lastDigest)return;
    lastDigest=now;putLocal(user.id,b);status('Alteração guardada neste aparelho · enviando para a nuvem…','warn');schedule(1400);
  }
  async function flush(){
    if(!user||remoteSaving||!pending)return;
    pending=false;remoteSaving=true;
    const b=localBackup();if(!b){remoteSaving=false;return}
    putLocal(user.id,b);
    try{
      const out=await api('/api/profile-data','PUT',{baseRevision:revision,bundle:b});
      revision=out.revision;sessionStorage.setItem('med_jita_loaded_revision',revision||'');
      errorCount=0;
      status(out.craftSynced?'Salvo online · Craft atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Salvo online · atualização do Craft pendente',out.craftSynced?'ok':'warn');
    }catch(e){
      pending=true;errorCount++;
      if(e.status===401){status('Seu código foi revogado. Troque de perfil e entre novamente.','error');overlay.hidden=false}
      else if(e.status===409)status('Outra versão foi salva neste perfil. Seu preenchimento local está preservado; abra em outro aparelho com cuidado.','error');
      else status('Sem conexão. Alterações preservadas neste aparelho; nova tentativa automática.','warn');
    }finally{
      remoteSaving=false;
      if(pending&&user&&errorCount<6)writeTimer=setTimeout(flush,Math.min(30000,1800*2**errorCount));
    }
  }
  document.addEventListener('input',()=>setTimeout(observe,100),true);
  document.addEventListener('change',()=>setTimeout(observe,100),true);
  document.addEventListener('click',()=>setTimeout(observe,160),true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){observe();if(pending)flush()}else if(user&&pending)schedule(300)});
  window.addEventListener('online',()=>{if(user&&pending)schedule(250)});
  window.addEventListener('pagehide',()=>{if(user){const b=localBackup();if(b)putLocal(user.id,b)}});
  setInterval(()=>{observe();if(user&&pending&&!remoteSaving&&!writeTimer)schedule(1000)},3300);
  start();
})();

