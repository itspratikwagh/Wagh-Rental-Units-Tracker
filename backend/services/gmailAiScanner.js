const Anthropic = require('@anthropic-ai/sdk');
const { getGmailClient, decodeBody, getHtmlBody } = require('./gmail');

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const BATCH_SIZE = 20;
const MAX_EMAILS = 500;

// Build context about tenants and properties for Claude
async function buildScanContext(prisma) {
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany(),
    prisma.tenant.findMany({ include: { Property: true } }),
  ]);

  const propertyList = properties.map(p => ({
    id: p.id,
    name: p.name,
    address: p.address,
  }));

  const tenantList = tenants.map(t => ({
    id: t.id,
    name: t.name,
    email: t.email,
    propertyId: t.propertyId,
    propertyName: t.Property?.name,
    rentAmount: t.rentAmount,
    isArchived: t.isArchived,
  }));

  return { propertyList, tenantList };
}

function buildSystemPrompt(propertyList, tenantList) {
  return `You are a financial email classifier for a rental property manager in Alberta, Canada.
Your job is to analyze emails and identify which ones are related to rental property income or expenses.

PROPERTIES:
${JSON.stringify(propertyList, null, 2)}

TENANTS (current and archived):
${JSON.stringify(tenantList, null, 2)}

KNOWN SENDER ALIASES (sender name -> tenant name):
- "Savannah Hummel" -> "Justin Sox"
- "Godwin Antepim" or "Godwin Kofi Antepim" -> "Eunice Frimpomaa"
- "Parveen Simplii" -> "Parveen Kumar"

CLASSIFICATION RULES:
- Interac e-Transfer RECEIVED (incoming money, "You've received", from notify@payments.interac.ca) = PAYMENT (rent from tenant). Match sender to a tenant using name, email, or aliases above.
- Interac e-Transfer SENT (outgoing money, "Your transfer to", from payments.interac.ca) = EXPENSE. Skip these known personal recipients: Kraken (crypto), Sandip Das (personal loan), Evelyn Ackah (lawyer), Xiujin Ju (Airbnb). Also skip if subject mentions "return" or "cancel".
- Utility bills (Enmax/Easymax, EPCOR, Shaw) = EXPENSE. Map Enmax to Calgary property, EPCOR to Edmonton property. Shaw: look for account numbers 099-0137-3821 (Edmonton) or 099-0203-0540 (Calgary).
- Amazon.ca order confirmations = EXPENSE (Home Improvement category). Look for delivery city (Calgary or Edmonton) to map to property.
- Insurance bills, mortgage statements, property tax notices = EXPENSE.
- IGNORE: personal emails, newsletters, social media notifications, job-related emails, marketing, subscriptions unrelated to properties, crypto exchanges, personal banking alerts, spam, login/security alerts.

RENT MONTH RULE: If payment date is after the 15th, it counts toward NEXT month's rent. Otherwise it's current month's rent.

MATCH CONFIDENCE:
- "high": Unambiguous match (exact tenant name, known alias, clear property mapping)
- "medium": Partial match (similar names, reasonable guess)
- "none": Cannot determine tenant or property

SOURCE VALUES to use:
- "interac_email" for incoming Interac e-Transfers
- "outgoing_interac_email" for outgoing Interac e-Transfers
- "utility_email" for utility bills (Enmax, EPCOR, Shaw)
- "amazon_email" for Amazon orders
- "other_email" for any other property-related income or expense

CATEGORY VALUES for expenses:
- "Utility Bills" for power/gas (Enmax, EPCOR)
- "Internet Bills" for internet/cable (Shaw)
- "Home Improvement" for Amazon orders
- "Maintenance" for contractor/repair payments
- "Insurance" for insurance bills
- "Mortgage" for mortgage payments
- "Property Taxes" for property tax
- "Other" for anything else

Respond with ONLY a valid JSON array. For irrelevant emails, omit them entirely (do NOT include them).
Each relevant email object must have this exact structure:
{
  "gmailMessageId": "<id from input>",
  "type": "payment" or "expense",
  "source": "<source value from list above>",
  "senderName": "<person or company name>",
  "senderEmail": "<email address if available>",
  "amount": <number, the dollar amount>,
  "date": "<ISO 8601 date string>",
  "description": "<short human-readable description>",
  "category": "<category value>",
  "propertyId": "<matched property ID from the list above, or null>",
  "tenantId": "<matched tenant ID from the list above, or null>",
  "matchConfidence": "high" or "medium" or "none"
}

If no emails are relevant, return an empty array: []
Do NOT include any text outside the JSON array.`;
}

// Fetch all recent emails from Gmail
async function fetchRecentEmails(gmail, prisma, afterClause, maxResults) {
  const query = `${afterClause} -category:promotions -category:social -category:forums`;

  const allMessageIds = [];
  let pageToken = null;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 100),
      pageToken,
    });

    const messages = res.data.messages || [];
    allMessageIds.push(...messages.map(m => m.id));
    pageToken = res.data.nextPageToken;

    if (allMessageIds.length >= MAX_EMAILS) break;
  } while (pageToken);

  // Deduplicate against already-processed emails
  const existing = await prisma.pendingTransaction.findMany({
    where: { gmailMessageId: { in: allMessageIds } },
    select: { gmailMessageId: true },
  });
  const existingIds = new Set(existing.map(e => e.gmailMessageId));
  const newIds = allMessageIds.filter(id => !existingIds.has(id));
  const skippedIds = allMessageIds.filter(id => existingIds.has(id));

  return { newIds, skippedIds, totalFetched: allMessageIds.length };
}

// Fetch email content for a batch of message IDs
async function fetchEmailBatch(gmail, messageIds) {
  const emails = [];

  for (const id of messageIds) {
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

      // Get plain text body
      let bodyPreview = decodeBody(msg.data);
      // Fallback to HTML stripped of tags
      if (!bodyPreview) {
        const html = getHtmlBody(msg.data.payload);
        bodyPreview = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z#0-9]+;/gi, ' ')
          .replace(/\s+/g, ' ');
      }
      // Truncate body to keep token usage manageable
      bodyPreview = bodyPreview.substring(0, 800);

      emails.push({
        gmailMessageId: id,
        from,
        subject,
        date: dateStr,
        snippet: msg.data.snippet || '',
        bodyPreview,
      });
    } catch (err) {
      console.error(`Failed to fetch email ${id}:`, err.message);
    }
  }

  return emails;
}

// Send a batch of emails to Claude for analysis
async function analyzeWithClaude(emails, systemPrompt) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze these ${emails.length} emails and identify any rental property income or expenses:\n\n${JSON.stringify(emails, null, 2)}`,
      },
    ],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('Claude returned invalid JSON, attempting retry...');
    console.error('Raw response:', text.substring(0, 500));

    // Retry once asking for valid JSON
    const retry = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${emails.length} emails and identify any rental property income or expenses:\n\n${JSON.stringify(emails, null, 2)}`,
        },
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: 'Your response was not valid JSON. Please respond with ONLY a valid JSON array, no other text.',
        },
      ],
    });

    const retryText = retry.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    let retryJson = retryText;
    const retryBlock = retryJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (retryBlock) retryJson = retryBlock[1].trim();

    return JSON.parse(retryJson);
  }
}

// Check if a transaction already exists in the DB (expenses or payments)
// Returns the matching record description if found, null if no match
async function findExistingInDB(prisma, tx) {
  const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0;
  const txDate = tx.date ? new Date(tx.date) : new Date();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  if (tx.type === 'expense') {
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date(txDate.getTime() - threeDaysMs),
          lte: new Date(txDate.getTime() + threeDaysMs),
        },
      },
    });
    const match = expenses.find(e => Math.abs(e.amount - amount) < 0.02);
    if (match) {
      return `Existing expense: ${match.date.toISOString().slice(0, 10)} $${match.amount} "${match.description || ''}"`;
    }
  }

  if (tx.type === 'payment') {
    const payments = await prisma.payment.findMany({
      where: {
        date: {
          gte: new Date(txDate.getTime() - threeDaysMs),
          lte: new Date(txDate.getTime() + threeDaysMs),
        },
      },
      include: { Tenant: true },
    });
    const match = payments.find(p => Math.abs(p.amount - amount) < 0.02);
    if (match) {
      return `Existing payment: ${match.date.toISOString().slice(0, 10)} $${match.amount} from ${match.Tenant?.name || 'unknown'}`;
    }
  }

  return null;
}

// Create PendingTransaction records from Claude's analysis
async function createPendingTransactions(prisma, transactions, emailMap) {
  const results = { payments: 0, expenses: 0, autoRejected: 0, errors: [] };

  for (const tx of transactions) {
    try {
      // Validate required fields
      if (!tx.gmailMessageId || !tx.type || !tx.amount) {
        results.errors.push(`Missing required fields for email ${tx.gmailMessageId}`);
        continue;
      }

      // Double-check dedup against pending transactions
      const existing = await prisma.pendingTransaction.findUnique({
        where: { gmailMessageId: tx.gmailMessageId },
      });
      if (existing) continue;

      // Check if this transaction already exists in the actual DB
      const dbMatch = await findExistingInDB(prisma, tx);

      // Get the snippet from our fetched email data
      const emailData = emailMap.get(tx.gmailMessageId);
      const rawSnippet = emailData?.snippet?.substring(0, 500) || '';

      if (dbMatch) {
        // Auto-reject — already in DB
        await prisma.pendingTransaction.create({
          data: {
            type: tx.type,
            source: tx.source || 'other_email',
            gmailMessageId: tx.gmailMessageId,
            senderName: tx.senderName || null,
            senderEmail: tx.senderEmail || null,
            amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
            date: tx.date ? new Date(tx.date) : new Date(),
            description: `[AUTO-REJECTED: ${dbMatch}] ${tx.description || ''}`,
            category: tx.category || null,
            propertyId: tx.propertyId || null,
            tenantId: tx.tenantId || null,
            matchConfidence: tx.matchConfidence || 'none',
            rawEmailSnippet: rawSnippet,
            status: 'rejected',
            reviewedAt: new Date(),
          },
        });
        results.autoRejected++;
        continue;
      }

      await prisma.pendingTransaction.create({
        data: {
          type: tx.type,
          source: tx.source || 'other_email',
          gmailMessageId: tx.gmailMessageId,
          senderName: tx.senderName || null,
          senderEmail: tx.senderEmail || null,
          amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
          date: tx.date ? new Date(tx.date) : new Date(),
          description: tx.description || null,
          category: tx.category || null,
          propertyId: tx.propertyId || null,
          tenantId: tx.tenantId || null,
          matchConfidence: tx.matchConfidence || 'none',
          rawEmailSnippet: rawSnippet,
        },
      });

      if (tx.type === 'payment') {
        results.payments++;
      } else {
        results.expenses++;
      }
    } catch (err) {
      results.errors.push(`Email ${tx.gmailMessageId}: ${err.message}`);
    }
  }

  return results;
}

// Main AI-powered scan function
async function scanGmailWithAI(prisma, options = {}) {
  const syncState = await prisma.gmailSyncState.findFirst();
  if (!syncState?.refreshToken) {
    throw new Error('Gmail not connected. Please authorize first.');
  }

  let gmail;
  try {
    gmail = await getGmailClient(syncState.refreshToken);
    // Test the connection with a lightweight call
    await gmail.users.getProfile({ userId: 'me' });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('invalid_grant') || msg.includes('invalid_request') || msg.includes('Token has been expired or revoked')) {
      // Clear the stale token so the frontend shows "Connect Gmail" again
      await prisma.gmailSyncState.update({
        where: { id: syncState.id },
        data: { refreshToken: null },
      });
      throw new Error('Gmail token expired. Please reconnect Gmail.');
    }
    throw err;
  }

  // Build date filter
  let afterClause = 'newer_than:14d';
  if (syncState.lastSyncAt) {
    const epoch = Math.floor(new Date(syncState.lastSyncAt).getTime() / 1000);
    afterClause = `after:${epoch}`;
  }
  if (options.afterDate) {
    const d = new Date(options.afterDate);
    if (!isNaN(d.getTime())) {
      afterClause = `after:${Math.floor(d.getTime() / 1000)}`;
    }
  }

  const maxResults = options.maxResults || 100;

  // Step 1: Fetch all new email IDs
  const { newIds: newMessageIds, skippedIds, totalFetched } = await fetchRecentEmails(gmail, prisma, afterClause, maxResults);

  // Fetch subjects of skipped emails for the scan log (last 10)
  const skippedSummary = [];
  for (const id of skippedIds.slice(0, 10)) {
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const headers = msg.data.payload?.headers || [];
      skippedSummary.push({
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        from: headers.find(h => h.name === 'From')?.value || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
      });
    } catch (e) { /* skip */ }
  }

  if (newMessageIds.length === 0) {
    await prisma.gmailSyncState.update({
      where: { id: syncState.id },
      data: { lastSyncAt: new Date() },
    });
    return {
      payments: 0, expenses: 0, total: 0, errors: [],
      scanLog: {
        totalFetched,
        newEmails: 0,
        skippedDuplicates: skippedIds.length,
        skippedSamples: skippedSummary,
      },
    };
  }

  console.log(`Found ${newMessageIds.length} new emails to analyze (${skippedIds.length} skipped as duplicates)`);

  // Step 2: Build context
  const { propertyList, tenantList } = await buildScanContext(prisma);
  const systemPrompt = buildSystemPrompt(propertyList, tenantList);

  // Step 3: Process in batches
  const totalResults = { payments: 0, expenses: 0, errors: [] };
  const emailMap = new Map();

  for (let i = 0; i < newMessageIds.length; i += BATCH_SIZE) {
    const batchIds = newMessageIds.slice(i, i + BATCH_SIZE);

    try {
      // Fetch email content
      const emails = await fetchEmailBatch(gmail, batchIds);

      // Store in map for snippet lookup later
      for (const e of emails) {
        emailMap.set(e.gmailMessageId, e);
      }

      if (emails.length === 0) continue;

      // Analyze with Claude
      const transactions = await analyzeWithClaude(emails, systemPrompt);

      if (!Array.isArray(transactions)) {
        totalResults.errors.push(`Batch ${i / BATCH_SIZE + 1}: Claude returned non-array response`);
        continue;
      }

      // Create records
      const batchResults = await createPendingTransactions(prisma, transactions, emailMap);
      totalResults.payments += batchResults.payments;
      totalResults.expenses += batchResults.expenses;
      totalResults.errors.push(...batchResults.errors);
    } catch (err) {
      totalResults.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err.message}`);
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, err);
    }
  }

  // Update sync state
  await prisma.gmailSyncState.update({
    where: { id: syncState.id },
    data: { lastSyncAt: new Date() },
  });

  totalResults.total = totalResults.payments + totalResults.expenses;

  if (totalResults.errors.length > 0) {
    console.error('Scan errors:', totalResults.errors);
  }

  totalResults.scanLog = {
    totalFetched,
    newEmails: newMessageIds.length,
    skippedDuplicates: skippedIds.length,
    skippedSamples: skippedSummary,
  };

  return totalResults;
}

module.exports = { scanGmailWithAI, findExistingInDB };
