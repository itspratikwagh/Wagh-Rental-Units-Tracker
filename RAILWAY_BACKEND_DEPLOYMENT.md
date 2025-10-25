# Railway Backend Deployment Guide

## 🚀 Deploy Your Backend to Railway

Your database is already on Railway, now let's deploy your backend API to Railway as well!

### Step 1: Create Railway Backend Service

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `Wagh-Rental-Units-Tracker` repository
5. Select the `backend` folder as the root directory

### Step 2: Configure Environment Variables

In your Railway backend service, add these environment variables:

```
DATABASE_URL=postgresql://postgres:gMnzgDsdPHZJjOrkEpONeIIwAvCiKkOT@crossover.proxy.rlwy.net:59900/railway
NODE_ENV=production
PORT=3005
```

### Step 3: Railway Configuration

Create a `railway.json` file in your backend directory:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/properties"
  }
}
```

### Step 4: Update CORS for Production

Your backend needs to allow requests from your Vercel frontend. Update the CORS configuration in `server.js`:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://your-vercel-app.vercel.app', // Replace with your Vercel URL
    'https://*.vercel.app'
  ],
  credentials: true
};
```

### Step 5: Deploy

1. Push your changes to GitHub
2. Railway will automatically deploy your backend
3. Get your Railway backend URL (e.g., `https://your-app.railway.app`)

### Step 6: Update Frontend Configuration

Update your frontend `config.js` with the actual Railway backend URL:

```javascript
const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-actual-railway-backend-url.railway.app'
      : 'http://localhost:3005'
  )
};
```

## 🎯 Final Architecture

- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Node.js + Express)
- **Database**: Railway PostgreSQL
- **All connected and working together!**

## 📝 Next Steps

1. Deploy backend to Railway
2. Get Railway backend URL
3. Update frontend config with Railway URL
4. Deploy frontend to Vercel
5. Test the full production setup
