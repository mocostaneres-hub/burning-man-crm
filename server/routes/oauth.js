const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// ============================================================================
// GOOGLE OAUTH IMPLEMENTATION (Mobile-Compatible)
// ============================================================================
// 
// This implementation uses Google ID token verification, which works for:
// - Web: Google Identity Services (JavaScript library)
// - iOS: Google Sign-In SDK (will call this same endpoint with ID token)
// - Android: Google Sign-In SDK (will call this same endpoint with ID token)
//
// Key Design Decisions for Mobile Compatibility:
// 1. ID Token Verification: We verify Google's ID token server-side (secure, works for all platforms)
// 2. Single Backend Endpoint: Web and mobile apps use the same /api/oauth/google endpoint
// 3. JWT Session Tokens: Our own JWT tokens work across web and mobile
// 4. No Platform-Specific Code: Backend doesn't care if request comes from web or mobile
//
// Common Failure Points:
// - Invalid ID token (expired, wrong audience, tampered)
// - Missing GOOGLE_CLIENT_ID environment variable
// - Network issues during token verification
// - User email already registered as camp account
// ============================================================================

const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client for ID token verification
// This client ID must match the one used by the frontend/mobile app
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  console.log('✅ [OAuth] Google OAuth client initialized');
  console.log('✅ [OAuth] GOOGLE_CLIENT_ID is configured');
} else {
  console.warn('⚠️ [OAuth] GOOGLE_CLIENT_ID not set - Google OAuth will be disabled');
  console.warn('⚠️ [OAuth] To enable Google OAuth:');
  console.warn('   1. Get your Client ID from https://console.cloud.google.com/apis/credentials');
  console.warn('   2. Add GOOGLE_CLIENT_ID=your-client-id to environment variables');
  console.warn('   3. Restart the server');
}

/**
 * Verify Google ID token and extract user information
 * This function works for tokens from web, iOS, and Android apps
 * 
 * @param {string} idToken - Google ID token from client
 * @returns {Promise<{email: string, name: string, picture: string, googleId: string}>}
 */
async function verifyGoogleIdToken(idToken) {
  if (!googleClient) {
    throw new Error('Google OAuth not configured');
  }

  try {
    // Verify the ID token
    // This checks: signature, expiration, audience (client ID), issuer
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, // Must match the client ID
    });

    // Extract user information from the verified token
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    return {
      email: payload.email,
      name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
      picture: payload.picture || '',
      googleId: payload.sub, // Google's unique user ID
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    console.error('❌ [OAuth] Google ID token verification failed:', error.message);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('audience')) {
      throw new Error('Token audience mismatch - check GOOGLE_CLIENT_ID configuration');
    } else if (error.message.includes('expired')) {
      throw new Error('Token has expired - please sign in again');
    } else if (error.message.includes('signature')) {
      throw new Error('Invalid token signature - token may be tampered');
    }
    
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

// @route   POST /api/oauth/google
// @desc    Handle Google OAuth authentication (web + mobile compatible)
// @access  Public
// 
// This endpoint accepts a Google ID token, verifies it server-side, and:
// - Creates a new user account if email doesn't exist
// - Links Google account to existing user if email exists
// - Returns JWT token for session management
//
// Request body: { idToken: string }
// Response: { token: string, user: User, isNewUser: boolean }
router.post('/google', [
  body('idToken').notEmpty().withMessage('ID token is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { idToken } = req.body;

    // Verify Google ID token (works for web, iOS, Android)
    const googleUser = await verifyGoogleIdToken(idToken);

    if (!googleUser.email) {
      return res.status(400).json({ 
        message: 'Email not provided by Google account' 
      });
    }

    // ============================================================================
    // CRITICAL: OAuth Provider Linking and Account Identity
    // ============================================================================
    // OAuth (Google, Apple, etc.) is an AUTHENTICATION method, not an authorization method.
    // 
    // Authentication: Verifying WHO the user is (identity)
    // Authorization: Verifying WHAT the user can do (permissions)
    // 
    // WHY OAuth providers must be linkable:
    // 1. Users may sign up with email/password, then want to use Google login
    // 2. Email is the primary identity - one email = one account
    // 3. Multiple auth methods can be linked to the same account
    // 4. User convenience: sign in with email/password OR Google OR Apple
    // 
    // WHY we allow OAuth for ALL account types:
    // 1. A camp admin should be able to sign in with Google just like a member
    // 2. Account type affects WHAT they can access, not HOW they authenticate
    // 3. Blocking OAuth by account type creates poor UX and security issues
    // 4. Mobile apps (iOS/Android) will use OAuth - must work for all users
    // 
    // WHERE account type matters:
    // - After authentication: redirect to correct dashboard
    // - During API requests: check permissions for actions
    // - NOT during authentication itself
    //
    // CRITICAL LOOKUP ORDER to prevent duplicate accounts:
    // 1. First try googleId (for returning OAuth users)
    // 2. Then try email (to link OAuth to existing email/password users)
    // 3. Only create new user if neither exists
    // ============================================================================
    
    console.log('🔍 [OAuth] Looking up user by googleId:', googleUser.googleId);
    let user = await db.findUser({ googleId: googleUser.googleId });
    let isNewUser = false;
    let isLinkingOAuth = false;
    
    if (user) {
      // Returning OAuth user - update last login
      console.log(`✅ [OAuth] Returning Google user found: ${googleUser.email} (accountType: ${user.accountType})`);
      await db.updateUser(user.email, { lastLogin: new Date() });
      user.lastLogin = new Date();
    } else {
      // Not found by googleId, try email (to link OAuth to existing account)
      console.log('🔍 [OAuth] User not found by googleId, trying email:', googleUser.email);
      user = await db.findUser({ email: googleUser.email });
      
      if (user) {
        // Existing email/password user - link Google account
        isLinkingOAuth = true;
        console.log(`🔗 [OAuth] Linking Google account to existing user: ${googleUser.email} (accountType: ${user.accountType})`);
        console.log(`🔗 [OAuth] User currently has these auth providers: ${user.authProviders || ['password (default)']}`);
        
        // CRITICAL: Use $set to update specific fields without triggering slug regeneration
        // Never pass firstName/lastName in updates to existing users from OAuth
        const updateFields = {
          googleId: googleUser.googleId,
          lastLogin: new Date(),
          $addToSet: { authProviders: 'google' } // Add 'google' to authProviders array if not present
        };
        
        // Only update profile photo if user doesn't have one
        if (!user.profilePhoto && googleUser.picture) {
          updateFields.profilePhoto = googleUser.picture;
        }
        
        await db.updateUserById(user._id, updateFields);
        
        // Refresh user object with updated data
        user = await db.findUserById(user._id);
        console.log(`✅ [OAuth] Successfully linked Google account. Updated auth providers: ${user.authProviders}`);
      }
    }
    
    if (!user) {
      // Create new personal account
      // Note: New OAuth users always start as "personal" accounts
      // They can be promoted to other roles/types later through proper channels
      isNewUser = true;
      console.log(`✨ [OAuth] Creating new user: ${googleUser.email}`);
      
      const [firstName, ...lastNameParts] = (googleUser.name || '').split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      user = await db.createUser({
        email: googleUser.email,
        password: crypto.randomUUID(), // Random password (not used for OAuth users, but required by schema)
        accountType: 'personal',
        firstName: firstName || '',
        lastName: lastName || '',
        googleId: googleUser.googleId,
        profilePhoto: googleUser.picture || '',
        lastLogin: new Date(),
        role: 'unassigned', // New OAuth users start with unassigned role
        isVerified: googleUser.emailVerified || false,
        authProviders: ['google'] // Track that this user uses Google OAuth
      });
      
      console.log(`✅ [OAuth] Created new user with ID: ${user._id}, slug: ${user.urlSlug || 'none'}`);
    }

    // Generate our own JWT token for session management
    // This token works across web and mobile platforms
    const token = generateToken(user._id);

    // Return user data (without sensitive info)
    const userResponse = { ...user };
    delete userResponse.password;

    // Send welcome email for new users (non-blocking)
    if (isNewUser) {
      sendWelcomeEmail(userResponse)
        .then(() => {
          console.log('✅ [OAuth] Welcome email sent to:', userResponse.email);
        })
        .catch((emailError) => {
          // Log but don't fail OAuth if email fails
          console.error('⚠️ [OAuth] Failed to send welcome email:', emailError);
        });
    }

    const authAction = isNewUser ? 'new user created' : (isLinkingOAuth ? 'Google linked to existing account' : 'returning OAuth user');
    console.log(`✅ [OAuth] Google authentication successful (${authAction}): ${googleUser.email}`);
    console.log(`✅ [OAuth] User details: accountType=${userResponse.accountType}, authProviders=${userResponse.authProviders || 'not set'}`);
    console.log('✅ [OAuth] Sending response with token (length:', token?.length, ') and user (email:', userResponse.email, ')');

    const responsePayload = {
      message: 'Google authentication successful',
      token,
      user: userResponse,
      isNewUser
    };
    
    console.log('✅ [OAuth] Response payload structure:', {
      hasMessage: !!responsePayload.message,
      hasToken: !!responsePayload.token,
      hasUser: !!responsePayload.user,
      isNewUser: responsePayload.isNewUser,
      userEmail: responsePayload.user?.email
    });

    res.json(responsePayload);

  } catch (error) {
    console.error('❌ [OAuth] Google authentication error:', error);
    
    // Provide helpful error messages
    if (error.message.includes('not configured')) {
      return res.status(503).json({ 
        message: 'Google authentication is not configured on the server' 
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Server error during Google authentication',
      ...(process.env.NODE_ENV === 'development' && { error: error.stack })
    });
  }
});

// @route   POST /api/oauth/apple
// @desc    Handle Apple OAuth authentication (account-type agnostic)
// @access  Public
router.post('/apple', [
  body('email').isEmail().normalizeEmail(),
  body('name').optional().trim(),
  body('appleId').notEmpty(),
  body('profilePicture').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, appleId, profilePicture } = req.body;

    // OAuth must be account-type agnostic and support account linking
    // (see Google OAuth handler for comprehensive explanation)
    
    console.log('🔍 [OAuth] Looking up user by appleId:', appleId);
    let user = await db.findUser({ appleId });
    let isNewUser = false;
    let isLinkingOAuth = false;
    
    if (user) {
      // Returning OAuth user - update last login
      console.log(`✅ [OAuth] Returning Apple user found: ${email} (accountType: ${user.accountType})`);
      await db.updateUser(user.email, { lastLogin: new Date() });
      user.lastLogin = new Date();
    } else {
      // Not found by appleId, try email (to link OAuth to existing account)
      console.log('🔍 [OAuth] User not found by appleId, trying email:', email);
      user = await db.findUser({ email });
      
      if (user) {
        // Existing email/password user - link Apple account
        isLinkingOAuth = true;
        console.log(`🔗 [OAuth] Linking Apple account to existing user: ${email} (accountType: ${user.accountType})`);
        console.log(`🔗 [OAuth] User currently has these auth providers: ${user.authProviders || ['password (default)']}`);
        
        // CRITICAL: Use $set to update specific fields without triggering slug regeneration
        const updateFields = {
          appleId,
          lastLogin: new Date(),
          $addToSet: { authProviders: 'apple' } // Add 'apple' to authProviders array if not present
        };
        
        // Only update profile photo if user doesn't have one
        if (!user.profilePhoto && profilePicture) {
          updateFields.profilePhoto = profilePicture;
        }
        
        await db.updateUserById(user._id, updateFields);
        
        // Refresh user object with updated data
        user = await db.findUserById(user._id);
        console.log(`✅ [OAuth] Successfully linked Apple account. Updated auth providers: ${user.authProviders}`);
      }
    }
    
    if (!user) {
      // Create new personal account
      // Note: New OAuth users always start as "personal" accounts
      isNewUser = true;
      console.log(`✨ [OAuth] Creating new user: ${email}`);
      
      const [firstName, ...lastNameParts] = (name || '').split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      user = await db.createUser({
        email,
        password: crypto.randomUUID(), // Random password (not used for OAuth users, but required by schema)
        accountType: 'personal',
        firstName: firstName || '',
        lastName: lastName || '',
        appleId,
        profilePhoto: profilePicture || '',
        lastLogin: new Date(),
        role: 'unassigned', // New OAuth users start with unassigned role
        authProviders: ['apple'] // Track that this user uses Apple OAuth
      });
      
      console.log(`✅ [OAuth] Created new user with ID: ${user._id}, slug: ${user.urlSlug || 'none'}`);
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without sensitive info)
    const userResponse = { ...user };
    delete userResponse.password;

    // Send welcome email for new users (non-blocking)
    if (isNewUser) {
      sendWelcomeEmail(userResponse)
        .then(() => {
          console.log('✅ [OAuth] Welcome email sent to:', userResponse.email);
        })
        .catch((emailError) => {
          // Log but don't fail OAuth if email fails
          console.error('⚠️ [OAuth] Failed to send welcome email:', emailError);
        });
    }

    const authAction = isNewUser ? 'new user created' : (isLinkingOAuth ? 'Apple linked to existing account' : 'returning OAuth user');
    console.log(`✅ [OAuth] Apple authentication successful (${authAction}): ${email}`);
    console.log(`✅ [OAuth] User details: accountType=${userResponse.accountType}, authProviders=${userResponse.authProviders || 'not set'}`);

    res.json({
      message: 'Apple OAuth successful',
      token,
      user: userResponse,
      isNewUser
    });

  } catch (error) {
    console.error('Apple OAuth error:', error);
    res.status(500).json({ message: 'Server error during Apple OAuth' });
  }
});

// @route   GET /api/oauth/config
// @desc    Get OAuth configuration for frontend
// @access  Public
// 
// Returns OAuth client IDs for frontend initialization
// Mobile apps will use their own client IDs from Google Cloud Console
router.get('/config', (req, res) => {
  // Debug logging to diagnose production issues
  console.log('🔍 [OAuth Config] Checking environment variables...');
  console.log('🔍 [OAuth Config] GOOGLE_CLIENT_ID present:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('🔍 [OAuth Config] GOOGLE_CLIENT_ID length:', process.env.GOOGLE_CLIENT_ID?.length || 0);
  console.log('🔍 [OAuth Config] APPLE_CLIENT_ID present:', !!process.env.APPLE_CLIENT_ID);
  
  // Log first/last few characters for verification (never log full credentials)
  if (process.env.GOOGLE_CLIENT_ID) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const preview = `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 20)}`;
    console.log('🔍 [OAuth Config] GOOGLE_CLIENT_ID preview:', preview);
  } else {
    console.warn('⚠️ [OAuth Config] GOOGLE_CLIENT_ID is not set in environment');
    console.warn('⚠️ [OAuth Config] Google OAuth will be DISABLED');
    console.warn('⚠️ [OAuth Config] Set GOOGLE_CLIENT_ID in Railway/Vercel environment variables');
  }
  
  const config = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      enabled: !!process.env.GOOGLE_CLIENT_ID
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || null,
      enabled: !!process.env.APPLE_CLIENT_ID
    }
  };
  
  console.log('✅ [OAuth Config] Sending config:', {
    google: { enabled: config.google.enabled, clientIdPresent: !!config.google.clientId },
    apple: { enabled: config.apple.enabled, clientIdPresent: !!config.apple.clientId }
  });
  
  res.json(config);
});

module.exports = router;
