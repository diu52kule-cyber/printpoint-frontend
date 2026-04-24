/**
 * js/upload.js
 * Handles local file selection (multi), drag-drop, Drive import.
 * Each file gets its own entry in S.files[].
 */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ── Add one or more files ────────────────────────────────
async function addFiles(fileList) {
  const arr = Array.from(fileList).slice(0, 10 - S.files.length);
  if (!arr.length) return showToast('Max 10 files', 'r');

  for (const file of arr) {
    if (file.size > 50 * 1024 * 1024) {
      showToast(file.name + ' exceeds 50 MB — skipped', 'r'); continue;
    }
    showToast('Loading ' + file.name + '…');
    const entry = await buildFileEntry(file);
    S.files.push(entry);
  }

  renderFileList();
  document.getElementById('nxt1').disabled = S.files.length === 0;
  if (S.files.length) showToast('✓ ' + S.files.length + ' file(s) ready', 'g');
}

async function buildFileEntry(file) {
  const type    = file.name.split('.').pop().toUpperCase();
  const sizeMB  = (file.size / 1048576).toFixed(1);
  const entry   = { file, name: file.name, sizeMB, type, pdfDoc: null, totalPages: 1, selectedPages: 1, thumbnails: [] };

  if (type === 'PDF') {
    try {
      const buf   = await file.arrayBuffer();
      entry.pdfDoc     = await pdfjsLib.getDocument({ data: buf }).promise;
      entry.totalPages = entry.pdfDoc.numPages;
      entry.selectedPages = entry.totalPages;
      await buildThumbs(entry);
    } catch (e) { console.warn('PDF parse:', e); }
  } else if (type === 'DOCX') {
    try {
      const pageCount = await getDocxPageCount(file);
      entry.totalPages    = pageCount;
      entry.selectedPages = pageCount;
    } catch (e) { console.warn('DOCX parse:', e); }
  } else if (type === 'DOC') {
    // Legacy binary format — page count cannot be extracted client-side
    entry.totalPages    = 1;
    entry.selectedPages = 1;
  }
  return entry;
}

async function getDocxPageCount(file) {
  if (typeof JSZip === 'undefined') return 1;
  const zip    = await JSZip.loadAsync(file);
  const appXml = zip.file('docProps/app.xml');
  if (!appXml) return 1;
  const xml   = await appXml.async('string');
  const match = xml.match(/<Pages>(\d+)<\/Pages>/i);
  const parsed = parseInt(match ? match[1] : '', 10);
  return (parsed > 0) ? parsed : 1;
}

async function buildThumbs(entry) {
  entry.thumbnails = [];
  const n = Math.min(entry.totalPages, 20);
  for (let i = 1; i <= n; i++) {
    const page = await entry.pdfDoc.getPage(i);
    const vp   = page.getViewport({ scale: 0.2 });
    const c    = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    entry.thumbnails.push(c);
  }
}

// ── Render the file list in step 1 ──────────────────────
function renderFileList() {
  const list = document.getElementById('fileList');
  if (!list) return;

  if (S.files.length === 0) {
    list.innerHTML = '';
    document.getElementById('dropZone').style.cssText = '';
    document.getElementById('dtxt').textContent = 'Tap to upload files';
    document.getElementById('dsub').textContent = 'PDF, JPG, PNG, DOCX, DOC — up to 10 files';
    return;
  }

  document.getElementById('dropZone').style.cssText = 'border-color:var(--green);background:#f0fdf4;pointer-events:none;';
  document.getElementById('dtxt').textContent = '✓ ' + S.files.length + ' file(s) selected';
  document.getElementById('dsub').textContent = 'Tap + Add More to add another file';

  list.innerHTML = S.files.map((f, i) => `
    <div class="fitem ${i === S.activeFileIdx ? 'factive' : ''}" data-idx="${i}">
      <div class="fitem-ico">${f.type === 'PDF' ? '📄' : (f.type === 'DOCX' || f.type === 'DOC') ? '📝' : '🖼️'}</div>
      <div class="fitem-info">
        <span class="fitem-name">${esc(f.name)}</span>
        <span class="fitem-sub">${f.sizeMB} MB · ${f.totalPages} page${f.totalPages !== 1 ? 's' : ''}</span>
      </div>
      <button class="fitem-del" data-idx="${i}" title="Remove">✕</button>
    </div>`).join('');

  list.querySelectorAll('.fitem').forEach(el =>
    el.addEventListener('click', e => {
      if (e.target.classList.contains('fitem-del')) return;
      S.activeFileIdx = parseInt(el.dataset.idx);
      renderFileList();
    }));

  list.querySelectorAll('.fitem-del').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeFileAt(parseInt(btn.dataset.idx));
    }));
}

function removeFileAt(idx) {
  S.files.splice(idx, 1);
  if (S.activeFileIdx >= S.files.length) S.activeFileIdx = Math.max(0, S.files.length - 1);
  renderFileList();
  document.getElementById('nxt1').disabled = S.files.length === 0;
}

function removeAllFiles() {
  S.files = []; S.activeFileIdx = 0;
  renderFileList();
  document.getElementById('nxt1').disabled = true;
  document.getElementById('fileIn').value = '';
}

// ── Drag & drop ──────────────────────────────────────────
function initDragDrop() {
  const dz = document.getElementById('dropZone');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', ()  => dz.classList.remove('drag'));
  dz.addEventListener('drop', async e => {
    e.preventDefault(); dz.classList.remove('drag');
    await addFiles(e.dataTransfer.files);
  });
}
