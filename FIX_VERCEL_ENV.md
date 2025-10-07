# 🚨 URGENT: Fix Vercel Environment Variables

## Problem
Socket.IO is trying to connect to `localhost:5001` instead of Railway backend.

## Solution

### 1. Go to Vercel Dashboard
1. Navigate to: https://vercel.com/dashboard
2. Select your project: `burning-man-crm`

### 2. Add Environment Variable
1. Click **Settings** tab
2. Click **Environment Variables** in left sidebar
3. Click **Add New**
4. Set:
   - **Name**: `REACT_APP_SOCKET_URL`
   - **Value**: `https://burning-man-crm-production.up.railway.app`
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### 3. Redeploy
1. Go to **Deployments** tab
2. Click the 3 dots (⋯) on the latest deployment
3. Click **Redeploy**

### 4. Wait 2-3 minutes for deployment to complete

## Expected Result
- No more `localhost:5001` errors in console
- Socket.IO connects to Railway backend
- Real-time features work

---

## Alternative: Quick Fix via CLI (if you have Vercel CLI)

```bash
vercel env add REACT_APP_SOCKET_URL
# Enter: https://burning-man-crm-production.up.railway.app
# Select: Production, Preview, Development
```

