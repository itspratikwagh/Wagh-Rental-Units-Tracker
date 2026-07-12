const express = require('express');
const router = express.Router();
const { getAuthUrl, exchangeCode } = require('../services/gmail');
const { scanGmailWithAI } = require('../services/gmailAiScanner');
const { approveTransaction, undoApproval } = require('../services/approval');

module.exports = function (prisma) {
  // Start OAuth2 flow
  router.get('/auth', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth credentials not configured' });
    }
    const url = getAuthUrl();
    res.redirect(url);
  });

  // OAuth2 callback
  router.get('/callback', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: 'No authorization code provided' });
      }

      const tokens = await exchangeCode(code);

      // Store refresh token in GmailSyncState
      let syncState = await prisma.gmailSyncState.findFirst();
      if (syncState) {
        await prisma.gmailSyncState.update({
          where: { id: syncState.id },
          data: { refreshToken: tokens.refresh_token || syncState.refreshToken },
        });
      } else {
        await prisma.gmailSyncState.create({
          data: { refreshToken: tokens.refresh_token },
        });
      }

      // Redirect to frontend inbox page
      const frontendUrl = process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || '/'
        : 'http://localhost:5173';
      res.redirect(`${frontendUrl}/inbox?gmail=connected`);
    } catch (error) {
      console.error('Gmail OAuth callback error:', error);
      res.status(500).json({ error: 'Failed to complete Gmail authorization' });
    }
  });

  // Check Gmail connection status (includes last scan outcome for the UI banner)
  router.get('/status', async (req, res) => {
    try {
      const [syncState, lastScan] = await Promise.all([
        prisma.gmailSyncState.findFirst(),
        prisma.scanRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      ]);
      res.json({
        connected: !!syncState?.refreshToken,
        lastSyncAt: syncState?.lastSyncAt || null,
        lastScan: lastScan
          ? {
              startedAt: lastScan.startedAt,
              finishedAt: lastScan.finishedAt,
              trigger: lastScan.trigger,
              status: lastScan.status,
              payments: lastScan.payments,
              expenses: lastScan.expenses,
              autoApproved: lastScan.autoApproved,
              errors: lastScan.errors,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check Gmail status' });
    }
  });

  // Scan history (most recent first)
  router.get('/scan-history', async (req, res) => {
    try {
      const runs = await prisma.scanRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 30,
      });
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch scan history' });
    }
  });

  // Manual scan trigger
  // Body can include:
  //   { afterDate: "2025/01/01" } for historical scan
  //   { rescan: true } to ignore lastSyncAt and scan last 30 days
  //   { maxResults: 200 } to increase email fetch limit
  router.post('/scan', async (req, res) => {
    try {
      const options = {};
      if (req.body.afterDate) options.afterDate = req.body.afterDate;
      if (req.body.maxResults) options.maxResults = req.body.maxResults;

      // Rescan mode: temporarily reset lastSyncAt so we go back further,
      // and pass flag so AI scanner clears ScannedEmail records too
      if (req.body.rescan) {
        options.rescan = true;
        const syncState = await prisma.gmailSyncState.findFirst();
        if (syncState) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          await prisma.gmailSyncState.update({
            where: { id: syncState.id },
            data: { lastSyncAt: thirtyDaysAgo },
          });
        }
      }

      const results = await scanGmailWithAI(prisma, options);
      const parts = [];
      if (results.payments) parts.push(`${results.payments} payment(s)`);
      if (results.expenses) parts.push(`${results.expenses} expense(s)`);
      const summary = parts.length > 0 ? parts.join(', ') : 'no new items';
      let autoRej = results.autoApproved ? ` ${results.autoApproved} auto-approved and recorded.` : '';
      if (results.autoRejected) autoRej += ` (${results.autoRejected} auto-rejected as duplicates)`;

      const log = results.scanLog || {};
      res.json({
        message: `Scan complete. Checked ${log.totalFetched || 0} emails: ${log.newEmails || 0} new, ${log.skippedDuplicates || 0} already processed. Found ${summary}.${autoRej}`,
        ...results,
      });
    } catch (error) {
      console.error('Gmail scan error:', error);
      const isTokenError = error.message.includes('expired') || error.message.includes('reconnect');
      res.status(isTokenError ? 401 : 500).json({
        error: error.message,
        reconnect: isTokenError,
      });
    }
  });

  // List pending transactions
  router.get('/pending', async (req, res) => {
    try {
      const { status } = req.query;
      const where = status ? { status } : {};
      const pending = await prisma.pendingTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
      });
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending transactions' });
    }
  });

  // Approve a pending transaction (with optional overrides)
  router.post('/pending/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const overrides = req.body || {};

      const pending = await prisma.pendingTransaction.findUnique({ where: { id } });
      if (!pending) return res.status(404).json({ error: 'Transaction not found' });
      if (pending.status !== 'pending') {
        return res.status(400).json({ error: `Transaction already ${pending.status}` });
      }

      const { record } = await approveTransaction(prisma, pending, overrides);
      res.json({ message: 'Transaction approved', record });
    } catch (error) {
      console.error('Approve error:', error);
      if (/must be selected/.test(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to approve transaction' });
    }
  });

  // Undo an approval (manual or auto) — reverts the created record and
  // returns the item to the pending queue
  router.post('/pending/:id/undo', async (req, res) => {
    try {
      const pending = await prisma.pendingTransaction.findUnique({ where: { id: req.params.id } });
      if (!pending) return res.status(404).json({ error: 'Transaction not found' });

      await undoApproval(prisma, pending);
      res.json({ message: 'Approval undone — transaction returned to pending' });
    } catch (error) {
      console.error('Undo error:', error);
      res.status(400).json({ error: error.message || 'Failed to undo approval' });
    }
  });

  // Reject a pending transaction
  router.post('/pending/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const pending = await prisma.pendingTransaction.findUnique({ where: { id } });
      if (!pending) return res.status(404).json({ error: 'Transaction not found' });

      await prisma.pendingTransaction.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      });

      res.json({ message: 'Transaction rejected' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject transaction' });
    }
  });

  // Bulk approve all high-confidence pending transactions
  router.post('/pending/approve-all', async (req, res) => {
    try {
      const highConfidence = await prisma.pendingTransaction.findMany({
        where: { status: 'pending', matchConfidence: 'high' },
      });

      let approved = 0;
      const errors = [];

      for (const pending of highConfidence) {
        try {
          if (
            (pending.type === 'payment' && !pending.tenantId) ||
            (pending.type === 'expense' && !pending.propertyId)
          ) {
            errors.push(`${pending.id}: missing required fields`);
            continue;
          }
          await approveTransaction(prisma, pending);
          approved++;
        } catch (err) {
          errors.push(`${pending.id}: ${err.message}`);
        }
      }

      res.json({
        message: `Approved ${approved} of ${highConfidence.length} transactions`,
        approved,
        total: highConfidence.length,
        errors,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to bulk approve' });
    }
  });

  return router;
};
