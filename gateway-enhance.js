/* MED JITA · camada visual iPhone V19. Não modifica login, notas ou Craft. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const pin = byId("pin"), confirm = byId("pinConfirm");
  const gate = byId("gate"), bar = byId("bar");
  if (!pin || !confirm || !gate || !bar) return;

  // Um único campo abre o teclado numérico nativo no iPhone. Nenhum teclado HTML paralelo.
  pin.setAttribute("inputmode", "numeric");
  pin.setAttribute("autocomplete", "off");
  pin.setAttribute("enterkeyhint", "go");
  confirm.setAttribute("inputmode", "numeric");
  confirm.setAttribute("autocomplete", "off");
  confirm.setAttribute("enterkeyhint", "done");
  // O Safari instala via menu Compartilhar. Nada tenta forçar um share sheet diferente.
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
  });

  const dialog = document.createElement("dialog");
  dialog.id = "jita-install-guide";
  dialog.innerHTML = `<h2>MED JITA na Tela de Início</h2>
    <p>Instale a entrada oficial: ela começa pela escolha de perfil.</p>
    <ol>
      <li>Abra o MED JITA no Safari do iPhone.</li>
      <li>Toque no menu da página e depois em <strong>Compartilhar</strong>.</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong>; caso falte, toque em <strong>Editar Ações</strong>.</li>
      <li>Ative <strong>Abrir como App da Web</strong> e confirme em <strong>Adicionar</strong>.</li>
    </ol>
    <p>O iOS exige essa confirmação no próprio navegador.</p>
    <div class="jita-install-actions">
      <button type="button" class="jita-install-copy">Copiar endereço</button>
      <button type="button" class="jita-install-close">Fechar</button>
    </div>
    <p class="jita-install-feedback" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  dialog.querySelector(".jita-install-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".jita-install-copy").addEventListener("click", async () => {
    const home = new URL("./", window.location.href).href;
    const feedback = dialog.querySelector(".jita-install-feedback");
    try {
      await navigator.clipboard.writeText(home);
      feedback.textContent = "Endereço copiado. Abra no Safari e use Compartilhar.";
    } catch {
      feedback.textContent = "Endereço oficial: " + home;
    }
  });

  const gateInstall = document.createElement("button");
  gateInstall.type = "button";
  gateInstall.className = "jita-install-gate";
  gateInstall.textContent = "Adicionar como app no iPhone";
  const lead = gate.querySelector(".lead");
  lead?.after(gateInstall);

  const barInstall = document.createElement("button");
  barInstall.type = "button";
  barInstall.className = "jita-install-bar";
  barInstall.textContent = "Instalar";
  const cfgButton = byId("settings");
  cfgButton ? bar.insertBefore(barInstall, cfgButton) : bar.append(barInstall);

  function installed() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }
  function refresh() {
    const hidden = installed();
    gateInstall.hidden = hidden;
    barInstall.hidden = hidden;
  }
  function showInstall() {
    if (installPrompt) {
      const event = installPrompt;
      installPrompt = null;
      event.prompt();
    } else {
      dialog.querySelector(".jita-install-feedback").textContent = "";
      dialog.showModal();
    }
  }
  gateInstall.addEventListener("click", showInstall);
  barInstall.addEventListener("click", showInstall);
  window.addEventListener("appinstalled", refresh);
  refresh();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
})();