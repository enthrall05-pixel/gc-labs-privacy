/* ╔══════════════════════╗
   ║   Created by G/C     ║
   ╚══════════════════════╝
   Stripe webhook — provisions Pro license key on subscription purchase */

const crypto = require('crypto');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY        = process.env.RESEND_API_KEY;

// Verify Stripe webhook signature manually (no Stripe SDK needed)
function verifySignature(rawBody, sigHeader, secret) {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const v1        = parts['v1'];
  if (!timestamp || !v1) throw new Error('Malformed signature header');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

// e.g. PW-A3F7-K2M9
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `PW-${seg()}-${seg()}`;
}

async function insertLicense(email, licenseKey, stripeSubscriptionId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pro_licenses`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({
      email,
      license_key:             licenseKey,
      is_pro:                  true,
      stripe_subscription_id:  stripeSubscriptionId,
    }),
  });

  if (!res.ok) throw new Error(`Supabase insert failed: ${await res.text()}`);
  return res.json();
}

async function sendDownloadEmail(email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Plictor Work <hello@plictor.com>',
      to:      [email],
      subject: 'Your Plictor Work Download Links',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 32px">
          <h2 style="color:#6c47ff;margin:0 0 8px">Thanks for buying Plictor Work ✦</h2>
          <p style="color:#555;margin:0 0 24px;font-size:15px">Your download links are below. Pick the right one for your OS.</p>

          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
            <a href="https://github.com/enthrall05-pixel/plictor-work-desktop/releases/download/v1.0.2/Plictor.Work.Setup.1.0.2.exe"
               style="display:block;background:#6c47ff;color:#fff;text-decoration:none;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px">
              🪟 Download for Windows
            </a>
            <a href="https://github.com/enthrall05-pixel/plictor-work-desktop/releases/download/v1.0.2/Plictor.Work-1.0.2-arm64.dmg"
               style="display:block;background:#6c47ff;color:#fff;text-decoration:none;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px">
              🍎 Download for Mac
            </a>
            <a href="https://github.com/enthrall05-pixel/plictor-work-desktop/releases/download/v1.0.2/Plictor.Work-1.0.2-linux.AppImage"
               style="display:block;background:#6c47ff;color:#fff;text-decoration:none;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px">
              🐧 Download for Linux
            </a>
          </div>

          <p style="color:#555;font-size:14px;margin:0 0 8px">No account required. Just install and bring your own API key.</p>
          <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:20px;margin:0">
            Keep this email — these are your personal download links.<br>
            Questions? Reply here and we'll help. — The Plictor Team
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) throw new Error(`Resend failed: ${await res.text()}`);
  return res.json();
}

async function sendLicenseEmail(email, licenseKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Plictor Work <hello@plictor.com>',
      to:      [email],
      subject: 'Your Plictor Work Pro License Key',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 32px">
          <h2 style="color:#6c47ff;margin:0 0 8px">Welcome to Plictor Work Pro ✦</h2>
          <p style="color:#555;margin:0 0 24px;font-size:15px">Your license key is below. Copy it into the app to unlock Pro.</p>

          <div style="background:#f5f3ff;border:2px solid #6c47ff;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px">
            <div style="font-size:11px;font-weight:600;color:#9370f6;letter-spacing:1px;margin-bottom:8px">LICENSE KEY</div>
            <div style="font-size:26px;font-weight:700;letter-spacing:3px;color:#3a1fa8">${licenseKey}</div>
          </div>

          <p style="color:#555;font-size:14px;margin:0 0 8px"><strong>To activate:</strong></p>
          <ol style="color:#555;font-size:14px;line-height:2;margin:0 0 32px;padding-left:20px">
            <li>Open Plictor Work</li>
            <li>Click <strong>File</strong> in the sidebar</li>
            <li>Paste your key → click <strong>Activate Pro</strong></li>
          </ol>

          <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:20px;margin:0">
            Keep this email safe — your key is tied to your subscription.<br>
            Questions? Reply here and we'll help. — The Plictor Team
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) throw new Error(`Resend failed: ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  if (!sig) return { statusCode: 400, body: 'Missing stripe-signature header' };

  let rawBody = event.body;
  if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, 'base64').toString('utf8');

  // Verify Stripe signature
  try {
    if (!verifySignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
      return { statusCode: 400, body: 'Invalid signature' };
    }
  } catch (err) {
    return { statusCode: 400, body: `Signature error: ${err.message}` };
  }

  const stripeEvent = JSON.parse(rawBody);

  // Only handle successful checkouts
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session        = stripeEvent.data.object;
  const email          = session.customer_details?.email || session.customer_email;
  const subscriptionId = session.subscription;

  if (!email) {
    console.error('No email found in session:', session.id);
    return { statusCode: 400, body: 'No email in session' };
  }

  // One-time base app purchase — email download links
  if (!subscriptionId) {
    try {
      await sendDownloadEmail(email);
      console.log(`Download links sent → ${email}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Download email error:', err.message);
      return { statusCode: 500, body: err.message };
    }
  }

  // Pro subscription — provision license key
  try {
    const licenseKey = generateKey();
    await insertLicense(email, licenseKey, subscriptionId);
    await sendLicenseEmail(email, licenseKey);
    console.log(`Pro license issued: ${licenseKey} → ${email}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('License provisioning error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
