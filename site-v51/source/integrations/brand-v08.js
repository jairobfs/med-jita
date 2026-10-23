/* MED JITA · integração visual V08, isolada da lógica das notas.
 * O logotipo anterior permanece embutido no HTML como fallback.
 * Este módulo não toca perfis, histórico, cálculo ou armazenamento. */
(() => {
  const logos = document.querySelectorAll('img[data-med-jita-logo]');
  for (const logo of logos) {
    const original = logo.getAttribute('src');
    const next = logo.closest('.wordmark, .jita-cover')
      ? './assets/completa-organic-inversa.svg'
      : './assets/completa-organic.svg';
    logo.addEventListener('error', () => {
      logo.src = original;
      logo.classList.add('legacy-logo-fallback');
    }, { once: true });
    logo.src = next;
    logo.alt = 'MED JITA · assinatura V08 com mascote original preservado';
    logo.decoding = 'async';
  }
})();
