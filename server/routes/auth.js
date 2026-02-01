const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');
const ImpersonationToken = require('../models/ImpersonationToken');
const { recordActivity } = require('../services/activityLogger');
const { normalizeEmail } = require('../utils/emailUtils');

const router = express.Router();

// Generate JWT token with rich claims
const generateToken = (user) => {
  // Support both user object and userId for backward compatibility
  const userId = user._id || user;
  const payload = {
    userId: userId.toString(),
    // Include additional claims for better performance (reduces DB lookups)
    accountType: user.accountType || undefined,
    role: user.role || undefined,
    campId: user.campId ? user.campId.toString() : undefined,
    email: user.email || undefined
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
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

    // Normalize email for consistency
    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await db.findUser({ email: normalizedEmail });
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
      email: normalizedEmail,
      password,
      accountType,
      role: 'unassigned', // New users start with unassigned role
      authProviders: ['password'] // Track that this user uses password authentication
    };

    if (accountType === 'personal') {
      userData.firstName = firstName;
      userData.lastName = lastName;
    } else {
      userData.campName = campName;
    }

    // Create and save user
    // NOTE: Camp creation moved to onboarding flow for atomicity
    // Registration only creates the user account - onboarding will handle camp setup
    const user = await db.createUser(userData);

    // Generate token with user context
    const token = generateToken(user);

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

    // Normalize email for consistency
    const normalizedEmail = normalizeEmail(email);

    // Find user in database
    const user = await db.findUser({ email: normalizedEmail });
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
    await db.updateUser(normalizedEmail, { lastLogin: new Date() });

    // Generate token with user context
    const token = generateToken(user);

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
// @desc    Get current user (with Camp Lead status if applicable)
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is a Camp Lead in any roster
    // Camp Leads are personal/member accounts with delegated admin permissions
    if (user.accountType === 'personal' || user.role === 'member' || user.role === 'camp_lead') {
      const Member = require('../models/Member');
      const Roster = require('../models/Roster');
      
      // CRITICAL FIX: Roster stores Member IDs, not User IDs
      // Need to find the Member record first, then query roster
      const member = await Member.findOne({ user: user._id });
      
      if (member) {
        console.log('🔍 [Auth /me] Found member record:', member._id);
        
        // Find all active rosters where this MEMBER is a Camp Lead
        const rosters = await Roster.find({
          'members': {
            $elemMatch: {
              member: member._id, // ← FIXED: Use member._id, not user._id
              isCampLead: true,
              status: 'approved'
            }
          },
          isActive: true
        }).select('camp _id').populate('camp', 'name slug _id');
        
        if (rosters && rosters.length > 0) {
          // User is Camp Lead! Return first camp
          // Note: Users can only be Camp Lead in ONE camp at a time
          const campLeadCamp = rosters[0].camp;
          
          console.log('✅ [Auth /me] User is Camp Lead for camp:', campLeadCamp.name);
          
          return res.json({
            user: {
              ...(user.toObject ? user.toObject() : user),
              isCampLead: true,
              campLeadCampId: campLeadCamp._id.toString(),
              campLeadCampSlug: campLeadCamp.slug,
              campLeadCampName: campLeadCamp.name
            }
          });
        } else {
          console.log('ℹ️ [Auth /me] Member found but not a Camp Lead');
        }
      } else {
        console.log('ℹ️ [Auth /me] No member record found for user');
      }
    }
    
    // Not a Camp Lead, return normal user data
    res.json({ user: req.user });
  } catch (error) {
    console.error('❌ [Auth /me] Error fetching Camp Lead status:', error);
    // Fallback to basic user data if query fails
    res.json({ user: req.user });
  }
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

    // Normalize email for consistency
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
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

// @route   GET /api/auth/impersonate
// @desc    Impersonate a user using a one-time token
// @access  Public (token-based)
router.get('/impersonate', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Impersonation token required' });
    }

    // Find and validate token
    const impersonationToken = await ImpersonationToken.findOne({ token });
    
    if (!impersonationToken) {
      return res.status(400).json({ message: 'Invalid impersonation token' });
    }

    // Check if token has been used
    if (impersonationToken.used) {
      return res.status(400).json({ message: 'Impersonation token has already been used' });
    }

    // Check if token has expired
    if (new Date() > impersonationToken.expiresAt) {
      return res.status(400).json({ message: 'Impersonation token has expired' });
    }

    // Find target user
    const targetUser = await db.findUser({ _id: impersonationToken.targetUserId });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check if target user is active
    if (!targetUser.isActive) {
      return res.status(400).json({ message: 'Cannot impersonate deactivated user' });
    }

    // Mark token as used
    impersonationToken.used = true;
    impersonationToken.usedAt = new Date();
    await impersonationToken.save();

    // Generate JWT token for the target user
    const userToken = generateToken(targetUser);

    // Log successful impersonation based on account type
    if (targetUser.accountType === 'camp') {
      // For camp accounts, log for CAMP entity
      const campId = targetUser.campId || targetUser._id;
      await recordActivity('CAMP', campId, impersonationToken.adminId, 'ADMIN_IMPERSONATION', {
        field: 'impersonation',
        action: 'impersonation_completed',
        adminId: impersonationToken.adminId,
        targetUserId: targetUser._id,
        targetUserName: targetUser.campName || `${targetUser.firstName} ${targetUser.lastName}` || 'Camp Account',
        targetUserEmail: targetUser.email,
        accountType: 'camp',
        timestamp: new Date()
      });
      console.log(`✅ [Impersonation] Completed for CAMP entity: ${campId}`);
    } else {
      // For personal/member accounts, log for MEMBER entity
      await recordActivity('MEMBER', targetUser._id, impersonationToken.adminId, 'ADMIN_IMPERSONATION', {
        field: 'impersonation',
        action: 'impersonation_completed',
        adminId: impersonationToken.adminId,
        targetUserId: targetUser._id,
        targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
        targetUserEmail: targetUser.email,
        accountType: targetUser.accountType,
        timestamp: new Date()
      });
      console.log(`✅ [Impersonation] Completed for MEMBER entity: ${targetUser._id}`);
    }

    console.log(`✅ [Impersonation] User ${targetUser.email} impersonated successfully`);

    // Redirect to appropriate dashboard based on account type
    const clientUrl = process.env.CLIENT_URL || 'https://www.g8road.com';
    let redirectUrl = `${clientUrl}/dashboard`;

    if (targetUser.accountType === 'camp' || (targetUser.accountType === 'admin' && targetUser.campId)) {
      const campId = targetUser.campId?.toString() || targetUser._id?.toString() || '';
      redirectUrl = campId ? `${clientUrl}/camp/${campId}/dashboard` : `${clientUrl}/dashboard`;
    } else if (targetUser.accountType === 'personal') {
      redirectUrl = `${clientUrl}/dashboard`;
    }

    // Return HTML page that sets token and redirects
    // This allows the token to be set in localStorage and then redirect
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Logging in...</title>
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
      </head>
      <body>
        <script>
          // Store token in localStorage
          localStorage.setItem('token', '${userToken}');
          // Redirect to dashboard
          window.location.href = '${redirectUrl}';
        </script>
        <p>Logging in... <a href="${redirectUrl}">Click here if you are not redirected</a></p>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
