# OAuth Setup Guide

This guide will help you set up Google and Apple OAuth authentication for your G8Road CRM.

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (or Google Identity API)

### Step 2: Create OAuth 2.0 Credentials

1. Go to "Credentials" in the left sidebar
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
5. Copy the Client ID

### Step 3: Configure Environment Variables

Create a `.env` file in the `client` directory:

```env
REACT_APP_GOOGLE_CLIENT_ID=your-actual-google-client-id-here
REACT_APP_APPLE_CLIENT_ID=your-apple-client-id-here
REACT_APP_API_URL=http://localhost:5001/api
```

## Apple OAuth Setup

### Step 1: Apple Developer Account

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Sign in with your Apple Developer account
3. Go to "Certificates, Identifiers & Profiles"

### Step 2: Create App ID

1. Go to "Identifiers" → "App IDs"
2. Click the "+" button
3. Choose "App" and fill in:
   - Description: "G8Road CRM"
   - Bundle ID: `com.yourcompany.g8road-crm`
4. Enable "Sign In with Apple" capability

### Step 3: Create Service ID

1. Go to "Identifiers" → "Services IDs"
2. Click the "+" button
3. Fill in:
   - Description: "G8Road CRM Web"
   - Identifier: `com.yourcompany.g8road-crm.web`
4. Enable "Sign In with Apple"
5. Configure domains:
   - Primary App ID: Select your App ID
   - Domains: `localhost:3000` (for development)
   - Return URLs: `http://localhost:3000`

### Step 4: Create Private Key

1. Go to "Keys" → "All"
2. Click the "+" button
3. Fill in:
   - Key Name: "G8Road CRM Sign In Key"
4. Enable "Sign In with Apple"
5. Download the key file (.p8)
6. Note the Key ID

## Backend Configuration

Update your backend `.env` file:

```env
# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
APPLE_CLIENT_ID=com.yourcompany.burning-man-crm.web
APPLE_CLIENT_SECRET=your-apple-private-key-here
APPLE_KEY_ID=your-apple-key-id-here
APPLE_TEAM_ID=your-apple-team-id-here
```

## Testing OAuth

1. Restart your development servers:
   ```bash
   # Backend
   cd /Users/mauricio/burning-man-crm
   node server/index.js
   
   # Frontend
   cd /Users/mauricio/burning-man-crm/client
   npm start
   ```

2. Go to `http://localhost:3000/register`
3. Select "Personal Account"
4. You should see working Google and Apple sign-in buttons

## Troubleshooting

### Common Issues:

1. **"400. That's an error"**: Google client ID is not properly configured
2. **"Invalid client"**: Client ID doesn't match the authorized origins
3. **"Access blocked"**: Domain not added to authorized origins
4. **Apple sign-in not working**: Service ID not properly configured

### Development vs Production:

- **Development**: Use `http://localhost:3000`
- **Production**: Use your actual domain (e.g., `https://yourdomain.com`)

### Security Notes:

- Never commit your `.env` files to version control
- Use different OAuth apps for development and production
- Regularly rotate your OAuth secrets
- Monitor OAuth usage in your Google/Apple developer consoles

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your OAuth configuration in Google/Apple consoles
3. Ensure your environment variables are set correctly
4. Check that your domains are properly configured

The OAuth buttons will show "Setup Required" until you configure the proper client IDs.


