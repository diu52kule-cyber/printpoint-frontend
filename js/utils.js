/** js/utils.js — shared helpers */

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast on' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('on'), 3200);
}

function fmtINR(v) { return '₹' + Number(v).toFixed(2); }

function calcPrice() {
  const pages = totalSelectedPages() * S.copies;
  const bwP   = S.colorMode === 'bw'    ? pages : 0;
  const colP  = S.colorMode === 'color' ? pages : 0;
  const bwC   = bwP  * CONFIG.BW_PPP;
  const colC  = colP * CONFIG.COL_PPP;
  return { bwP, colP, bwC, colC, total: bwC + colC + CONFIG.SVC_FEE };
}

function setSliderGrad(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background =
    `linear-gradient(to right,var(--red) 0%,var(--red) ${pct}%,var(--border) ${pct}%,var(--border) 100%)`;
}

function getPaperDims() {
  const base = CONFIG.PAPER_SIZES[S.paperSize] || CONFIG.PAPER_SIZES.A4;
  return S.orientation === 'portrait' ? [...base] : [base[1], base[0]];
}

function esc(s)     { return String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }

// Simple poll helper
function poll(fn, interval, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      if (Date.now() - start > timeout) return reject(new Error('Polling timed out'));
      const result = await fn();
      if (result) return resolve(result);
      setTimeout(tick, interval);
    };
    tick();
  });
}
