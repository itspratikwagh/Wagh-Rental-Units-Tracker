# 🚀 Complete Vercel + Railway Deployment Guide

## Overview
Deploy your rental management system to the cloud:
- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Node.js + Express)  
- **Database**: Railway PostgreSQL (already deployed!)

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Backend Service
1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `Wagh-Rental-Units-Tracker` repository
4. Choose the `backend` folder as root directory

### 1.2 Configure Environment Variables
In Railway dashboard, add these environment variables:
```
DATABASE_URL=postgresql://postgres:gMnzgDsdPHZJjOrkEpONeIIwAvCiKkOT@crossover.proxy.rlwy.net:59900/railway
NODE_ENV=production
PORT=3005
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app
```

### 1.3 Deploy Backend
- Railway will automatically deploy your backend
- Get your Railway backend URL (e.g., `https://your-app.railway.app`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Login to Vercel
```bash
vercel login
```

### 2.3 Deploy Frontend
```bash
cd frontend
vercel
```

### 2.4 Configure Environment Variables
In Vercel dashboard, add:
```
VITE_API_URL=https://your-railway-backend-url.railway.app
```

## Step 3: Update Configuration

### 3.1 Update Frontend Config
Edit `frontend/src/config.js`:
```javascript
const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-actual-railway-backend-url.railway.app'
      : 'http://localhost:3005'
  )
};
```

### 3.2 Update Backend CORS
Edit `backend/config/production.js`:
```javascript
cors: {
  origins: [
    'https://your-vercel-app.vercel.app',
    'https://*.vercel.app',
    'http://localhost:5173'
  ]
}
```

## Step 4: Test Production Setup

### 4.1 Test Backend
```bash
curl https://your-railway-backend-url.railway.app/api/properties
```

### 4.2 Test Frontend
Visit your Vercel URL and verify:
- ✅ Properties load
- ✅ Tenants load  
- ✅ Payments load
- ✅ Expenses load

## 🎯 Final Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Railway       │    │   Railway       │
│   Frontend      │───▶│   Backend       │───▶│   Database      │
│   (React)       │    │   (Node.js)     │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Your Data Status
- **Properties**: 2
- **Tenants**: 17
- **Payments**: 107
- **Expenses**: 167
- **Total**: 293 records (all safely in Railway!)

## 🔧 Troubleshooting

### CORS Issues
If you get CORS errors, update your Railway backend environment:
```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app
```

### Database Connection
Your database is already connected and working! All your data is safe.

### API Connection
Make sure your Vercel environment variable `VITE_API_URL` points to your Railway backend URL.

## 🎉 Success!
Your rental management system will be fully deployed to the cloud with:
- ✅ Scalable frontend on Vercel
- ✅ Robust backend on Railway  
- ✅ Reliable database on Railway
- ✅ All your data preserved and accessible
