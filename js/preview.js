/**
 * js/preview.js — Nokoprint-style live preview engine
 */

async function buildPreview() {
  if (!S.files.length) return;
  const f = activeFile();
  if (!f) return;
  S.currentPage = 1;
  layoutPaper();
  await renderPage();
  buildStripThumbs();
  updateSlider();
  updateDocInfo();
  updateInfoChips();
  renderFileTabs();
}

// ── 1. Paper layout ──────────────────────────────────────
function layoutPaper() {
  const viewport = document.getElementById('paperViewport');
  const paper    = document.getElementById('paper');
  const pArea    = document.getElementById('printableArea');
  const mGuide   = document.getElementById('marginGuide');
  if (!viewport) return;

  const [pw_mm, ph_mm] = getPaperDims();
  const vpW   = viewport.offsetWidth - 28;
  const maxH  = 320;
  const aspect = pw_mm / ph_mm;
  let paperW, paperH;
  if (vpW / aspect <= maxH) { paperW = vpW * S.displayZoom; paperH = (vpW / aspect) * S.displayZoom; }
  else                       { paperH = maxH * S.displayZoom; paperW = maxH * aspect * S.displayZoom; }

  paper.style.width  = paperW + 'px';
  paper.style.height = paperH + 'px';

  const scX = paperW / pw_mm, scY = paperH / ph_mm;
  const mt = S.margins.top    * scY, mb = S.margins.bottom * scY;
  const ml = S.margins.left   * scX, mr = S.margins.right  * scX;
  const paW = paperW - ml - mr, paH = paperH - mt - mb;

  pArea.style.cssText = `left:${ml}px;top:${mt}px;width:${paW}px;height:${paH}px;`;
  mGuide.style.cssText = `left:${ml-1}px;top:${mt-1}px;width:${paW+2}px;height:${paH+2}px;`;
  S._paW = paW; S._paH = paH;
}

// ── 2. Render current page ───────────────────────────────
async function renderPage() {
  const canvas  = document.getElementById('pdfCanvas');
  const blank   = document.getElementById('blankPage');
  const f       = activeFile();

  if (!f) { canvas.style.display = 'none'; blank.style.display = 'flex'; return; }

  blank.style.display = 'none';
  canvas.style.display = 'block';
  canvas.style.cssText = 'display:block;position:absolute;top:0;left:0;';

  if (f.type === 'DOCX' || f.type === 'DOC') {
    renderWordPlaceholder(canvas, f);
  } else if (f.type !== 'PDF' || !f.pdfDoc) {
    await renderImageFile(canvas, f.file);
  } else {
    await renderPDFPage(canvas, f.pdfDoc);
  }
  applyColorFilter();
  updateNavBtns(f);
}

async function renderPDFPage(canvas, pdfDoc) {
  try {
    const page  = await pdfDoc.getPage(S.currentPage);
    const rawVP = page.getViewport({ scale: 1 });
    const fit   = Math.min(S._paW / rawVP.width, S._paH / rawVP.height) * (S.scale / 100);
    const vp    = page.getViewport({ scale: fit });
    canvas.width  = vp.width;
    canvas.height = vp.height;
    canvas.style.left = Math.max(0, (S._paW - vp.width)  / 2) + 'px';
    canvas.style.top  = Math.max(0, (S._paH - vp.height) / 2) + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch (e) { console.error('[renderPDF]', e); }
}

function renderWordPlaceholder(canvas, f) {
  const w = Math.round(S._paW) || 300;
  const h = Math.round(S._paH) || 400;
  canvas.width  = w;
  canvas.height = h;
  canvas.style.left = '0px';
  canvas.style.top  = '0px';
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = S.colorMode === 'bw' ? '#f4f4f4' : '#eef3fb';
  ctx.fillRect(0, 0, w, h);

  // Word "W" badge
  const badgeR = Math.min(w, h) * 0.14;
  const cx = w / 2, cy = h / 2 - badgeR * 0.6;
  ctx.fillStyle = S.colorMode === 'bw' ? '#555' : '#2b579a';
  ctx.beginPath();
  ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(badgeR * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', cx, cy);

  ctx.fillStyle = '#444';
  ctx.font = `${Math.round(Math.min(w, h) * 0.042)}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const nameY = cy + badgeR + Math.round(Math.min(w, h) * 0.08);
  const maxW  = w * 0.85;
  let displayName = f.name;
  if (ctx.measureText(displayName).width > maxW) {
    while (displayName.length > 5 && ctx.measureText(displayName + '…').width > maxW) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }
  ctx.fillText(displayName, cx, nameY);

  ctx.fillStyle = '#888';
  ctx.font      = `${Math.round(Math.min(w, h) * 0.036)}px sans-serif`;
  ctx.fillText(
    `Page ${S.currentPage} of ${f.selectedPages || f.totalPages} · ${f.totalPages} page${f.totalPages !== 1 ? 's' : ''} total`,
    cx, nameY + Math.round(Math.min(w, h) * 0.07)
  );

  ctx.fillStyle = '#bbb';
  ctx.font      = `${Math.round(Math.min(w, h) * 0.032)}px sans-serif`;
  ctx.fillText('Word document — preview not available', cx, nameY + Math.round(Math.min(w, h) * 0.13));
}

function renderImageFile(canvas, file) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const fit   = Math.min(S._paW / img.width, S._paH / img.height) * (S.scale / 100);
      canvas.width  = img.width  * fit;
      canvas.height = img.height * fit;
      canvas.style.left = Math.max(0, (S._paW - canvas.width)  / 2) + 'px';
      canvas.style.top  = Math.max(0, (S._paH - canvas.height) / 2) + 'px';
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url); resolve();
    };
    img.onerror = resolve; img.src = url;
  });
}

function applyColorFilter() {
  const c = document.getElementById('pdfCanvas');
  c.style.filter = S.colorMode === 'bw' ? 'grayscale(1) contrast(1.08)' : 'none';
}

function updateNavBtns(f) {
  const total = f ? f.totalPages : 1;
  document.getElementById('prevBtn').disabled = S.currentPage <= 1;
  document.getElementById('nextBtn').disabled = S.currentPage >= total;
  document.getElementById('pgCounter').textContent = S.currentPage + ' / ' + (f?.selectedPages || total);
}

// ── 3. Page change ───────────────────────────────────────
async function changePage(dir) {
  const f = activeFile(); if (!f) return;
  const np = S.currentPage + dir;
  if (np < 1 || np > f.totalPages) return;
  S.currentPage = np;
  document.querySelectorAll('.pgm').forEach((t, i) => t.classList.toggle('apg', i === np - 1));
  await renderPage();
}

// ── 4. Thumbnail strip ───────────────────────────────────
function buildStripThumbs() {
  const f = activeFile();
  const strip = document.getElementById('pgstrip');
  strip.innerHTML = '';
  if (!f) return;

  for (let i = 1; i <= f.totalPages; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'pgm' + (i === S.currentPage ? ' apg' : '') + (i > f.selectedPages ? ' excl' : '');
    const pDiv = document.createElement('div'); pDiv.className = 'pgm-paper';
    const thumb = f.thumbnails[i - 1];
    if (thumb) {
      const c = document.createElement('canvas');
      c.width = thumb.width; c.height = thumb.height;
      c.getContext('2d').drawImage(thumb, 0, 0);
      c.style.cssText = 'width:100%;height:100%;object-fit:contain;' + (S.colorMode === 'bw' ? 'filter:grayscale(1)' : '');
      pDiv.appendChild(c);
    }
    const lbl = document.createElement('div'); lbl.className = 'pgm-lbl'; lbl.textContent = 'p' + i;
    wrap.appendChild(pDiv); wrap.appendChild(lbl);
    const idx = i;
    wrap.addEventListener('click', () => { S.currentPage = idx; changePage(0); });
    strip.appendChild(wrap);
  }
}

// ── 5. File tabs (multi-file) ────────────────────────────
function renderFileTabs() {
  const tabs = document.getElementById('fileTabs');
  if (!tabs) return;
  if (S.files.length <= 1) { tabs.style.display = 'none'; return; }
  tabs.style.display = 'flex';
  tabs.innerHTML = S.files.map((f, i) => `
    <button class="ftab ${i === S.activeFileIdx ? 'active' : ''}" data-idx="${i}">
      ${f.type === 'PDF' ? '📄' : (f.type === 'DOCX' || f.type === 'DOC') ? '📝' : '🖼️'} ${esc(f.name.length > 12 ? f.name.slice(0, 12) + '…' : f.name)}
    </button>`).join('');
  tabs.querySelectorAll('.ftab').forEach(btn =>
    btn.addEventListener('click', async () => {
      S.activeFileIdx = parseInt(btn.dataset.idx);
      S.currentPage = 1;
      await buildPreview();
    }));
}

// ── 6. Info chips + doc info ─────────────────────────────
function updateInfoChips() {
  const avgM = Math.round((S.margins.top + S.margins.bottom + S.margins.left + S.margins.right) / 4);
  document.getElementById('chip-size').textContent  = S.paperSize + ' · ' + (S.orientation === 'portrait' ? 'Portrait' : 'Landscape');
  const cc = document.getElementById('chip-color');
  cc.textContent = S.colorMode === 'bw' ? 'B&W' : 'Full Color';
  cc.className   = 'pinfo-chip' + (S.colorMode !== 'bw' ? ' active-chip' : '');
  document.getElementById('chip-scale').textContent  = 'Scale: ' + S.scale + '%';
  document.getElementById('chip-margin').textContent = 'Margin: ' + avgM + 'mm';
  document.getElementById('pgsetSummary').textContent = `Margin: ${avgM}mm · Scale: ${S.scale}% · ${S.orientation === 'portrait' ? 'Portrait' : 'Landscape'}`;
}

function updateDocInfo() {
  const f = activeFile();
  document.getElementById('fname').textContent    = f ? f.name : '—';
  document.getElementById('fdetails').textContent = f
    ? `${f.totalPages} pages · ${f.sizeMB} MB · ${f.type}` + (S.files.length > 1 ? ` · File ${S.activeFileIdx + 1} of ${S.files.length}` : '')
    : '—';
}

// ── 7. Slider ────────────────────────────────────────────
function updateSlider() {
  const f = activeFile(); if (!f) return;
  const r = document.getElementById('pgRange');
  r.max = f.totalPages; r.value = f.selectedPages;
  setSliderGrad(r);
  document.getElementById('rdisp').textContent =
    f.selectedPages === f.totalPages ? `All (1–${f.totalPages})` : `1–${f.selectedPages} of ${f.totalPages}`;
  document.getElementById('rmax').textContent = 'Pg ' + f.totalPages;
}

// ── 8. Zoom ──────────────────────────────────────────────
function zoomIn()  { S.displayZoom = Math.min(2.5, +(S.displayZoom + 0.25).toFixed(2)); refreshZoom(); }
function zoomOut() { S.displayZoom = Math.max(0.4, +(S.displayZoom - 0.25).toFixed(2)); refreshZoom(); }
async function refreshZoom() {
  document.getElementById('zoomLbl').textContent = Math.round(S.displayZoom * 100) + '%';
  layoutPaper(); await renderPage();
}
