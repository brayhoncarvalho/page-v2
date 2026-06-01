/**
 * CEA Pay — app.js
 * Interações mínimas: visibilidade de valores, scroll horizontal suave,
 * estados de toque e tempo da status bar.
 */

(function () {
  'use strict';

  /* ============================================================
     Utilitários
     ============================================================ */
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  /* ============================================================
     Status Bar — atualiza o horário em tempo real
     ============================================================ */
  function updateClock() {
    const timeEls = $$('.status-bar__time');
    if (!timeEls.length) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    timeEls.forEach(el => { el.textContent = timeStr; });
  }

  updateClock();
  setInterval(updateClock, 30_000);

  /* ============================================================
     Visibilidade de valores — botão do olho no header
     ============================================================ */
  const btnToggle = $('#btn-toggle-visibility');
  if (btnToggle) {
    let hidden = false;

    // Atualiza limite do Pix Parcelado a partir do localStorage
    const pixLimitEl = $('#pix-limite-valor');
    if (pixLimitEl) {
      const stored = parseInt(localStorage.getItem('ceapay_pix_limit') || '100000', 10);
      const limitCents = isNaN(stored) || stored < 0 ? 100000 : stored;
      pixLimitEl.textContent = 'R$ ' + (limitCents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
    }

    // Elementos que podem ser ocultados na Home
    const hiddenTargets = [
      '#fatura-valor',
      '#fatura-vencimento',
      '#limits-valor',
      '#pix-limite-valor',
    ];

    const MASK = '••••';

    // Guarda valores originais para restaurar
    const originals = {};
    hiddenTargets.forEach(sel => {
      const el = $(sel);
      if (el) originals[sel] = el.textContent;
    });

    btnToggle.addEventListener('click', () => {
      hidden = !hidden;
      btnToggle.setAttribute('aria-label', hidden ? 'Revelar valores' : 'Ocultar valores');
      btnToggle.setAttribute('aria-pressed', String(hidden));

      hiddenTargets.forEach(sel => {
        const el = $(sel);
        if (!el) return;
        el.textContent = hidden ? MASK : originals[sel];
      });

      // Troca ícone: olho fechado → olho aberto
      const eyeOpen = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
      const eyeOff = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
      const svgEl = btnToggle.querySelector('svg');
      if (svgEl) svgEl.innerHTML = hidden ? eyeOpen : eyeOff;
    });
  }

  /* ============================================================
     Scroll horizontal dos atalhos — setas de teclado funcionam
     ============================================================ */
  const shortcutsScroll = $('.shortcuts__scroll');
  if (shortcutsScroll) {
    shortcutsScroll.addEventListener('keydown', (e) => {
      const STEP = 120;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        shortcutsScroll.scrollBy({ left: STEP, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        shortcutsScroll.scrollBy({ left: -STEP, behavior: 'smooth' });
      }
    });
  }

  /* ============================================================
     Feedback de toque nos botões de atalho (ripple leve)
     ============================================================ */
  $$('.shortcut-card').forEach(card => {
    card.addEventListener('pointerdown', () => {
      card.style.opacity = '0.85';
    });
    card.addEventListener('pointerup', () => {
      card.style.opacity = '';
    });
    card.addEventListener('pointercancel', () => {
      card.style.opacity = '';
    });
  });

  /* ============================================================
     Carrossel de Parceiros — dots indicadores sincronizados com scroll
     ============================================================ */
  const partnersScroll = $('#partners-scroll');
  const partnersDots   = $$('#partners-dots .partners__dot');

  if (partnersScroll && partnersDots.length) {
    let scrollTimer = null;

    function updateDots() {
      const cards = $$('.partner-card', partnersScroll);
      if (!cards.length) return;

      // Calcula qual card está mais visível (mais próximo do snap point)
      const scrollLeft    = partnersScroll.scrollLeft;
      const containerLeft = partnersScroll.getBoundingClientRect().left;

      let activeIndex = 0;
      let minDistance = Infinity;

      cards.forEach((card, i) => {
        const cardLeft = card.getBoundingClientRect().left - containerLeft;
        const distance = Math.abs(cardLeft);
        if (distance < minDistance) {
          minDistance = distance;
          activeIndex = i;
        }
      });

      partnersDots.forEach((dot, i) => {
        dot.classList.toggle('partners__dot--active', i === activeIndex);
      });
    }

    // Atualiza dots durante o scroll (debounced para performance)
    partnersScroll.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateDots, 50);
    }, { passive: true });

    // Clicar em um dot navega para o slide correspondente
    partnersDots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const cards = $$('.partner-card', partnersScroll);
        if (cards[i]) {
          cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      });
      dot.style.cursor = 'pointer';
    });

    // Estado inicial
    updateDots();
  }

  /* ============================================================
     Bottom nav — previne reload quando já está na página ativa
     (útil ao navegar entre index.html e servicos.html via href)
     ============================================================ */
  $$('.bottom-nav__item').forEach(item => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');
      // Se href é "#" (tela não implementada), previne navegação e dá feedback visual
      if (href === '#') {
        e.preventDefault();
        item.style.opacity = '0.6';
        setTimeout(() => { item.style.opacity = ''; }, 200);
      }
    });
  });

  /* ============================================================
     Focus management — ao clicar em link de navegação, foca
     o conteúdo principal da nova página para acessibilidade
     ============================================================ */
  const mainContent = $('#main-content');
  if (mainContent) {
    // Se veio de outra página (sem hash), foca o conteúdo principal
    if (!document.referrer.includes('#')) {
      // Delay mínimo para garantir que o DOM está pronto
      requestAnimationFrame(() => {
        mainContent.focus({ preventScroll: true });
      });
    }
  }

})();
