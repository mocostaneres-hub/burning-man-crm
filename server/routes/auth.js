const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user (personal or camp account)
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('accountType').isIn(['personal', 'camp']),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('campName').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, accountType, firstName, lastName, campName } = req.body;

    // Check if user already exists
    const existingUser = await db.findUser({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Validate required fields based on account type
    if (accountType === 'personal' && (!firstName || !lastName)) {
      return res.status(400).json({ message: 'First name and last name required for personal accounts' });
    }

    if (accountType === 'camp' && !campName) {
      return res.status(400).json({ message: 'Camp name required for camp accounts' });
    }

    // Create user data
    const userData = {
      email,
      password,
      accountType,
      role: 'unassigned' // New users start with unassigned role
    };

    if (accountType === 'personal') {
      userData.firstName = firstName;
      userData.lastName = lastName;
    } else {
      userData.campName = campName;
    }

    // Create and save user
    const user = await db.createUser(userData);

    // For camp accounts, create the camp record immediately
    if (accountType === 'camp') {
      try {
        // Generate slug from camp name
        const slug = campName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Create camp data
        const campData = {
          owner: user._id,
          name: campName,
          slug: slug,
          description: `Welcome to ${campName}! We're excited to share our camp experience with you.`,
          contactEmail: email,
          status: 'active',
          isRecruiting: true,
          isPublic: true,
          acceptingNewMembers: true,
          showApplyNow: true,
          showMemberCount: true
        };

        // Create camp record
        const camp = await db.createCamp(campData);

        // Update user with campId and urlSlug
        await db.updateUserById(user._id, { 
          campId: camp._id,
          urlSlug: slug 
        });

        // Update user object for response
        user.campId = camp._id;
        user.urlSlug = slug;
      } catch (campError) {
        console.error('Camp creation error during registration:', campError);
        // If camp creation fails, we should still allow user registration
        // The camp can be created later when they edit their profile
      }
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    // Convert Mongoose document to plain object if needed
    const userResponse = user.toObject ? user.toObject() : { ...user };
    delete userResponse.password;

    // Debug logging
    console.log('🔍 [Auth] Registration successful');
    console.log('🔍 [Auth] User accountType:', userResponse.accountType);
    console.log('🔍 [Auth] User campId:', userResponse.campId);
    console.log('🔍 [Auth] Full user response:', JSON.stringify(userResponse, null, 2));

    // Send welcome email (non-blocking, don't await)
    sendWelcomeEmail(userResponse)
      .then(() => {
        console.log('✅ [Auth] Welcome email sent to:', userResponse.email);
      })
      .catch((emailError) => {
        // Log but don't fail registration if email fails
        console.error('⚠️ [Auth] Failed to send welcome email:', emailError);
      });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userResponse,
      isNewAccount: true // Flag to indicate this is a new account
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user in database
    const user = await db.findUser({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    // Check password
    const isPasswordValid = await db.comparePassword(user, password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // For camp accounts without urlSlug, generate and save it
    if (user.accountType === 'camp' && !user.urlSlug && user.campName) {
      const slug = user.campName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      await db.updateUserById(user._id, { urlSlug: slug });
      user.urlSlug = slug;
    }

    // For admin accounts with campId, fetch the camp's slug and set it
    if (user.accountType === 'admin' && user.campId && !user.urlSlug) {
      try {
        const camp = await db.findCamp({ _id: user.campId });
        if (camp && camp.slug) {
          await db.updateUserById(user._id, { urlSlug: camp.slug });
          user.urlSlug = camp.slug;
        }
      } catch (error) {
        console.error('Error fetching camp slug for admin:', error);
      }
    }

    // Update last login
    await db.updateUser(email, { lastLogin: new Date() });

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    // Convert Mongoose document to plain object if needed
    const userResponse = user.toObject ? user.toObject() : { ...user };
    delete userResponse.password;

    // Check if this is a first login for camp account (no lastLogin means first time)
    const isFirstLogin = !user.lastLogin && user.accountType === 'camp';

    res.json({
      message: 'Login successful',
      token,
      user: userResponse,
      isFirstLogin // Flag to indicate if this is the first login
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', (req, res) => {
  res.json({ message: 'Token refresh not implemented in demo mode' });
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({ message: 'If email exists, reset instructions sent' });
    }

    // TODO: Implement email sending for password reset
    // For now, just return success
    res.json({ message: 'If email exists, reset instructions sent' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // TODO: Implement password reset with token verification
    // For now, return not implemented
    res.status(501).json({ message: 'Password reset not yet implemented' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user from database
    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await db.updateUser(user._id, { password: hashedPassword });

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
