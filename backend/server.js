const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

// Mount Gmail and Chat routes
const gmailRoutes = require('./routes/gmail')(prisma);
const chatRoutes = require('./routes/chat')(prisma);

// Load configuration based on environment
const config = require(`./config/${process.env.NODE_ENV || 'development'}.js`);

// Configure CORS
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? config.server.cors.origins
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Get all properties
app.get('/api/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      include: {
        Tenant: true,
        Expense: true,
      },
    });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new property
app.post('/api/properties', async (req, res) => {
  try {
    const property = await prisma.property.create({
      data: {
        ...req.body,
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
        Expense: true,
      },
    });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get property by ID
app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        Tenant: true,
        Expense: true,
      },
    });
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const property = await prisma.property.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a property
app.put('/api/properties/:id', async (req, res) => {
  try {
    // Extract property fields to update
    const { name, address, type, units,
            purchasePrice, purchaseDate, downPaymentPct, closingCosts,
            originalMortgage, mortgageRate, currentMortgageBal, currentMarketValue
          } = req.body;

    const updateData = {
      name,
      address,
      type,
      units: parseInt(units, 10),
    };

    // Investment fields — only include if provided (so existing forms still work)
    if (purchasePrice !== undefined) updateData.purchasePrice = parseFloat(purchasePrice);
    if (purchaseDate !== undefined) updateData.purchaseDate = new Date(purchaseDate);
    if (downPaymentPct !== undefined) updateData.downPaymentPct = parseFloat(downPaymentPct);
    if (closingCosts !== undefined) updateData.closingCosts = parseFloat(closingCosts);
    if (originalMortgage !== undefined) updateData.originalMortgage = parseFloat(originalMortgage);
    if (mortgageRate !== undefined) updateData.mortgageRate = parseFloat(mortgageRate);
    if (currentMortgageBal !== undefined) updateData.currentMortgageBal = parseFloat(currentMortgageBal);
    if (currentMarketValue !== undefined) updateData.currentMarketValue = parseFloat(currentMarketValue);

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        Tenant: true,
        Expense: true,
      },
    });
    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.meta || 'No additional details available'
    });
  }
});

// Get all tenants (with optional archived filter)
app.get('/api/tenants', async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const where = includeArchived === 'true' ? { isArchived: true } : { isArchived: false };
    
    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        Property: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Update a tenant
app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    
    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
      include: {
        Property: true,
        Payment: true,
      },
    });
    res.json(tenant);
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

// Archive a tenant
app.put('/api/tenants/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isArchived: true },
      include: {
        Property: true,
      },
    });
    res.json(tenant);
  } catch (error) {
    console.error('Error archiving tenant:', error);
    res.status(500).json({ error: 'Failed to archive tenant' });
  }
});

// Unarchive a tenant
app.put('/api/tenants/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isArchived: false },
      include: {
        Property: true,
      },
    });
    res.json(tenant);
  } catch (error) {
    console.error('Error unarchiving tenant:', error);
    res.status(500).json({ error: 'Failed to unarchive tenant' });
  }
});

// Create a new tenant
app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = await prisma.tenant.create({
      data: {
        ...req.body,
        updatedAt: new Date()
      },
      include: {
        Property: true,
        Payment: true,
      },
    });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tenant by ID
app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        Property: true,
        Payment: true,
      },
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a tenant
app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await prisma.tenant.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all payments
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        Tenant: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Add a new payment
app.post('/api/payments', async (req, res) => {
  try {
    const { tenantId, amount, date, paymentMethod, notes, status } = req.body;

    // Validate required fields
    if (!tenantId || !amount || !date || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          tenantId: !tenantId ? 'Tenant ID is required' : null,
          amount: !amount ? 'Amount is required' : null,
          date: !date ? 'Date is required' : null,
          paymentMethod: !paymentMethod ? 'Payment method is required' : null
        }
      });
    }

    // Validate amount is a number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }

    // Validate status if provided
    const validStatuses = ['completed', 'pending', 'late', 'partial'];
    const paymentStatus = status || 'completed';
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        details: 'Status must be one of: completed, pending, late, partial'
      });
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        amount: parsedAmount,
        date: new Date(date),
        paymentMethod,
        status: paymentStatus,
        notes: notes || null,
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ 
      error: 'Failed to create payment',
      details: error.message 
    });
  }
});

// Delete a payment
app.delete('/api/payments/:id', async (req, res) => {
  try {
    const payment = await prisma.payment.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment', details: error.message });
  }
});

// Update a payment
app.put('/api/payments/:id', async (req, res) => {
  try {
    const { tenantId, amount, date, paymentMethod, notes, status } = req.body;

    // Validate required fields
    if (!tenantId || !amount || !date || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          tenantId: !tenantId ? 'Tenant ID is required' : null,
          amount: !amount ? 'Amount is required' : null,
          date: !date ? 'Date is required' : null,
          paymentMethod: !paymentMethod ? 'Payment method is required' : null
        }
      });
    }

    // Validate amount is a number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }

    // Validate status if provided
    const validStatuses = ['completed', 'pending', 'late', 'partial'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        details: 'Status must be one of: completed, pending, late, partial'
      });
    }

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: req.params.id },
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update the payment
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        tenantId,
        amount: parsedAmount,
        date: new Date(date),
        paymentMethod,
        status: status || existingPayment.status,
        notes: notes || null
      },
      include: {
        Tenant: true,
      },
    });

    res.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ 
      error: 'Failed to update payment',
      details: error.message 
    });
  }
});

// Generate pending payments for all active tenants for the current month
app.post('/api/payments/generate-pending', async (req, res) => {
  try {
    const { month, year } = req.body;
    
    // Use provided month/year or default to current month
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();
    
    // Create date for the 1st of the target month
    const dueDate = new Date(targetYear, targetMonth - 1, 1);
    
    // Get all active tenants
    const activeTenants = await prisma.tenant.findMany({
      where: { isArchived: false }
    });
    
    if (activeTenants.length === 0) {
      return res.json({ 
        message: 'No active tenants found',
        created: 0 
      });
    }
    
    // Check which tenants already have payments for this month
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    const existingPayments = await prisma.payment.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });
    
    const tenantsWithPayments = new Set(existingPayments.map(p => p.tenantId));
    
    // Create pending payments for tenants without payments
    const tenantsNeedingPayments = activeTenants.filter(
      tenant => !tenantsWithPayments.has(tenant.id)
    );
    
    const createdPayments = [];
    for (const tenant of tenantsNeedingPayments) {
      const payment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          amount: tenant.rentAmount,
          date: dueDate,
          paymentMethod: 'bank_transfer',
          status: 'pending',
          notes: `Auto-generated for ${new Date(targetYear, targetMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          updatedAt: new Date()
        },
        include: {
          Tenant: true
        }
      });
      createdPayments.push(payment);
    }
    
    res.json({ 
      message: `Generated ${createdPayments.length} pending payments`,
      created: createdPayments.length,
      payments: createdPayments
    });
  } catch (error) {
    console.error('Error generating pending payments:', error);
    res.status(500).json({ 
      error: 'Failed to generate pending payments',
      details: error.message 
    });
  }
});

// Get all expenses
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: {
        date: 'desc',
      },
    });
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create a new expense
app.post('/api/expenses', async (req, res) => {
  try {
    const { amount, date, category, description, propertyId } = req.body;
    
    if (!amount || !date || !category || !description || !propertyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        date: new Date(date),
        category,
        description,
        propertyId,
        updatedAt: new Date()
      },
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
});

// Get expense by ID
app.get('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
    });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        amount: parseFloat(req.body.amount),
        date: new Date(req.body.date),
        category: req.body.category,
        description: req.body.description,
      },
    });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gmail and Chat API routes
app.use('/api/gmail', gmailRoutes);
app.use('/api/chat', chatRoutes);

// Manual trigger for the garbage reminder — useful for testing the pipeline
// without waiting for the nightly cron. Returns whatever the reminder check
// produced so you can see what was sent / skipped / errored.
app.post('/api/garbage-reminder/run', async (req, res) => {
  try {
    const { runReminderCheck } = require('./services/garbageReminder');
    const results = await runReminderCheck();
    res.json(results);
  } catch (error) {
    console.error('Garbage reminder trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Scan Gmail every 6 hours using AI scanner (if connected)
cron.schedule('0 */6 * * *', async () => {
  try {
    const { scanGmailWithAI } = require('./services/gmailAiScanner');
    const results = await scanGmailWithAI(prisma);
    console.log(`[Cron] Gmail AI scan: ${results.payments} payments, ${results.expenses} expenses`);
  } catch (err) {
    // Not connected or scan failed — skip silently
    if (!err.message.includes('not connected')) {
      console.error('[Cron] Gmail scan error:', err.message);
    }
  }
});

// Generate recurring expenses daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const { generateRecurringExpenses } = require('./services/recurring');
    const results = await generateRecurringExpenses(prisma);
    if (results.created > 0) {
      console.log(`[Cron] Recurring expenses: created ${results.created}`);
    }
  } catch (err) {
    console.error('[Cron] Recurring expenses error:', err.message);
  }
});

// Garbage reminder — runs every evening in Calgary time. The reminder service
// checks tomorrow's pickup for each configured address and only sends a
// WhatsApp message if at least one cart is actually due. Guarded by
// GARBAGE_REMINDER_ENABLED so the existing deploy is unaffected until opted in.
const garbageReminderTz = process.env.GARBAGE_REMINDER_TIMEZONE || 'America/Edmonton';
const garbageReminderCron = process.env.GARBAGE_REMINDER_CRON || '0 19 * * *';
cron.schedule(garbageReminderCron, async () => {
  if (process.env.GARBAGE_REMINDER_ENABLED !== 'true') return;
  try {
    const { runReminderCheck } = require('./services/garbageReminder');
    const results = await runReminderCheck();
    console.log(
      `[Cron] Garbage reminder: checked=${results.checked} sent=${results.sent} ` +
      `skipped=${results.skipped} errors=${results.errors.length}`
    );
  } catch (err) {
    console.error('[Cron] Garbage reminder error:', err.message);
  }
}, { timezone: garbageReminderTz });

// --- Investment Stats API ---

app.get('/api/dashboard/investment-stats', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      include: { Tenant: true, Expense: true },
    });
    const payments = await prisma.payment.findMany({
      include: { Tenant: true },
    });

    const stats = properties
      .filter(p => p.purchasePrice) // only properties with investment data
      .map(property => {
        const now = new Date();
        const purchaseDate = new Date(property.purchaseDate);
        const yearsHeld = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25);

        const downPayment = property.purchasePrice * (property.downPaymentPct / 100);
        const closingCosts = property.closingCosts || property.purchasePrice * 0.03;
        const totalCashInvested = downPayment + closingCosts;

        // Total income: payments to tenants of this property
        const propertyTenantIds = property.Tenant.map(t => t.id);
        const totalIncome = payments
          .filter(p => propertyTenantIds.includes(p.tenantId))
          .reduce((sum, p) => sum + p.amount, 0);

        // Total expenses
        const totalExpenses = property.Expense.reduce((sum, e) => sum + e.amount, 0);

        const totalCashFlow = totalIncome - totalExpenses;
        const appreciation = (property.currentMarketValue || property.purchasePrice) - property.purchasePrice;
        const equityFromMortgage = (property.originalMortgage || 0) - (property.currentMortgageBal || 0);
        const totalEquity = (property.currentMarketValue || property.purchasePrice) - (property.currentMortgageBal || 0);

        const totalReturn = appreciation + equityFromMortgage + totalCashFlow;
        const totalROI = totalCashInvested > 0 ? (totalReturn / totalCashInvested) * 100 : 0;
        const annualizedROI = yearsHeld > 0
          ? (Math.pow(1 + totalReturn / totalCashInvested, 1 / yearsHeld) - 1) * 100
          : 0;
        const annualCashFlow = yearsHeld > 0 ? totalCashFlow / yearsHeld : 0;
        const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

        // Cap Rate = Annual NOI / Current Market Value
        // NOI = income - operating expenses (excluding mortgage)
        const mortgageExpenses = property.Expense
          .filter(e => e.category === 'Mortgage')
          .reduce((sum, e) => sum + e.amount, 0);
        const operatingExpenses = totalExpenses - mortgageExpenses;
        const annualNOI = yearsHeld > 0 ? (totalIncome - operatingExpenses) / yearsHeld : 0;
        const capRate = property.currentMarketValue > 0
          ? (annualNOI / property.currentMarketValue) * 100 : 0;

        const equityMultiple = totalCashInvested > 0
          ? (totalCashInvested + totalReturn) / totalCashInvested : 0;

        return {
          propertyId: property.id,
          propertyName: property.name,
          purchasePrice: property.purchasePrice,
          purchaseDate: property.purchaseDate,
          downPayment: Math.round(downPayment),
          closingCosts: Math.round(closingCosts),
          totalCashInvested: Math.round(totalCashInvested),
          currentMarketValue: property.currentMarketValue,
          originalMortgage: property.originalMortgage,
          currentMortgageBal: property.currentMortgageBal,
          mortgageRate: property.mortgageRate,
          equityFromMortgage: Math.round(equityFromMortgage),
          totalEquity: Math.round(totalEquity),
          appreciation: Math.round(appreciation),
          totalIncome: Math.round(totalIncome),
          totalExpenses: Math.round(totalExpenses),
          totalCashFlow: Math.round(totalCashFlow),
          yearsHeld: Math.round(yearsHeld * 10) / 10,
          totalReturn: Math.round(totalReturn),
          totalROI: Math.round(totalROI * 10) / 10,
          annualizedROI: Math.round(annualizedROI * 10) / 10,
          cashOnCash: Math.round(cashOnCash * 10) / 10,
          capRate: Math.round(capRate * 10) / 10,
          equityMultiple: Math.round(equityMultiple * 100) / 100,
        };
      });

    // Combined portfolio
    const portfolio = stats.reduce(
      (acc, s) => ({
        totalCashInvested: acc.totalCashInvested + s.totalCashInvested,
        totalMarketValue: acc.totalMarketValue + (s.currentMarketValue || 0),
        totalMortgageBal: acc.totalMortgageBal + (s.currentMortgageBal || 0),
        totalAppreciation: acc.totalAppreciation + s.appreciation,
        totalEquityFromMortgage: acc.totalEquityFromMortgage + s.equityFromMortgage,
        totalCashFlow: acc.totalCashFlow + s.totalCashFlow,
        totalIncome: acc.totalIncome + s.totalIncome,
        totalExpenses: acc.totalExpenses + s.totalExpenses,
        totalEquity: acc.totalEquity + s.totalEquity,
      }),
      {
        totalCashInvested: 0, totalMarketValue: 0, totalMortgageBal: 0,
        totalAppreciation: 0, totalEquityFromMortgage: 0, totalCashFlow: 0,
        totalIncome: 0, totalExpenses: 0, totalEquity: 0,
      }
    );

    const portfolioReturn = portfolio.totalAppreciation + portfolio.totalEquityFromMortgage + portfolio.totalCashFlow;
    portfolio.totalReturn = Math.round(portfolioReturn);
    portfolio.totalROI = portfolio.totalCashInvested > 0
      ? Math.round((portfolioReturn / portfolio.totalCashInvested) * 1000) / 10 : 0;
    portfolio.equityMultiple = portfolio.totalCashInvested > 0
      ? Math.round(((portfolio.totalCashInvested + portfolioReturn) / portfolio.totalCashInvested) * 100) / 100 : 0;

    res.json({ properties: stats, portfolio });
  } catch (error) {
    console.error('Error computing investment stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Recurring Expense API ---

// List all recurring expense templates
app.get('/api/recurring-expenses', async (req, res) => {
  try {
    const templates = await prisma.recurringExpense.findMany({
      orderBy: { category: 'asc' },
    });
    // Attach property name
    const properties = await prisma.property.findMany();
    const propMap = Object.fromEntries(properties.map(p => [p.id, p]));
    const result = templates.map(t => ({
      ...t,
      Property: propMap[t.propertyId] || null,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recurring expenses' });
  }
});

// Create a recurring expense template
app.post('/api/recurring-expenses', async (req, res) => {
  try {
    const { description, amount, category, propertyId, frequency, dayOfWeek, dayOfMonth } = req.body;
    const template = await prisma.recurringExpense.create({
      data: { description, amount, category, propertyId, frequency, dayOfWeek, dayOfMonth },
    });
    res.json(template);
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

// Update a recurring expense template
app.put('/api/recurring-expenses/:id', async (req, res) => {
  try {
    const template = await prisma.recurringExpense.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update recurring expense' });
  }
});

// Delete a recurring expense template
app.delete('/api/recurring-expenses/:id', async (req, res) => {
  try {
    await prisma.recurringExpense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recurring expense' });
  }
});

// Trigger recurring expense generation manually
app.post('/api/recurring-expenses/generate', async (req, res) => {
  try {
    const { generateRecurringExpenses } = require('./services/recurring');
    const results = await generateRecurringExpenses(prisma);
    res.json(results);
  } catch (error) {
    console.error('Recurring generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});