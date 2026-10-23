/* MED JITA · camada visual iPhone V19. Não modifica login, notas ou Craft. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const pin = byId("pin"), confirm = byId("pinConfirm");
  const fields = byId("pinFields"), gate = byId("gate"), bar = byId("bar");
  if (!pin || !confirm || !fields || !gate || !bar) return;

  // A entrada protegida permanece no código canônico; o teclado é uma alternativa de toque.
  pin.setAttribute("inputmode", "numeric");
  pin.setAttribute("autocomplete", "off");
  pin.setAttribute("enterkeyhint", "go");
  confirm.setAttribute("inputmode", "numeric");
  confirm.setAttribute("autocomplete", "off");
  confirm.setAttribute("enterkeyhint", "done");
  let activeField = pin;
  for (const field of [pin, confirm]) {
    field.addEventListener("focus", () => { activeField = field; });
  }

  const pad = document.createElement("div");
  pad.className = "jita-pin-pad";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", "Teclado numérico do PIN");
  const targetField = () =>
    activeField === confirm && !byId("pinConfirmWrap").hidden ? confirm : pin;

  function tap(value) {
    const input = targetField();
    if (value === "ok") {
      if (input === pin && !byId("pinConfirmWrap").hidden) {
        activeField = confirm;
        confirm.focus();
      } else {
        byId("enter").click();
      }
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (value === "erase") {
      const from = start === end ? Math.max(0, start - 1) : start;
      input.setRangeText("", from, end, "end");
    } else if (input.value.length < 6) {
      input.setRangeText(value, start, end, "end");
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  for (const value of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "erase", "0", "ok"]) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "jita-pin-key" + (value === "erase" || value === "ok" ? " action" : "");
    key.textContent = value === "erase" ? "Apagar" : value === "ok" ? "OK" : value;
    key.setAttribute("aria-label",
      value === "erase" ? "Apagar dígito" : value === "ok" ? "Confirmar PIN" : "Número " + value);
    key.addEventListener("click", () => tap(value));
    pad.append(key);
  }
  const actions = fields.querySelector(".actions");
  if (actions) actions.before(pad);

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