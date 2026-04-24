/** js/app.js — entry point, all event bindings */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Init Google auth after GIS script loads
  window.addEventListener('load', () => setTimeout(initGoogleAuth, 800));

  // ── Step 1 ────────────────────────────────────────────
  document.getElementById('fileIn').addEventListener('change', e => addFiles(e.target.files));
  document.getElementById('addMoreBtn').addEventListener('click', () =>
    document.getElementById('fileIn').click());
  document.getElementById('clearAllBtn').addEventListener('click', removeAllFiles);
  document.getElementById('nxt1').addEventListener('click', () => gotoStep(2));
  document.getElementById('driveBtn').addEventListener('click', openDriveSheet);
  initDragDrop();

  // ── Step 2 ────────────────────────────────────────────
  document.getElementById('prevBtn').addEventListener('click', () => changePage(-1));
  document.getElementById('nextBtn').addEventListener('click', () => changePage(1));
  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('pageSettingsTopBtn').addEventListener('click', openPageSettings);
  document.getElementById('pageSettingsBtn').addEventListener('click', openPageSettings);
  document.getElementById('cpMinus').addEventListener('click', () => chCopies(-1));
  document.getElementById('cpPlus').addEventListener('click',  () => chCopies(1));
  document.getElementById('colorSel').addEventListener('change', onSettingChange);
  document.getElementById('paperSel').addEventListener('change', onSettingChange);
  document.getElementById('pgRange').addEventListener('input',   e => onRangeChange(e.target.value));
  document.getElementById('addDocBtn').addEventListener('click', () => gotoStep(1));
  document.getElementById('nxt2').addEventListener('click', () => gotoStep(3));
  document.getElementById('back1').addEventListener('click', () => gotoStep(1));

  // ── Step 3 ────────────────────────────────────────────
  document.getElementById('uploadPayBtn').addEventListener('click', startPayment);
  document.getElementById('back2').addEventListener('click', () => gotoStep(2));

  // ── Success ───────────────────────────────────────────
  document.getElementById('printAnotherBtn').addEventListener('click', resetApp);

  // ── Drive sheet ───────────────────────────────────────
  document.getElementById('closeDriveBtn').addEventListener('click', closeDriveSheet);
  document.getElementById('driveOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDriveSheet();
  });

  // ── Page settings sheet ───────────────────────────────
  document.getElementById('closePsBtn').addEventListener('click', closePageSettings);
  document.getElementById('psOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePageSettings();
  });
  document.getElementById('scaleRange').addEventListener('input', e => onScaleSlide(e.target.value));
  document.getElementById('ob-p').addEventListener('click', () => setOrientation('portrait'));
  document.getElementById('ob-l').addEventListener('click', () => setOrientation('landscape'));
  document.getElementById('applyPsBtn').addEventListener('click', applyPageSettings);

  // ── Resize ────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (document.getElementById('p2').classList.contains('active')) {
      layoutPaper(); renderPage();
    }
  });
});

function resetApp() {
  resetState();
  document.getElementById('fileIn').value = '';
  document.getElementById('nxt1').disabled = true;
  document.getElementById('dropZone').style.cssText = '';
  document.getElementById('dtxt').textContent = 'Tap to upload files';
  document.getElementById('dsub').textContent = 'PDF, JPG, PNG, DOCX, DOC — up to 10 files';
  document.getElementById('fileList').innerHTML = '';
  document.getElementById('colorSel').value  = 'bw';
  document.getElementById('paperSel').value  = 'A4';
  document.getElementById('cpval').textContent = '1';
  document.getElementById('pdfCanvas').style.display = 'none';
  document.getElementById('blankPage').style.display = 'flex';
  document.getElementById('pgstrip').innerHTML = '';
  document.getElementById('succ').classList.remove('active');
  document.getElementById('ob-p').classList.add('sel');
  document.getElementById('ob-l').classList.remove('sel');
  gotoStep(1);
}
