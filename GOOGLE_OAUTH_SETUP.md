# Google OAuth Setup Guide for G8Road CRM

## Overview
Your G8Road CRM application already has Google OAuth infrastructure built-in. This guide will help you complete the setup.

## Prerequisites
- Google Cloud Console access
- Your domain (g8road.com) ready for production

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Name it "G8Road CRM" (or similar)

### 1.2 Enable APIs
1. Navigate to "APIs & Services" → "Library"
2. Search and enable:
   - Google+ API
   - Google Identity API
   - Google OAuth2 API

### 1.3 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Name: "G8Road CRM Web Client"

### 1.4 Configure Authorized Origins
```
Authorized JavaScript origins:
- http://localhost:3000
- http://localhost:3001
- https://www.g8road.com
- https://g8road.com

Authorized redirect URIs:
- http://localhost:3000
- http://localhost:3001
- https://www.g8road.com
- https://g8road.com
```

### 1.5 Copy Client ID
- Copy the generated Client ID (you'll need this for environment variables)

## Step 2: Environment Configuration

### 2.1 Development Environment
Create `client/.env.local`:
```bash
# Google OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=your-actual-google-client-id-here

# API Configuration
REACT_APP_API_URL=http://localhost:5001/api

# Other environment variables
REACT_APP_APP_NAME=G8Road CRM
REACT_APP_VERSION=1.0.0
```

### 2.2 Production Environment
For production deployment, set these environment variables:
```bash
REACT_APP_GOOGLE_CLIENT_ID=your-production-google-client-id
REACT_APP_API_URL=https://api.g8road.com/api
```

## Step 3: Test the Setup

### 3.1 Start Development Server
```bash
# Terminal 1 - Backend
cd server
JWT_SECRET="your-super-secret-jwt-key-here" PORT=5001 npm start

# Terminal 2 - Frontend
cd client
npm start
```

### 3.2 Test OAuth Flow
1. Go to http://localhost:3000
2. Click "Sign Up" or "Sign In"
3. Try the "Continue with Google" button
4. Verify the OAuth flow works

## Step 4: Production Deployment

### 4.1 Update Google Console
1. Add your production domain to authorized origins
2. Update redirect URIs for production

### 4.2 Deploy with Environment Variables
Make sure your production environment has:
- `REACT_APP_GOOGLE_CLIENT_ID` set to your production client ID
- `REACT_APP_API_URL` set to your production API URL

## Troubleshooting

### Common Issues

1. **"Google OAuth not properly configured"**
   - Check that `REACT_APP_GOOGLE_CLIENT_ID` is set correctly
   - Ensure the environment variable is loaded (restart dev server)

2. **"Error 400: redirect_uri_mismatch"**
   - Verify your domain is added to authorized origins in Google Console
   - Check that the redirect URI matches exactly

3. **"This app isn't verified"**
   - This is normal for development
   - For production, you may need to verify your app with Google

### Debug Steps
1. Check browser console for errors
2. Verify environment variables are loaded
3. Test with different browsers
4. Check Google Console for API usage

## Security Notes

- Never commit `.env.local` to version control
- Use different client IDs for development and production
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Console

## Current Implementation

Your app already includes:
- ✅ Google OAuth component (`GoogleOAuth.tsx`)
- ✅ Backend OAuth routes (`/api/oauth/google`)
- ✅ Integration with login/register pages
- ✅ JWT token generation
- ✅ User account creation/updates

You just need to:
- ✅ Configure Google Cloud Console
- ✅ Set environment variables
- ✅ Test the flow

## Next Steps

1. Complete Google Cloud Console setup
2. Add your client ID to environment variables
3. Test locally
4. Deploy to production
5. Update production environment variables

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Google OAuth documentation
3. Check browser console for errors
4. Verify all environment variables are set correctly
