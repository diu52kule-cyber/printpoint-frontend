/**
 * js/state.js — Single source of truth
 */
const S = {
  // ── Files (multi-file support) ─────────────────────────
  files: [],           // Array<{ file, name, sizeMB, type, pdfDoc, totalPages, thumbnails }>
  activeFileIdx: 0,    // which file is being previewed

  // ── PDF preview ───────────────────────────────────────
  currentPage:   1,
  displayZoom:   1.0,
  _paW: 0, _paH: 0,   // computed printable area px

  // ── Print settings ────────────────────────────────────
  copies:       1,
  colorMode:    'bw',
  paperSize:    'A4',
  orientation:  'portrait',
  scale:        100,
  margins:      { top: 10, bottom: 10, left: 10, right: 10 },

  // ── Job (set after /api/upload) ───────────────────────
  jobId:        null,
  amountPaise:  0,

  // ── Drive ─────────────────────────────────────────────
  driveToken:   null,
  selectedDriveFileId: null,
};

function resetState() {
  S.files          = [];
  S.activeFileIdx  = 0;
  S.currentPage    = 1;
  S.displayZoom    = 1.0;
  S.copies         = 1;
  S.colorMode      = 'bw';
  S.paperSize      = 'A4';
  S.orientation    = 'portrait';
  S.scale          = 100;
  S.margins        = { top: 10, bottom: 10, left: 10, right: 10 };
  S.jobId          = null;
  S.amountPaise    = 0;
  S.selectedDriveFileId = null;
  // keep driveToken — user stays signed in
}

// Helpers
function activeFile() { return S.files[S.activeFileIdx] || null; }
function totalSelectedPages() {
  return S.files.reduce((sum, f) => sum + (f.selectedPages || f.totalPages || 1), 0);
}
