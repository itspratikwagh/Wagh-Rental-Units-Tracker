const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreToRailway() {
  try {
    console.log('🚀 RESTORING DATA TO RAILWAY DATABASE...');
    
    // Find the latest backup files
    const backupDir = path.join(__dirname, 'database-backups');
    const files = fs.readdirSync(backupDir);
    
    const propertiesFile = files.find(f => f.startsWith('properties-backup-'));
    const tenantsFile = files.find(f => f.startsWith('tenants-backup-'));
    const paymentsFile = files.find(f => f.startsWith('payments-backup-'));
    const expensesFile = files.find(f => f.startsWith('expenses-backup-'));
    
    if (!propertiesFile || !tenantsFile || !paymentsFile || !expensesFile) {
      throw new Error('Backup files not found!');
    }
    
    console.log('📋 Reading backup files...');
    
    // Read backup data
    const properties = JSON.parse(fs.readFileSync(path.join(backupDir, propertiesFile), 'utf8'));
    const tenants = JSON.parse(fs.readFileSync(path.join(backupDir, tenantsFile), 'utf8'));
    const payments = JSON.parse(fs.readFileSync(path.join(backupDir, paymentsFile), 'utf8'));
    const expenses = JSON.parse(fs.readFileSync(path.join(backupDir, expensesFile), 'utf8'));
    
    console.log(`📊 Found ${properties.length} properties, ${tenants.length} tenants, ${payments.length} payments, ${expenses.length} expenses`);
    
    // Clear existing data (be careful!)
    console.log('🗑️  Clearing existing data...');
    await prisma.payment.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.property.deleteMany();
    
    // Restore Properties
    console.log('🏠 Restoring properties...');
    for (const property of properties) {
      await prisma.property.create({
        data: {
          id: property.id,
          name: property.name,
          address: property.address,
          type: property.type,
          units: property.units,
          createdAt: new Date(property.createdAt),
          updatedAt: new Date(property.updatedAt)
        }
      });
    }
    console.log(`✅ Restored ${properties.length} properties`);
    
    // Restore Tenants
    console.log('👥 Restoring tenants...');
    for (const tenant of tenants) {
      await prisma.tenant.create({
        data: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          propertyId: tenant.propertyId,
          rentAmount: tenant.rentAmount,
          leaseStart: new Date(tenant.leaseStart),
          leaseEnd: tenant.leaseEnd ? new Date(tenant.leaseEnd) : null,
          isArchived: tenant.isArchived || false,
          createdAt: new Date(tenant.createdAt),
          updatedAt: new Date(tenant.updatedAt)
        }
      });
    }
    console.log(`✅ Restored ${tenants.length} tenants`);
    
    // Restore Payments
    console.log('💰 Restoring payments...');
    for (const payment of payments) {
      await prisma.payment.create({
        data: {
          id: payment.id,
          tenantId: payment.tenantId,
          amount: payment.amount,
          date: new Date(payment.date),
          paymentMethod: payment.paymentMethod,
          status: payment.status || 'completed',
          notes: payment.notes,
          createdAt: new Date(payment.createdAt),
          updatedAt: new Date(payment.updatedAt)
        }
      });
    }
    console.log(`✅ Restored ${payments.length} payments`);
    
    // Restore Expenses
    console.log('📊 Restoring expenses...');
    for (const expense of expenses) {
      await prisma.expense.create({
        data: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          date: new Date(expense.date),
          category: expense.category,
          propertyId: expense.propertyId,
          tenantId: expense.tenantId,
          createdAt: new Date(expense.createdAt),
          updatedAt: new Date(expense.updatedAt)
        }
      });
    }
    console.log(`✅ Restored ${expenses.length} expenses`);
    
    // Verify restoration
    const finalCounts = {
      properties: await prisma.property.count(),
      tenants: await prisma.tenant.count(),
      payments: await prisma.payment.count(),
      expenses: await prisma.expense.count()
    };
    
    console.log('\n🎉 RAILWAY RESTORATION COMPLETE!');
    console.log('================================');
    console.log(`📊 Final Database Counts:`);
    console.log(`   Properties: ${finalCounts.properties}`);
    console.log(`   Tenants: ${finalCounts.tenants}`);
    console.log(`   Payments: ${finalCounts.payments}`);
    console.log(`   Expenses: ${finalCounts.expenses}`);
    console.log(`   Total: ${finalCounts.properties + finalCounts.tenants + finalCounts.payments + finalCounts.expenses}`);
    
    console.log('\n✅ Your data is now live on Railway!');
    console.log('🌐 Check your Railway dashboard to verify the database contents.');
    
  } catch (error) {
    console.error('❌ RESTORATION FAILED:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  restoreToRailway();
}

module.exports = { restoreToRailway };
