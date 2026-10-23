/* MED JITA optional, passwordless encrypted sync client.
 * Never sends the recovery code or a Craft URL to the remote service.
 * Background requests occur only after an explicit per-device opt-in.
 */
(() => {
  'use strict';
  // The v7 recovery-code flow remains in source for legacy recovery, but the
  // account-based MED JITA v8 uses the authenticated per-profile service.
  if (window.MED_JITA_ACCOUNTS_ENABLED) return;
  const $ = id => document.getElementById(id);
  if (!$('syncPane')) return;
  const CONFIG_KEY = 'med_jita_sync_config_v1';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const cfg = {server:location.origin,key:'',revision:0,autoBackup:false,lastDigest:''};
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    // MED JITA now serves its encrypted bridge from the same origin.
    // A historical custom endpoint must never silently receive a new backup.
    if (saved.server && saved.server !== location.origin) cfg.revision = 0;
    if (typeof saved.key === 'string') cfg.key = saved.key;
    if (saved.server === location.origin && Number.isSafeInteger(saved.revision)) {
      cfg.revision = Math.max(0,saved.revision);
      if (typeof saved.lastDigest === 'string' && /^[A-Za-z0-9_-]{43}$/.test(saved.lastDigest))
        cfg.lastDigest = saved.lastDigest;
      cfg.autoBackup = saved.autoBackup === true && cfg.revision > 0 && !!cfg.lastDigest;
    }
  } catch (_) {}
  $('syncServer').value = cfg.server;
  $('syncRecovery').value = cfg.key;
  $('syncAutoBackup').checked = cfg.autoBackup;
  let manualBusy = false;
  let autoRunPromise = null;
  let autoTimer = null;
  const show = (message, status='info') => {
    $('syncStatus').textContent = message;
    $('syncStatus').dataset.status = status;
  };
  function saveConfig() {
    cfg.server = location.origin;
    cfg.key = $('syncRecovery').value.trim();
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }
    catch (_) { show('Sem espaço para salvar preferências. Guarde o código fora deste navegador.', 'error'); }
  }
  function stopAuto(message) {
    cfg.autoBackup = false;
    $('syncAutoBackup').checked = false;
    clearTimeout(autoTimer);
    saveConfig();
    show(message, 'error');
  }
  function requireServer() {
    const url = new URL(cfg.server);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw Error('Informe somente a origem HTTPS da ponte, sem caminhos, usuário ou parâmetros.');
    if (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))
      throw Error('A ponte precisa usar HTTPS para proteger os dados.');
    return url.origin;
  }
  function bytesToB64url(bytes) {
    let str = '';
    for (let i=0; i<bytes.length; i+=8192) str += String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlToBytes(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Código de recuperação inválido.');
    const padded = value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  }
  async function sha(label, key) {
    if (!crypto?.subtle) throw Error('Criptografia indisponível. Abra o site publicado via HTTPS.');
    return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`med-jita:v1:${label}:${key}`)));
  }
  function validatedRecovery() {
    const key = cfg.key;
    if (key.length !== 43 || b64urlToBytes(key).length !== 32)
      throw Error('Gere ou cole um código de recuperação válido de 43 caracteres.');
    return key;
  }
  async function headers() {
    const bearer = bytesToB64url(await sha('auth',validatedRecovery()));
    return {Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'};
  }
  async function request(path,options={}) {
    const response = await fetch(requireServer()+path,{cache:'no-store',...options});
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(typeof payload.error === 'string' ? payload.error : `Serviço respondeu HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  async function encrypt(backup) {
    const keyBytes = await sha('encryption',validatedRecovery());
    const aes = await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(JSON.stringify(backup));
    if (plaintext.length > 1000000) throw Error('Backup excede 1 MB. Exporte o JSON e reduza o histórico antes do envio.');
    const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,plaintext);
    return {alg:'AES-256-GCM',iv:bytesToB64url(iv),ciphertext:bytesToB64url(new Uint8Array(ciphertext))};
  }
  async function decrypt(envelope) {
    if (!envelope || envelope.alg !== 'AES-256-GCM') throw Error('Formato remoto incompatível.');
    const keyBytes = await sha('encryption',validatedRecovery());
    const aes = await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['decrypt']);
    const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:b64urlToBytes(envelope.iv)},aes,b64urlToBytes(envelope.ciphertext));
    return JSON.parse(decoder.decode(bytes));
  }
  async function fingerprint(source) {
    // exportedAt changes on each export; it is not part of the saved content.
    const data = encoder.encode(JSON.stringify({data:source.data,history:source.history}));
    return bytesToB64url(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
  }
  async function snapshot() {
    const source = window.MED_JITA_BRIDGE?.exportBackup?.();
    if (!source) throw Error('A calculadora ainda não iniciou. Reabra a página.');
    return {source,digest:await fingerprint(source)};
  }
  async function remoteSnapshot() {
    try { return await request('/api/snapshot',{headers:await headers()}); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  async function sendSnapshot(current) {
    const encrypted = await encrypt(current.source);
    const result = await request('/api/snapshot',{
      method:'PUT',headers:await headers(),body:JSON.stringify({revision:cfg.revision,payload:encrypted})
    });
    cfg.revision = result.revision;
    cfg.lastDigest = current.digest;
    saveConfig();
    return result;
  }
  function scheduleAuto(delay=12000) {
    if (!cfg.autoBackup) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { void runAutoSync(); },delay);
  }
  async function runAutoSync() {
    if (!cfg.autoBackup || manualBusy || autoRunPromise || document.visibilityState === 'hidden') return;
    autoRunPromise = (async () => {
      try {
        const keyAtStart = cfg.key;
        const current = await snapshot();
        const remote = await remoteSnapshot();
        // Opting out or changing the recovery key cancels any pending action.
        if (!cfg.autoBackup || cfg.key !== keyAtStart) return;
        if (remote && remote.revision > cfg.revision) {
          // Never replace a local edit made since our last successful upload.
          if (!cfg.lastDigest || (await snapshot()).digest !== cfg.lastDigest) {
            stopAuto('Sincronização pausada: há mudanças locais e uma versão mais recente em outro aparelho. Exporte um JSON de segurança e use Recuperar backup para conciliá-las.');
            return;
          }
          const incoming = await decrypt(remote.payload);
          if (incoming?.version !== 3 || incoming?.format !== 'med-jita-backup') throw Error('O backup remoto tem formato incompatível.');
          const incomingDigest = await fingerprint(incoming);
          // An edit may occur during decryption; recheck immediately before import.
          if (!cfg.autoBackup || cfg.key !== keyAtStart) return;
          if ((await snapshot()).digest !== cfg.lastDigest) {
            stopAuto('Sincronização pausada porque o preenchimento mudou durante a verificação remota. Nenhum dado local foi substituído.');
            return;
          }
          if (incomingDigest !== current.digest)
            window.MED_JITA_BRIDGE.importBackup(incoming,{replaceHistory:true});
          cfg.revision = remote.revision;
          cfg.lastDigest = (await snapshot()).digest;
          saveConfig();
          show('Notas e histórico atualizados a partir de outro aparelho. Revisão '+cfg.revision+'.','success');
          return;
        }
        if (remote && remote.revision < cfg.revision) {
          stopAuto('Sincronização pausada: a revisão remota é anterior à última registrada aqui. Verifique a cópia antes de continuar.');
          return;
        }
        if (!remote && cfg.revision !== 0) {
          stopAuto('Sincronização pausada: a cópia remota esperada não foi encontrada. Os dados locais estão intactos.');
          return;
        }
        if (current.digest !== cfg.lastDigest) {
          if (!cfg.autoBackup || cfg.key !== keyAtStart) return;
          await sendSnapshot(current);
          show('Backup automático cifrado atualizado. Revisão '+cfg.revision+'.','success');
        }
      } catch (error) {
        if (error?.status === 409) stopAuto('Sincronização pausada: outro aparelho alterou o backup. Seus dados locais foram preservados. Exporte um JSON antes de recuperar a versão remota.');
        else show('Sincronização temporariamente indisponível: '+(error?.message||'falha de conexão')+'. Os dados locais continuam salvos; tentaremos novamente.','error');
      }
    })();
    try { await autoRunPromise; } finally { autoRunPromise = null; }
  }
  async function enableAuto() {
    saveConfig();
    validatedRecovery();
    const local = await snapshot();
    const remote = await remoteSnapshot();
    if (!remote) {
      if (cfg.revision !== 0) throw Error('A cópia remota anterior não foi encontrada. Exporte seu JSON e verifique o serviço antes de ativar.');
      await sendSnapshot(local);
    } else {
      if (!cfg.revision) throw Error('Já existe uma cópia ligada a este código. Primeiro use Recuperar backup para evitar sobrescrever os dados de outro aparelho.');
      if (remote.revision !== cfg.revision) throw Error('Existe outra revisão remota. Recupere e confira o backup antes de ativar a sincronização.');
      const previous = await decrypt(remote.payload);
      if (previous?.version !== 3 || previous?.format !== 'med-jita-backup') throw Error('O backup remoto tem formato incompatível.');
      cfg.lastDigest = await fingerprint(previous);
    }
    cfg.autoBackup = true;
    saveConfig();
    $('syncAutoBackup').checked = true;
    show('Sincronização automática ativada neste aparelho: alterações são cifradas e enviadas, com verificação periódica de outras versões.','success');
    if (local.digest !== cfg.lastDigest) scheduleAuto(1000);
  }
  async function busy(button, fn) {
    button.disabled = true;
    manualBusy = true;
    try {
      if (autoRunPromise) await autoRunPromise;
      await fn();
    } catch (error) {
      if (error?.status === 409 && cfg.autoBackup) stopAuto('O backup foi alterado por outro aparelho. A sincronização foi pausada para preservar os dados locais.');
      else show(error?.message || 'Não foi possível concluir a operação.', 'error');
    } finally {
      manualBusy = false;
      button.disabled = false;
      scheduleAuto(1200);
    }
  }
  for(const id of ['syncServer','syncRecovery']) $(id).addEventListener('change',() => {
    const before = cfg.server + '|' + cfg.key;
    saveConfig();
    if (before !== cfg.server+'|'+cfg.key) {
      cfg.revision=0;cfg.lastDigest='';cfg.autoBackup=false;
      $('syncAutoBackup').checked=false;clearTimeout(autoTimer);saveConfig();
      show('Código alterado. A sincronização automática foi desligada até verificar o novo backup.');
    }
  });
  $('syncCreateKey').addEventListener('click', () => {
    if (cfg.key && !confirm('Substituir a chave atual? Backups anteriores precisarão do código antigo.')) return;
    if (!crypto?.getRandomValues) { show('Abra a página por HTTPS para gerar uma chave segura.','error');return; }
    $('syncRecovery').value = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
    cfg.revision=0;cfg.lastDigest='';cfg.autoBackup=false;
    $('syncAutoBackup').checked=false;clearTimeout(autoTimer);saveConfig();
    show('Código criado localmente. Guarde-o em local seguro antes de enviar qualquer backup.');
  });
  $('syncCopyKey').addEventListener('click',() => busy($('syncCopyKey'),async () => {
    validatedRecovery();await navigator.clipboard.writeText(cfg.key);
    show('Código copiado. Não o compartilhe publicamente.');
  }));
  $('syncTest').addEventListener('click', () => busy($('syncTest'),async () => {
    saveConfig();show('Verificando o serviço de backup…','working');
    const alive = await request('/api/health');
    if(!alive.ok || !alive.store) throw Error('O serviço de backup não está disponível. Seus dados locais continuam preservados.');
    if (!alive.editorial) {
      show('Backup na nuvem operacional. A edição automática dos textos pelo Craft ainda aguarda conexão com o espaço MED.', 'success');
      return;
    }
    show('Backup na nuvem operacional. Conferindo a leitura editorial do Craft…','working');
    if (!cfg.key) {
      show('Backup na nuvem operacional. Para testar a conexão do Craft, gere primeiro o código de recuperação.', 'success');
      return;
    }
    const craft = await request('/api/craft/test',{headers:await headers()});
    show(craft.connected ? 'Backup operacional; Craft conectado ao servidor.'
      : 'Backup operacional. O Craft ainda não respondeu; os dados locais estão seguros.', 'success');
  }));
  $('syncUpload').addEventListener('click', () => busy($('syncUpload'),async () => {
    saveConfig();
    if(!confirm('Enviar agora uma cópia cifrada de suas notas e histórico para a ponte configurada?')) return;
    show('Criptografando antes do envio…','working');
    const result = await sendSnapshot(await snapshot());
    show('Backup cifrado recebido pelo servidor. Revisão '+cfg.revision+'. Nenhuma nota foi enviada ao Craft automaticamente.','success');
  }));
  $('syncDownload').addEventListener('click', () => busy($('syncDownload'),async () => {
    saveConfig();show('Buscando e decifrando seu backup…','working');
    const result = await request('/api/snapshot',{headers:await headers()});
    const restored = await decrypt(result.payload);
    if(!confirm('Restaurar backup remoto? O preenchimento atual será salvo no histórico, se houver notas.')) {
      show('Restauração cancelada. Seus dados locais não mudaram.'); return;
    }
    window.MED_JITA_BRIDGE?.importBackup?.(restored);
    cfg.revision = result.revision;cfg.lastDigest = await fingerprint(restored);saveConfig();
    show('Backup autenticado e restaurado. Atualização local concluída.','success');
  }));
  $('syncAutoBackup').addEventListener('change',() => {
    if (!$('syncAutoBackup').checked) {
      cfg.autoBackup = false;clearTimeout(autoTimer);saveConfig();
      show('Sincronização automática desligada. Dados locais preservados; envio manual continua disponível.');
      return;
    }
    if (!confirm('Ativar neste aparelho o envio cifrado automático de notas e histórico e a recuperação segura de atualizações de outros aparelhos?')) {
      $('syncAutoBackup').checked=false;return;
    }
    void busy($('syncAutoBackup'),async () => {
      try { await enableAuto(); }
      catch (error) { cfg.autoBackup=false;saveConfig();$('syncAutoBackup').checked=false;throw error; }
    });
  });
  window.addEventListener('med-jita:changed',() => scheduleAuto());
  window.addEventListener('online',() => scheduleAuto(1000));
  document.addEventListener('visibilitychange',() => {
    if (document.visibilityState === 'visible') scheduleAuto(1500);
  });
  setInterval(() => {
    if (cfg.autoBackup && document.visibilityState === 'visible') void runAutoSync();
  },60000);
  if (cfg.autoBackup) {
    show('Sincronização automática ativa. Verificando a cópia cifrada quando o aplicativo estiver visível.','success');
    scheduleAuto(1500);
  }
})();
