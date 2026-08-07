const Anthropic = require('@anthropic-ai/sdk');
const { getGmailClient, decodeBody, getHtmlBody, buildAfterClause, stripHtmlToText } = require('./gmail');
const { sendPush } = require('./notify');

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const BATCH_SIZE = 20;
const MAX_EMAILS = 2000;
// Upper bound on the email text handed to Claude. Routine scans see ~4 new
// emails, so this is a safety valve, not a cost control.
const MAX_BODY_CHARS = 6000;

// Remove the noise that crowds out real content: tracking URLs, image/CID
// junk, unsubscribe boilerplate, and whitespace padding. Keeps the words a
// human would read — amounts, names, listing titles, order numbers.
function cleanEmailBody(text) {
  if (!text) return '';
  return text
    .replace(/https?:\/\/\S+/g, ' ')          // tracking + deep links
    .replace(/\[cid:[^\]]*\]/gi, ' ')
    .replace(/%[A-Za-z0-9_]+%/g, ' ')          // %opentrack% style markers
    .replace(/[​-‍﻿­͏]/g, '') // zero-width padding
    .replace(/(?:^|\s)(?:unsubscribe|view (?:in browser|online)|privacy policy|terms of service)[^.\n]{0,60}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build context about tenants, properties, and sender rules for Claude
async function buildScanContext(prisma) {
  const [properties, tenants, senderRules] = await Promise.all([
    prisma.property.findMany({ where: { deletedAt: null } }),
    prisma.tenant.findMany({ where: { deletedAt: null }, include: { Property: true } }),
    prisma.senderRule.findMany(),
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

  return {
    propertyList,
    tenantList,
    aliasRules: senderRules.filter(r => r.kind === 'alias'),
    skipRules: senderRules.filter(r => r.kind === 'skip'),
  };
}

function buildSystemPrompt(propertyList, tenantList, aliasRules = [], skipRules = []) {
  const aliasText = aliasRules.length > 0
    ? aliasRules.map(r => `- "${r.senderName}" -> "${r.tenantName}"`).join('\n')
    : '- (none)';
  const skipText = skipRules.length > 0
    ? skipRules.map(r => `${r.senderName}${r.notes ? ` (${r.notes})` : ''}`).join(', ')
    : '(none)';
  return `You are a financial email classifier for a rental property manager in Alberta, Canada.
Your job is to analyze emails and identify which ones are related to rental property income or expenses.

PROPERTIES:
${JSON.stringify(propertyList, null, 2)}

TENANTS (current and archived):
${JSON.stringify(tenantList, null, 2)}

KNOWN SENDER ALIASES (sender name -> tenant name):
${aliasText}

You are the ONLY classifier — no other code parses these emails. Every transaction you return goes to a human review queue; NOTHING is recorded without the owner's explicit approval. So err on the side of surfacing borderline items, and use matchConfidence to tell the reviewer how sure you are.

CLASSIFICATION RULES:
- Interac e-Transfer RECEIVED (incoming money, "You've received", from notify@payments.interac.ca) = PAYMENT (rent from tenant). Match sender to a tenant using name, email, or aliases above. For tenant rent payments, put the rent month in the description, e.g. "Interac e-Transfer from JANE DOE (September 2026 rent)" (see RENT MONTH RULE). EXCEPTION: the skip list below applies to INCOMING transfers too — money received FROM a skip-listed person (e.g. a personal loan repayment) is NOT rental income; ignore those emails entirely.
- Interac LIFECYCLE NOISE: only COMPLETED transfers count ("You've received...", "...has been successfully deposited"). IGNORE money requests, transfer reminders, expiry warnings, declines, cancellations, and "transfer returned/cancelled" notices — none of them move money.
- Interac e-Transfer SENT (outgoing money, "Your transfer to" or "You've sent X money", from payments.interac.ca) = EXPENSE. Skip these known personal recipients (NOT property expenses): ${skipText}. Outgoing transfers to Airbnb guests (refunds, partial refunds for early checkout) are legitimate property expenses — categorize as "Airbnb".
- DEPOSIT RETURNS: an outgoing e-Transfer to a CURRENT OR FORMER TENANT (match the recipient against the tenant list, including archived tenants) is most likely a security-deposit return, not an expense. Include it with category "Deposit Return", describe it as "Possible deposit return to <name>", and set matchConfidence "none" so it is held for human review instead of being recorded automatically.
- AIRBNB PAYOUTS AND ROOMS: there are multiple Airbnb rooms, each a separate tenant (e.g. "Airbnb 01", "Airbnb 02"). Payout emails contain a Details section with the LISTING NAME, e.g. "Home • {dates} {listing name} ({listing id}". Match the listing name against the KNOWN SENDER ALIASES list to pick the room tenant and set its tenantId with matchConfidence "high". If a listing name is present but matches no alias, use matchConfidence "medium".
- ONLY "We sent a payout of $X" emails represent money actually received from Airbnb. IGNORE the surrounding lifecycle emails for the same money — "{Guest} has accepted your request for money", "Your request was sent", reservation confirmations, and booking reminders. Recording those double-counts the payout that follows.
- AIRBNB ROOM EXPENSES: for EXPENSES with category "Airbnb" or "Common Airbnb Expenses", if you cannot determine WHICH room the expense belongs to, leave tenantId null and cap matchConfidence at "medium" so a human assigns the room during review. This rule applies ONLY to those two categories.
- Utility bills (Enmax/Easymax, EPCOR, Shaw) = EXPENSE. Map Enmax to Calgary property, EPCOR to Edmonton property. Shaw: look for account numbers 099-0137-3821 (Edmonton) or 099-0203-0540 (Calgary).
- Amazon.ca order confirmations = EXPENSE (Home Improvement category). Look for delivery city (Calgary or Edmonton) to map to property.
- Insurance bills, mortgage statements, property tax notices = EXPENSE.
- IGNORE only clear noise: newsletters, social media notifications, job-related emails, marketing/promotions without an actual purchase, crypto exchanges, spam, login/security alerts.
- IGNORE shipping/delivery/tracking notifications ("Shipped:", "Delivered:", "Arriving today", "Out for delivery") — the ORDER CONFIRMATION email is the record of a purchase; a shipping notice for the same order is a duplicate, not a new expense.
- ORDER TOTALS: for a multi-item order ("...and N more items"), the amount MUST be the full order total, never a single item's price. Amazon order emails show one "Total" PER SHIPMENT with no grand total — sum all shipment totals ("Subtotal" lines are NOT totals). Beware of USD: if any total is billed in US dollars ("Total US$39.22"), report the USD figure but say "billed in USD — verify CAD charge" in the description and set matchConfidence "none" (the actual card charge in CAD differs).
- WHEN IN DOUBT, INCLUDE: any other email showing an actual dollar amount paid or received (bills, receipts, invoices, bank or e-Transfer notices, insurance, taxes, paid contractor work, service charges) should be returned as a transaction even if you are not sure it relates to the rental properties — use matchConfidence "medium" or "none" to flag uncertainty. It is better to surface a borderline item for human review than to silently drop it.

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
- "Airbnb" for Airbnb-room-specific costs (guest refunds, room furnishing, cleaning for one room)
- "Common Airbnb Expenses" for supplies shared across the Airbnb rooms (laundry soap, toilet supplies, cleaning products)
- "Utility Bills" for power/gas (Enmax, EPCOR)
- "Internet Bills" for internet/cable (Shaw)
- "Home Improvement" for Amazon orders
- "Maintenance" for contractor/repair payments
- "Insurance" for insurance bills
- "Mortgage" for mortgage payments
- "Property Taxes" for property tax
- "Other" for anything else

Return the relevant transactions in the "transactions" array. For irrelevant emails, omit them entirely (do NOT include them). If no emails are relevant, return an empty transactions array.`;
}

// JSON schema for structured outputs — the API guarantees the response
// matches this shape, so no parse-retry logic is needed.
const TRANSACTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['transactions'],
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['gmailMessageId', 'type', 'source', 'amount', 'date', 'matchConfidence'],
        properties: {
          gmailMessageId: { type: 'string', description: 'id from the input email' },
          type: { type: 'string', enum: ['payment', 'expense'] },
          source: {
            type: 'string',
            enum: ['interac_email', 'outgoing_interac_email', 'utility_email', 'amazon_email', 'other_email'],
          },
          senderName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          senderEmail: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          amount: { type: 'number', description: 'dollar amount' },
          date: { type: 'string', description: 'ISO 8601 date string' },
          description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          propertyId: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'matched property ID or null' },
          tenantId: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'matched tenant ID or null' },
          matchConfidence: { type: 'string', enum: ['high', 'medium', 'none'] },
        },
      },
    },
  },
};

// Fetch all recent emails from Gmail.
// Shipping/delivery notifications are excluded at the query level — the order
// confirmation email is the record of the expense; "Shipped:"/"Delivered:"
// emails repeat the same purchase and were double-recording Amazon orders.
async function fetchRecentEmails(gmail, prisma, afterClause, maxResults) {
  // Two queries, unioned:
  // 1. Broad sweep — everything except bulk categories and Amazon shipping notices.
  // 2. Critical financial senders searched EVERYWHERE (`in:anywhere` includes
  //    spam; no category filters). The retired keyword matchers guaranteed these
  //    senders were found even when Gmail miscategorized them — this query
  //    inherits that guarantee so an Interac notice landing in spam or an order
  //    email sorted into Promotions can never be silently skipped.
  const queries = [
    `${afterClause} -category:promotions -category:social -category:forums -from:shipment-tracking@amazon.ca -from:order-update@amazon.ca`,
    `${afterClause} in:anywhere {from:payments.interac.ca from:auto-confirm@amazon.ca from:easymax@enmax.com from:no-reply@epcor.com subject:"shaw bill is ready"}`,
  ];

  const seenIds = new Set();
  const allMessageIds = [];

  for (const query of queries) {
    let pageToken = null;
    do {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(maxResults, 100),
        pageToken,
      });

      for (const m of res.data.messages || []) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          allMessageIds.push(m.id);
        }
      }
      pageToken = res.data.nextPageToken;

      if (allMessageIds.length >= MAX_EMAILS) {
        console.warn(`[Gmail] Hit MAX_EMAILS cap (${MAX_EMAILS}) — some emails may have been skipped. Consider running a rescan with an earlier afterDate.`);
        pageToken = null;
        break;
      }
    } while (pageToken);
  }

  // Deduplicate against already-processed emails (pending transactions + scanned emails)
  const [existingPending, existingScanned] = await Promise.all([
    prisma.pendingTransaction.findMany({
      where: { gmailMessageId: { in: allMessageIds } },
      select: { gmailMessageId: true },
    }),
    prisma.scannedEmail.findMany({
      where: { gmailMessageId: { in: allMessageIds } },
      select: { gmailMessageId: true },
    }),
  ]);
  const existingIds = new Set([
    ...existingPending.map(e => e.gmailMessageId),
    ...existingScanned.map(e => e.gmailMessageId),
  ]);
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

      // Give Claude the WHOLE email, cleaned. Both body representations are
      // considered and the richer one wins — Airbnb's text/plain part is 64%
      // tracking URLs, which previously pushed real content (listing names,
      // order totals) past the truncation point and out of the model's view.
      const plainBody = cleanEmailBody(decodeBody(msg.data));
      const htmlBody = cleanEmailBody(stripHtmlToText(getHtmlBody(msg.data.payload)));
      let bodyPreview = plainBody.length >= htmlBody.length ? plainBody : htmlBody;

      // Generous cap purely as a runaway guard — routine scans analyze only a
      // handful of emails, so full bodies cost a fraction of a cent.
      if (bodyPreview.length > MAX_BODY_CHARS) {
        bodyPreview = bodyPreview.slice(0, MAX_BODY_CHARS) + ' …[truncated]';
      }

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

// Send a batch of emails to Claude for analysis.
// Structured outputs guarantee schema-valid JSON — no parse-retry needed.
// The system prompt (tenant/property context) is identical across batches
// within a scan, so it's cached to cut input cost on batches 2..N.
async function analyzeWithClaude(emails, systemPrompt) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8192,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: TRANSACTIONS_SCHEMA },
    },
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze these ${emails.length} emails and identify any rental property income or expenses:\n\n${JSON.stringify(emails, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude response truncated (max_tokens) — batch will be retried next scan');
  }
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to analyze this batch — batch will be retried next scan');
  }

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return JSON.parse(text).transactions;
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
        deletedAt: null,
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
        deletedAt: null,
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

// Verify the stored refresh token still works and return a Gmail client.
// Only wipes the token on a DEFINITIVE revocation (invalid_grant / expired-or-revoked).
// Transient network/API errors are retried once and then rethrown with the
// token intact — a flaky network call must never force a manual reconnect.
function isTokenRevocation(err) {
  const msg = err.message || '';
  const apiErr = err.response?.data?.error || '';
  return (
    apiErr === 'invalid_grant' ||
    msg.includes('invalid_grant') ||
    msg.includes('Token has been expired or revoked')
  );
}

async function getVerifiedGmailClient(prisma, syncState) {
  const gmail = await getGmailClient(syncState.refreshToken);

  try {
    await gmail.users.getProfile({ userId: 'me' });
    return gmail;
  } catch (firstErr) {
    let err = firstErr;
    if (!isTokenRevocation(err)) {
      // Possibly transient — retry once before deciding anything
      await new Promise(r => setTimeout(r, 2000));
      try {
        await gmail.users.getProfile({ userId: 'me' });
        return gmail;
      } catch (secondErr) {
        if (!isTokenRevocation(secondErr)) throw secondErr; // transient/unknown: keep token
        err = secondErr;
      }
    }

    // Definitive revocation: clear token so the UI shows "Connect Gmail", and alert
    await prisma.gmailSyncState.update({
      where: { id: syncState.id },
      data: { refreshToken: null },
    });
    await sendPush(
      'Rental Tracker: Gmail disconnected',
      'Google revoked the Gmail token. Open the app and click "Connect Gmail" to re-authorize.',
      { priority: 'urgent', tags: 'rotating_light' }
    );
    throw new Error('Gmail token expired. Please reconnect Gmail.');
  }
}

// Main scan function. The AI is the sole classifier — the old keyword/regex
// matchers are retired. Their targeted Gmail queries live on inside
// fetchRecentEmails so coverage of critical senders is unchanged.
async function runScan(prisma, options = {}) {
  const syncState = await prisma.gmailSyncState.findFirst();
  if (!syncState?.refreshToken) {
    throw new Error('Gmail not connected. Please authorize first.');
  }

  const gmail = await getVerifiedGmailClient(prisma, syncState);

  // Self-healing date filter — never looks back less than LOOKBACK_DAYS even if
  // lastSyncAt has advanced past unprocessed emails. Dedup prevents reprocessing.
  const afterClause = buildAfterClause(syncState.lastSyncAt, options.afterDate);

  const maxResults = options.maxResults || 100;

  // If rescan requested, clear ScannedEmail entries so previously-dismissed emails are re-analyzed
  if (options.rescan) {
    const deleted = await prisma.scannedEmail.deleteMany({});
    console.log(`Rescan mode: cleared ${deleted.count} scanned-email records`);
  }

  // Fetch all new email IDs (anything already in pendingTransaction or
  // scannedEmail is filtered out as a duplicate)
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

  const aiResults = { payments: 0, expenses: 0, autoRejected: 0, errors: [] };

  if (newMessageIds.length > 0) {
    console.log(`AI scanner: ${newMessageIds.length} new emails to analyze (${skippedIds.length} already processed)`);

    // Build context and process in batches
    const { propertyList, tenantList, aliasRules, skipRules } = await buildScanContext(prisma);
    const systemPrompt = buildSystemPrompt(propertyList, tenantList, aliasRules, skipRules);
    const emailMap = new Map();

    for (let i = 0; i < newMessageIds.length; i += BATCH_SIZE) {
      const batchIds = newMessageIds.slice(i, i + BATCH_SIZE);

      try {
        const emails = await fetchEmailBatch(gmail, batchIds);
        for (const e of emails) {
          emailMap.set(e.gmailMessageId, e);
        }

        if (emails.length === 0) continue;

        const transactions = await analyzeWithClaude(emails, systemPrompt);

        if (!Array.isArray(transactions)) {
          aiResults.errors.push(`Batch ${i / BATCH_SIZE + 1}: Claude returned non-array response`);
          continue;
        }

        const batchResults = await createPendingTransactions(prisma, transactions, emailMap);
        aiResults.payments += batchResults.payments;
        aiResults.expenses += batchResults.expenses;
        aiResults.autoRejected += batchResults.autoRejected || 0;
        aiResults.errors.push(...batchResults.errors);

        // Record ALL emails in this batch as scanned (even ones Claude ignored)
        // — AFTER pending transactions are created, so a creation failure doesn't
        // mark an email scanned without saving its transaction.
        await Promise.all(
          emails.map(e =>
            prisma.scannedEmail.upsert({
              where: { gmailMessageId: e.gmailMessageId },
              create: { gmailMessageId: e.gmailMessageId },
              update: {},
            })
          )
        );
      } catch (err) {
        aiResults.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err.message}`);
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, err);
      }
    }
  }

  // ============================================================
  // Update sync state — ONLY if the scan completed without errors.
  // Advancing lastSyncAt after a partial/failed scan would skip the
  // unprocessed emails permanently. The self-healing LOOKBACK window
  // is the second line of defense if this ever advances too far.
  // ============================================================
  if (aiResults.errors.length === 0) {
    await prisma.gmailSyncState.update({
      where: { id: syncState.id },
      data: { lastSyncAt: new Date() },
    });
  } else {
    console.error(`Scan completed with ${aiResults.errors.length} error(s) — NOT advancing lastSyncAt so missed emails get retried.`);
    console.error('Scan errors:', aiResults.errors);
  }

  return {
    payments: aiResults.payments,
    expenses: aiResults.expenses,
    total: aiResults.payments + aiResults.expenses,
    autoRejected: aiResults.autoRejected,
    errors: aiResults.errors,
    scanLog: {
      totalFetched,
      newEmails: newMessageIds.length,
      skippedDuplicates: skippedIds.length,
      skippedSamples: skippedSummary,
    },
  };
}

// Public entry point: wraps runScan so every scan (manual or cron) leaves a
// ScanRun record and failures produce a push notification instead of dying
// silently in the Railway logs.
async function scanGmailWithAI(prisma, options = {}) {
  const run = await prisma.scanRun.create({
    data: { trigger: options.trigger || 'manual' },
  });

  let results;
  try {
    results = await runScan(prisma, options);
  } catch (err) {
    await prisma.scanRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        errors: (err.message || 'Unknown error').slice(0, 4000),
      },
    }).catch(() => {});

    // Token revocation already sent its own targeted push in getVerifiedGmailClient
    const isDisconnect = (err.message || '').includes('reconnect') || (err.message || '').includes('not connected');
    if (!isDisconnect) {
      await sendPush(
        'Rental Tracker: Gmail scan failed',
        err.message || 'Unknown error',
        { priority: 'high', tags: 'warning' }
      );
    }
    throw err;
  }

  // NOTHING is auto-approved — every scanned transaction waits in the Inbox
  // for the owner's explicit approval. (Auto-approve was removed entirely at
  // the owner's request; the "Approve All High Confidence" button in the
  // Inbox remains for one-click MANUAL bulk approval.)
  const status = results.errors.length > 0 ? 'partial' : 'success';
  await prisma.scanRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      status,
      totalFetched: results.scanLog?.totalFetched || 0,
      newEmails: results.scanLog?.newEmails || 0,
      payments: results.payments || 0,
      expenses: results.expenses || 0,
      autoRejected: results.autoRejected || 0,
      errors: results.errors.length > 0 ? results.errors.join('\n').slice(0, 4000) : null,
    },
  }).catch(e => console.error('Failed to record scan run:', e.message));

  // Notify only when the scan surfaced something to review
  const needsReview = results.total || 0;
  if (needsReview > 0) {
    const lines = [
      `${results.payments} payment(s), ${results.expenses} expense(s) waiting in the Inbox.`,
    ];
    if (results.autoRejected) lines.push(`${results.autoRejected} duplicate(s) auto-rejected.`);
    await sendPush(
      `Rental Tracker: ${needsReview} new item(s) need review`,
      lines.join('\n').slice(0, 800),
      { priority: 'default', tags: 'incoming_envelope' }
    );
  }

  if (status === 'partial') {
    await sendPush(
      'Rental Tracker: scan completed with errors',
      `${results.errors.length} error(s) — unprocessed emails will be retried next scan.\nFirst: ${results.errors[0]}`.slice(0, 500),
      { priority: 'high', tags: 'warning' }
    );
  }

  return results;
}

module.exports = { scanGmailWithAI, findExistingInDB, analyzeWithClaude, buildSystemPrompt };
