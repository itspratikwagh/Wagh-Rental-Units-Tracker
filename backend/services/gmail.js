const { google } = require('googleapis');

// Utility email parsers — map sender to property and extract amounts
const UTILITY_PARSERS = [
  {
    name: 'Easymax (Enmax)',
    fromPattern: /easymax@enmax\.com/i,
    amountPatterns: [
      /total\s+(?:amount\s+)?(?:due|owing|payable)[:\s]*\$?([\d,]+\.?\d*)/i,
      /amount\s+due[:\s]*\$?([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.\d{2})/,
    ],
    category: 'Utility Bills',
    propertyKey: 'calgary',
  },
  {
    name: 'EPCOR',
    fromPattern: /no-reply@epcor\.com/i,
    amountPatterns: [
      /total\s+(?:amount\s+)?(?:due|owing|payable)[:\s]*\$?([\d,]+\.?\d*)/i,
      /amount\s+due[:\s]*\$?([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.\d{2})/,
    ],
    category: 'Utility Bills',
    propertyKey: 'edmonton',
  },
  {
    name: 'Shaw Internet',
    fromPattern: /shaw/i,
    subjectPattern: /shaw bill is ready/i,
    amountPatterns: [
      /total\s+(?:amount\s+)?(?:due|owing|payable)[:\s]*\$?([\d,]+\.?\d*)/i,
      /amount\s+due[:\s]*\$?([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.\d{2})/,
    ],
    category: 'Internet Bills',
    // Property determined by account number in email body:
    // 099-0137-3821 = Edmonton, 099-0203-0540 = Calgary
    propertyKey: 'shaw_by_account',
    accountMap: {
      '099-0137-3821': 'edmonton',
      '099-0203-0540': 'calgary',
    },
  },
];

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
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
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

// Parse Interac e-Transfer email
function parseInteracEmail(headers, bodyText) {
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

  // Pattern: "John Smith sent you $1,500.00" or similar
  let senderName = null;
  let amount = null;

  // Pattern: "You've received $755.00 from OUSMAN SONKO and it has been automatically deposited."
  // Also handles quoted variants: "You've received '$755.00' from 'John Smith'"
  const receivedMatch = subject.match(/You['']ve received\s+'?\$?([\d,]+\.?\d*)'?\s+from\s+'?(.+?)(?:'?\s+and\s+|$)/i);
  if (receivedMatch) {
    amount = parseFloat(receivedMatch[1].replace(/,/g, ''));
    senderName = receivedMatch[2].replace(/'+$/, '').trim();
  }

  // Fallback: "John Smith sent you $1,500.00"
  if (!amount) {
    const sentMatch = subject.match(/(.+?)\s+sent you\s+\$?([\d,]+\.?\d*)/i);
    if (sentMatch) {
      senderName = sentMatch[1].trim();
      amount = parseFloat(sentMatch[2].replace(/,/g, ''));
    }
  }

  // Try body if subject didn't match
  if (!amount && bodyText) {
    const bodyReceivedMatch = bodyText.match(/received\s+'?\$?([\d,]+\.?\d*)'?\s+from\s+'?(.+?)(?:'?\s+and\s+|$)/im);
    if (bodyReceivedMatch) {
      amount = parseFloat(bodyReceivedMatch[1].replace(/,/g, ''));
      senderName = bodyReceivedMatch[2].replace(/'+$/, '').trim();
    }
  }

  if (!amount && bodyText) {
    const bodyMatch = bodyText.match(/(.+?)\s+sent you\s+(?:a\s+)?(?:money\s+transfer\s+of\s+)?\$?([\d,]+\.?\d*)/i);
    if (bodyMatch) {
      senderName = bodyMatch[1].trim();
      amount = parseFloat(bodyMatch[2].replace(/,/g, ''));
    }
  }

  // Fallback: just find any dollar amount
  if (!amount && bodyText) {
    const amountMatch = bodyText.match(/\$\s*([\d,]+\.\d{2})/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
  }

  const date = dateStr ? new Date(dateStr) : new Date();

  return { senderName, amount, date };
}

// Parse utility bill email
function parseUtilityEmail(headers, bodyText, parser) {
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
  let amount = null;

  for (const pattern of parser.amountPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  const date = dateStr ? new Date(dateStr) : new Date();

  return {
    amount,
    date,
    description: `${parser.name} bill`,
    category: parser.category,
  };
}

// Alias map: Interac sender names that should map to a specific tenant.
// Key = lowercase sender name, Value = tenant name in DB (lowercase).
const SENDER_ALIASES = {
  'savannah hummel': 'justin sox',
  'godwin antepim': 'eunice frimpomaa',
  'godwin kofi antepim': 'eunice frimpomaa',
  'parveen simplii': 'parveen kumar',
};

// Match sender name to a tenant
async function matchTenant(prisma, senderName) {
  if (!senderName) return { tenantId: null, confidence: 'none' };

  // Search all tenants (including archived) for historical matching
  const tenants = await prisma.tenant.findMany();
  let normalized = senderName.toLowerCase().trim();

  // Check alias map first
  const aliasTarget = SENDER_ALIASES[normalized];
  if (aliasTarget) {
    const aliased = tenants.find(t => t.name.toLowerCase().trim() === aliasTarget);
    if (aliased) return { tenantId: aliased.id, confidence: 'high' };
  }

  // Exact match
  const exact = tenants.find(t => t.name.toLowerCase().trim() === normalized);
  if (exact) return { tenantId: exact.id, confidence: 'high' };

  // Partial match (name contains or is contained)
  const partial = tenants.find(t => {
    const tName = t.name.toLowerCase().trim();
    return normalized.includes(tName) || tName.includes(normalized);
  });
  if (partial) return { tenantId: partial.id, confidence: 'high' };

  // Word-based match: all words of tenant name appear in sender name
  const wordMatch = tenants.find(t => {
    const tWords = t.name.toLowerCase().trim().split(/\s+/);
    return tWords.length >= 2 && tWords.every(w => normalized.includes(w));
  });
  if (wordMatch) return { tenantId: wordMatch.id, confidence: 'high' };

  // Reverse word match: all words of sender appear in tenant name
  const senderWords = normalized.split(/\s+/).filter(w => w.length > 1);
  const reverseMatch = tenants.find(t => {
    const tName = t.name.toLowerCase().trim();
    return senderWords.length >= 2 && senderWords.every(w => tName.includes(w));
  });
  if (reverseMatch) return { tenantId: reverseMatch.id, confidence: 'medium' };

  return { tenantId: null, confidence: 'none' };
}

// Map utility property key to actual property ID
async function mapUtilityToProperty(prisma, propertyKey) {
  const properties = await prisma.property.findMany();

  // Try matching by name or address containing the city name
  const cityMap = { calgary: 'calgary', edmonton: 'edmonton' };
  const city = cityMap[propertyKey];

  if (city) {
    const match = properties.find(
      p =>
        p.name.toLowerCase().includes(city) ||
        p.address.toLowerCase().includes(city)
    );
    if (match) return match.id;
  }

  // Fallback: use env var mapping
  const envMap = process.env.UTILITY_PROPERTY_MAP;
  if (envMap) {
    const pairs = envMap.split(',');
    for (const pair of pairs) {
      const [key, propId] = pair.split(':');
      if (key.trim() === propertyKey) return propId.trim();
    }
  }

  return null;
}

// Parse Amazon.ca order confirmation email
function parseAmazonEmail(headers, htmlBody) {
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

  // Strip HTML to plain text for parsing
  const text = htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ');

  // Extract order total: "Total $XX.XX"
  let amount = null;
  const totalMatch = text.match(/Total\s+\$([\d,]+\.\d{2})/i);
  if (totalMatch) {
    amount = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  // Extract city from "Pratik – Calgary, Alberta" or "Pratik – Edmonton, Alberta"
  let city = null;
  const cityMatch = text.match(/Pratik\s+.{1,5}\s+(Calgary|Edmonton)\s*,\s*Alberta/i);
  if (cityMatch) {
    city = cityMatch[1].toLowerCase();
  }

  // Extract item name from subject
  // New format: Ordered: "Item Name..." and X more items
  // Old format: Your Amazon.ca order #XXX of N items
  let itemName = 'Amazon.ca order';
  const newFormat = subject.match(/Ordered:\s*"(.+?)(?:\.\.\.?)?"(?:\s+and\s+(\d+)\s+more)?/);
  if (newFormat) {
    itemName = newFormat[1].trim();
    if (newFormat[2]) itemName += ` + ${newFormat[2]} more items`;
  } else {
    const oldFormat = subject.match(/order\s+#([\d-]+)/i);
    if (oldFormat) itemName = `Amazon order #${oldFormat[1]}`;
  }

  const date = dateStr ? new Date(dateStr) : new Date();

  return { amount, city, itemName, date };
}

// Get HTML body from email (Amazon emails are HTML-heavy)
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

// Main scan function
// options.afterDate: scan emails after this date (e.g., '2025/10/25')
// options.maxResults: max emails per query (default 50)
async function scanGmail(prisma, options = {}) {
  const syncState = await prisma.gmailSyncState.findFirst();
  if (!syncState?.refreshToken) {
    throw new Error('Gmail not connected. Please authorize first.');
  }

  const gmail = await getGmailClient(syncState.refreshToken);
  const results = { interac: 0, utility: 0, amazon: 0, errors: [] };

  // Gmail accepts after:YYYY/M/D — strip leading zeros to be safe
  let afterClause = 'newer_than:14d';
  if (options.afterDate) {
    // Convert "2025/09/01" to epoch seconds for reliable filtering
    const d = new Date(options.afterDate);
    if (!isNaN(d.getTime())) {
      afterClause = `after:${Math.floor(d.getTime() / 1000)}`;
    } else {
      afterClause = `after:${options.afterDate}`;
    }
  }
  const maxResults = options.maxResults || 50;

  // Scan for Interac e-Transfers (try multiple search queries)
  const interacQueries = [
    `from:notify@payments.interac.ca ${afterClause} in:anywhere`,
    `subject:"INTERAC e-Transfer" "You've received" ${afterClause} in:anywhere`,
  ];

  try {
    let allInteracMessages = [];
    const seenIds = new Set();

    for (const query of interacQueries) {
      let pageToken = null;
      do {
        const interacRes = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
          pageToken,
        });
        for (const msg of (interacRes.data.messages || [])) {
          if (!seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            allInteracMessages.push(msg);
          }
        }
        pageToken = interacRes.data.nextPageToken;
      } while (pageToken);
    }

    const interacMessages = allInteracMessages;
    for (const msg of interacMessages) {
      try {
        // Check if already processed
        const existing = await prisma.pendingTransaction.findUnique({
          where: { gmailMessageId: msg.id },
        });
        if (existing) continue;

        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = full.data.payload?.headers || [];
        const bodyText = decodeBody(full.data);
        const parsed = parseInteracEmail(headers, bodyText);

        if (!parsed.amount) continue;

        const { tenantId, confidence } = await matchTenant(prisma, parsed.senderName);

        const rentMonth = getRentMonth(parsed.date);
        const rentMonthLabel = rentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        await prisma.pendingTransaction.create({
          data: {
            type: 'payment',
            source: 'interac_email',
            gmailMessageId: msg.id,
            senderName: parsed.senderName,
            amount: parsed.amount,
            date: parsed.date,
            tenantId,
            matchConfidence: confidence,
            rawEmailSnippet: full.data.snippet?.substring(0, 500),
            description: `Interac e-Transfer from ${parsed.senderName || 'Unknown'} (${rentMonthLabel} rent)`,
            category: rentMonthLabel,
          },
        });
        results.interac++;
      } catch (err) {
        results.errors.push(`Interac msg ${msg.id}: ${err.message}`);
      }
    }
  } catch (err) {
    results.errors.push(`Interac scan: ${err.message}`);
  }

  // Scan for Amazon.ca order confirmations
  try {
    const amazonQuery = `from:auto-confirm@amazon.ca ${afterClause} in:anywhere`;
    let allAmazonMessages = [];
    let amazonPageToken = null;

    do {
      const amazonRes = await gmail.users.messages.list({
        userId: 'me',
        q: amazonQuery,
        maxResults,
        pageToken: amazonPageToken,
      });
      allAmazonMessages = allAmazonMessages.concat(amazonRes.data.messages || []);
      amazonPageToken = amazonRes.data.nextPageToken;
    } while (amazonPageToken);

    for (const msg of allAmazonMessages) {
      try {
        const existing = await prisma.pendingTransaction.findUnique({
          where: { gmailMessageId: msg.id },
        });
        if (existing) continue;

        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = full.data.payload?.headers || [];
        const htmlBody = getHtmlBody(full.data.payload);
        const parsed = parseAmazonEmail(headers, htmlBody);

        if (!parsed.amount) continue; // Skip if we can't determine the total

        // Map city to property
        let propertyId = null;
        if (parsed.city) {
          propertyId = await mapUtilityToProperty(prisma, parsed.city);
        }

        await prisma.pendingTransaction.create({
          data: {
            type: 'expense',
            source: 'amazon_email',
            gmailMessageId: msg.id,
            senderName: 'Amazon.ca',
            senderEmail: 'auto-confirm@amazon.ca',
            amount: parsed.amount,
            date: parsed.date,
            description: `${parsed.itemName} (Amazon)`,
            category: 'Home Improvement',
            propertyId,
            matchConfidence: parsed.amount && propertyId ? 'high' : parsed.amount ? 'medium' : 'none',
            rawEmailSnippet: full.data.snippet?.substring(0, 500),
          },
        });
        results.amazon++;
      } catch (err) {
        results.errors.push(`Amazon msg ${msg.id}: ${err.message}`);
      }
    }
  } catch (err) {
    results.errors.push(`Amazon scan: ${err.message}`);
  }

  // Scan for utility bills
  for (const parser of UTILITY_PARSERS) {
    try {
      const fromAddr = parser.fromPattern.source.replace(/\\/g, '').replace(/\.com\/i$/, '.com');
      const utilAfterClause = afterClause; // use same epoch-based clause as Interac

      // Build query — add subject filter if parser has one
      let query = `from:${fromAddr} ${utilAfterClause} in:anywhere`;
      if (parser.subjectPattern) {
        const subjectText = parser.subjectPattern.source.replace(/\\/g, '');
        query = `subject:"${subjectText}" ${utilAfterClause} in:anywhere`;
      }

      let allUtilMessages = [];
      let utilPageToken = null;

      do {
        const utilRes = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
          pageToken: utilPageToken,
        });
        allUtilMessages = allUtilMessages.concat(utilRes.data.messages || []);
        utilPageToken = utilRes.data.nextPageToken;
      } while (utilPageToken);

      const utilMessages = allUtilMessages;
      for (const msg of utilMessages) {
        try {
          const existing = await prisma.pendingTransaction.findUnique({
            where: { gmailMessageId: msg.id },
          });
          if (existing) continue;

          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          });

          const headers = full.data.payload?.headers || [];
          const bodyText = decodeBody(full.data);
          const parsed = parseUtilityEmail(headers, bodyText, parser);

          // Determine property: account-based (Shaw) or city-based
          let propertyId = null;
          if (parser.propertyKey === 'shaw_by_account' && parser.accountMap) {
            for (const [acct, city] of Object.entries(parser.accountMap)) {
              if (bodyText.includes(acct) || (full.data.snippet || '').includes(acct)) {
                propertyId = await mapUtilityToProperty(prisma, city);
                parsed.description = `${parser.name} bill (${city})`;
                break;
              }
            }
          } else {
            propertyId = await mapUtilityToProperty(prisma, parser.propertyKey);
          }

          await prisma.pendingTransaction.create({
            data: {
              type: 'expense',
              source: 'utility_email',
              gmailMessageId: msg.id,
              senderName: parser.name,
              senderEmail: fromAddr,
              amount: parsed.amount || 0,
              date: parsed.date,
              description: parsed.description,
              category: parsed.category,
              propertyId,
              matchConfidence: parsed.amount && propertyId ? 'high' : 'none',
              rawEmailSnippet: full.data.snippet?.substring(0, 500),
            },
          });
          results.utility++;
        } catch (err) {
          results.errors.push(`Utility msg ${msg.id}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`${parser.name} scan: ${err.message}`);
    }
  }

  // Update sync state
  await prisma.gmailSyncState.update({
    where: { id: syncState.id },
    data: { lastSyncAt: new Date() },
  });

  return results;
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  scanGmail,
  getRentMonth,
  UTILITY_PARSERS,
};
