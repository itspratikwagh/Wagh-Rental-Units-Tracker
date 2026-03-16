# Deployment Guide

## Architecture

```
Frontend (Vercel)  →  Backend (Railway)  →  Database (Railway PostgreSQL)
React + Vite          Express + Prisma       PostgreSQL 17
```

## Prerequisites

- [Railway](https://railway.app) account
- [Vercel](https://vercel.com) account
- GitHub repository connected to both

## Step 1: Set Up Railway PostgreSQL

1. Go to [railway.app](https://railway.app) and create a new project
2. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
3. Once provisioned, go to the **Variables** tab and copy the `DATABASE_URL`

## Step 2: Deploy Backend to Railway

1. In the same Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select your `Wagh-Rental-Units-Tracker` repository
3. Set **Root Directory** to `backend`
4. Add these environment variables:

```
DATABASE_URL=<copied from Step 1>
NODE_ENV=production
PORT=3005
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

5. Railway will auto-deploy. Note your backend URL (e.g., `https://your-app.railway.app`)

### Run Migrations

In Railway's console (or locally with the Railway DATABASE_URL):

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add this environment variable:

```
VITE_API_URL=https://your-railway-backend-url.railway.app
```

4. Deploy. Note your frontend URL.

## Step 4: Update CORS

Go back to your Railway backend service and update:

```
ALLOWED_ORIGINS=https://your-actual-vercel-url.vercel.app
```

Railway will auto-redeploy.

## Environment Variables Reference

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Railway PostgreSQL connection string |
| `NODE_ENV` | `production` |
| `PORT` | `3005` |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Railway backend URL |

## Troubleshooting

- **CORS errors**: Ensure `ALLOWED_ORIGINS` includes your exact Vercel domain
- **Database connection fails**: Verify `DATABASE_URL` is correct in Railway variables
- **Build errors**: Check that `backend/package.json` and `frontend/package.json` have all dependencies
- **API not responding**: Check Railway deployment logs for errors

## Local Development

```bash
# Backend
cd backend
cp .env.example .env  # Edit with your local DB URL
npm install
npx prisma migrate dev
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173 | Backend: http://localhost:3005
