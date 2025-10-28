const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/oauth/google
// @desc    Handle Google OAuth for personal accounts only
// @access  Public
router.post('/google', [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().notEmpty(),
  body('googleId').notEmpty(),
  body('profilePicture').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, googleId, profilePicture } = req.body;

    // Check if user already exists
    let user = await db.findUser({ email });
    
    if (user) {
      // User exists, check if it's a personal account
      if (user.accountType !== 'personal') {
        return res.status(400).json({ 
          message: 'OAuth is only available for personal accounts. This email is registered as a camp account.' 
        });
      }
      
      // Update user with Google info if not already linked
      if (!user.googleId) {
        await db.updateUser(email, {
          googleId,
          profilePhoto: profilePicture,
          lastLogin: new Date()
        });
        user.googleId = googleId;
        user.profilePhoto = profilePicture;
        user.lastLogin = new Date();
      }
    } else {
      // Create new personal account
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      user = await db.createUser({
        email,
        password: 'oauth-user', // Will be hashed, but not used for OAuth users
        accountType: 'personal',
        firstName: firstName || '',
        lastName: lastName || '',
        googleId,
        profilePhoto: profilePicture || '',
        lastLogin: new Date(),
        role: 'unassigned' // New OAuth users start with unassigned role
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without sensitive info)
    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      message: 'Google OAuth successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ message: 'Server error during Google OAuth' });
  }
});

// @route   POST /api/oauth/apple
// @desc    Handle Apple OAuth for personal accounts only
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

    // Check if user already exists
    let user = await db.findUser({ email });
    
    if (user) {
      // User exists, check if it's a personal account
      if (user.accountType !== 'personal') {
        return res.status(400).json({ 
          message: 'OAuth is only available for personal accounts. This email is registered as a camp account.' 
        });
      }
      
      // Update user with Apple info if not already linked
      if (!user.appleId) {
        await db.updateUser(email, {
          appleId,
          profilePhoto: profilePicture,
          lastLogin: new Date()
        });
        user.appleId = appleId;
        user.profilePhoto = profilePicture;
        user.lastLogin = new Date();
      }
    } else {
      // Create new personal account
      const [firstName, ...lastNameParts] = (name || '').split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      user = await db.createUser({
        email,
        password: 'oauth-user', // Will be hashed, but not used for OAuth users
        accountType: 'personal',
        firstName: firstName || '',
        lastName: lastName || '',
        appleId,
        profilePhoto: profilePicture || '',
        lastLogin: new Date(),
        role: 'unassigned' // New OAuth users start with unassigned role
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without sensitive info)
    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      message: 'Apple OAuth successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Apple OAuth error:', error);
    res.status(500).json({ message: 'Server error during Apple OAuth' });
  }
});

// @route   GET /api/oauth/config
// @desc    Get OAuth configuration for frontend
// @access  Public
router.get('/config', (req, res) => {
  res.json({
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      enabled: !!process.env.GOOGLE_CLIENT_ID
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || null,
      enabled: !!process.env.APPLE_CLIENT_ID
    }
  });
});

module.exports = router;
