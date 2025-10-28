# Google OAuth Troubleshooting Guide

## Current Status
Google OAuth is configured with Client ID: `115710029109-99h025pi7c43bbf058fim6fjog07qdj5.apps.googleusercontent.com`

## Common Issues and Fixes

### Issue 1: "400 Bad Request" Error

#### Symptoms
- User clicks "Sign in with Google"
- Google popup appears but immediately shows "400 Bad Request"
- Error message: "The server cannot process the request because it is malformed"

#### Root Causes
1. **Incorrect Authorized JavaScript Origins**
   - The origin must match EXACTLY (including protocol and port)
   - localhost requires http:// (not https://)
   
2. **Missing or Incorrect Redirect URIs**
   - Even for popup OAuth, redirect URIs must be configured
   
3. **Client ID Mismatch**
   - Frontend and backend must use the same Client ID

#### Fix Steps

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com
   - Select your project
   - Navigate to "APIs & Services" → "Credentials"
   - Click on your OAuth 2.0 Client ID

2. **Update Authorized JavaScript Origins**
   ```
   For Development:
   - http://localhost:3000
   - http://localhost:5001
   
   For Production:
   - https://burning-man-crm.vercel.app
   - https://www.g8road.com
   - https://g8road.com
   ```

3. **Update Authorized Redirect URIs**
   ```
   For Development:
   - http://localhost:3000
   - http://localhost:3000/auth/callback
   - http://localhost:5001/api/oauth/google
   
   For Production:
   - https://burning-man-crm.vercel.app
   - https://burning-man-crm.vercel.app/auth/callback
   - https://www.g8road.com
   - https://www.g8road.com/auth/callback
   ```

4. **Verify Environment Variables**
   ```bash
   # Check client/.env.local
   cat client/.env.local
   
   # Should contain:
   REACT_APP_GOOGLE_CLIENT_ID=115710029109-99h025pi7c43bbf058fim6fjog07qdj5.apps.googleusercontent.com
   REACT_APP_API_URL=http://localhost:5001/api
   ```

5. **Restart Both Servers**
   ```bash
   # Kill existing processes
   pkill -f "node server/index.js"
   pkill -f "react-scripts"
   
   # Start backend
   JWT_SECRET="your-super-secret-jwt-key-here" PORT=5001 node server/index.js &
   
   # Start frontend (in client directory)
   cd client && npm start
   ```

### Issue 2: CORS Errors

#### Symptoms
- Browser console shows CORS-related errors
- Network tab shows OPTIONS request failed

#### Fix
Ensure your backend CORS configuration includes Google domains:
```javascript
// server/index.js
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://accounts.google.com',
    'https://burning-man-crm.vercel.app',
    'https://www.g8road.com',
    'https://g8road.com'
  ],
  credentials: true
}));
```

### Issue 3: Profile Picture Validation Error

#### Symptoms
- Backend returns validation error for profilePicture field
- Google returns a picture URL that fails validation

#### Fix
✅ **ALREADY FIXED** - Removed `.isURL()` validation requirement from profilePicture field

### Issue 4: User Creation Fails

#### Symptoms
- OAuth succeeds but user is not created in database
- No JWT token returned

#### Debug Steps
1. Check backend logs for errors
2. Verify JWT_SECRET is set:
   ```bash
   echo $JWT_SECRET
   ```
3. Check if MongoDB is running (if using MongoDB)
4. Verify mock database has write permissions

### Issue 5: Token Storage Issues

#### Symptoms
- User authenticates but is immediately logged out
- localStorage is empty after OAuth

#### Fix
Check browser localStorage in DevTools:
```javascript
// Console
localStorage.getItem('token')
localStorage.getItem('user')
```

If empty, check that the OAuth component is properly storing data:
```typescript
// Should happen in GoogleOAuth.tsx handleGoogleSuccess
localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));
```

## Testing Checklist

### Local Development
- [ ] Google Cloud Console configured with localhost origins
- [ ] Client ID in `.env.local` matches Google Console
- [ ] Backend server running on port 5001
- [ ] Frontend running on port 3000
- [ ] JWT_SECRET environment variable set
- [ ] Can click "Sign in with Google" button
- [ ] Google popup opens successfully
- [ ] Can select Google account
- [ ] Redirects back to app after authentication
- [ ] User is logged in (see user avatar/name in navbar)
- [ ] localStorage has token and user data

### Production
- [ ] Production domain added to Google Console
- [ ] HTTPS redirect URIs configured
- [ ] Environment variables set in Vercel
- [ ] Deployed app can authenticate with Google
- [ ] User data persists across page refreshes

## Debug Mode

To enable detailed OAuth logging:

1. **Frontend (DevTools Console)**
   ```javascript
   localStorage.setItem('debug', 'oauth:*')
   ```

2. **Backend (Terminal)**
   ```bash
   DEBUG=oauth:* JWT_SECRET="your-super-secret-jwt-key-here" PORT=5001 node server/index.js
   ```

## Quick Fix Commands

```bash
# Check if Google OAuth is configured
grep REACT_APP_GOOGLE_CLIENT_ID client/.env.local

# Test backend OAuth endpoint
curl -X POST http://localhost:5001/api/oauth/google \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "name": "Test User",
    "googleId": "12345",
    "profilePicture": "https://example.com/photo.jpg"
  }'

# Check if frontend can reach backend
curl http://localhost:5001/api/health

# Verify CORS headers
curl -I -X OPTIONS http://localhost:5001/api/oauth/google \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

## Still Having Issues?

1. **Clear browser cache and cookies**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Clear localStorage: DevTools → Application → Local Storage → Clear

2. **Check Google Cloud Console Quota**
   - Go to "APIs & Services" → "Dashboard"
   - Check if you've hit API quotas

3. **Verify Google Account Settings**
   - Some organizations block OAuth for personal apps
   - Try with a personal Gmail account first

4. **Check Network Tab**
   - Open DevTools → Network
   - Filter by "oauth"
   - Look for failed requests and their error messages

## Contact Support

If none of these fixes work, provide:
- Error message from browser console
- Network tab screenshot
- Backend terminal logs
- Google Cloud Console configuration screenshot

