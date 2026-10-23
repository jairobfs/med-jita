/* MED JITA V60 · Safety is visible when (and only when) running the
 * separate public Cloudflare demonstration Worker. The stable Sites build is
 * unaffected; no historical exports, PINs or grade content are collected.
 */
(() => {
  'use strict';
  if(window.MED_JITA_PREVIEW_ISOLATED !== true)return;

  const blockedFiles=new Set(['importData','importHistory','vercelExitFile']);
  const info='Importação desativada nesta prévia. Utilize o MED JITA original para notas e arquivos reais.';
  const lockInputs=()=>{
    for(const id of blockedFiles) {
      const input=document.getElementById(id);
      if(!input || input.dataset.previewLocked==='yes')continue;
      input.dataset.previewLocked='yes';
      input.disabled=true;
      input.title=info;
      input.setAttribute('aria-label','Importação de backups reais desativada na prévia');
      const parent=input.closest('label');
      if(parent) {
        parent.dataset.previewLocked='yes';
        parent.title=info;
      }
    }
    const accountToggle=document.getElementById('accountPasswordToggle');
    if(accountToggle) {
      accountToggle.disabled=true;
      accountToggle.title='PIN de demonstração: JBFS utiliza 0000. Alterações são exclusivas do aplicativo original.';
      accountToggle.setAttribute('aria-label','Alterar PIN desativado nesta prévia');
    }
  };
  document.addEventListener('change',event=>{
    if(!blockedFiles.has(event.target?.id))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.target.value='';
  },true);

  const note=document.createElement('p');
  note.id='jitaPreviewSafetyNote';
  note.className='jita-preview-safety-note';
  note.setAttribute('role','note');
  note.textContent='Ambiente isolado: use apenas valores fictícios. A cópia de teste online expira em até sete dias. Importação de backups reais e administração de PIN estão desativadas.';
  const slot=document.querySelector('#page-history .page-head') ||
    document.querySelector('#settingsDialog');
  if(slot)slot.insertAdjacentElement('afterend',note);
  lockInputs();
  const watcher=new MutationObserver(lockInputs);
  watcher.observe(document.body,{childList:true,subtree:true});
})();
