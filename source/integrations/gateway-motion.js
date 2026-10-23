/* MED JITA V32 · ripple discreto dos perfis; a cinética do Jita vive em jita-motion.js. */
(function () {
  'use strict';
  const choices = document.getElementById('profileChoices');
  if (!choices) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  choices.addEventListener('pointerdown', (event) => {
    if (reduced?.matches || !(event.target instanceof Element)) return;
    const button = event.target.closest('.profile-choice');
    if (!button || button.disabled) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'gateway-ripple';
    ripple.style.setProperty('--ripple-x', `${event.clientX - rect.left}px`);
    ripple.style.setProperty('--ripple-y', `${event.clientY - rect.top}px`);
    ripple.setAttribute('aria-hidden', 'true');
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, { passive: true });
})();
