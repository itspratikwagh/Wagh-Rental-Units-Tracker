const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

async function buildDataContext(prisma) {
  const [properties, tenants, payments, expenses] = await Promise.all([
    prisma.property.findMany(),
    prisma.tenant.findMany({ include: { Property: true } }),
    prisma.payment.findMany({
      include: { Tenant: true },
      orderBy: { date: 'desc' },
      take: 200,
    }),
    prisma.expense.findMany({
      orderBy: { date: 'desc' },
      take: 200,
    }),
  ]);

  // Summarize tenants for context
  const tenantSummary = tenants.map(t => ({
    id: t.id,
    name: t.name,
    email: t.email,
    property: t.Property?.name,
    rentAmount: t.rentAmount,
    leaseStart: t.leaseStart,
    leaseEnd: t.leaseEnd,
    isArchived: t.isArchived,
  }));

  // Summarize payments
  const paymentSummary = payments.map(p => ({
    date: p.date,
    tenant: p.Tenant?.name,
    amount: p.amount,
    status: p.status,
    method: p.paymentMethod,
  }));

  // Summarize expenses
  const expenseSummary = expenses.map(e => ({
    date: e.date,
    amount: e.amount,
    category: e.category,
    description: e.description,
    propertyId: e.propertyId,
  }));

  // Map property IDs to names for expenses
  const propertyMap = {};
  properties.forEach(p => { propertyMap[p.id] = p.name; });
  expenseSummary.forEach(e => {
    e.property = propertyMap[e.propertyId] || e.propertyId;
    delete e.propertyId;
  });

  return `You are a helpful assistant for a rental property manager in Alberta, Canada. Here is the current data from their rental tracking system:

PROPERTIES:
${JSON.stringify(properties.map(p => ({ name: p.name, address: p.address, type: p.type, units: p.units })), null, 2)}

TENANTS:
${JSON.stringify(tenantSummary, null, 2)}

RECENT PAYMENTS (up to 200, newest first):
${JSON.stringify(paymentSummary, null, 2)}

RECENT EXPENSES (up to 200, newest first):
${JSON.stringify(expenseSummary, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

Rules:
- Answer questions based on this data. Be specific with numbers and names.
- Format currency as CAD (e.g., $1,500.00).
- If calculating totals or comparisons, show your reasoning.
- If the data doesn't contain enough information to answer, say so.
- Keep responses concise and practical.`;
}

async function chat(prisma, message, conversationHistory = []) {
  const client = getClient();
  const context = await buildDataContext(prisma);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: context,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message },
    ],
  });

  const assistantMessage = response.content[0].text;

  return {
    response: assistantMessage,
    conversationHistory: [
      ...conversationHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: assistantMessage },
    ],
  };
}

module.exports = { chat };
