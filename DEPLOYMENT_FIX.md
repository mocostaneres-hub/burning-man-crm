# Deployment Fix Instructions

## Problem Summary
1. **Railway backend is using mock database instead of MongoDB** because MONGODB_URI connection is failing
2. **Vercel frontend Socket.IO is trying to connect to localhost:5001** because REACT_APP_SOCKET_URL is not set
3. **Event creation fails** due to camp context issues from mock database

## Solution Steps

### Step 1: Fix Railway Environment Variables

Log into Railway dashboard and ensure these environment variables are set:

```
MONGODB_URI=mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQOOwB@yamanote.proxy.rlwy.net:41945
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRE=7d
NODE_ENV=production
CLIENT_URL=https://burning-man-crm.vercel.app
```

**Important**: The MONGODB_URI should be the PUBLIC connection string, NOT the internal one.

After setting, **redeploy the Railway service**.

### Step 2: Fix Vercel Environment Variables

Log into Vercel dashboard and add/verify these environment variables:

```
REACT_APP_API_URL=https://burning-man-crm-production.up.railway.app/api
REACT_APP_SOCKET_URL=https://burning-man-crm-production.up.railway.app
```

After setting, **trigger a new deployment** (Settings → Deployments → Redeploy).

### Step 3: Verify MongoDB Connection

After Railway redeploys, check the logs to see:
- "MongoDB connected successfully" message
- No "using mock database" messages

### Step 4: Test Login and Event Creation

1. Go to https://burning-man-crm.vercel.app
2. Login with: mocostaneres@gmail.com / weh0809
3. Try creating an event
4. Check browser console - should see NO localhost:5001 errors

## Database State

The MongoDB database currently has:
- User: mocostaneres@gmail.com (camp account)
- Camp: Mudskippers (ID: 68e43f61a8f6ec1271586306)
- ~20 other users from migration

The roster from mock data did NOT transfer over - you'll need to add members fresh.

## Quick Test Commands

Test MongoDB connection from local:
```bash
MONGODB_URI="mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQOOwB@yamanote.proxy.rlwy.net:41945" node check-mongo-users.js
```

Test production API:
```bash
curl -X POST https://burning-man-crm-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mocostaneres@gmail.com","password":"weh0809"}'
```

