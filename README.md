# Wagh Rental Units Tracker

A full-stack application for managing rental properties, tenants, payments, and expenses.

## Features

- Property Management
- Tenant Management
- Payment Tracking
- Expense Tracking
- Dashboard with Analytics

## Tech Stack

- Frontend: React with Vite
- Backend: Node.js with Express
- Database: PostgreSQL with Prisma ORM
- UI Framework: Material-UI

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

## Setup Instructions

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wagh-rental-units-tracker.git
cd wagh-rental-units-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create PostgreSQL database
createdb wagh_rental_db

# Run Prisma migrations
npx prisma migrate dev

# Seed the database
npm run seed
```

4. Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL="postgresql://username:password@localhost:5432/wagh_rental_db"
PORT=3005
```

5. Start the development servers:

For backend:
```bash
cd backend
npm run dev
```

For frontend:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3005

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 