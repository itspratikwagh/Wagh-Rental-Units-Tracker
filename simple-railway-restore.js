const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function simpleRailwayRestore() {
  try {
    console.log('🚀 SIMPLE RAILWAY DATA RESTORATION...');
    
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
    
    // Restore Properties (simplified - let Prisma handle IDs)
    console.log('🏠 Restoring properties...');
    for (const property of properties) {
      await prisma.property.create({
        data: {
          name: property.name,
          address: property.address,
          type: property.type,
          units: property.units
        }
      });
    }
    console.log(`✅ Restored ${properties.length} properties`);
    
    // Get the newly created properties to map IDs
    const newProperties = await prisma.property.findMany();
    const propertyMap = new Map();
    for (let i = 0; i < properties.length; i++) {
      propertyMap.set(properties[i].id, newProperties[i].id);
    }
    
    // Restore Tenants
    console.log('👥 Restoring tenants...');
    for (const tenant of tenants) {
      const newPropertyId = propertyMap.get(tenant.propertyId);
      if (newPropertyId) {
        await prisma.tenant.create({
          data: {
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            propertyId: newPropertyId,
            rentAmount: tenant.rentAmount,
            leaseStart: new Date(tenant.leaseStart),
            leaseEnd: tenant.leaseEnd ? new Date(tenant.leaseEnd) : null,
            isArchived: tenant.isArchived || false
          }
        });
      }
    }
    console.log(`✅ Restored ${tenants.length} tenants`);
    
    // Get the newly created tenants to map IDs
    const newTenants = await prisma.tenant.findMany();
    const tenantMap = new Map();
    for (let i = 0; i < tenants.length; i++) {
      tenantMap.set(tenants[i].id, newTenants[i].id);
    }
    
    // Restore Payments
    console.log('💰 Restoring payments...');
    for (const payment of payments) {
      const newTenantId = tenantMap.get(payment.tenantId);
      if (newTenantId) {
        await prisma.payment.create({
          data: {
            tenantId: newTenantId,
            amount: payment.amount,
            date: new Date(payment.date),
            paymentMethod: payment.paymentMethod,
            status: payment.status || 'completed',
            notes: payment.notes
          }
        });
      }
    }
    console.log(`✅ Restored ${payments.length} payments`);
    
    // Restore Expenses
    console.log('📊 Restoring expenses...');
    for (const expense of expenses) {
      const newPropertyId = propertyMap.get(expense.propertyId);
      const newTenantId = expense.tenantId ? tenantMap.get(expense.tenantId) : null;
      
      await prisma.expense.create({
        data: {
          description: expense.description,
          amount: expense.amount,
          date: new Date(expense.date),
          category: expense.category,
          propertyId: newPropertyId,
          tenantId: newTenantId
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

simpleRailwayRestore();
