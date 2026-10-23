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
  gateInstall.textContent = "Instalar no iPhone";
  const helper = gate.querySelector(".notice");
  if (helper) helper.after(gateInstall);
  else gate.querySelector(".panel")?.append(gateInstall);

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

/* MED JITA · recuperação visual V52: estrutura sem alterações em PIN, notas ou Craft. */
(() => {
  "use strict";
  const gate = document.getElementById("gate");
  const panel = gate?.querySelector(".panel");
  if (!panel || panel.classList.contains("jita-restored")) return;

  const auth = document.createElement("section");
  auth.className = "jita-auth";
  auth.setAttribute("aria-label", "Escolha de perfil");
  while (panel.firstChild) auth.appendChild(panel.firstChild);

  const scene = document.createElement("section");
  scene.className = "jita-showcase";
  scene.setAttribute("aria-label", "Universo MED JITA");
  scene.innerHTML = `
    <div class="jita-showcase-brand">
      <img src="./identidade/med-jita-brand-v11.svg" alt="MED JITA · lettering autoral V11">
    </div>
    <button type="button" class="jita-showcase-mascot"
      aria-label="Toque no Jita para iluminar o cenário" aria-pressed="false">
      <img src="./icons/jita-corpo.svg" alt="" aria-hidden="true">
    </button>
    <p class="jita-showcase-kicker">ACOMPANHAMENTO ACADÊMICO</p>
    <h2 class="jita-showcase-title">Quem é você?</h2>
    <p class="jita-showcase-copy">Notas, metas e histórico de Medicina organizados em um só lugar, semestre após semestre.</p>
    <div class="jita-showcase-chip">Sua jornada acadêmica, sempre à mão.</div>
  `;
  const eyebrow = auth.querySelector(".eyebrow");
  const heading = auth.querySelector("h1");
  const lead = auth.querySelector(".lead");
  if (eyebrow) eyebrow.textContent = "BEM-VINDO DE VOLTA";
  if (heading) heading.textContent = "Escolha seu perfil";
  if (lead) lead.textContent = "Continue de onde parou, com seus módulos e resultados.";

  panel.append(scene, auth);
  panel.classList.add("jita-restored");

  const mascot = scene.querySelector(".jita-showcase-mascot");
  let effectTimer;
  mascot?.addEventListener("click", () => {
    mascot.classList.toggle("is-lit");
    mascot.setAttribute("aria-pressed", String(mascot.classList.contains("is-lit")));
    clearTimeout(effectTimer);
    effectTimer = setTimeout(() => {
      mascot.classList.remove("is-lit");
      mascot.setAttribute("aria-pressed", "false");
    }, 1100);
  });
})();
