# Google OAuth Setup Guide

## Overview

This implementation provides Google Sign-In and Sign-Up functionality that is **mobile-compatible** from day one. The same backend endpoint works for:
- **Web**: Google Identity Services (JavaScript)
- **iOS**: Google Sign-In SDK (native) - *future implementation*
- **Android**: Google Sign-In SDK (native) - *future implementation*

## Architecture

### Key Design Decisions for Mobile Compatibility

1. **ID Token Verification**: Server-side verification of Google ID tokens (secure, works for all platforms)
2. **Single Backend Endpoint**: `/api/oauth/google` accepts ID tokens from any platform
3. **JWT Session Tokens**: Our own JWT tokens work across web and mobile
4. **Platform-Agnostic Backend**: Backend doesn't care if request comes from web or mobile

### Flow Diagram

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │         │   Google    │         │   Backend   │
│  (Web/Mobile)│         │   Servers   │         │   Server    │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Request Sign-In   │                        │
       │──────────────────────>│                        │
       │                       │                        │
       │ 2. Google Auth Flow   │                        │
       │<──────────────────────>│                        │
       │                       │                        │
       │ 3. Receive ID Token    │                        │
       │<───────────────────────│                        │
       │                       │                        │
       │ 4. Send ID Token      │                        │
       │────────────────────────────────────────────────>│
       │                       │                        │
       │                       │ 5. Verify Token       │
       │                       │<───────────────────────│
       │                       │                        │
       │                       │ 6. Token Valid        │
       │                       │───────────────────────>│
       │                       │                        │
       │ 7. Receive JWT Token  │                        │
       │<────────────────────────────────────────────────│
       │                       │                        │
```

## Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Client IDs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**

### Step 2: Configure OAuth Consent Screen

If you haven't already:
1. Go to **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - App name: `G8Road CRM`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Save and continue

### Step 3: Create Web Client ID

1. **Application type**: Web application
2. **Name**: `G8Road Web Client`
3. **Authorized JavaScript origins**:
   - `http://localhost:3000` (development)
   - `http://localhost:3001` (development)
   - `https://www.g8road.com` (production)
   - `https://g8road.com` (production)
4. **Authorized redirect URIs**:
   - `http://localhost:3000` (development)
   - `https://www.g8road.com` (production)
5. Click **Create**
6. **Copy the Client ID** (ends with `.apps.googleusercontent.com`)

### Step 4: Create iOS Client ID (Future)

When implementing iOS app:
1. **Application type**: iOS
2. **Name**: `G8Road iOS`
3. **Bundle ID**: Your iOS app bundle ID (e.g., `com.g8road.crm`)
4. Click **Create**
5. **Copy the Client ID** - iOS app will use this

### Step 5: Create Android Client ID (Future)

When implementing Android app:
1. **Application type**: Android
2. **Name**: `G8Road Android`
3. **Package name**: Your Android package name (e.g., `com.g8road.crm`)
4. **SHA-1 certificate fingerprint**: Your app's SHA-1
5. Click **Create**
6. **Copy the Client ID** - Android app will use this

## Environment Variables

### Backend (`.env` or Railway/Vercel)

```bash
# Google OAuth - Web Client ID
# This is the Client ID from Step 3 above
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Frontend (`.env` or Vercel)

**Note**: Frontend doesn't need `GOOGLE_CLIENT_ID` in environment variables because it fetches it from the backend `/api/oauth/config` endpoint. This ensures:
- Single source of truth (backend)
- Easier configuration management
- No need to rebuild frontend when client ID changes

However, if you want to hardcode it (not recommended), you can add:
```bash
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Installation

### Backend Dependencies

The `google-auth-library` package is already installed. If you need to reinstall:

```bash
npm install google-auth-library
```

### Frontend Dependencies

No additional packages needed! Google Identity Services is loaded dynamically via script tag.

## Testing

### Local Development

1. **Start backend server**:
   ```bash
   npm run server
   ```

2. **Start frontend**:
   ```bash
   cd client && npm start
   ```

3. **Test Sign-In**:
   - Navigate to `http://localhost:3000/login`
   - Click "Sign in with Google"
   - Complete Google authentication
   - Should redirect to dashboard

4. **Test Sign-Up**:
   - Navigate to `http://localhost:3000/register`
   - Click "Sign up with Google"
   - Complete Google authentication
   - Should redirect to onboarding

### Common Issues

#### 1. "Google OAuth not configured"
- **Cause**: `GOOGLE_CLIENT_ID` not set in backend environment
- **Fix**: Add `GOOGLE_CLIENT_ID` to `.env` file

#### 2. "Token audience mismatch"
- **Cause**: Client ID in frontend doesn't match backend
- **Fix**: Ensure backend `GOOGLE_CLIENT_ID` matches the Client ID from Google Cloud Console

#### 3. "Invalid redirect URI"
- **Cause**: Redirect URI not in authorized list
- **Fix**: Add your domain to "Authorized redirect URIs" in Google Cloud Console

#### 4. "Failed to load Google Identity Services"
- **Cause**: Network issue or script blocked
- **Fix**: Check browser console, ensure `https://accounts.google.com/gsi/client` is accessible

#### 5. "OAuth is only available for personal accounts"
- **Cause**: Email already registered as camp account
- **Fix**: Use a different email or convert account type

## Mobile App Integration (Future)

### iOS Implementation

1. Install Google Sign-In SDK:
   ```bash
   pod 'GoogleSignIn'
   ```

2. Configure in `Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>YOUR_REVERSED_CLIENT_ID</string>
       </array>
     </dict>
   </array>
   ```

3. Use iOS Client ID (from Step 4 above):
   ```swift
   GIDSignIn.sharedInstance.configuration = GIDConfiguration(
     clientID: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
   )
   ```

4. Sign in and get ID token:
   ```swift
   GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
     guard let idToken = result?.user.idToken?.tokenString else { return }
     
     // Send to backend
     sendToBackend(idToken: idToken)
   }
   ```

5. Call backend endpoint:
   ```swift
   POST /api/oauth/google
   Body: { "idToken": "..." }
   ```

### Android Implementation

1. Add dependency to `build.gradle`:
   ```gradle
   implementation 'com.google.android.gms:play-services-auth:20.7.0'
   ```

2. Use Android Client ID (from Step 5 above):
   ```kotlin
   val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
     .requestIdToken("YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com")
     .requestEmail()
     .build()
   ```

3. Sign in and get ID token:
   ```kotlin
   val signInIntent = googleSignInClient.signInIntent
   startActivityForResult(signInIntent, RC_SIGN_IN)
   
   // In onActivityResult
   val task = GoogleSignIn.getSignedInAccountFromIntent(data)
   val account = task.getResult(ApiException::class.java)
   val idToken = account.idToken
   ```

4. Call backend endpoint:
   ```kotlin
   POST /api/oauth/google
   Body: { "idToken": "..." }
   ```

## Security Considerations

1. **ID Token Verification**: Always verify tokens server-side (never trust client)
2. **HTTPS Only**: Use HTTPS in production (required by Google)
3. **Token Expiration**: ID tokens expire after 1 hour
4. **Audience Check**: Backend verifies token audience matches `GOOGLE_CLIENT_ID`
5. **No Client Secrets**: Never expose client secrets to frontend/mobile apps

## Troubleshooting

### Backend Logs

Check server logs for:
- `✅ [OAuth] Google OAuth client initialized` - Configuration loaded
- `✅ [OAuth] Google authentication successful` - Sign-in worked
- `❌ [OAuth] Google ID token verification failed` - Token invalid

### Frontend Console

Check browser console for:
- `✅ [GoogleOAuth] Google Identity Services loaded` - Script loaded
- `✅ [GoogleOAuth] Google Sign-In initialized` - Component ready
- `✅ [GoogleOAuth] Authentication successful` - Sign-in worked

### Network Tab

Check Network tab for:
- `GET /api/oauth/config` - Should return `{ google: { clientId: "...", enabled: true } }`
- `POST /api/oauth/google` - Should return `{ token: "...", user: {...} }`

## Support

For issues:
1. Check this guide first
2. Review Google's [Identity Services documentation](https://developers.google.com/identity/gsi/web)
3. Check server logs and browser console
4. Verify environment variables are set correctly

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ Production Ready (Web), 🔄 Mobile Pending
