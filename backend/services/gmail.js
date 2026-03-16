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

// Parse Interac e-Transfer email
function parseInteracEmail(headers, bodyText) {
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

  // Pattern: "John Smith sent you $1,500.00" or similar
  let senderName = null;
  let amount = null;

  // Try subject first
  const subjectMatch = subject.match(/(.+?)\s+sent you\s+\$?([\d,]+\.?\d*)/i);
  if (subjectMatch) {
    senderName = subjectMatch[1].trim();
    amount = parseFloat(subjectMatch[2].replace(/,/g, ''));
  }

  // Try body if subject didn't match
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

// Match sender name to a tenant
async function matchTenant(prisma, senderName) {
  if (!senderName) return { tenantId: null, confidence: 'none' };

  const tenants = await prisma.tenant.findMany({ where: { isArchived: false } });
  const normalized = senderName.toLowerCase().trim();

  // Exact match
  const exact = tenants.find(t => t.name.toLowerCase().trim() === normalized);
  if (exact) return { tenantId: exact.id, confidence: 'high' };

  // Partial match (name contains or is contained)
  const partial = tenants.find(t => {
    const tName = t.name.toLowerCase().trim();
    return normalized.includes(tName) || tName.includes(normalized);
  });
  if (partial) return { tenantId: partial.id, confidence: 'medium' };

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
async function scanGmail(prisma) {
  const syncState = await prisma.gmailSyncState.findFirst();
  if (!syncState?.refreshToken) {
    throw new Error('Gmail not connected. Please authorize first.');
  }

  const gmail = await getGmailClient(syncState.refreshToken);
  const results = { interac: 0, utility: 0, errors: [] };

  // Scan for Interac e-Transfers
  try {
    const interacRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:notify@payments.interac.ca newer_than:14d',
      maxResults: 50,
    });

    const interacMessages = interacRes.data.messages || [];
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
            description: `Interac e-Transfer from ${parsed.senderName || 'Unknown'}`,
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

  // Scan for utility bills
  for (const parser of UTILITY_PARSERS) {
    try {
      const fromAddr = parser.fromPattern.source.replace(/\\/g, '').replace(/\.com\/i$/, '.com');
      const utilRes = await gmail.users.messages.list({
        userId: 'me',
        q: `from:${fromAddr} newer_than:30d`,
        maxResults: 10,
      });

      const utilMessages = utilRes.data.messages || [];
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

          const propertyId = await mapUtilityToProperty(prisma, parser.propertyKey);

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
  UTILITY_PARSERS,
};
