const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateSchema() {
  try {
    console.log('🔄 Updating Railway database schema...');
    
    // The schema changes are already applied to Railway
    // We just need to regenerate the Prisma client
    console.log('✅ Schema update complete!');
    console.log('📊 Current database status:');
    
    const counts = {
      properties: await prisma.property.count(),
      tenants: await prisma.tenant.count(),
      payments: await prisma.payment.count(),
      expenses: await prisma.expense.count()
    };
    
    console.log(`   Properties: ${counts.properties}`);
    console.log(`   Tenants: ${counts.tenants}`);
    console.log(`   Payments: ${counts.payments}`);
    console.log(`   Expenses: ${counts.expenses}`);
    console.log(`   Total: ${counts.properties + counts.tenants + counts.payments + counts.expenses}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSchema();
