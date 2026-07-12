const { getRentMonth } = require('./gmail');

// Shared approval logic used by the review UI endpoints AND the auto-approve
// step after each scan. Creates (or completes) the real Payment/Expense record
// and stamps the pending transaction with what was created so it can be undone.
async function approveTransaction(prisma, pending, overrides = {}, opts = {}) {
  const amount = overrides.amount != null ? parseFloat(overrides.amount) : pending.amount;
  const isAirbnb = (pending.senderName || '').toLowerCase().includes('airbnb');

  // For rent payments, snap to 1st of rent month; for Airbnb payouts, keep actual date
  let date;
  if (overrides.date) {
    date = new Date(overrides.date);
  } else if (pending.type === 'payment' && !isAirbnb) {
    date = getRentMonth(pending.date);
  } else {
    date = pending.date;
  }

  const notes = overrides.notes
    || (opts.auto ? 'Auto-approved from Gmail scan' : 'Auto-detected from Interac e-Transfer');

  let record;
  let recordType;

  if (pending.type === 'payment') {
    const tenantId = overrides.tenantId || pending.tenantId;
    if (!tenantId) throw new Error('Tenant must be selected before approving a payment');

    // If a pending (expected) payment already exists for this tenant/month,
    // complete it instead of creating a duplicate
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
      record = await prisma.payment.update({
        where: { id: existingPending.id },
        data: { amount, date, status: 'completed', paymentMethod: 'e-transfer', notes },
        include: { Tenant: true },
      });
      recordType = 'payment_completed'; // undo reverts to pending instead of deleting
    } else {
      record = await prisma.payment.create({
        data: {
          tenantId,
          amount,
          date,
          paymentMethod: 'e-transfer',
          status: 'completed',
          notes,
          updatedAt: new Date(),
        },
        include: { Tenant: true },
      });
      recordType = 'payment';
    }
  } else {
    const propertyId = overrides.propertyId || pending.propertyId;
    if (!propertyId) throw new Error('Property must be selected before approving an expense');

    record = await prisma.expense.create({
      data: {
        amount,
        date,
        category: overrides.category || pending.category || 'Utility Bills',
        description: overrides.description || pending.description || 'Utility bill',
        propertyId,
        updatedAt: new Date(),
      },
    });
    recordType = 'expense';
  }

  await prisma.pendingTransaction.update({
    where: { id: pending.id },
    data: {
      status: 'approved',
      reviewedAt: new Date(),
      autoApproved: !!opts.auto,
      createdRecordType: recordType,
      createdRecordId: record.id,
    },
  });

  return { record, recordType };
}

// Undo an approval (manual or auto): remove/revert the created record and
// put the pending transaction back in the review queue.
async function undoApproval(prisma, pending) {
  if (pending.status !== 'approved' || !pending.createdRecordId) {
    throw new Error('Nothing to undo for this transaction');
  }

  if (pending.createdRecordType === 'payment') {
    await prisma.payment.update({
      where: { id: pending.createdRecordId },
      data: { deletedAt: new Date() },
    });
  } else if (pending.createdRecordType === 'payment_completed') {
    // Approval completed a pre-existing expected payment — revert it, don't delete it
    await prisma.payment.update({
      where: { id: pending.createdRecordId },
      data: { status: 'pending' },
    });
  } else if (pending.createdRecordType === 'expense') {
    await prisma.expense.update({
      where: { id: pending.createdRecordId },
      data: { deletedAt: new Date() },
    });
  } else {
    throw new Error(`Unknown record type: ${pending.createdRecordType}`);
  }

  await prisma.pendingTransaction.update({
    where: { id: pending.id },
    data: {
      status: 'pending',
      reviewedAt: null,
      autoApproved: false,
      createdRecordType: null,
      createdRecordId: null,
    },
  });
}

// Check whether a pending transaction already has a matching real record —
// used to stop auto-approve from double-recording things entered manually.
// Payments: a completed payment for the same tenant in the same rent month.
// Expenses: same amount within ±3 days.
async function hasExistingRecord(prisma, pending) {
  if (pending.type === 'payment' && pending.tenantId) {
    const rentMonth = getRentMonth(pending.date);
    const monthStart = new Date(rentMonth.getFullYear(), rentMonth.getMonth(), 1);
    const monthEnd = new Date(rentMonth.getFullYear(), rentMonth.getMonth() + 1, 0, 23, 59, 59);
    const existing = await prisma.payment.findFirst({
      where: {
        tenantId: pending.tenantId,
        status: 'completed',
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
      },
    });
    return !!existing;
  }

  if (pending.type === 'expense') {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const txDate = new Date(pending.date);
    const nearby = await prisma.expense.findMany({
      where: {
        deletedAt: null,
        date: {
          gte: new Date(txDate.getTime() - threeDaysMs),
          lte: new Date(txDate.getTime() + threeDaysMs),
        },
      },
    });
    return nearby.some(e => Math.abs(e.amount - pending.amount) < 0.02);
  }

  return false;
}

// Auto-approve high-confidence transactions created since `since` (i.e. by the
// current scan — never touches older items the user may have deliberately left).
// Requirements: high confidence, positive amount, tenant/property resolved, and
// no matching record already in the books (those stay pending for review).
async function autoApproveHighConfidence(prisma, since) {
  const candidates = await prisma.pendingTransaction.findMany({
    where: {
      status: 'pending',
      matchConfidence: 'high',
      amount: { gt: 0 },
      createdAt: { gte: since },
    },
  });

  const approved = [];
  const errors = [];
  let skippedAsPossibleDuplicate = 0;

  for (const pending of candidates) {
    if (pending.type === 'payment' && !pending.tenantId) continue;
    if (pending.type === 'expense' && !pending.propertyId) continue;
    try {
      if (await hasExistingRecord(prisma, pending)) {
        skippedAsPossibleDuplicate++;
        continue; // stays pending — user decides if it's a duplicate or a second payment
      }
      const { record } = await approveTransaction(prisma, pending, {}, { auto: true });
      approved.push({ pending, record });
    } catch (err) {
      errors.push(`Auto-approve ${pending.id}: ${err.message}`);
    }
  }

  return { approved, errors, skippedAsPossibleDuplicate };
}

module.exports = { approveTransaction, undoApproval, autoApproveHighConfidence };
