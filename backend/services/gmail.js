const { google } = require('googleapis');

// Minimum lookback window for every scan. Even if lastSyncAt is recent, we always
// re-scan at least this many days so a corrupted/over-advanced lastSyncAt can't
// permanently skip emails. Dedup (pendingTransaction + scannedEmail) prevents doubles.
const LOOKBACK_DAYS = 35;

// Build a Gmail `after:` clause that is self-healing.
// - options.afterDate (explicit override, e.g. historical scan) takes priority
// - otherwise: the EARLIER of lastSyncAt and (now - LOOKBACK_DAYS), so we never
//   look back less than LOOKBACK_DAYS even if lastSyncAt jumped ahead.
function buildAfterClause(lastSyncAt, afterDate) {
  if (afterDate) {
    const d = new Date(afterDate);
    if (!isNaN(d.getTime())) return `after:${Math.floor(d.getTime() / 1000)}`;
    return `after:${afterDate}`;
  }
  const lookbackFloor = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  let effective = lookbackFloor;
  if (lastSyncAt) {
    const syncEpoch = new Date(lastSyncAt).getTime();
    effective = Math.min(syncEpoch, lookbackFloor);
  }
  return `after:${Math.floor(effective / 1000)}`;
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send', // rent reminder emails to tenants
    ],
  });
}

async function exchangeCode(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getGmailClient(refreshToken) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Compute which rent month a payment applies to.
// Rule: payment after the 15th counts toward next month;
//       payment on or before the 15th counts toward current month.
// Returns the 1st of the applicable rent month.
function getRentMonth(paymentDate) {
  const d = new Date(paymentDate);
  if (d.getDate() > 15) {
    // Next month's rent
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  // Current month's rent
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Convert an HTML email body to plain text.
// Named entities are DECODED, not deleted — blanket-replacing "&...;" with a
// space silently corrupted text (e.g. an Airbnb listing name "Mini Fridge &
// Coffee" became "Mini Fridge Coffee", so its room alias no longer matched).
function stripHtmlToText(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:#39|apos|rsquo|lsquo);/gi, "'")
    .replace(/&(?:#8212|mdash);/gi, '—')
    .replace(/&(?:#8211|ndash);/gi, '–')
    .replace(/&[a-z#0-9]+;/gi, ' ') // anything else we don't decode
    .replace(/\s+/g, ' ');
}

// Get HTML body from email (order/bill emails are HTML-heavy)
function getHtmlBody(payload) {
  let html = '';
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    html += Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        html += Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === 'text/html' && sub.body?.data) {
            html += Buffer.from(sub.body.data, 'base64url').toString('utf-8');
          }
        }
      }
    }
  }
  return html;
}

// Decode email body from base64
function decodeBody(message) {
  const parts = message.payload?.parts || [];
  let body = '';

  // Try to get text/plain first
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  }

  // Fallback to top-level body
  if (!body && message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64url').toString('utf-8');
  }

  // Try nested parts (multipart/alternative inside multipart/mixed)
  if (!body) {
    for (const part of parts) {
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            body += Buffer.from(subpart.body.data, 'base64url').toString('utf-8');
          }
        }
      }
    }
  }

  return body;
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  getGmailClient,
  decodeBody,
  getHtmlBody,
  getRentMonth,
  buildAfterClause,
  stripHtmlToText,
};
