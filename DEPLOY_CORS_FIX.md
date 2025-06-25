# Deploy CORS Fix to Railway

## Current Issue
The frontend at `https://quotation-app-fe.onrender.com` is still being blocked by CORS policy because the backend changes haven't been deployed yet.

## Changes Made ✅

### 1. **Updated CORS Configuration** (`server.js`)
- Added environment variable support for allowed origins
- Enhanced logging for CORS debugging
- Explicit origin checking with detailed logs

### 2. **Added Environment Variable** (`.env`)
```
ALLOWED_ORIGINS=https://quotation-app-fe.onrender.com,https://quotation-app-fe.vercel.app,https://railway.com,http://localhost:3000,http://localhost:3001,http://localhost:8080
```

## Deployment Steps

### Option 1: Railway Dashboard (Recommended)
1. **Go to Railway Dashboard**
   - Visit: https://railway.app/dashboard
   - Find your `quotation-app-be` project

2. **Add Environment Variable**
   - Go to Variables tab
   - Add new variable:
     - **Name**: `ALLOWED_ORIGINS`
     - **Value**: `https://quotation-app-fe.onrender.com,https://quotation-app-fe.vercel.app,https://railway.com,http://localhost:3000,http://localhost:3001,http://localhost:8080`

3. **Deploy Changes**
   - Go to Deployments tab
   - Click "Deploy Latest" or push changes to trigger deployment

### Option 2: Git Push
1. **Commit Changes**
   ```bash
   cd ../quotation-app-be
   git add .
   git commit -m "Fix CORS configuration for Render frontend"
   git push origin main
   ```

2. **Railway Auto-Deploy**
   - Railway will automatically detect the changes
   - Monitor deployment in Railway dashboard

## Verification

### 1. **Check Deployment Logs**
Look for these messages in Railway logs:
```
CORS Configuration:
Allowed origins: [
  'https://quotation-app-fe.onrender.com',
  'https://quotation-app-fe.vercel.app',
  'https://railway.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080'
]
```

### 2. **Test CORS**
After deployment, test:
- Visit: `https://quotation-app-fe.onrender.com`
- Try to login
- Check browser console for CORS errors

### 3. **Monitor CORS Logs**
In Railway logs, you should see:
```
CORS check for origin: https://quotation-app-fe.onrender.com
Origin allowed: https://quotation-app-fe.onrender.com
```

## If Still Not Working

### 1. **Check Environment Variable**
In Railway dashboard, verify the `ALLOWED_ORIGINS` variable is set correctly.

### 2. **Force Redeploy**
- In Railway dashboard, go to Deployments
- Click "Redeploy" on the latest deployment

### 3. **Check Railway Logs**
Look for any errors during startup or CORS-related messages.

## Quick Test Commands

### Test Backend Health
```bash
curl https://quotation-app-be.railway.app/health
```

### Test CORS Preflight
```bash
curl -X OPTIONS \
  -H "Origin: https://quotation-app-fe.onrender.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://quotation-app-be.railway.app/api/v1/auth/login
```

## Expected Result
After deployment, the frontend should be able to communicate with the backend without CORS errors.
