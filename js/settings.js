/** js/settings.js */

async function onSettingChange() {
  S.colorMode = document.getElementById('colorSel').value;
  S.paperSize = document.getElementById('paperSel').value;
  applyColorFilter();
  document.querySelectorAll('.pgm canvas').forEach(c =>
    c.style.filter = S.colorMode === 'bw' ? 'grayscale(1)' : 'none');
  layoutPaper(); await renderPage();
  updateInfoChips(); updatePrice();
}

function chCopies(d) {
  S.copies = Math.max(1, Math.min(99, S.copies + d));
  document.getElementById('cpval').textContent = S.copies;
  updatePrice();
}

function onRangeChange(v) {
  const f = activeFile(); if (!f) return;
  f.selectedPages = parseInt(v);
  setSliderGrad(document.getElementById('pgRange'));
  document.getElementById('rdisp').textContent =
    f.selectedPages === f.totalPages ? `All (1–${f.totalPages})` : `1–${f.selectedPages} of ${f.totalPages}`;
  document.getElementById('pgCounter').textContent = S.currentPage + ' / ' + f.selectedPages;
  document.querySelectorAll('.pgm').forEach((t, i) => t.classList.toggle('excl', i + 1 > f.selectedPages));
  updatePrice();
}

function updatePrice() {
  const { bwP, colP, bwC, colC, total } = calcPrice();
  document.getElementById('m_bw').textContent  = bwP  + ' × ' + fmtINR(CONFIG.BW_PPP)  + ' = ' + fmtINR(bwC);
  document.getElementById('m_col').textContent = colP + ' × ' + fmtINR(CONFIG.COL_PPP) + ' = ' + fmtINR(colC);
  document.getElementById('m_tot').textContent = fmtINR(total);
}

function updatePaySummary() {
  const { bwP, colP, bwC, colC, total } = calcPrice();
  document.getElementById('bwLbl').textContent  = `B&W Pages (${bwP} × ${fmtINR(CONFIG.BW_PPP)})`;
  document.getElementById('colLbl').textContent = `Color Pages (${colP} × ${fmtINR(CONFIG.COL_PPP)})`;
  document.getElementById('bwP').textContent    = fmtINR(bwC);
  document.getElementById('colP').textContent   = fmtINR(colC);
  document.getElementById('totAmt').textContent = fmtINR(total);
  document.getElementById('filesSummary').textContent =
    S.files.map(f => f.name).join(', ') + ` · ${S.copies} cop${S.copies > 1 ? 'ies' : 'y'} · ${S.colorMode === 'bw' ? 'B&W' : 'Color'}`;
}

// ── Page Settings sheet ───────────────────────────────────
function openPageSettings() {
  const sr = document.getElementById('scaleRange');
  sr.value = S.scale;
  document.getElementById('scaleVal').textContent = S.scale + '%';
  setSliderGrad(sr);
  document.getElementById('mTop').value   = S.margins.top;
  document.getElementById('mBot').value   = S.margins.bottom;
  document.getElementById('mLeft').value  = S.margins.left;
  document.getElementById('mRight').value = S.margins.right;
  document.getElementById('ob-p').classList.toggle('sel', S.orientation === 'portrait');
  document.getElementById('ob-l').classList.toggle('sel', S.orientation === 'landscape');
  document.getElementById('psOverlay').classList.add('open');
}

function closePageSettings() { document.getElementById('psOverlay').classList.remove('open'); }

function onScaleSlide(v) {
  document.getElementById('scaleVal').textContent = v + '%';
  setSliderGrad(document.getElementById('scaleRange'));
}

function setOrientation(o) {
  S.orientation = o;
  document.getElementById('ob-p').classList.toggle('sel', o === 'portrait');
  document.getElementById('ob-l').classList.toggle('sel', o === 'landscape');
}

async function applyPageSettings() {
  S.scale = parseInt(document.getElementById('scaleRange').value);
  S.margins = {
    top:    parseInt(document.getElementById('mTop').value)   || 0,
    bottom: parseInt(document.getElementById('mBot').value)   || 0,
    left:   parseInt(document.getElementById('mLeft').value)  || 0,
    right:  parseInt(document.getElementById('mRight').value) || 0,
  };
  closePageSettings();
  layoutPaper(); await renderPage();
  updateInfoChips();
  showToast('✓ Page settings applied', 'g');
}
