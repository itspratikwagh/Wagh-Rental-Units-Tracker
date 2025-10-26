# 🚀 Complete Railway Deployment Guide

Deploy both your backend and frontend to Railway for a unified hosting solution.

## 📋 **Prerequisites**
- Railway account (free tier available)
- GitHub repository connected
- Your Railway database already set up

## 🎯 **Deployment Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Railway       │    │   Railway       │    │   Railway        │
│   Frontend      │───▶│   Backend       │───▶│   Database       │
│   (React)       │    │   (Node.js)     │    │   (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 **Step 1: Deploy Backend to Railway**

### 1.1 Create Backend Service
1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `Wagh-Rental-Units-Tracker` repository
4. **Set Root Directory to:** `backend`
5. Click "Deploy"

### 1.2 Configure Backend Environment Variables
In your Railway backend service, go to "Variables" tab and add:

```bash
DATABASE_URL=postgresql://postgres:gMnzgDsdPHZJjOrkEpONeIIwAvCiKkOT@crossover.proxy.rlwy.net:59900/railway
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-url.railway.app
```

### 1.3 Get Backend URL
After deployment, note your backend URL (e.g., `https://your-backend.railway.app`)

## 🎨 **Step 2: Deploy Frontend to Railway**

### 2.1 Create Frontend Service
1. In the same Railway project, click "New Service" → "GitHub Repo"
2. Select your `Wagh-Rental-Units-Tracker` repository again
3. **Set Root Directory to:** `frontend`
4. Click "Deploy"

### 2.2 Configure Frontend Environment Variables
In your Railway frontend service, go to "Variables" tab and add:

```bash
VITE_API_URL=https://your-backend-url.railway.app
NODE_ENV=production
```

### 2.3 Configure Build Settings
Railway will automatically detect it's a Vite React app and:
- Run `npm install`
- Run `npm run build`
- Serve the built files

## 🔧 **Step 3: Update CORS Configuration**

### 3.1 Update Backend CORS
Once you have your frontend URL, update the backend's `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=https://your-frontend-url.railway.app,https://*.railway.app
```

### 3.2 Redeploy Backend
Trigger a redeploy of your backend service to apply the CORS changes.

## 🧪 **Step 4: Test Your Deployment**

### 4.1 Test Backend
Visit your backend URL: `https://your-backend.railway.app/api/properties`
You should see JSON data.

### 4.2 Test Frontend
Visit your frontend URL: `https://your-frontend.railway.app`
You should see your rental management app.

### 4.3 Test Full Integration
- Try logging in
- Check if data loads from backend
- Test creating/editing records

## 💰 **Cost Estimation**

### Railway Free Tier:
- **Backend**: $0/month (512MB RAM, 1GB storage)
- **Frontend**: $0/month (Static hosting)
- **Database**: $0/month (1GB storage)

### Railway Pro Tier (if needed):
- **Backend**: $5/month (1GB RAM, 8GB storage)
- **Frontend**: $0/month (Static hosting)
- **Database**: $5/month (8GB storage)

## 🔄 **Step 5: Custom Domain (Optional)**

### 5.1 Add Custom Domain
1. Go to your Railway project
2. Click on your frontend service
3. Go to "Settings" → "Domains"
4. Add your custom domain (e.g., `rental-manager.yourdomain.com`)

### 5.2 Update DNS
Point your domain to Railway's servers using the provided DNS settings.

## 🛠️ **Troubleshooting**

### Common Issues:

#### **Frontend Not Loading**
- Check if `VITE_API_URL` is set correctly
- Verify backend is running and accessible
- Check Railway logs for build errors

#### **CORS Errors**
- Update `ALLOWED_ORIGINS` in backend
- Ensure frontend URL is included in CORS origins
- Redeploy backend after CORS changes

#### **Database Connection Issues**
- Verify `DATABASE_URL` is correct
- Check if database service is running
- Ensure backend can reach database

#### **Build Failures**
- Check `package.json` scripts
- Verify all dependencies are installed
- Check Railway build logs for specific errors

## 📊 **Monitoring & Logs**

### View Logs:
1. Go to your Railway project
2. Click on any service
3. Go to "Deployments" tab
4. Click on latest deployment
5. View "Logs" tab

### Monitor Performance:
- Railway provides basic metrics
- Check response times and error rates
- Monitor resource usage

## 🎉 **Success!**

Your complete rental management system is now running on Railway:

- **Frontend**: `https://your-frontend.railway.app`
- **Backend**: `https://your-backend.railway.app`
- **Database**: Railway PostgreSQL

All your data (293 records) is preserved and accessible!

## 🔄 **Future Updates**

### Deploy Updates:
1. Push changes to GitHub
2. Railway automatically redeploys
3. No manual intervention needed

### Environment Variables:
- Update in Railway dashboard
- Changes apply on next deployment
- No code changes needed

---

**🎯 Benefits of Railway over Vercel:**
- ✅ Unified platform for everything
- ✅ Better database integration
- ✅ Simpler environment management
- ✅ Lower cost for full-stack apps
- ✅ Built-in monitoring and logs
