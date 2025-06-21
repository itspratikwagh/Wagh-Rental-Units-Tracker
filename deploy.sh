#!/bin/bash

echo "🚀 Wagh Rental Units Tracker - Deployment Script"
echo "================================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote origin is set
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ No remote origin found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "   git push -u origin main"
    exit 1
fi

echo "✅ Git repository is properly configured"

# Check if all required files exist
echo "📁 Checking project structure..."

if [ ! -f "backend/server.js" ]; then
    echo "❌ Backend server.js not found"
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo "❌ Frontend package.json not found"
    exit 1
fi

if [ ! -f "backend/prisma/schema.prisma" ]; then
    echo "❌ Prisma schema not found"
    exit 1
fi

echo "✅ Project structure looks good"

# Check for environment files
echo "🔧 Checking environment configuration..."

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file not found. You'll need to set environment variables in your deployment platform."
fi

if [ ! -f "frontend/.env" ]; then
    echo "⚠️  Frontend .env file not found. You'll need to set environment variables in your deployment platform."
fi

echo ""
echo "📋 Deployment Checklist:"
echo "========================"
echo ""
echo "1. Database Setup:"
echo "   - Create a Supabase account at https://supabase.com"
echo "   - Create a new project"
echo "   - Copy the database connection string"
echo ""
echo "2. Backend Deployment (Railway):"
echo "   - Go to https://railway.app"
echo "   - Connect your GitHub repository"
echo "   - Create a new service"
echo "   - Set environment variables:"
echo "     DATABASE_URL=your_supabase_connection_string"
echo "     NODE_ENV=production"
echo "     ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app"
echo ""
echo "3. Frontend Deployment (Vercel):"
echo "   - Go to https://vercel.com"
echo "   - Import your GitHub repository"
echo "   - Set environment variable:"
echo "     VITE_API_URL=https://your-backend-domain.railway.app"
echo ""
echo "4. Update CORS:"
echo "   - Update ALLOWED_ORIGINS in Railway with your Vercel domain"
echo ""
echo "5. Database Migration:"
echo "   - Run 'npx prisma migrate deploy' in Railway console"
echo ""
echo "🔗 Useful Links:"
echo "================="
echo "Supabase: https://supabase.com"
echo "Railway: https://railway.app"
echo "Vercel: https://vercel.com"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "🎉 Good luck with your deployment!" 