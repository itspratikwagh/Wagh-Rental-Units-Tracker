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
      rentAmount: 1500.00,
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

  console.log('Seed data created:', edmontonProperty);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 