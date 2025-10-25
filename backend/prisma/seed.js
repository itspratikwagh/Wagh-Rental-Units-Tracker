const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create the Edmonton property
  const edmontonProperty = await prisma.property.create({
    data: {
      name: 'Edmonton Main Street Apartments',
      address: '123 Main Street, Edmonton, Alberta T5J 2K1',
      type: 'Apartment Building',
      units: 4,
      tenants: {
        create: [
          {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '780-555-0123',
            leaseStart: new Date('2024-01-01'),
            leaseEnd: new Date('2025-01-01'),
            rentAmount: 1500.00,
          },
          {
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            phone: '780-555-0124',
            leaseStart: new Date('2024-02-01'),
            leaseEnd: new Date('2025-02-01'),
            rentAmount: 1600.00,
          },
          {
            name: 'Mike Johnson',
            email: 'mike.johnson@example.com',
            phone: '780-555-0125',
            leaseStart: new Date('2024-03-01'),
            leaseEnd: new Date('2025-03-01'),
            rentAmount: 1550.00,
          },
          {
            name: 'Sarah Williams',
            email: 'sarah.williams@example.com',
            phone: '780-555-0126',
            leaseStart: new Date('2024-04-01'),
            leaseEnd: new Date('2025-04-01'),
            rentAmount: 1650.00,
          },
        ],
      },
    },
  });

  console.log('Property created:', edmontonProperty);

  // Get all tenants to create payments for them
  const tenants = await prisma.tenant.findMany();
  
  // Create payments for the last 6 months
  const payments = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    for (const tenant of tenants) {
      const paymentDate = new Date(now.getFullYear(), now.getMonth() - i, 5);
      // Vary the status for demonstration purposes
      let status = 'completed';
      if (i === 0 && tenant.name === 'Sarah Williams') {
        status = 'pending'; // One pending payment
      } else if (i === 1 && tenant.name === 'Mike Johnson') {
        status = 'late'; // One late payment
      }
      
      payments.push({
        tenantId: tenant.id,
        amount: tenant.rentAmount,
        date: paymentDate,
        paymentMethod: 'bank_transfer',
        status: status,
        notes: `Rent payment for ${paymentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      });
    }
  }

  await prisma.payment.createMany({ data: payments });
  console.log(`Created ${payments.length} payments`);

  // Create some expenses
  const expenses = [
    {
      description: 'Plumbing repair - Unit 1',
      amount: 250.00,
      date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      category: 'Maintenance',
      propertyId: edmontonProperty.id,
    },
    {
      description: 'Property tax',
      amount: 1200.00,
      date: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      category: 'Tax',
      propertyId: edmontonProperty.id,
    },
    {
      description: 'Building insurance',
      amount: 800.00,
      date: new Date(now.getFullYear(), now.getMonth() - 3, 10),
      category: 'Insurance',
      propertyId: edmontonProperty.id,
    },
    {
      description: 'Landscaping service',
      amount: 150.00,
      date: new Date(now.getFullYear(), now.getMonth(), 5),
      category: 'Maintenance',
      propertyId: edmontonProperty.id,
    },
  ];

  await prisma.expense.createMany({ data: expenses });
  console.log(`Created ${expenses.length} expenses`);
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 