const { getRentMonth } = require('./gmail');
const { sendEmail } = require('./email');
const { sendPush } = require('./notify');

// Both cron jobs fire at 09:00 America/Edmonton (15:00/16:00 UTC), so the
// server's UTC calendar date always equals the Edmonton date at fire time —
// plain new Date() month/day math is safe here.

// Rent reminders go out on the 30th, or on the last day of February.
function isRentReminderDay(d) {
  const isLastDayOfFeb =
    d.getMonth() === 1 &&
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getMonth() !== 1;
  return d.getDate() === 30 || isLastDayOfFeb;
}

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function rentEmailBody(tenant, rentMonthLabel, dueMonthName) {
  const firstName = (tenant.name || '').split(/\s+/)[0] || 'there';
  return [
    `Hi ${firstName},`,
    '',
    `This is a friendly reminder that your rent of $${tenant.rentAmount.toFixed(2)} for`,
    `${rentMonthLabel} is due on ${dueMonthName} 1st.`,
    '',
    `  Property: ${tenant.Property?.name || ''} — ${tenant.Property?.address || ''}`,
    `  Amount:   $${tenant.rentAmount.toFixed(2)}`,
    '  Payment:  Interac e-Transfer (same as usual)',
    '',
    "If you've already sent this month's payment, please disregard this message.",
    '',
    'Thank you,',
    'Pratik',
  ].join('\n');
}

// Email each active tenant a reminder for NEXT month's rent.
// Skips (recomputed every run): no email, final month of lease / lease over,
// rent month already paid, or reminder already sent (ReminderLog dedupe).
async function runRentReminders(prisma, options = {}) {
  const dryRun = !!options.dryRun;
  const now = options.now ? new Date(options.now) : new Date();

  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rentMonthLabel = monthLabel(nextMonthStart);
  const dueMonthName = nextMonthStart.toLocaleString('en-US', { month: 'long' });
  const monthKey = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}`;

  const tenants = await prisma.tenant.findMany({
    where: { isArchived: false, deletedAt: null },
    include: { Property: true },
  });

  const sent = [];
  const skipped = [];

  for (const tenant of tenants) {
    const dedupeKey = `rent:${tenant.id}:${monthKey}`;

    // "Airbnb" is a bookkeeping pseudo-tenant for payouts, not a person
    if (tenant.name.toLowerCase().includes('airbnb')) {
      skipped.push({ name: tenant.name, reason: 'placeholder tenant' });
      continue;
    }

    if (!tenant.email) {
      skipped.push({ name: tenant.name, reason: 'no email' });
      continue;
    }

    // Final month of the lease (assumed prepaid) or lease already over
    const leaseEndMonthStart = new Date(tenant.leaseEnd.getFullYear(), tenant.leaseEnd.getMonth(), 1);
    if (leaseEndMonthStart.getTime() <= nextMonthStart.getTime()) {
      skipped.push({ name: tenant.name, reason: 'final month of lease / lease ended' });
      continue;
    }

    // Lease hasn't started yet for next month (e.g. tenant starting later)
    if (tenant.leaseStart.getTime() > new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0).getTime()) {
      skipped.push({ name: tenant.name, reason: 'lease not started' });
      continue;
    }

    // Already paid: any completed payment whose rent month IS next month.
    // getRentMonth applies the same after-the-15th rule the scanner uses.
    const windowStart = new Date(nextMonthStart.getTime() - 45 * 24 * 3600 * 1000);
    const windowEnd = new Date(nextMonthStart.getTime() + 20 * 24 * 3600 * 1000);
    const payments = await prisma.payment.findMany({
      where: {
        tenantId: tenant.id,
        status: 'completed',
        deletedAt: null,
        date: { gte: windowStart, lt: windowEnd },
      },
    });
    const alreadyPaid = payments.some(
      p => getRentMonth(p.date).getTime() === nextMonthStart.getTime()
    );
    if (alreadyPaid) {
      skipped.push({ name: tenant.name, reason: 'already paid' });
      continue;
    }

    const existingLog = await prisma.reminderLog.findUnique({ where: { dedupeKey } });
    if (existingLog) {
      skipped.push({ name: tenant.name, reason: 'already sent' });
      continue;
    }

    if (dryRun) {
      sent.push({ name: tenant.name, email: tenant.email, dryRun: true });
      continue;
    }

    try {
      await sendEmail(prisma, {
        to: tenant.email,
        subject: `Rent reminder — ${rentMonthLabel} rent for ${tenant.Property?.name || 'your unit'}`,
        text: rentEmailBody(tenant, rentMonthLabel, dueMonthName),
      });
      try {
        await prisma.reminderLog.create({
          data: {
            type: 'rent',
            tenantId: tenant.id,
            dedupeKey,
            detail: `${rentMonthLabel} rent reminder to ${tenant.email}`,
          },
        });
      } catch (logErr) {
        if (logErr.code !== 'P2002') throw logErr; // unique violation = already logged
      }
      sent.push({ name: tenant.name, email: tenant.email });
    } catch (err) {
      skipped.push({ name: tenant.name, reason: `send failed: ${err.message}` });
      // Gmail-level failure (disconnected / missing send scope) affects everyone — alert and stop
      if (/not connected|insufficient|scope|invalid_grant/i.test(err.message)) {
        await sendPush(
          'Rental Tracker: rent reminders FAILED',
          `Could not send reminder emails: ${err.message}. Reconnect Gmail in the app (send permission needed).`,
          { priority: 'urgent', tags: 'rotating_light' }
        );
        break;
      }
    }
  }

  if (!dryRun && (sent.length > 0 || skipped.some(s => s.reason.startsWith('send failed')))) {
    const lines = [];
    if (sent.length) lines.push(`Sent: ${sent.map(s => s.name).join(', ')}`);
    const skippedText = skipped.map(s => `${s.name} (${s.reason})`).join(', ');
    if (skippedText) lines.push(`Skipped: ${skippedText}`);
    await sendPush(
      `Rental Tracker: ${rentMonthLabel} rent reminders`,
      lines.join('\n').slice(0, 800),
      { tags: 'incoming_envelope' }
    );
  }

  return { rentMonth: rentMonthLabel, sent, skipped, dryRun };
}

// Push a lease-renewal alert to the landlord at 90/60/30 days before leaseEnd.
// Logs every matched threshold but pushes only the most urgent unsent one,
// so a tenant added mid-window gets one alert, not three.
const RENEWAL_THRESHOLDS = [90, 60, 30];

async function runRenewalReminders(prisma, options = {}) {
  const dryRun = !!options.dryRun;
  const now = options.now ? new Date(options.now) : new Date();

  const tenants = await prisma.tenant.findMany({
    where: { isArchived: false, deletedAt: null },
    include: { Property: true },
  });

  const notified = [];
  const skipped = [];

  for (const tenant of tenants) {
    if (tenant.name.toLowerCase().includes('airbnb')) {
      skipped.push({ name: tenant.name, reason: 'placeholder tenant' });
      continue;
    }

    const daysUntil = Math.floor((tenant.leaseEnd.getTime() - now.getTime()) / 86400000);
    if (daysUntil < 0) {
      skipped.push({ name: tenant.name, reason: 'lease already ended' });
      continue;
    }

    const matched = RENEWAL_THRESHOLDS.filter(t => daysUntil <= t);
    if (matched.length === 0) {
      skipped.push({ name: tenant.name, reason: `${daysUntil} days left (no threshold)` });
      continue;
    }

    const leaseEndKey = tenant.leaseEnd.toISOString().slice(0, 10);
    const unsent = [];
    for (const t of matched) {
      const dedupeKey = `renewal:${tenant.id}:${leaseEndKey}:${t}`;
      const existing = await prisma.reminderLog.findUnique({ where: { dedupeKey } });
      if (!existing) unsent.push({ threshold: t, dedupeKey });
    }

    if (unsent.length === 0) {
      skipped.push({ name: tenant.name, reason: 'already alerted' });
      continue;
    }

    if (dryRun) {
      notified.push({ name: tenant.name, daysUntil, thresholds: unsent.map(u => u.threshold), dryRun: true });
      continue;
    }

    await sendPush(
      'Rental Tracker: lease renewal due',
      `${tenant.name}'s lease at ${tenant.Property?.name || 'unknown property'} ends in ${daysUntil} days (${leaseEndKey}). Time to renew or plan turnover.`,
      { priority: 'high', tags: 'calendar' }
    );

    for (const u of unsent) {
      try {
        await prisma.reminderLog.create({
          data: {
            type: 'renewal',
            tenantId: tenant.id,
            dedupeKey: u.dedupeKey,
            detail: `${u.threshold}d alert — lease ends ${leaseEndKey} (${daysUntil} days out at send time)`,
          },
        });
      } catch (logErr) {
        if (logErr.code !== 'P2002') throw logErr;
      }
    }
    notified.push({ name: tenant.name, daysUntil, thresholds: unsent.map(u => u.threshold) });
  }

  return { notified, skipped, dryRun };
}

module.exports = { runRentReminders, runRenewalReminders, isRentReminderDay };
