# 🚨 CRITICAL DEPLOYMENT STEPS

## Problem
The Railway backend is **NOT connecting to MongoDB** because `MONGODB_URI` is not set.

## Solution

### 1. Add MONGODB_URI to Railway (MUST DO NOW)

1. Go to Railway dashboard: https://railway.com/project/86a5466e-f55f-4c85-bca3-41afc5cb4d80
2. Select your **backend service** (burning-man-crm-production)
3. Click **Variables** tab
4. Add variable:
   ```
   Key: MONGODB_URI
   Value: mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQOOwB@yamanote.proxy.rlwy.net:41945
   ```
5. Service will auto-redeploy

### 2. Add REACT_APP_SOCKET_URL to Vercel

1. Go to Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add variable:
   ```
   Key: REACT_APP_SOCKET_URL
   Value: https://burning-man-crm-production.up.railway.app
   ```
5. **Redeploy** from Deployments tab

### 3. Verify Health Check

After Railway redeploys (2-3 minutes), check:
```bash
curl -s https://burning-man-crm-production.up.railway.app/api/health | python3 -m json.tool
```

Should show:
```json
{
  "mongodb": {
    "connected": true
  },
  "databaseAdapter": {
    "usingMongoDB": true
  },
  "environment": {
    "mongoUriSet": true
  }
}
```

### 4. Test Login

```bash
curl -X POST https://burning-man-crm-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mocostaneres@gmail.com","password":"weh0809"}'
```

Should return MongoDB ObjectId (not numeric ID):
```json
{
  "user": {
    "_id": "68e43f320937858462d3acf5",  ← MongoDB ObjectId!
    "campId": "68e43f61a8f6ec1271586306",
    "campName": "Mudskippers"
  }
}
```

### 5. Test Event Creation

1. Login at https://burning-man-crm.vercel.app
2. Email: `mocostaneres@gmail.com`
3. Password: `weh0809`
4. Try creating an event
5. Should work without "Unable to determine camp context" error

## What We Fixed

✅ Added `campId` field to User model (MongoDB ObjectId reference)
✅ Updated `/camps/my-camp` to use `campId` instead of querying by `contactEmail`
✅ Updated `/shifts/events` to use `campId` for camp context
✅ Created migration script to populate `campId` for existing users
✅ User `mocostaneres@gmail.com` now has `campId` set in MongoDB

## Next Steps After MongoDB Connects

Once MongoDB is connected, we'll need to update all remaining routes:
- `/api/rosters/*` - roster management
- `/api/tasks/*` - task management  
- `/api/call-slots/*` - call slot management
- `/api/applications/*` - application management

All to use `campId` instead of `campName` or `contactEmail` queries.

