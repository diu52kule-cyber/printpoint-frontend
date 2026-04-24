/** js/drive.js */

const MAX_AUTH_INIT_RETRIES = 20;
const AUTH_INIT_RETRY_DELAY_MS = 500;

let _tokenClient = null, _searchTimer = null, _authRetryTimer = null, _authRetryPending = false;

function hasGoogleClientId() {
  return !!CONFIG.GOOGLE_CLIENT_ID &&
    CONFIG.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID.apps.googleusercontent.com';
}

function initGoogleAuth(retriesLeft = MAX_AUTH_INIT_RETRIES) {
  if (_tokenClient || !hasGoogleClientId()) return;
  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    if (retriesLeft <= 0) return;
    if (_authRetryPending) return;
    clearTimeout(_authRetryTimer);
    _authRetryPending = true;
    _authRetryTimer = setTimeout(() => {
      _authRetryPending = false;
      initGoogleAuth(retriesLeft - 1);
    }, AUTH_INIT_RETRY_DELAY_MS);
    return;
  }
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope:     'https://www.googleapis.com/auth/drive.readonly',
    callback:  async resp => {
      if (resp.error) { showToast('Sign-in failed', 'r'); return; }
      S.driveToken = resp.access_token;
      await fetchDriveFiles();
    },
  });
}

function openDriveSheet() {
  S.selectedDriveFileId = null;
  document.getElementById('driveOverlay').classList.add('open');
  S.driveToken ? fetchDriveFiles() : renderDriveAuth();
}
function closeDriveSheet() { document.getElementById('driveOverlay').classList.remove('open'); }

function renderDriveAuth() {
  document.getElementById('driveBody').innerHTML = `
    <div class="drive-auth-msg">
      <p>Sign in to browse your Google Drive files.</p>
      <button class="gauthbtn" id="gSignInBtn">
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign in with Google
      </button>
      <p style="margin-top:10px;font-size:11px;color:#bbb">Set GOOGLE_CLIENT_ID in js/config.js</p>
    </div>`;
  document.getElementById('gSignInBtn').addEventListener('click', () => {
    if (!hasGoogleClientId()) { showToast('Set GOOGLE_CLIENT_ID in config.js', 'r'); return; }
    initGoogleAuth();
    if (!_tokenClient) { showToast('Google Sign-In is still loading, try again', 'r'); return; }
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function fetchDriveFiles(q = '') {
  document.getElementById('driveBody').innerHTML =
    `<div style="display:flex;align-items:center;justify-content:center;gap:9px;padding:28px;color:var(--sub);font-size:13px;"><div class="spin dark on"></div> Loading…</div>`;
  try {
    const url = `${CONFIG.BACKEND_URL}/api/drive/files${q ? '?q=' + encodeURIComponent(q) : ''}`;
    const r   = await fetch(url, { headers: { Authorization: 'Bearer ' + S.driveToken } });
    if (r.status === 401) { S.driveToken = null; renderDriveAuth(); return; }
    if (!r.ok) throw new Error('Drive API error');
    const data = await r.json();
    renderDriveList(data.files || []);
  } catch (e) {
    document.getElementById('driveBody').innerHTML =
      `<div style="padding:24px;text-align:center;color:var(--sub);font-size:13px;">Failed. Check backend URL.</div>`;
  }
}

function renderDriveList(files) {
  const icoFor  = m => m === 'application/pdf' ? 'pdf' : m.startsWith('image/') ? 'img' : 'doc';
  const emoFor  = m => m === 'application/pdf' ? '📄' : m.startsWith('image/') ? '🖼️' : '📝';
  const sizeFmt = s => !s ? '—' : s > 1048576 ? (s/1048576).toFixed(1)+' MB' : Math.round(s/1024)+' KB';
  const dateFmt = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';

  const listHtml = files.length
    ? files.map(f => `<div class="dfile" data-id="${escAttr(f.id)}" data-name="${escAttr(f.name)}" data-mime="${escAttr(f.mimeType)}">
        <div class="dfico ${icoFor(f.mimeType)}">${emoFor(f.mimeType)}</div>
        <div class="dfi"><h4>${esc(f.name)}</h4><p>${sizeFmt(f.size)} · ${dateFmt(f.modifiedTime)}</p></div>
        <span class="dchk">✓</span></div>`).join('')
    : `<div style="padding:24px;text-align:center;color:var(--sub);font-size:13px;">No printable files found</div>`;

  document.getElementById('driveBody').innerHTML = `
    <div class="dsearch"><input type="text" id="dSearch" placeholder="🔍  Search Drive…"/></div>
    <div class="dfiles-list">${listHtml}</div>
    <div class="dfooter">
      <button class="dcancel" id="dCancelBtn">Cancel</button>
      <button class="dsel" id="dSelBtn" disabled>Add to Queue</button>
    </div>`;

  document.getElementById('dCancelBtn').addEventListener('click', closeDriveSheet);
  document.getElementById('dSelBtn').addEventListener('click', downloadDriveFile);
  document.getElementById('dSearch').addEventListener('input', e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => fetchDriveFiles(e.target.value), 400);
  });
  document.querySelectorAll('.dfile').forEach(el =>
    el.addEventListener('click', () => {
      S.selectedDriveFileId = el.dataset.id;
      document.querySelectorAll('.dfile').forEach(x => x.classList.toggle('sel', x === el));
      document.getElementById('dSelBtn').disabled = false;
    }));
}

async function downloadDriveFile() {
  if (!S.selectedDriveFileId) return;
  const el   = document.querySelector(`.dfile[data-id="${CSS.escape(S.selectedDriveFileId)}"]`);
  const btn  = document.getElementById('dSelBtn');
  btn.textContent = 'Downloading…'; btn.disabled = true;

  try {
    const r = await fetch(
      `${CONFIG.BACKEND_URL}/api/drive/download/${S.selectedDriveFileId}`,
      { headers: { Authorization: 'Bearer ' + S.driveToken } }
    );
    if (!r.ok) throw new Error('Download failed');
    const name = decodeURIComponent(r.headers.get('X-File-Name') || el.dataset.name);
    const mime = r.headers.get('Content-Type') || el.dataset.mime;
    const buf  = await r.arrayBuffer();
    const file = new File([buf], name, { type: mime });
    closeDriveSheet();
    await addFiles([file]);
  } catch (e) {
    showToast('Download failed', 'r');
    btn.textContent = 'Add to Queue'; btn.disabled = false;
  }
}
