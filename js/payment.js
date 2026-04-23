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

  // Background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a2e';

  // Code128 patterns (subset, enough for ASCII)
  const CODE128 = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100",
    "11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000",
    "10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110",
    "10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000",
    "11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100",
    "10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010",
    "11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100",
    "10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110",
    "10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000",
    "11010011100","1100011101011" // STOP
  ];

  const START_CODE_B = 104;
  const STOP = 106;

  // Convert text to char codes
  const values = [];
  for (let i = 0; i < text.length; i++) {
    values.push(text.charCodeAt(i) - 32);
  }

  // Checksum
  let checksum = START_CODE_B;
  for (let i = 0; i < values.length; i++) {
    checksum += values[i] * (i + 1);
  }
  checksum = checksum % 103;

  // Full sequence
  const sequence = [START_CODE_B, ...values, checksum, STOP];

  // Build binary pattern
  let pattern = "";
  for (let val of sequence) {
    pattern += CODE128[val] || "";
  }

  // Draw bars
  const totalBars = pattern.length;
  const barW = (W-10) / totalBars;

  let x = 5;
  for (let i = 0; i < totalBars; i++) {
    if (pattern[i] === '1') {
      ctx.fillRect(x, 5, barW, H - 10);
    }
    x += barW;
  }
}
