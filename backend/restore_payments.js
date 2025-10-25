const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restorePayments() {
  try {
    console.log('Restoring payments...');
    
    // Read the CSV file
    const csvData = fs.readFileSync('/tmp/payments.csv', 'utf8');
    const lines = csvData.trim().split('\n');
    
    console.log(`Found ${lines.length - 1} payments to restore`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Skip header and process each payment
    for (let i = 1; i < lines.length; i++) {
      try {
        // Parse CSV line (basic implementation)
        const line = lines[i];
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current); // Add the last value
        
        const payment = {
          id: values[0],
          tenantId: values[1],
          amount: parseFloat(values[2]),
          date: new Date(values[3]),
          paymentMethod: values[4] || 'bank_transfer',
          status: 'completed', // Add the new field with default value
          notes: values[5] || null,
          createdAt: new Date(values[6]),
          updatedAt: new Date(values[7])
        };
        
        await prisma.payment.create({
          data: payment
        });
        
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Restored ${successCount} payments...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`Error restoring payment ${i}:`, error.message);
      }
    }
    
    console.log(`✅ Restoration complete!`);
    console.log(`   Successfully restored: ${successCount} payments`);
    console.log(`   Errors: ${errorCount} payments`);
    
    // Verify the data
    const count = await prisma.payment.count();
    console.log(`   Total payments in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Error restoring payments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restorePayments();
