/* MED JITA V30 · ciclo cromático progressivo. Não altera as notas ou o backup do usuário. */
(function () {
  'use strict';
  const root = document.documentElement;
  const palettes = ['aurora', 'mineral', 'figo', 'integrado'];
  const names = { aurora: 'Aurora', mineral: 'Mineral', figo: 'Figo', integrado: 'ATLAS · Integrado' };
  const duration = 18000;
  const key = 'med-jita-palette-orbit-paused-v1';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const controls = document.getElementById('paletteOrbitControls');
  const label = document.getElementById('paletteOrbitLabel');
  const toggle = document.getElementById('paletteOrbitToggle');
  const buttons = Array.from(document.querySelectorAll('[data-palette-choice]'));
  let timer = 0;
  let startTimer = 0;
  let paused = false;
  try { paused = window.localStorage.getItem(key) === 'yes'; } catch (_) { /* privacy mode */ }

  function showPalette(palette) {
    if (!palettes.includes(palette)) return;
    root.dataset.palette = palette;
    buttons.forEach((button) => {
      const active = button.dataset.paletteChoice === palette;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (label) label.textContent = `Paleta atual: ${names[palette]}. ${paused || reduced?.matches ? 'Ciclo pausado.' : 'Próxima transição suave automática.'}`;
  }
  function advance() {
    if (document.hidden || paused || reduced?.matches) return;
    const active = root.dataset.palette || 'aurora';
    showPalette(palettes[(palettes.indexOf(active) + 1) % palettes.length]);
  }
  function stop() {
    window.clearInterval(timer);
    window.clearTimeout(startTimer);
    timer = 0;
    startTimer = 0;
  }
  function update() {
    stop();
    const on = !paused && !reduced?.matches;
    root.dataset.paletteOrbit = on ? 'on' : 'off';
    if (toggle) {
      toggle.textContent = on ? 'Pausar ciclo' : 'Retomar ciclo';
      toggle.setAttribute('aria-pressed', String(on));
      toggle.disabled = !!reduced?.matches;
      toggle.title = reduced?.matches ? 'Movimento reduzido ativado no aparelho' : 'Alternar o ciclo automático de paletas';
    }
    showPalette(root.dataset.palette || 'aurora');
    if (on && !document.hidden) {
      startTimer = window.setTimeout(() => {
        advance();
        timer = window.setInterval(advance, duration);
      }, 2200);
    }
  }
  buttons.forEach((button) => button.addEventListener('click', () => {
    showPalette(button.dataset.paletteChoice);
    update();
  }));
  // Appearance is an explicit light/dark choice: switch it immediately to avoid
  // a low-contrast intermediate frame while the chrome adapts.
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('#themeToggle,[data-theme-choice]')) return;
    root.dataset.paletteOrbit = 'off';
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      root.dataset.paletteOrbit = paused || reduced?.matches ? 'off' : 'on';
      showPalette(root.dataset.palette || 'aurora');
    }));
  }, { capture: true });
  toggle?.addEventListener('click', () => {
    paused = !paused;
    try { window.localStorage.setItem(key, paused ? 'yes' : 'no'); } catch (_) { /* privacy mode */ }
    update();
  });
  document.addEventListener('visibilitychange', update);
  reduced?.addEventListener?.('change', update);
  if (controls) controls.hidden = false;
  update();
})();
