/*
 * MED JITA · saída gradual da Vercel.
 *
 * Conferência local e exportação reversível. Este módulo nunca grava no
 * navegador, no banco do Sites, na Vercel ou no Craft; não chama importBackup.
 * A atribuição de exportações antigas sem ID de perfil depende da confirmação
 * explícita da pessoa e não é apresentada como verificação criptográfica.
 */
import { prepareFusion } from './fusion-archive.mjs';

(() => {
  'use strict';
  const bridge = window.MED_JITA_BRIDGE;
  const field = document.getElementById('vercelExitFile');
  const report = document.getElementById('vercelExitResult');
  const confirmation = document.getElementById('vercelExitConfirm');
  const confirmationLabel = document.getElementById('vercelExitConfirmLabel');
  const downloadButton = document.getElementById('vercelExitDownload');
  if (!bridge || !field || !report || !confirmation || !downloadButton) return;

  let staged = null;
  const selectedProfile = () => document.documentElement.dataset.profileReady === 'yes'
    ? document.documentElement.dataset.activeProfile || null : null;
  const stateSignature = backup => JSON.stringify({
    data: backup.data, history: backup.history, avatar: backup.avatar,
  });

  function reset(message = 'Nenhum arquivo selecionado. Suas notas não serão alteradas.', isError = false) {
    staged = null;
    confirmation.checked = false;
    confirmation.disabled = true;
    downloadButton.disabled = true;
    field.value = '';
    report.textContent = message;
    report.dataset.state = isError ? 'error' : 'idle';
    confirmationLabel.textContent = 'Confirmo que o backup pertence ao meu perfil aberto.';
  }

  function extractBackup(contents, profileId) {
    if (!contents || typeof contents !== 'object' || Array.isArray(contents))
      throw Error('O arquivo não contém um backup JSON válido.');
    const backup = contents.backup && contents.backup.format === 'med-jita-backup'
      ? contents.backup : contents;
    const declaredProfile = contents.profileId || contents.profile || backup.profile || null;
    if (declaredProfile && declaredProfile !== profileId)
      throw Error('O arquivo informa outro perfil. Nenhum dado foi importado.');
    return { backup, hasProfileEvidence: Boolean(declaredProfile) };
  }

  field.addEventListener('change', async () => {
    const file = field.files?.[0];
    if (!file) return;
    const profileId = selectedProfile();
    if (!profileId) {
      reset('Escolha e abra seu perfil antes de conferir um arquivo da Vercel.', true);
      return;
    }
    try {
      if (file.size > 12 * 1024 * 1024) throw Error('Arquivo acima de 12 MB; faça uma exportação menor ou separada.');
      if (!/\.json$/i.test(file.name)) throw Error('Selecione um arquivo JSON exportado do MED JITA antigo.');
      const contents = JSON.parse(await file.text());
      if (selectedProfile() !== profileId) throw Error('O perfil mudou durante a leitura. Recomece no perfil correto.');
      const { backup: vercel, hasProfileEvidence } = extractBackup(contents, profileId);
      const sites = bridge.exportBackup();
      const plan = prepareFusion({ profileId, sites, vercel });
      staged = { profileId, plan, sitesSignature: stateSignature(sites), hasProfileEvidence };
      confirmation.disabled = false;
      confirmation.checked = false;
      downloadButton.disabled = true;
      confirmationLabel.textContent = `Confirmo que o arquivo da Vercel pertence ao perfil ${profileId.toUpperCase()}.`;
      report.dataset.state = 'ready';
      report.textContent = [
        `Perfil aberto: ${profileId.toUpperCase()}.`,
        `${sites.history.length} versão(ões) no app atual e ${vercel.history.length} na exportação Vercel.`,
        `${plan.totalVersions} registro(s) no pacote de conferência, incluindo os estados atuais.`,
        plan.sameLiveState ? 'Notas atuais equivalentes nas duas origens.' : 'Há diferenças nas notas atuais; ambas serão preservadas no arquivo.',
        plan.needsSeparateArchive ? 'Acima do limite do histórico do app: será necessário arquivar antes de importar.' : 'A comparação não alterou nenhum dado.',
        hasProfileEvidence ? 'Identificador de perfil informado no arquivo.' : 'Exportação antiga sem identificador de perfil; confirme sua origem antes de guardar.',
      ].join('\n');
    } catch (error) {
      reset(error instanceof SyntaxError ? 'O arquivo não contém JSON legível.' : error.message, true);
    } finally {
      field.value = '';
    }
  });

  confirmation.addEventListener('change', () => {
    downloadButton.disabled = !staged || !confirmation.checked || selectedProfile() !== staged.profileId;
  });

  downloadButton.addEventListener('click', () => {
    if (!staged || !confirmation.checked || selectedProfile() !== staged.profileId) {
      reset('Perfil alterado ou confirmação pendente. Selecione o arquivo novamente.', true);
      return;
    }
    if (stateSignature(bridge.exportBackup()) !== staged.sitesSignature) {
      reset('As notas mudaram depois da comparação. Selecione o arquivo novamente para preservar a versão mais recente.', true);
      return;
    }
    const payload = {
      format: 'med-jita-transition-archive', version: 1,
      preparedAt: new Date().toISOString(), profileId: staged.profileId,
      attribution: staged.hasProfileEvidence ? 'declared-in-source-and-confirmed' : 'confirmed-by-user-only',
      review: {
        sameLiveState: staged.plan.sameLiveState,
        requiresActiveStateDecision: staged.plan.requiresActiveStateDecision,
        needsSeparateArchive: staged.plan.needsSeparateArchive,
        totalVersions: staged.plan.totalVersions,
      },
      // Both originals, not a truncated set of history items.
      archive: staged.plan.completeArchive,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const address = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = address;
    anchor.download = `MED_JITA_TRANSICAO_${staged.profileId.toUpperCase()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(address), 10000);
    report.dataset.state = 'ready';
    report.textContent += '\nPacote preparado para guardar em Arquivos. Nada foi enviado ou importado.';
  });

  new MutationObserver(() => reset('Perfil alterado. Selecione novamente o arquivo correspondente.'))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-active-profile', 'data-profile-ready'] });
})();
