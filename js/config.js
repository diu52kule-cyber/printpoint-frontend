/**
 * js/config.js
 *
 * ⚠️  The ONLY config the frontend needs.
 *     NO API keys, NO secrets, NO Supabase credentials here.
 *     All secrets live in Railway environment variables (backend).
 */
const CONFIG = {
  // ── Your Railway backend URL ──────────────────────────
  // Dev:  http://localhost:3000
  // Prod: https://printpoint-backend-production.up.railway.app
  BACKEND_URL: 'http://localhost:3000',

  // ── Google OAuth Client ID ────────────────────────────
  // This is PUBLIC (not a secret). It only identifies your app to Google.
  // Get from: console.cloud.google.com → Credentials → OAuth 2.0 Client ID
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

  // ── Display pricing (must match backend routes/upload.js) ──
  BW_PPP:  1.00,   // ₹ per B&W page
  COL_PPP: 5.00,   // ₹ per color page
  SVC_FEE: 2.00,   // ₹ flat service fee

  // ── Paper sizes mm [W, H] portrait ────────────────────
  PAPER_SIZES: {
    A4:     [210, 297],
    A3:     [297, 420],
    Letter: [216, 279],
    Legal:  [216, 356],
  },

  // ── Polling interval (ms) for job status after payment ─
  POLL_INTERVAL: 2000,
  POLL_TIMEOUT:  60000,
};
