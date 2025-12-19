# Google OAuth Production Configuration

## Issue: Google OAuth Disabled in Production

### Symptom
- Frontend: `/oauth/config` returns `google.enabled = false` and `google.clientId = null`
- Google sign-in button does not appear
- Backend logs show: "GOOGLE_CLIENT_ID not set - Google OAuth will be disabled"

### Root Cause
The `GOOGLE_CLIENT_ID` environment variable is **not set in the production environment** (Railway).

### Solution

#### Step 1: Get Your Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your **Web application** OAuth 2.0 Client ID
4. Copy the Client ID (ends with `.apps.googleusercontent.com`)

#### Step 2: Add to Railway Environment Variables

**Via Railway Dashboard:**

1. Go to https://railway.app/dashboard
2. Select your project (`burning-man-crm`)
3. Click on your **Backend Service** (Node.js/Express)
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add:
   - Variable: `GOOGLE_CLIENT_ID`
   - Value: `your-client-id-here.apps.googleusercontent.com`
7. Click **Add**
8. Railway will automatically redeploy

**Via Railway CLI:**

```bash
railway variables set GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
```

#### Step 3: Verify Configuration

1. **Check Railway Logs** (after deployment):
   ```
   ✅ [OAuth] Google OAuth client initialized
   ✅ [OAuth] GOOGLE_CLIENT_ID is configured
   ```

2. **Test the Config Endpoint**:
   ```bash
   curl https://api.g8road.com/oauth/config
   ```
   
   Should return:
   ```json
   {
     "google": {
       "clientId": "your-client-id-here.apps.googleusercontent.com",
       "enabled": true
     },
     "apple": {
       "clientId": "...",
       "enabled": true/false
     }
   }
   ```

3. **Check Frontend**:
   - Visit https://www.g8road.com/login
   - Google sign-in button should appear
   - Browser console should show:
     ```
     ✅ [GoogleOAuth] Google Identity Services loaded
     ✅ [GoogleOAuth] Google Sign-In initialized
     ```

#### Step 4: Verify Google Cloud Console Configuration

Ensure your OAuth 2.0 Client ID has the correct **Authorized JavaScript origins**:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **Web application** OAuth 2.0 Client ID
4. Under **Authorized JavaScript origins**, add:
   - `https://www.g8road.com`
   - `https://g8road.com`
   - `http://localhost:3000` (for local development)
5. Under **Authorized redirect URIs**, add:
   - `https://www.g8road.com`
   - `http://localhost:3000` (for local development)
6. Click **Save**

### Debug Logging

The backend now includes detailed logging to diagnose configuration issues:

```
🔍 [OAuth Config] Checking environment variables...
🔍 [OAuth Config] GOOGLE_CLIENT_ID present: true/false
🔍 [OAuth Config] GOOGLE_CLIENT_ID length: XXX
🔍 [OAuth Config] GOOGLE_CLIENT_ID preview: 123456789...googleusercontent.com
✅ [OAuth Config] Sending config: { google: { enabled: true, clientIdPresent: true } }
```

### Common Issues

#### Issue 1: Environment Variable Not Loading
- **Symptom**: Variable is set but still shows as `false`
- **Fix**: Railway requires a restart after adding environment variables. Click **Redeploy** in Railway dashboard.

#### Issue 2: Wrong Client ID
- **Symptom**: `Token audience mismatch` error
- **Fix**: Ensure the Client ID in Railway matches the one from Google Cloud Console

#### Issue 3: CORS Error
- **Symptom**: `Not allowed by CORS` error
- **Fix**: Add your production domain to **Authorized JavaScript origins** in Google Cloud Console

#### Issue 4: Invalid Redirect URI
- **Symptom**: `redirect_uri_mismatch` error
- **Fix**: Add your production domain to **Authorized redirect URIs** in Google Cloud Console

### Security Notes

1. **Never commit** `GOOGLE_CLIENT_ID` to Git
2. **Use environment variables** for all environments (dev, staging, prod)
3. **Different Client IDs** can be used for different environments (optional)
4. **Server restart** is required after changing environment variables

### Testing Checklist

After setting `GOOGLE_CLIENT_ID`:

- [ ] Railway shows variable in dashboard
- [ ] Server logs show "Google OAuth client initialized"
- [ ] `/oauth/config` returns `google.enabled: true`
- [ ] Google sign-in button appears on login/register pages
- [ ] Can successfully sign in with Google account
- [ ] New user is created in database
- [ ] Existing user can link Google account

### Mobile Compatibility

The same `GOOGLE_CLIENT_ID` works for:
- ✅ **Web**: Google Identity Services (JavaScript)
- 🔄 **iOS**: Will use separate iOS Client ID (future)
- 🔄 **Android**: Will use separate Android Client ID (future)

When adding mobile apps, you'll create separate Client IDs in Google Cloud Console for iOS and Android, but they'll all use the same backend endpoint (`/api/oauth/google`).

---

**Last Updated**: 2025-12-19  
**Status**: Awaiting Railway Configuration

