/* ============================================================
   CEA Pay — PIX Crédito — Lógica JS
   Três módulos independentes ativados por feature-detection no DOM.
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     Utilidades
  ---------------------------------------------------------- */
  const $  = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  /** Formata centavos → "R$ 1.500,00" */
  function formatBRL(cents) {
    return 'R$\u00a0' + (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /** Taxas mensais por número de parcelas */
  const RATES = {
    2:  0.0199, 3:  0.0249, 4:  0.0299,
    5:  0.0349, 6:  0.0399, 7:  0.0449,
    8:  0.0499, 9:  0.0549, 10: 0.0599,
    11: 0.0649, 12: 0.0699
  };

  /**
   * Fórmula Price: PMT = PV × i × (1+i)^n / ((1+i)^n − 1)
   * @param {number} pv   - valor principal
   * @param {number} i    - taxa mensal decimal
   * @param {number} n    - número de parcelas
   * @returns {number} valor da parcela
   */
  function calcPMT(pv, i, n) {
    const f = Math.pow(1 + i, n);
    return pv * (i * f) / (f - 1);
  }

  /* ----------------------------------------------------------
     Relógio do status-bar (evita dependência do app.js)
  ---------------------------------------------------------- */
  const clockEl = $('.status-bar__time');
  if (clockEl) {
    function tick() {
      clockEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 30000);
  }

  /* ==========================================================
     MÓDULO A — Tela de Entrada de Valor (pix-entrada.html)
     Ativo quando #value-display existe.
  ========================================================== */
  var valueDisplay = $('#value-display');
  if (valueDisplay) {
    // Lê limite disponível do localStorage (padrão R$ 1.000,00)
    var PIX_LIMIT_DEFAULT = 100000;
    var pixLimitCents = parseInt(localStorage.getItem('ceapay_pix_limit') || String(PIX_LIMIT_DEFAULT), 10);
    if (isNaN(pixLimitCents) || pixLimitCents < 0) pixLimitCents = PIX_LIMIT_DEFAULT;

    // Atualiza o hint de limite
    var limitHint = $('#pix-limit-hint');
    function updateLimitHint(isError) {
      if (!limitHint) return;
      if (isError) {
        limitHint.classList.add('pix-limit-hint--error');
        limitHint.innerHTML = 'Valor excede o limite disponível de <strong>' + formatBRL(pixLimitCents) + '</strong>';
      } else {
        limitHint.classList.remove('pix-limit-hint--error');
        limitHint.innerHTML = 'Limite disponível: <strong>' + formatBRL(pixLimitCents) + '</strong>';
      }
    }
    updateLimitHint(false);

    // Inicializa com R$ 250,00 pré-preenchido
    var digits = [2, 5, 0, 0, 0];

    function renderValue() {
      var cents = parseInt(digits.join(''), 10) || 0;
      valueDisplay.innerHTML =
        formatBRL(cents) +
        '<span class="value-input-cursor" aria-hidden="true"></span>';
    }

    renderValue();

    $$('.numpad__key').forEach(function (key) {
      key.addEventListener('click', function () {
        var v = key.dataset.key;
        if (v === 'del') {
          digits.pop();
          if (digits.length === 0) digits = [0];
        } else if (v !== undefined) {
          // Substitui zero inicial; limita a 7 dígitos (R$ 99.999,99)
          if (digits.length === 1 && digits[0] === 0) {
            digits = [+v];
          } else if (digits.length < 7) {
            digits.push(+v);
          }
        }
        renderValue();
      });
    });

    var btnVer = $('#btn-ver-parcelas');
    if (btnVer) {
      btnVer.addEventListener('click', function () {
        var cents = parseInt(digits.join(''), 10) || 0;
        if (cents < 100) return; // mínimo R$ 1,00
        if (cents > pixLimitCents) {
          updateLimitHint(true);
          return; // bloqueia navegação
        }
        window.location.href = 'pix-simulador.html?valor=' + cents;
      });
    }
  }

  /* ==========================================================
     MÓDULO B — Simulador de Parcelas (pix-simulador.html)
     Ativo quando #installment-list existe.
  ========================================================== */
  var installmentList = $('#installment-list');
  if (installmentList) {
    var params = new URLSearchParams(window.location.search);
    var valorCents = parseInt(params.get('valor'), 10) || 50000;
    var pv = valorCents / 100;
    var installmentOptions = [3, 6, 9, 12];
    var selectedN = 3; // parcela padrão selecionada

    // Preenche o card de valor
    var valueCardAmount = $('#value-card-amount');
    if (valueCardAmount) valueCardAmount.textContent = formatBRL(valorCents);

    // Armazena pmt/total da seleção atual para o CTA
    var selectedPmt   = 0;
    var selectedTotal = 0;

    function buildItems() {
      installmentList.innerHTML = '';

      installmentOptions.forEach(function (n) {
        var rate  = RATES[n];
        var pmt   = calcPMT(pv, rate, n);
        var total = pmt * n;
        var pmtCents   = Math.round(pmt * 100);
        var totalCents = Math.round(total * 100);

        // Guarda a seleção padrão
        if (n === selectedN) {
          selectedPmt   = pmtCents;
          selectedTotal = totalCents;
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'installment-item' + (n === selectedN ? ' installment-item--active' : '');
        btn.dataset.n     = n;
        btn.dataset.pmt   = pmtCents;
        btn.dataset.total = totalCents;
        btn.setAttribute('aria-pressed', n === selectedN ? 'true' : 'false');
        btn.setAttribute('aria-label',
          n + ' vezes de ' + formatBRL(pmtCents) + ', total ' + formatBRL(totalCents));

        btn.innerHTML =
          '<span class="installment-item__radio" aria-hidden="true"></span>' +
          '<span class="installment-item__content">' +
            '<span class="installment-item__main">' +
              '<span class="installment-item__count">' + n + 'x&nbsp;de</span>' +
              '<span class="installment-item__value">' + formatBRL(pmtCents) + '</span>' +
            '</span>' +
            '<span class="installment-item__detail">' +
              (rate * 100).toFixed(2).replace('.', ',') + '% a.m. &middot; IOF incl.' +
            '</span>' +
          '</span>' +
          '<span class="installment-item__total">' +
            '<span class="installment-item__total-label">total</span>' +
            formatBRL(totalCents) +
          '</span>';

        btn.addEventListener('click', function () {
          selectedN     = n;
          selectedPmt   = pmtCents;
          selectedTotal = totalCents;

          $$('.installment-item').forEach(function (i) {
            i.classList.remove('installment-item--active');
            i.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('installment-item--active');
          btn.setAttribute('aria-pressed', 'true');
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        installmentList.appendChild(btn);
      });
    }

    buildItems();

    var btnPagar = $('#btn-pagar');
    if (btnPagar) {
      btnPagar.addEventListener('click', function () {
        var active = $('.installment-item--active');
        if (!active) return;
        window.location.href =
          'pix-confirmar.html' +
          '?valor='    + valorCents +
          '&parcelas=' + active.dataset.n +
          '&pmt='      + active.dataset.pmt +
          '&total='    + active.dataset.total;
      });
    }
  }

  /* ==========================================================
     MÓDULO C — Confirmação + PIN (pix-confirmar.html)
     Ativo quando #pin-section existe.
  ========================================================== */
  var pinSection = $('#pin-section');
  if (pinSection) {
    var params2     = new URLSearchParams(window.location.search);
    var valorCents2 = parseInt(params2.get('valor'),    10) || 50000;
    var parcelas    = parseInt(params2.get('parcelas'), 10) || 3;
    var pmtCents    = parseInt(params2.get('pmt'),      10) || 0;
    var totalCents  = parseInt(params2.get('total'),    10) || 0;

    // Preenche summary
    var elValor      = $('#summary-valor');
    var elParcelas   = $('#summary-parcelas');
    var elTotal      = $('#summary-total');
    var elVencimento = $('#summary-vencimento');
    var elSuccessAmt = $('#success-amount');

    if (elValor)      elValor.textContent    = formatBRL(valorCents2);
    if (elParcelas)   elParcelas.textContent = parcelas + 'x\u00a0de\u00a0' + formatBRL(pmtCents);
    if (elTotal)      elTotal.textContent    = formatBRL(totalCents);
    if (elVencimento) {
      var due = new Date();
      due.setMonth(due.getMonth() + 1);
      elVencimento.textContent = due.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
    if (elSuccessAmt) elSuccessAmt.textContent = formatBRL(totalCents);

    // PIN
    var pinDigits = [];
    var pinDots   = $$('.pin-dot');

    function updatePin() {
      pinDots.forEach(function (dot, i) {
        dot.classList.toggle('pin-dot--filled', i < pinDigits.length);
      });
    }

    function triggerSuccess() {
      var overlay = $('#success-overlay');
      if (!overlay) return;
      overlay.classList.add('visible');

      // Subtrai o total pago (principal + juros) do limite do Pix Parcelado
      var currentLimit = parseInt(localStorage.getItem('ceapay_pix_limit') || '100000', 10);
      if (isNaN(currentLimit)) currentLimit = 100000;
      var newLimit = Math.max(0, currentLimit - totalCents);
      localStorage.setItem('ceapay_pix_limit', String(newLimit));

      setTimeout(function () {
        window.location.href =
          'pix-comprovante.html' +
          '?valor='    + valorCents2 +
          '&parcelas=' + parcelas +
          '&pmt='      + pmtCents +
          '&total='    + totalCents;
      }, 1200);
    }

    $$('.numpad__key').forEach(function (key) {
      key.addEventListener('click', function () {
        var v = key.dataset.key;
        if (v === 'del') {
          pinDigits.pop();
          updatePin();
        } else if (v === 'go') {
          if (pinDigits.length === 6) triggerSuccess();
        } else if (v !== undefined && pinDigits.length < 6) {
          pinDigits.push(v);
          updatePin();
          if (pinDigits.length === 6) {
            setTimeout(triggerSuccess, 400);
          }
        }
      });
    });
  }

})();

/* ==========================================================
   MÓDULO D — Comprovante (pix-comprovante.html)
   Ativo quando #comprovante-section existe.
========================================================== */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  function formatBRL(cents) {
    return 'R$\u00a0' + (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  /* Relógio */
  var clockEl = $('.status-bar__time');
  if (clockEl) {
    function tick() {
      clockEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 30000);
  }

  var comprovanteSection = $('#comprovante-section');
  if (!comprovanteSection) return;

  var p         = new URLSearchParams(window.location.search);
  var valorC    = parseInt(p.get('valor'),    10) || 50000;
  var parcelasC = parseInt(p.get('parcelas'), 10) || 3;
  var pmtC      = parseInt(p.get('pmt'),      10) || 0;
  var totalC    = parseInt(p.get('total'),    10) || 0;
  var now       = new Date();

  /* Hero */
  var elAmt  = $('#hero-amount');
  var elDate = $('#hero-date');
  if (elAmt)  elAmt.textContent  = formatBRL(totalC);
  if (elDate) elDate.textContent =
    now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    '\u00a0às\u00a0' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  /* Linhas do recibo */
  var elRValor    = $('#r-valor');
  var elRParcelas = $('#r-parcelas');
  var elRTotal    = $('#r-total');
  var elRVenc     = $('#r-vencimento');
  var elProtocol  = $('#r-protocol');

  if (elRValor)    elRValor.textContent    = formatBRL(valorC);
  if (elRParcelas) elRParcelas.textContent = parcelasC + 'x\u00a0de\u00a0' + formatBRL(pmtC);
  if (elRTotal)    elRTotal.textContent    = formatBRL(totalC);
  if (elRVenc) {
    var due = new Date();
    due.setMonth(due.getMonth() + 1);
    elRVenc.textContent = due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  if (elProtocol) {
    elProtocol.textContent =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(Math.floor(Math.random() * 99999999) + 1).padStart(8, '0');
  }

  /* Botão compartilhar */
  var shareBtn = $('#btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var text =
        'Comprovante Pix Parcelado \u2014 C&A Pay\n\n' +
        'Para: C&A Modas Ltda\n' +
        'CNPJ: 45.242.914/0001-36\n' +
        'Banco: Banco C&A\n\n' +
        'Valor: '    + formatBRL(valorC) + '\n' +
        'Parcelas: ' + parcelasC + 'x de ' + formatBRL(pmtC) + '\n' +
        'Total: '    + formatBRL(totalC) + '\n\n' +
        'Protocolo: ' + (elProtocol ? elProtocol.textContent : '\u2014') + '\n' +
        'Data: '      + (elDate ? elDate.textContent : '\u2014');

      if (navigator.share) {
        navigator.share({ title: 'Comprovante C\u00e9A Pay', text: text }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var orig = shareBtn.innerHTML;
          shareBtn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>' +
            '\u00a0Comprovante copiado!';
          setTimeout(function () { shareBtn.innerHTML = orig; }, 2200);
        }).catch(function () {});
      }
    });
  }

})();
