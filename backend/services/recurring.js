// Generates expense records from recurring expense templates.
// Called by cron job — checks which expenses are due and creates them.

async function generateRecurringExpenses(prisma) {
  const templates = await prisma.recurringExpense.findMany({
    where: { isActive: true },
  });

  const now = new Date();
  let created = 0;
  const errors = [];

  for (const t of templates) {
    try {
      const dueDates = getDueDates(t, now);

      for (const dueDate of dueDates) {
        // Check if expense already exists for this template + date
        const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
        const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);

        // For weekly expenses, check exact date; for monthly, check the month
        let existing;
        if (t.frequency === 'weekly') {
          const dayStart = new Date(dueDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dueDate);
          dayEnd.setHours(23, 59, 59, 999);

          existing = await prisma.expense.findFirst({
            where: {
              propertyId: t.propertyId,
              category: t.category,
              amount: t.amount,
              date: { gte: dayStart, lte: dayEnd },
            },
          });
        } else {
          // Monthly — check if same category+property+amount exists this month
          existing = await prisma.expense.findFirst({
            where: {
              propertyId: t.propertyId,
              category: t.category,
              amount: t.amount,
              date: { gte: monthStart, lte: monthEnd },
            },
          });
        }

        if (existing) continue;

        await prisma.expense.create({
          data: {
            description: t.description,
            amount: t.amount,
            date: dueDate,
            category: t.category,
            propertyId: t.propertyId,
            updatedAt: new Date(),
          },
        });
        created++;
      }

      // Update lastGenerated
      await prisma.recurringExpense.update({
        where: { id: t.id },
        data: { lastGenerated: now },
      });
    } catch (err) {
      errors.push(`${t.description}: ${err.message}`);
    }
  }

  return { created, errors };
}

// Calculate due dates between lastGenerated and now
function getDueDates(template, now) {
  const dates = [];
  // Start from lastGenerated or 30 days ago (don't backfill forever)
  const start = template.lastGenerated
    ? new Date(template.lastGenerated)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (template.frequency === 'weekly') {
    // Find the first target weekday after start
    const targetDay = template.dayOfWeek || 1; // default Monday
    let d = new Date(start);
    d.setDate(d.getDate() + 1); // move past lastGenerated

    // Advance to next target weekday
    while (d.getDay() !== targetDay) {
      d.setDate(d.getDate() + 1);
    }

    // Generate all weekly dates up to now
    while (d <= now) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
  } else if (template.frequency === 'monthly') {
    const targetDay = template.dayOfMonth || 1;
    let d = new Date(start);
    d.setDate(1); // go to start of month
    d.setMonth(d.getMonth() + 1); // next month after lastGenerated

    while (d <= now) {
      const dueDate = new Date(d.getFullYear(), d.getMonth(), targetDay);
      if (dueDate <= now && dueDate > start) {
        dates.push(dueDate);
      }
      d.setMonth(d.getMonth() + 1);
    }
  }

  return dates;
}

module.exports = { generateRecurringExpenses };
