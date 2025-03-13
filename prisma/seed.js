const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create the property
  const property = await prisma.property.create({
    data: {
      address: '9316 107A Ave NW',
      city: 'Edmonton',
      province: 'AB',
      postalCode: 'T5H0Z3',
      tenants: {
        create: [
          {
            firstName: 'Aditya Kumar',
            lastName: 'Sharma',
            email: 'sharmaadityakumar78@gmail.com',
            leaseStart: new Date('2024-01-01'),
            leaseEnd: new Date('2025-01-01'), // Setting a year from start for month-to-month
            rentAmount: 490,
          },
          {
            firstName: 'Gursharan',
            lastName: 'Singh',
            email: 'guru@gmail.com',
            leaseStart: new Date('2024-01-01'),
            leaseEnd: new Date('2025-01-01'),
            rentAmount: 490,
          },
          {
            firstName: 'Micheal',
            lastName: '',
            email: 'mike@gmail.com',
            leaseStart: new Date('2025-03-01'),
            leaseEnd: new Date('2026-03-01'),
            rentAmount: 725,
          },
          {
            firstName: 'Beth',
            lastName: 'Mackrous',
            email: 'beth@gmail.com',
            leaseStart: new Date('2025-01-01'),
            leaseEnd: new Date('2026-01-01'),
            rentAmount: 1125,
          },
        ],
      },
    },
  });

  console.log('Property and tenants created:', property);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 