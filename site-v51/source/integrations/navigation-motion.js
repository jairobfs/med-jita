/* MED JITA · Microinterações não invasivas: não lê nem grava histórico. */
(() => {
  'use strict';
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const interactives = '.btn,.icon-btn,.navbtn,.mobilebar button,.profile-choice,.module-row,.home-uc-card,.segmented button,.subtab button';

  document.addEventListener('pointerdown', (event) => {
    if (reduce?.matches || event.button !== 0) return;
    const surface = event.target.closest?.(interactives);
    if (!surface || surface.disabled || !surface.isConnected) return;
    const rect = surface.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    surface.classList.add('jita-press-surface');
    const wave = document.createElement('span');
    wave.className = 'jita-tap-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.setProperty('--jita-tap-x', `${event.clientX - rect.left}px`);
    wave.style.setProperty('--jita-tap-y', `${event.clientY - rect.top}px`);
    wave.style.setProperty('--jita-tap-scale', String(Math.ceil(Math.hypot(rect.width, rect.height) / 5) + 1));
    surface.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), {once:true});
    window.setTimeout(() => wave.remove(), 700);
  }, {passive:true});

  document.addEventListener('click', (event) => {
    if (reduce?.matches) return;
    const nav = event.target.closest?.('.navbtn,.mobilebar button');
    if (!nav) return;
    nav.classList.remove('jita-activated');
    void nav.offsetWidth;
    nav.classList.add('jita-activated');
    window.setTimeout(() => nav.classList.remove('jita-activated'), 460);
  });
})();
