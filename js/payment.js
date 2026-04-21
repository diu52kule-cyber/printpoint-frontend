/**
 * js/payment.js
 *
 * Full secure payment flow:
 *   1. Upload files → backend compiles PDF → stores in Supabase → returns jobId
 *   2. Create Razorpay order via backend (key_secret never in browser)
 *   3. Open Razorpay checkout
 *   4. On success: poll backend /api/jobs/:jobId until status === 'paid'
 *   5. Show barcode
 *   6. On failure: DELETE /api/jobs/:jobId → backend removes PDF from Supabase
 */

// ── Step 3 entry ──────────────────────────────────────────
async function startPayment() {
  if (!S.files.length) return showToast('No files to print', 'r');

  const btn = document.getElementById('uploadPayBtn');
  const spn = document.getElementById('uploadSpin');
  btn.disabled = true; spn.classList.add('on');
  showToast('Uploading & compiling PDF…');

  try {
    // ── 1. Upload all files to backend ─────────────────
    const jobId = await uploadFilesToBackend();
    S.jobId = jobId;

    // ── 2. Get Razorpay order from backend ─────────────
    const orderRes = await fetch(`${CONFIG.BACKEND_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!orderRes.ok) {
      const e = await orderRes.json();
      throw new Error(e.error || 'Order creation failed');
    }

    const { orderId, amount, currency, keyId } = await orderRes.json();

    btn.disabled = false; spn.classList.remove('on');

    // ── 3. Open Razorpay checkout ───────────────────────
    const options = {
      key:         keyId,        // public key — safe in browser
      amount,
      currency,
      order_id:    orderId,
      name:        'PrintPoint',
      description: `${S.files.length} file(s) · ${S.copies}× · ${S.colorMode === 'bw' ? 'B&W' : 'Color'}`,
      theme:       { color: '#E8394A' },

      handler: async (response) => {
        // payment.captured webhook handles DB update on backend
        // we just poll here until the job is marked paid
        showSuccess_polling(S.jobId, response.razorpay_payment_id);
      },

      modal: {
        ondismiss: async () => {
          showToast('Payment cancelled — cleaning up…', 'r');
          await cancelJob(S.jobId);
          S.jobId = null;
          btn.disabled = false; spn.classList.remove('on');
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', async (resp) => {
      showToast('Payment failed: ' + resp.error.description, 'r');
      await cancelJob(S.jobId);
      S.jobId = null;
      btn.disabled = false; spn.classList.remove('on');
    });
    rzp.open();

  } catch (err) {
    console.error('[Payment]', err);
    showToast(err.message || 'Error — try again', 'r');
    btn.disabled = false; spn.classList.remove('on');
  }
}

// ── Upload all files as multipart/form-data ────────────────
async function uploadFilesToBackend() {
  const form = new FormData();

  for (const entry of S.files) {
    form.append('files', entry.file, entry.name);
  }

  const settings = {
    copies:        S.copies,
    colorMode:     S.colorMode,
    paperSize:     S.paperSize,
    orientation:   S.orientation,
    scale:         S.scale,
    margins:       S.margins,
    selectedPages: activeFile()?.selectedPages,
  };
  form.append('settings', JSON.stringify(settings));

  const res = await fetch(`${CONFIG.BACKEND_URL}/api/upload`, {
    method: 'POST',
    body:   form,
    // DO NOT set Content-Type — browser sets it with boundary automatically
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Upload failed (' + res.status + ')');
  }

  const { jobId, amountPaise } = await res.json();
  S.amountPaise = amountPaise;
  return jobId;
}

// ── Poll backend until job is paid ────────────────────────
async function showSuccess_polling(jobId, _paymentId) {
  showToast('Verifying payment…');

  // Show a loading screen while we wait
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('verifying').classList.add('active');

  try {
    const job = await poll(
      async () => {
        const r    = await fetch(`${CONFIG.BACKEND_URL}/api/jobs/${jobId}`);
        const data = await r.json();
        if (data.status === 'paid')           return data;
        if (data.status === 'payment_failed') throw new Error('Payment verification failed');
        return null; // keep polling
      },
      CONFIG.POLL_INTERVAL,
      CONFIG.POLL_TIMEOUT
    );
    showSuccessScreen(job.barcode);
  } catch (err) {
    showToast(err.message || 'Verification failed', 'r');
    document.getElementById('verifying').classList.remove('active');
    gotoStep(3);
  }
}

// ── Cancel job (delete PDF from backend) ──────────────────
async function cancelJob(jobId) {
  if (!jobId) return;
  try {
    await fetch(`${CONFIG.BACKEND_URL}/api/jobs/${jobId}`, { method: 'DELETE' });
  } catch (_) {}
}

// ── Success screen ────────────────────────────────────────
function showSuccessScreen(barcode) {
  document.querySelectorAll('.panel, #verifying').forEach(p => p.classList.remove('active'));
  document.getElementById('succ').classList.add('active');
  document.getElementById('jobCode').textContent    = barcode || '——';
  document.getElementById('barcodeText').textContent = barcode || '';
  updProg(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Draw a simple barcode visual (Code 128 style bars)
  drawBarcode(barcode);
}

function drawBarcode(text) {
  const canvas = document.getElementById('barcodeCanvas');
  if (!canvas || !text) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width = 240;
  const H = canvas.height = 60;

  // background (same as yours)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // sanitize input (same idea as yours but better)
 // const chars = text.replace(/[^A-Za-z0-9]/g, '');

  // REAL barcode generation (replaces fake pattern logic)
  JsBarcode(canvas, text, {
    format: "CODE128",
    width: 1.8,        // similar density to your barW idea
    height: H - 10,    // matches your margin logic
    margin: 5,
    displayValue: false,
    background: "#ffffff",
    lineColor: "#1a1a2e" // same color you used
  });
}
