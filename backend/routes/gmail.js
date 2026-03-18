const express = require('express');
const router = express.Router();
const { getAuthUrl, exchangeCode, scanGmail, getRentMonth } = require('../services/gmail');

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

  // Check Gmail connection status
  router.get('/status', async (req, res) => {
    try {
      const syncState = await prisma.gmailSyncState.findFirst();
      res.json({
        connected: !!syncState?.refreshToken,
        lastSyncAt: syncState?.lastSyncAt || null,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check Gmail status' });
    }
  });

  // Manual scan trigger
  // Body can include { afterDate: "2025/10/25" } for historical scan
  router.post('/scan', async (req, res) => {
    try {
      const options = {};
      if (req.body.afterDate) options.afterDate = req.body.afterDate;
      if (req.body.maxResults) options.maxResults = req.body.maxResults;

      const results = await scanGmail(prisma, options);
      const parts = [];
      if (results.interac) parts.push(`${results.interac} rent payment(s)`);
      if (results.outgoing_interac) parts.push(`${results.outgoing_interac} outgoing transfer(s)`);
      if (results.amazon) parts.push(`${results.amazon} Amazon order(s)`);
      if (results.utility) parts.push(`${results.utility} utility bill(s)`);
      const summary = parts.length > 0 ? parts.join(', ') : 'no new items';
      res.json({
        message: `Scan complete. Found ${summary}.`,
        ...results,
      });
    } catch (error) {
      console.error('Gmail scan error:', error);
      res.status(500).json({ error: error.message });
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

      const amount = overrides.amount != null ? parseFloat(overrides.amount) : pending.amount;
      // For payments, use the rent month (1st of month) as the accounting date
      let date;
      if (overrides.date) {
        date = new Date(overrides.date);
      } else if (pending.type === 'payment') {
        date = getRentMonth(pending.date);
      } else {
        date = pending.date;
      }

      let created;

      if (pending.type === 'payment') {
        const tenantId = overrides.tenantId || pending.tenantId;
        if (!tenantId) {
          return res.status(400).json({ error: 'Tenant must be selected before approving a payment' });
        }

        // Check for existing pending payment for this tenant/month to update instead
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        const existingPending = await prisma.payment.findFirst({
          where: {
            tenantId,
            status: 'pending',
            date: { gte: monthStart, lte: monthEnd },
          },
        });

        if (existingPending) {
          // Update existing pending payment to completed
          created = await prisma.payment.update({
            where: { id: existingPending.id },
            data: {
              amount,
              date,
              status: 'completed',
              paymentMethod: 'e-transfer',
              notes: overrides.notes || `Auto-detected from Interac e-Transfer`,
            },
            include: { Tenant: true },
          });
        } else {
          created = await prisma.payment.create({
            data: {
              tenantId,
              amount,
              date,
              paymentMethod: 'e-transfer',
              status: 'completed',
              notes: overrides.notes || `Auto-detected from Interac e-Transfer`,
              updatedAt: new Date(),
            },
            include: { Tenant: true },
          });
        }
      } else {
        // Expense
        const propertyId = overrides.propertyId || pending.propertyId;
        if (!propertyId) {
          return res.status(400).json({ error: 'Property must be selected before approving an expense' });
        }

        created = await prisma.expense.create({
          data: {
            amount,
            date,
            category: overrides.category || pending.category || 'Utility Bills',
            description: overrides.description || pending.description || 'Utility bill',
            propertyId,
            updatedAt: new Date(),
          },
        });
      }

      // Mark as approved
      await prisma.pendingTransaction.update({
        where: { id },
        data: { status: 'approved', reviewedAt: new Date() },
      });

      res.json({ message: 'Transaction approved', record: created });
    } catch (error) {
      console.error('Approve error:', error);
      res.status(500).json({ error: 'Failed to approve transaction' });
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
          const amount = pending.amount;
          const date = pending.date;

          if (pending.type === 'payment' && pending.tenantId) {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const existingPending = await prisma.payment.findFirst({
              where: {
                tenantId: pending.tenantId,
                status: 'pending',
                date: { gte: monthStart, lte: monthEnd },
              },
            });

            if (existingPending) {
              await prisma.payment.update({
                where: { id: existingPending.id },
                data: {
                  amount,
                  date,
                  status: 'completed',
                  paymentMethod: 'e-transfer',
                  notes: 'Auto-detected from Interac e-Transfer',
                },
              });
            } else {
              await prisma.payment.create({
                data: {
                  tenantId: pending.tenantId,
                  amount,
                  date,
                  paymentMethod: 'e-transfer',
                  status: 'completed',
                  notes: 'Auto-detected from Interac e-Transfer',
                  updatedAt: new Date(),
                },
              });
            }
          } else if (pending.type === 'expense' && pending.propertyId) {
            await prisma.expense.create({
              data: {
                amount,
                date,
                category: pending.category || 'Utility Bills',
                description: pending.description || 'Utility bill',
                propertyId: pending.propertyId,
                updatedAt: new Date(),
              },
            });
          } else {
            errors.push(`${pending.id}: missing required fields`);
            continue;
          }

          await prisma.pendingTransaction.update({
            where: { id: pending.id },
            data: { status: 'approved', reviewedAt: new Date() },
          });
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
