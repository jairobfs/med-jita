/* MED JITA: choose a profile, optionally unlock its history, and
 * automatically save notes online with an editable Craft mirror.
 * Personal histories never go to the public editorial endpoint.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bridge = window.MED_JITA_BRIDGE;
  if (!bridge || !$('profileGateway')) return;
  const META_PREFIX = 'med_jita_profile_sync_';
  // A profile is a person, not a shortcut to a calculator feature.
  const JITA_PRESETS = [
    ['jita-classico','Jita original','./JITA_vetorial.svg'],
    ['selo-jita','Selo Jita','./assets/med-jita-app-icon.svg'],
    ['cartola','Cartola','./assets/jita-cartola-avatar.svg'],
    ['jita-noite','Jita noturno','./JITA_vetorial.svg'],
  ];
  // Preserve legacy choices in stored backups, but never present feature icons
  // as a person's face. They render as that person's monogram and Jita hat.
  const LEGACY_PRESETS = ['ajuda','calcular','media','meta','integrar','progresso','historico','salvar'];
  const avatarAsset = id => JITA_PRESETS.find(p => p[0] === id)?.[2] ||
    (LEGACY_PRESETS.includes(id) ? './assets/jita-v11/cor/'+id+'.svg' : null);
  let selected = null, active = null, historyPassword = '';
  let revision = 0, lastDigest = '', busy = false, timer = null, suspended = false;
  let pendingResync = false, choiceSequence = 0;
  const isCurrentChoice = (profile,sequence) => !!profile && sequence === choiceSequence && selected?.id === profile.id;

  const message = (text,kind='info') => {
    $('profileMessage').textContent = text;
    $('profileMessage').dataset.kind = kind;
  };
  const status = (text,kind='info') => {
    $('accountSyncStatus').textContent = text;
    $('accountSyncStatus').dataset.status = kind;
  };
  const cleanAvatar = avatar => {
    if (avatar?.kind === 'preset' && LEGACY_PRESETS.includes(avatar.id)) return { kind:'default' };
    if (avatar?.kind === 'preset' && avatarAsset(avatar.id)) return avatar;
    if (avatar?.kind === 'photo' && typeof avatar.src === 'string' && avatar.src.length <= 18000 &&
        /^data:image\/(?:webp|jpeg|png);base64,[a-zA-Z0-9+/]+={0,2}$/.test(avatar.src)) return avatar;
    return { kind:'default' };
  };
  function paintAvatar(container,value,profile=active) {
    const avatar = cleanAvatar(value);
    container.dataset.avatarKind = avatar.kind;
    container.dataset.avatarId = avatar.kind === 'preset' ? avatar.id : '';
    if (profile?.id) container.dataset.profile = profile.id;
    if (avatar.kind === 'default') {
      const monogram = document.createElement('span');
      monogram.className = 'avatar-monogram';
      monogram.textContent = (profile?.name || profile?.id || '?').trim().charAt(0).toLocaleUpperCase('pt-BR');
      monogram.setAttribute('aria-hidden','true');
      container.replaceChildren(monogram);
    } else {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = avatar.kind === 'photo' ? avatar.src : avatarAsset(avatar.id);
      container.replaceChildren(img);
    }
  }
  function refreshPersonalMarks(profile=active) {
    // A shared MED JITA installation is neutral until someone enters.
    // Its visual monogram is derived from the active person, never a fixed J.
    const letter = profile?.name?.trim().charAt(0).toLocaleUpperCase('pt-BR') || '';
    [$('headerProfileMark'),$('settingsProfileMark')].filter(Boolean).forEach(mark => {
      mark.textContent = letter;
      mark.dataset.neutral = String(!profile);
      if (profile?.id) mark.dataset.profile = profile.id;
      else delete mark.dataset.profile;
    });
  }
  function refreshActiveAvatar() {
    if (!active) return;
    const avatar = bridge.getAvatar();
    paintAvatar($('profileActiveAvatar'),avatar);
    paintAvatar($('accountAvatarPreview'),avatar);
    $('accountAvatarName').textContent = active.name;
    for (const item of $('avatarPresetGrid').children) {
      item.setAttribute('aria-pressed',String(avatar.kind === 'preset' && avatar.id === item.dataset.preset));
    }
  }
  function initAvatarPresets() {
    const list = $('avatarPresetGrid');
    list.replaceChildren();
    for (const [id,label,src] of JITA_PRESETS) {
      const button = document.createElement('button');
      button.type='button'; button.dataset.preset=id;
      button.setAttribute('aria-label','Usar avatar Jita: '+label);
      const picture = document.createElement('img');
      picture.src=src; picture.alt='';
      const name = document.createElement('span'); name.textContent=label;
      button.append(picture,name);
      button.addEventListener('click',() => applyAvatar({kind:'preset',id}));
      list.appendChild(button);
    }
  }
  function applyAvatar(next) {
    if (!active) return;
    bridge.setAvatar(next);
    refreshActiveAvatar();
    $('avatarEditorStatus').textContent='Escolha salva neste aparelho; sincronização automática em andamento.';
    schedule(280);
  }
  async function compressPhoto(file) {
    if (!file || file.size > 8 * 1024 * 1024 || !file.type.startsWith('image/'))
      throw Error('Escolha uma imagem de até 8 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve,reject) => {
        const picture = new Image();
        picture.onload = () => resolve(picture);
        picture.onerror = () => reject(Error('Esta imagem não pôde ser aberta.'));
        picture.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width=144; canvas.height=144;
      const ctx=canvas.getContext('2d');
      if (!ctx) throw Error('Este aparelho não conseguiu preparar a foto.');
      const side=Math.min(img.naturalWidth,img.naturalHeight);
      const sx=(img.naturalWidth-side)/2, sy=(img.naturalHeight-side)/2;
      ctx.drawImage(img,sx,sy,side,side,0,0,144,144);
      for (const quality of [.78,.60,.43]) {
        const src=canvas.toDataURL('image/webp',quality);
        if (src.startsWith('data:image/webp;') && src.length<=18000) return {kind:'photo',src};
      }
      canvas.width=108;canvas.height=108;
      ctx.drawImage(img,sx,sy,side,side,0,0,108,108);
      const src=canvas.toDataURL('image/jpeg',.54);
      if (src.length<=18000) return {kind:'photo',src};
      throw Error('A foto ainda ficou grande. Escolha uma imagem menor.');
    } finally { URL.revokeObjectURL(url); }
  }
  function readMeta(id) {
    try {
      const parsed = JSON.parse(localStorage.getItem(META_PREFIX + id) || '{}');
      return {
        revision: Number.isSafeInteger(parsed.revision) ? parsed.revision : 0,
        digest: typeof parsed.digest === 'string' ? parsed.digest : '',
      };
    } catch { return { revision: 0, digest: '' }; }
  }
  function saveMeta() {
    if (!active) return;
    localStorage.setItem(META_PREFIX + active.id, JSON.stringify({ revision, digest:lastDigest }));
  }
  const fingerprint = backup => JSON.stringify({ data: backup.data, history: backup.history, avatar:backup.avatar || {kind:'default'} });
  // Preserve both edits on two devices without making anyone export JSON to sign in.
  // The local work remains active; the remote state becomes a named history entry.
  function reconcileBackups(local,remote) {
    if (!remote) return local;
    if (!local) return remote;
    const merged = { ...local, history:[] };
    const identities = new Set(), usedIds = new Set();
    const add = entry => {
      if (!entry || !entry.data) return;
      const signature = JSON.stringify(entry.data);
      const key = String(entry.id || '') + '|' + signature;
      if (identities.has(key)) return;
      identities.add(key);
      // Two devices can create a distinct item with the same timestamp/id.
      let recordId = typeof entry.id === 'string' ? entry.id : 'r'+identities.size;
      if (usedIds.has(recordId)) recordId += '-versao-'+identities.size;
      usedIds.add(recordId);
      merged.history.push({ ...entry, id:recordId });
    };
    if (JSON.stringify(local.data) !== JSON.stringify(remote.data)) {
      add({ id:'nuvem-'+Date.now().toString(36), name:'Versão preservada de outro aparelho',
        savedAt:new Date().toISOString(), data:remote.data });
    }
    for (const entry of [...(local.history||[]),...(remote.history||[])]) add(entry);
    merged.history = merged.history.slice(0,60);
    const localAvatar = local.avatar || {kind:'default'}, remoteAvatar = remote.avatar || {kind:'default'};
    merged.avatar = localAvatar.kind === 'default' ? remoteAvatar : localAvatar;
    return merged;
  }
  async function request(path,method='GET',payload=null,withPassword=true) {
    const headers = { Accept:'application/json' };
    if (withPassword && historyPassword) headers['X-Med-History-Password'] = historyPassword;
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const result = await fetch(path,{
      method,headers,credentials:'same-origin',cache:'no-store',
      ...(method !== 'GET' ? { body: JSON.stringify(payload) } : {}),
    });
    let data = {};
    try { data = await result.json(); } catch {}
    if (!result.ok) {
      const err = new Error(data.error || 'Não foi possível acessar o servidor.');
      err.status = result.status;
      throw err;
    }
    return data;
  }
  function passwordStage(show,profile=null) {
    $('profilePasswordSection').hidden = !show;
    $('profileChoices').hidden = show;
    $('profileGatewayHint').hidden = show;
    $('profileGatewayPanel').dataset.stage = show ? 'password' : 'choose';
    $('profileGatewayHeading').textContent = show ? 'Confirme seu PIN' : 'Escolha seu perfil';
    if (show && profile) paintAvatar($('profileUnlockAvatar'),bridge.readLocalAvatar(profile.id),profile);
  }
  function chooseProfile(profile) {
    if (!profile?.available || active) return;
    selected = profile;
    const sequence = ++choiceSequence;
    historyPassword = '';
    passwordStage(false);
    $('profileUnlockPassword').value = '';
    for (const button of $('profileChoices').children) button.setAttribute('aria-pressed',String(button.dataset.profile === profile.id));
    $('profileUnlockPassword').type = 'password';
    $('profileUnlockReveal').textContent = 'Mostrar';
    $('profileUnlockReveal').setAttribute('aria-pressed','false');
    $('profileUnlockReveal').setAttribute('aria-label','Mostrar senha');
    message('Oi, '+profile.name+'! Abrindo suas notas…');
    void openCandidate(profile,sequence);
  }
  function renderProfiles(profiles) {
    const list = $('profileChoices');
    list.replaceChildren();
    for (const profile of profiles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-choice';
      button.disabled = !profile.available;
      button.dataset.profile = profile.id;
      button.setAttribute('aria-pressed','false');
      button.dataset.protected = String(!!profile.passwordRequired);
      const picture = document.createElement('span');
      picture.className = 'profile-avatar profile-choice-avatar';
      paintAvatar(picture,bridge.readLocalAvatar(profile.id),profile);
      const copy = document.createElement('span');
      copy.className = 'profile-choice-copy';
      const heading = document.createElement('strong');
      heading.textContent = profile.name;
      const caption = document.createElement('small');
      caption.textContent = profile.activationNeedsRepair ? 'Ativação pendente no Craft' :
        !profile.available ? 'Ainda não disponível' :
        profile.passwordRequired ? 'PIN configurado' : 'Entrar neste perfil';
      const arrow = document.createElement('span');
      arrow.className = 'profile-choice-arrow';
      arrow.setAttribute?.('aria-hidden','true');
      arrow.textContent = '→';
      copy.append(heading,caption);
      button.append(picture,copy,arrow);
      button.addEventListener('click',() => chooseProfile(profile));
      list.appendChild(button);
    }
  }
  async function loadCatalog() {
    try {
      const catalog = await request('/api/profiles');
      const profiles = catalog.profiles || [];
      renderProfiles(profiles);
      message('Escolha seu nome para abrir exclusivamente o seu histórico.');
    } catch (error) {
      message('O cadastro no Craft está temporariamente indisponível. Tente atualizar a página.','error');
    }
  }
  async function openCandidate(profile=selected,sequence=choiceSequence) {
    if (!profile) return;
    try {
      message('Recuperando suas notas…');
      const opened = await request('/api/profile/open','POST',{ id:profile.id },false);
      if (!isCurrentChoice(profile,sequence)) return;
      if (opened.id !== profile.id) throw Error('O servidor retornou outro perfil. Nenhum histórico foi aberto.');
      if (opened.passwordRequired) {
        $('profileUnlockName').textContent = opened.name;
        passwordStage(true,profile);
        message('Histórico de '+profile.name+' protegido. Digite seu PIN ou senha pessoal.');
        $('profileUnlockPassword').focus();
        return;
      }
      historyPassword = '';
      await enterProfile(opened,profile,sequence);
    } catch (error) {
      if (isCurrentChoice(profile,sequence)) message(error.message,'error');
    }
  }
  async function unlockCandidate() {
    if (!selected || busy) return;
    const profile=selected, sequence=choiceSequence;
    historyPassword = $('profileUnlockPassword').value;
    if (!historyPassword) { message('Digite seu PIN ou senha pessoal.','error'); return; }
    busy = true;
    try {
      const opened = await request('/api/profile/open','POST',{ id:profile.id },false);
      if (!isCurrentChoice(profile,sequence)) return;
      if (opened.id !== profile.id) throw Error('O servidor retornou outro perfil. Nenhum histórico foi aberto.');
      await enterProfile(opened,profile,sequence);
    } catch (error) {
      if (isCurrentChoice(profile,sequence)) {
        historyPassword = '';
        if (error.status === 423) {
          $('profileUnlockPassword').select();
          message('Senha incorreta. Confira e tente novamente.','error');
        } else message(error.message,'error');
      }
    }
    finally { releaseBusy(); }
  }
  async function enterProfile(opened,profile,sequence) {
    if (!isCurrentChoice(profile,sequence) || opened.id !== profile.id) return;
    // Keep the chooser visible until the selected person's notes load.
    const remote = await request('/api/profile/backup?id='+encodeURIComponent(opened.id));
    if (!isCurrentChoice(profile,sequence)) return;
    const local = bridge.cachedProfile(opened.id);
    const meta = readMeta(opened.id);
    const hasOfflineChange = local && meta.digest && fingerprint(local) !== meta.digest;
    const localAhead = !!local && remote.revision < meta.revision;
    const mergeOnEntry = !!remote.backup && !!local &&
      (localAhead || (hasOfflineChange && remote.revision > meta.revision));
    // When local edits are unsent, keep them; otherwise import the newest
    // remote version. The original JBFS v7 data is migrated only for JBFS.
    const useLocal = !!local && ((hasOfflineChange && meta.revision === remote.revision) ||
      (localAhead && !remote.backup));
    bridge.bindProfile(opened.id,mergeOnEntry ? reconcileBackups(local,remote.backup) : useLocal ? null : remote.backup);
    active = { id:opened.id, name:opened.name, passwordRequired:opened.passwordRequired };
    revision = remote.revision;
    lastDigest = remote.backup && !useLocal ? fingerprint(remote.backup) : meta.digest;
    if (!remote.backup) lastDigest = '';
    localStorage.setItem('med_jita_last_profile',active.id);
    document.documentElement.dataset.profileReady = 'yes';
    document.documentElement.dataset.activeProfile = active.id;
    document.body.classList.add('account-mode');
    $('profileActiveName').textContent = opened.name;
    refreshPersonalMarks();
    refreshActiveAvatar();
    $('profileControls').hidden = false;
    passwordStage(false);
    $('profileUnlockPassword').value = '';
    $('accountPasswordToggle').textContent = active.passwordRequired ? 'Alterar senha' : 'Criar senha';
    status(mergeOnEntry ? 'As versões deste aparelho e da nuvem foram preservadas no histórico. Sincronizando…' :
      'Conectado como '+opened.name+'. Salvamento automático habilitado.','success');
    suspended = false;
    saveMeta();
    schedule(500);
  }
  function schedule(delay=1200) {
    clearTimeout(timer);
    if (!active || suspended) return;
    if (busy) { pendingResync = true; return; }
    timer = setTimeout(() => { void sync(); },delay);
  }
  function releaseBusy() {
    busy = false;
    if (pendingResync) {
      pendingResync = false;
      schedule(250);
    }
  }
  async function sync() {
    if (!active || suspended || document.visibilityState === 'hidden') return;
    if (busy) { pendingResync = true; return; }
    busy = true;
    try {
      const id = active.id;
      const current = bridge.exportBackup(), digest = fingerprint(current);
      const remote = await request('/api/profile/backup?id='+encodeURIComponent(id));
      if (!active || active.id !== id) return;
      if (remote.revision > revision) {
        if (lastDigest !== digest) {
          bridge.importBackup(reconcileBackups(current,remote.backup),{replaceHistory:true});
          revision = remote.revision;
          lastDigest = fingerprint(remote.backup || current);
          saveMeta();
          pendingResync = true;
          status('As duas versões foram preservadas. Atualizando o histórico online…','success');
          return;
        }
        if (remote.backup) bridge.importBackup(remote.backup,{replaceHistory:true});
        revision = remote.revision;
        lastDigest = fingerprint(bridge.exportBackup());
        saveMeta();
        status('Notas recebidas do outro aparelho. Sincronização em dia.','success');
      } else if (remote.revision < revision) {
        if (remote.backup) bridge.importBackup(reconcileBackups(current,remote.backup),{replaceHistory:true});
        revision = remote.revision;
        lastDigest = remote.backup ? fingerprint(remote.backup) : '';
        saveMeta();
        pendingResync = true;
        status('O histórico local será reenviado à nuvem sem perder as versões anteriores.','success');
      } else if (digest !== lastDigest) {
        const result = await request('/api/profile/backup','PUT',{id,revision,backup:current});
        revision = result.revision;
        lastDigest = digest;
        saveMeta();
        const time = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        status(result.craftMirrored ? 'Salvo online e no Craft · '+time :
          'Salvo online · Craft aguardando atualização · '+time,'success');
      } else if (remote.craftMirrored === true) {
        status('Online e Craft sincronizados.','success');
      }
    } catch (error) {
      if (error.status === 409) {
        pendingResync = true;
        status('Outro aparelho acabou de salvar. Reunindo as versões automaticamente…','success');
      } else {
        if ([403,423].includes(error.status)) suspended = true;
        status((suspended?'Sincronização pausada: ':'Tentaremos novamente: ')+error.message,'error');
      }
    } finally { releaseBusy(); }
  }
  async function switchProfile() {
    choiceSequence++;
    if (active) {
      await sync();
      // Unsynced edits are already kept in this person's own local cache and
      // reconciled on return. Profile switching should never become a lock.
    }
    active = null; selected = null; historyPassword = ''; revision = 0; lastDigest = '';
    pendingResync = false;
    clearTimeout(timer);
    document.documentElement.dataset.profileReady = 'no';
    delete document.documentElement.dataset.activeProfile;
    document.body.classList.remove('account-mode');
    refreshPersonalMarks();
    $('profileControls').hidden = true;
    passwordStage(false);
    $('profileUnlockPassword').value = '';
    $('accountCurrentPassword').value = '';
    $('accountNewPassword').value = '';
    $('accountPasswordForm').hidden = true;
    await loadCatalog();
  }
  $('profileUnlockButton').addEventListener('click',() => void unlockCandidate());
  function returnToChooser() {
    const previousId = selected?.id;
    choiceSequence++;
    selected = null; historyPassword = '';
    $('profileUnlockPassword').value = '';
    passwordStage(false);
    for (const button of $('profileChoices').children) button.setAttribute('aria-pressed','false');
    message('Escolha outro perfil para continuar.');
    Array.from($('profileChoices').children).find(button => button.dataset.profile === previousId)?.focus?.();
  }
  $('profileUnlockBack').addEventListener('click',returnToChooser);
  $('profileGateway').addEventListener('keydown',event => {
    if (event.key === 'Escape' && !$('profilePasswordSection').hidden) {
      event.preventDefault();
      returnToChooser();
    }
  });
  $('profileUnlockReveal').addEventListener('click',() => {
    const input = $('profileUnlockPassword');
    const showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    $('profileUnlockReveal').textContent = showing ? 'Ocultar' : 'Mostrar';
    $('profileUnlockReveal').setAttribute('aria-label',showing ? 'Ocultar senha' : 'Mostrar senha');
    $('profileUnlockReveal').setAttribute('aria-pressed',String(showing));
    input.focus();
  });
  $('profileUnlockPassword').addEventListener('keydown',e => { if (e.key === 'Enter') void unlockCandidate(); });
  $('profileSwitch').addEventListener('click',() => void switchProfile());
  $('profileAvatarEdit').addEventListener('click',() => {
    const page = document.querySelector('[data-page="history"]');
    if (page) page.click();
    $('accountAvatarEditor').open = true;
    $('accountAvatarEditor').scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('avatarUseDefault').addEventListener('click',() => applyAvatar({kind:'default'}));
  $('avatarPhotoUpload').addEventListener('change',async event => {
    try {
      if (!event.target.files?.[0]) return;
      $('avatarEditorStatus').textContent='Preparando a foto…';
      applyAvatar(await compressPhoto(event.target.files[0]));
    } catch(error) { $('avatarEditorStatus').textContent=error.message; }
    finally { event.target.value=''; }
  });
  $('accountSyncNow').addEventListener('click',() => { suspended = false; void sync(); });
  $('accountPasswordToggle').addEventListener('click',() => {
    $('accountPasswordForm').hidden = !$('accountPasswordForm').hidden;
    $('accountPasswordToggle').textContent = $('accountPasswordForm').hidden ?
      (active?.passwordRequired ? 'Alterar senha' : 'Criar senha') : 'Fechar';
    if (!$('accountPasswordForm').hidden) {
      $('accountPasswordHint').textContent = active?.passwordRequired ?
        'Digite sua senha atual para alterá-la ou removê-la.' :
        'Na primeira ativação, informe o código de ativação disponível com o administrador JBFS.';
      $('accountCurrentPassword').placeholder = active?.passwordRequired ? 'Senha atual' : 'Código de ativação';
    }
  });
  $('accountPasswordSave').addEventListener('click',async () => {
    if (!active || busy) return;
    const current = $('accountCurrentPassword').value;
    const next = $('accountNewPassword').value;
    if (!current) { status('Informe a senha atual ou o código de ativação.','error'); return; }
    if (next && next.length < 4) { status('Use pelo menos 4 caracteres.','error'); return; }
    busy = true;
    try {
      const result = await request('/api/profile/password','PUT',{id:active.id,current,next},false);
      historyPassword = next;
      active.passwordRequired = result.passwordRequired;
      $('accountCurrentPassword').value = '';
      $('accountNewPassword').value = '';
      $('accountPasswordForm').hidden = true;
      $('accountPasswordToggle').textContent = result.passwordRequired ? 'Alterar senha' : 'Criar senha';
      status(next ? 'Pronto. Sua senha foi atualizada.' : 'Senha removida. Prontinho.','success');
    } catch (error) { status(error.message,'error'); }
    finally { releaseBusy(); }
  });
  window.addEventListener('med-jita:changed',() => schedule(1200));
  document.addEventListener('visibilitychange',() => {
    if (document.visibilityState === 'visible') schedule(350);
  });
  window.addEventListener('online',() => schedule(350));
  window.setInterval(() => { if (active && !document.hidden) void sync(); },60000);
  initAvatarPresets();
  void loadCatalog();
})();
