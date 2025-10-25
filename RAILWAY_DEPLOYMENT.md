# 🚀 Railway Database Deployment Guide

## Overview
This guide will help you deploy your Wagh Rental Units Tracker database to Railway's cloud PostgreSQL service.

## Prerequisites
- Railway account (free tier available)
- Your local database backup (already created)

## Step 1: Create Railway Project

1. **Sign up/Login**: Go to [railway.app](https://railway.app) and sign in with GitHub
2. **New Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Select Repository**: Choose your `Wagh-Rental-Units-Tracker` repository

## Step 2: Add PostgreSQL Database

1. **Add Database**: In your Railway project, click **"+ New"**
2. **Select Service**: Choose **"Database"** → **"PostgreSQL"**
3. **Wait for Creation**: Railway will provision a PostgreSQL instance (takes 1-2 minutes)

## Step 3: Get Connection Details

1. **Click on PostgreSQL Service**: In your Railway dashboard
2. **Go to Variables Tab**: You'll see these environment variables:
   ```
   DATABASE_URL=postgresql://postgres:password@host:port/database
   PGHOST=containers-us-west-123.railway.app
   PGPORT=6543
   PGUSER=postgres
   PGPASSWORD=your_password_here
   PGDATABASE=railway
   ```

## Step 4: Update Local Configuration

### Option A: Update .env file
Replace the DATABASE_URL in `/backend/.env`:
```bash
# Replace with your Railway DATABASE_URL
DATABASE_URL="postgresql://postgres:your_password@containers-us-west-123.railway.app:6543/railway"
```

### Option B: Use Railway CLI (Alternative)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Set environment variable
railway variables set DATABASE_URL="your_railway_database_url"
```

## Step 5: Deploy Database Schema

1. **Push Schema**: Deploy your Prisma schema to Railway
   ```bash
   cd backend
   npx prisma db push
   ```

2. **Run Migrations**: Apply all migrations
   ```bash
   npx prisma migrate deploy
   ```

## Step 6: Restore Your Data

### Method 1: Using Backup Files (Recommended)
Your data is already backed up in `/database-backups/`. Use these to restore:

```bash
# Create a restore script
node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restoreFromBackup() {
  // Read backup files
  const properties = JSON.parse(fs.readFileSync('./database-backups/properties-backup-*.json'));
  const tenants = JSON.parse(fs.readFileSync('./database-backups/tenants-backup-*.json'));
  const payments = JSON.parse(fs.readFileSync('./database-backups/payments-backup-*.json'));
  const expenses = JSON.parse(fs.readFileSync('./database-backups/expenses-backup-*.json'));

  // Restore data
  for (const property of properties) {
    await prisma.property.create({ data: property });
  }
  
  for (const tenant of tenants) {
    await prisma.tenant.create({ data: tenant });
  }
  
  for (const payment of payments) {
    await prisma.payment.create({ data: payment });
  }
  
  for (const expense of expenses) {
    await prisma.expense.create({ data: expense });
  }
  
  console.log('✅ Data restored to Railway!');
  await prisma.\$disconnect();
}

restoreFromBackup();
"
```

### Method 2: Direct Database Migration
```bash
# Export from local database
pg_dump wagh_rental_db > local_backup.sql

# Import to Railway database
psql "your_railway_database_url" < local_backup.sql
```

## Step 7: Deploy Your Application

### Option A: Deploy Backend to Railway
1. **Add Node.js Service**: In Railway dashboard, add "Node.js" service
2. **Configure**: Set build command: `npm install && npx prisma generate`
3. **Set Environment**: Add your Railway DATABASE_URL
4. **Deploy**: Railway will automatically deploy your backend

### Option B: Deploy Frontend to Railway
1. **Add Static Site**: Add "Static Site" service
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`

## Step 8: Update Frontend Configuration

Update `/frontend/src/config.js`:
```javascript
// For Railway deployment
export const config = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-railway-backend-url.railway.app'
    : 'http://localhost:3005'
};
```

## Step 9: Verify Deployment

1. **Check Database**: Use Railway's built-in database browser
2. **Test API**: Verify your backend endpoints work
3. **Test Frontend**: Ensure frontend connects to Railway backend

## Cost Considerations

- **Railway Free Tier**: $5 credit monthly (usually enough for small projects)
- **PostgreSQL**: ~$5-10/month for small databases
- **Total Estimated Cost**: $5-15/month

## Security Notes

- ✅ Your data is encrypted in transit and at rest
- ✅ Railway handles backups automatically
- ✅ Environment variables are secure
- ✅ Database access is restricted to your services

## Troubleshooting

### Common Issues:
1. **Connection Refused**: Check DATABASE_URL format
2. **Schema Errors**: Run `npx prisma db push` again
3. **Data Missing**: Verify restore script ran successfully

### Support:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your backup files are in `/database-backups/` for recovery

## Next Steps After Deployment

1. **Update DNS**: Point your domain to Railway (if using custom domain)
2. **Set up Monitoring**: Use Railway's built-in monitoring
3. **Configure Backups**: Railway handles this automatically
4. **Scale as Needed**: Upgrade Railway plan as your app grows

---

**🎉 Congratulations!** Your rental management system will be running in the cloud with automatic backups and scaling!
