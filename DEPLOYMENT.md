# Deployment Guide for Wagh Rental Units Tracker

## Overview
This project consists of:
- **Frontend**: React + Vite + Material-UI
- **Backend**: Express.js + Prisma
- **Database**: PostgreSQL

## Deployment Steps

### 1. Database Setup (Supabase - Recommended)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings > Database to get your connection string
4. Copy the connection string (it looks like: `postgresql://postgres:[password]@[host]:5432/postgres`)

### 2. Backend Deployment (Railway - Recommended)

1. Go to [railway.app](https://railway.app) and create an account
2. Connect your GitHub repository
3. Create a new service from your repository
4. Set the following environment variables:
   ```
   DATABASE_URL=your_supabase_connection_string
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
   ```
5. Deploy the service
6. Copy the generated domain (e.g., `https://your-app.railway.app`)

### 3. Frontend Deployment (Vercel - Recommended)

1. Go to [vercel.com](https://vercel.com) and create an account
2. Import your GitHub repository
3. Set the following environment variable:
   ```
   VITE_API_URL=https://your-backend-domain.railway.app
   ```
4. Deploy the application
5. Copy the generated domain (e.g., `https://your-app.vercel.app`)

### 4. Update CORS Configuration

1. Go back to your Railway backend service
2. Update the `ALLOWED_ORIGINS` environment variable with your Vercel frontend domain:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
3. Redeploy the backend service

### 5. Database Migration

1. Connect to your Railway backend service via SSH or use Railway's console
2. Run the following commands:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

## Alternative Deployment Options

### Backend Alternatives:
- **Render**: Similar to Railway, good free tier
- **Heroku**: More established, but requires credit card for free tier
- **DigitalOcean App Platform**: Good performance, paid service

### Frontend Alternatives:
- **Netlify**: Great for static sites, good free tier
- **GitHub Pages**: Free, but requires some configuration
- **Firebase Hosting**: Google's offering, good integration with other Firebase services

### Database Alternatives:
- **Railway PostgreSQL**: If you're already using Railway for backend
- **Neon**: Serverless PostgreSQL, good free tier
- **PlanetScale**: MySQL-based, but very reliable

## Environment Variables Reference

### Backend (.env)
```
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
PORT=3005
```

### Frontend (.env)
```
VITE_API_URL=https://your-backend-domain.railway.app
```

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure `ALLOWED_ORIGINS` includes your frontend domain
2. **Database Connection**: Verify your `DATABASE_URL` is correct
3. **Build Errors**: Check that all dependencies are in `package.json`
4. **Environment Variables**: Ensure all required variables are set in your deployment platform

### Testing Deployment:

1. Test your backend API: `curl https://your-backend-domain.railway.app/api/properties`
2. Test your frontend: Visit your Vercel domain
3. Check browser console for any errors

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to your repository
2. **CORS**: Only allow necessary origins
3. **Database**: Use strong passwords and consider connection pooling
4. **HTTPS**: All production deployments should use HTTPS

## Monitoring

1. **Railway**: Built-in monitoring and logs
2. **Vercel**: Analytics and performance monitoring
3. **Supabase**: Database monitoring and backups

## Cost Estimation

### Free Tier (Recommended for starting):
- **Supabase**: Free tier includes 500MB database, 2GB bandwidth
- **Railway**: Free tier includes $5 credit monthly
- **Vercel**: Free tier includes unlimited deployments, 100GB bandwidth

### Paid Options (When you scale):
- **Supabase Pro**: $25/month for 8GB database, 250GB bandwidth
- **Railway**: Pay-as-you-use, typically $5-20/month for small apps
- **Vercel Pro**: $20/month for team features and more bandwidth 