const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// Tools Claude can use for write operations
const TOOLS = [
  {
    name: 'create_expense',
    description: 'Create a new expense record. Use this when the user asks to add/log/record an expense.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What the expense is for' },
        amount: { type: 'number', description: 'Amount in CAD' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        category: { type: 'string', description: 'Expense category (e.g., Utility Bills, Repairs, Mortgage, Insurance, Internet Bills, Property Tax, Maintenance)' },
        propertyName: { type: 'string', description: 'Property name as it appears in the system (e.g., "Edmonton Property", "Calgary Property")' },
      },
      required: ['description', 'amount', 'date', 'category', 'propertyName'],
    },
  },
  {
    name: 'create_payment',
    description: 'Record a rent payment from a tenant. Use this when the user says a tenant paid rent or asks to add a payment.',
    input_schema: {
      type: 'object',
      properties: {
        tenantName: { type: 'string', description: 'Tenant name as it appears in the system' },
        amount: { type: 'number', description: 'Payment amount in CAD' },
        date: { type: 'string', description: 'Payment date in YYYY-MM-DD format' },
        paymentMethod: { type: 'string', description: 'Payment method (e.g., Interac e-Transfer, Cash, Cheque)', default: 'Interac e-Transfer' },
        notes: { type: 'string', description: 'Optional notes about the payment' },
      },
      required: ['tenantName', 'amount', 'date'],
    },
  },
  {
    name: 'update_tenant',
    description: 'Update tenant details like rent amount, lease dates, email, or phone.',
    input_schema: {
      type: 'object',
      properties: {
        tenantName: { type: 'string', description: 'Current tenant name in the system' },
        rentAmount: { type: 'number', description: 'New rent amount if changing' },
        leaseEnd: { type: 'string', description: 'New lease end date in YYYY-MM-DD format' },
        email: { type: 'string', description: 'New email address' },
        phone: { type: 'string', description: 'New phone number' },
      },
      required: ['tenantName'],
    },
  },
  {
    name: 'archive_tenant',
    description: 'Archive a tenant who has moved out.',
    input_schema: {
      type: 'object',
      properties: {
        tenantName: { type: 'string', description: 'Tenant name to archive' },
      },
      required: ['tenantName'],
    },
  },
  {
    name: 'delete_expense',
    description: 'Delete an expense record. Use when user wants to remove a wrongly entered expense.',
    input_schema: {
      type: 'object',
      properties: {
        expenseId: { type: 'string', description: 'The expense ID to delete' },
      },
      required: ['expenseId'],
    },
  },
  {
    name: 'delete_payment',
    description: 'Delete a payment record. Use when user wants to remove a wrongly entered payment.',
    input_schema: {
      type: 'object',
      properties: {
        paymentId: { type: 'string', description: 'The payment ID to delete' },
      },
      required: ['paymentId'],
    },
  },
];

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

  const paymentSummary = payments.map(p => ({
    id: p.id,
    date: p.date,
    tenant: p.Tenant?.name,
    amount: p.amount,
    status: p.status,
    method: p.paymentMethod,
  }));

  const propertyMap = {};
  properties.forEach(p => { propertyMap[p.id] = p.name; });

  const expenseSummary = expenses.map(e => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    category: e.category,
    description: e.description,
    property: propertyMap[e.propertyId] || e.propertyId,
  }));

  return `You are a helpful assistant for a rental property manager in Alberta, Canada. You can both answer questions about their data AND make changes when asked.

PROPERTIES:
${JSON.stringify(properties.map(p => ({ id: p.id, name: p.name, address: p.address, type: p.type, units: p.units })), null, 2)}

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
- Keep responses concise and practical.
- When the user asks to create, add, update, or delete data, use the appropriate tool.
- For property names, match them to existing property names in the data above.
- For tenant names, match them to existing tenant names in the data above.
- When using tools, explain what you're about to do BEFORE calling the tool so the user can see the confirmation.
- If the user's request is ambiguous (e.g., which property?), ask for clarification rather than guessing.`;
}

// Execute a confirmed tool action against the database
async function executeAction(prisma, action) {
  const { toolName, input } = action;

  switch (toolName) {
    case 'create_expense': {
      const property = await prisma.property.findFirst({
        where: { name: { contains: input.propertyName, mode: 'insensitive' } },
      });
      if (!property) throw new Error(`Property "${input.propertyName}" not found`);

      const expense = await prisma.expense.create({
        data: {
          description: input.description,
          amount: input.amount,
          date: new Date(input.date),
          category: input.category,
          propertyId: property.id,
          updatedAt: new Date(),
        },
      });
      return { success: true, message: `Expense created: ${input.description} — $${input.amount} for ${property.name}`, id: expense.id };
    }

    case 'create_payment': {
      const tenant = await prisma.tenant.findFirst({
        where: { name: { contains: input.tenantName, mode: 'insensitive' } },
      });
      if (!tenant) throw new Error(`Tenant "${input.tenantName}" not found`);

      const payment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          amount: input.amount,
          date: new Date(input.date),
          paymentMethod: input.paymentMethod || 'Interac e-Transfer',
          notes: input.notes || null,
          status: 'completed',
          updatedAt: new Date(),
        },
      });
      return { success: true, message: `Payment recorded: $${input.amount} from ${tenant.name}`, id: payment.id };
    }

    case 'update_tenant': {
      const tenant = await prisma.tenant.findFirst({
        where: { name: { contains: input.tenantName, mode: 'insensitive' } },
      });
      if (!tenant) throw new Error(`Tenant "${input.tenantName}" not found`);

      const updateData = {};
      if (input.rentAmount != null) updateData.rentAmount = input.rentAmount;
      if (input.leaseEnd) updateData.leaseEnd = new Date(input.leaseEnd);
      if (input.email) updateData.email = input.email;
      if (input.phone) updateData.phone = input.phone;

      if (Object.keys(updateData).length === 0) throw new Error('No fields to update');

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: updateData,
      });
      return { success: true, message: `Updated ${tenant.name}: ${Object.entries(updateData).map(([k, v]) => `${k} → ${v}`).join(', ')}` };
    }

    case 'archive_tenant': {
      const tenant = await prisma.tenant.findFirst({
        where: { name: { contains: input.tenantName, mode: 'insensitive' }, isArchived: false },
      });
      if (!tenant) throw new Error(`Active tenant "${input.tenantName}" not found`);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { isArchived: true },
      });
      return { success: true, message: `Archived tenant: ${tenant.name}` };
    }

    case 'delete_expense': {
      await prisma.expense.delete({ where: { id: input.expenseId } });
      return { success: true, message: `Expense deleted (${input.expenseId})` };
    }

    case 'delete_payment': {
      await prisma.payment.delete({ where: { id: input.paymentId } });
      return { success: true, message: `Payment deleted (${input.paymentId})` };
    }

    default:
      throw new Error(`Unknown action: ${toolName}`);
  }
}

// Format a tool call into a human-readable confirmation message
function describeAction(toolName, input) {
  switch (toolName) {
    case 'create_expense':
      return `Add expense: **${input.description}** — $${input.amount.toFixed(2)} on ${input.date} (${input.category}) for ${input.propertyName}`;
    case 'create_payment':
      return `Record payment: **$${input.amount.toFixed(2)}** from ${input.tenantName} on ${input.date}${input.paymentMethod ? ` via ${input.paymentMethod}` : ''}${input.notes ? ` (${input.notes})` : ''}`;
    case 'update_tenant': {
      const changes = [];
      if (input.rentAmount != null) changes.push(`rent → $${input.rentAmount}`);
      if (input.leaseEnd) changes.push(`lease end → ${input.leaseEnd}`);
      if (input.email) changes.push(`email → ${input.email}`);
      if (input.phone) changes.push(`phone → ${input.phone}`);
      return `Update tenant **${input.tenantName}**: ${changes.join(', ')}`;
    }
    case 'archive_tenant':
      return `Archive tenant: **${input.tenantName}**`;
    case 'delete_expense':
      return `Delete expense (ID: ${input.expenseId})`;
    case 'delete_payment':
      return `Delete payment (ID: ${input.paymentId})`;
    default:
      return `${toolName}: ${JSON.stringify(input)}`;
  }
}

async function chat(prisma, message, conversationHistory = []) {
  const client = getClient();
  const context = await buildDataContext(prisma);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: context,
    tools: TOOLS,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message },
    ],
  });

  // Check if Claude wants to use a tool (write action)
  const toolUseBlock = response.content.find(b => b.type === 'tool_use');
  const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

  if (toolUseBlock) {
    // Return the proposed action for user confirmation
    const description = describeAction(toolUseBlock.name, toolUseBlock.input);

    return {
      response: textBlocks || 'I\'d like to make this change:',
      pendingAction: {
        toolName: toolUseBlock.name,
        toolUseId: toolUseBlock.id,
        input: toolUseBlock.input,
        description,
      },
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: response.content },
      ],
    };
  }

  // Pure text response (read-only query)
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

// After user confirms, execute and continue the conversation
async function confirmAction(prisma, action, conversationHistory) {
  const result = await executeAction(prisma, action);

  // Continue conversation with tool result so Claude can acknowledge
  const client = getClient();
  const context = await buildDataContext(prisma);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: context,
    tools: TOOLS,
    messages: [
      ...conversationHistory,
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: action.toolUseId,
          content: JSON.stringify(result),
        }],
      },
    ],
  });

  const assistantMessage = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

  return {
    response: assistantMessage || result.message,
    result,
    conversationHistory: [
      ...conversationHistory,
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: action.toolUseId,
          content: JSON.stringify(result),
        }],
      },
      { role: 'assistant', content: assistantMessage },
    ],
  };
}

module.exports = { chat, confirmAction, executeAction };
