const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../database/databaseAdapter');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const ImpersonationToken = require('../models/ImpersonationToken');
const { recordActivity } = require('../services/activityLogger');
const { normalizeEmail } = require('../utils/emailUtils');
const { propagateUserEmailChange } = require('../services/emailPropagationService');
const { acceptInviteForUser } = require('../services/inviteAcceptance');
const { resolveMemberApplicationSignup } = require('../utils/memberApplicationSignup');
const {
  isValidPhoneCountryCode,
  isValidProfilePhoneNumber,
  normalizePhoneCountryCode
} = require('../utils/phone');

const router = express.Router();

const PASSWORD_RESET_EXPIRY_HOURS = parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS || '1', 10);
const PASSWORD_MIN_LENGTH = 6;
const FORGOT_PASSWORD_SUCCESS_MESSAGE = 'If an account exists for that email, we sent a reset link. Check your inbox and spam folder.';

// Stricter rate limit for forgot-password (per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const normalizeInviteRecipient = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const ACTIVE_ROSTER_ENTRY_STATUSES = new Set(['approved', 'active']);
const REMOVED_MEMBER_STATUSES = new Set(['inactive', 'rejected', 'suspended', 'withdrawn']);

const getIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString ? value.toString() : '';
};

const isLeadRosterEntry = (entry, memberRecord) => {
  const rosterRole = String(entry?.role || '').toLowerCase();
  const memberRole = String(memberRecord?.role || '').toLowerCase();
  return (
    entry?.isCampLead === true ||
    entry?.isEventsLead === true ||
    rosterRole === 'lead' ||
    rosterRole === 'admin' ||
    memberRole === 'camp-lead' ||
    memberRole === 'camp_lead' ||
    memberRole === 'project-lead' ||
    memberRole === 'project_lead'
  );
};

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
  body('phoneCountryCode').optional().trim().custom((value) => value === '' || isValidPhoneCountryCode(value)).withMessage('Country code must be 1 to 4 digits'),
  body('phoneNumber').optional().trim().custom((value) => value === '' || isValidProfilePhoneNumber(value)).withMessage('Phone number must contain 7 to 20 digits'),
  body('campName').optional().trim(),
  body('inviteToken').optional().isString().trim(),
  body('signupIntent').optional().isIn(['member_application']),
  body('applicationCampIdentifier').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      accountType,
      firstName,
      lastName,
      phoneCountryCode,
      phoneNumber,
      campName,
      inviteToken,
      signupIntent,
      applicationCampIdentifier
    } = req.body;

    // Normalize email for consistency
    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await db.findUser({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    let effectiveAccountType = accountType;
    let effectiveRole = 'unassigned';
    let inviteContext = null;
    let isMemberApplicationSignup = false;

    // Invitation-based signup is always a member-style personal account.
    // Backend enforces this so role/accountType cannot be escalated by client payloads.
    //
    // We do a *pre-flight* invite validation here (before creating the user)
    // because the registration endpoint promises hard 400/403 responses on
    // bad/used/wrong-email invites — the user shouldn't end up with an
    // account they can't link. The actual linking work happens after user
    // creation via `acceptInviteForUser`, which is the same helper the
    // OAuth routes use; that keeps the two flows in lockstep.
    if (inviteToken) {
      const invite = await db.findInvite({ token: inviteToken });
      if (!invite) {
        return res.status(400).json({ message: 'Invitation link is invalid' });
      }
      const normalizedInviteRecipient = normalizeInviteRecipient(invite.recipient);
      if (invite.method === 'email' && normalizedInviteRecipient && normalizedInviteRecipient !== normalizedEmail) {
        return res.status(403).json({ message: 'This invitation was sent to a different email address' });
      }
      if (invite.invitedUserId || invite.status === 'applied' || invite.appliedBy || invite.appliedAt) {
        return res.status(400).json({ message: 'This invitation has already been used' });
      }

      const camp = await db.findCamp({ _id: invite.campId });
      if (!camp) {
        return res.status(400).json({ message: 'Camp not found for this invitation' });
      }

      effectiveAccountType = 'personal';
      effectiveRole = 'member';
    } else if (signupIntent === 'member_application') {
      const result = await resolveMemberApplicationSignup(db, signupIntent, applicationCampIdentifier);
      if (result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      isMemberApplicationSignup = result.isMemberApplicationSignup;
      effectiveAccountType = 'personal';
      effectiveRole = 'member';
    }

    // Validate required fields based on effective account type
    const normalizedPhoneCountryCode = normalizePhoneCountryCode(phoneCountryCode);
    const normalizedPhoneNumber = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';

    if (effectiveAccountType === 'personal' && (!firstName || !lastName)) {
      return res.status(400).json({ message: 'First name and last name required for personal accounts' });
    }

    if (effectiveAccountType === 'personal' && (!normalizedPhoneCountryCode || !normalizedPhoneNumber)) {
      return res.status(400).json({ message: 'Phone country code and phone number are required for personal accounts' });
    }

    if (effectiveAccountType === 'camp' && !campName) {
      return res.status(400).json({ message: 'Camp name required for camp accounts' });
    }

    // Create user data
    const userData = {
      email: normalizedEmail,
      password,
      accountType: effectiveAccountType,
      role: effectiveRole, // Invite signups are pre-assigned member role
      authProviders: ['password'] // Track that this user uses password authentication
    };

    if (effectiveAccountType === 'personal') {
      userData.firstName = firstName;
      userData.lastName = lastName;
      userData.phoneCountryCode = normalizedPhoneCountryCode;
      userData.phoneNumber = normalizedPhoneNumber;
    } else {
      userData.campName = campName;
    }

    // Create and save user
    // NOTE: Camp creation moved to onboarding flow for atomicity
    // Registration only creates the user account - onboarding will handle camp setup
    const user = await db.createUser(userData);

    // Persist invite/member onboarding tracking via the shared helper. This
    // is the same call OAuth (Google/Apple) makes after authenticating the
    // user, so all signup channels produce identical post-conditions:
    // Member.user gets linked, status flips to 'active', invite is marked
    // 'applied', and the camp-side activity log gets an ACCOUNT_CREATED
    // entry against the Member.
    if (inviteToken) {
      const result = await acceptInviteForUser({
        inviteToken,
        user,
        normalizedEmail,
        firstName,
        lastName,
        db,
        recordActivity
      });
      inviteContext = result.inviteContext;
    } else {
      // Fallback: if user signed up without token but had an invite email, start reminder tracking.
      const invites = await db.findInvites({ recipient: normalizedEmail });
      const openInvite = (invites || [])
        .filter((inv) => !inv.applicationCompletedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (openInvite) {
        await db.updateInviteById(openInvite._id, {
          invitedUserId: user._id,
          accountCreatedAt: openInvite.accountCreatedAt || new Date()
        });
      }
    }

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

    // Audit: account signup (logged against the User). The
    // member-entity-side audit (for SOR signups) is handled inside
    // acceptInviteForUser so it always fires from a single code path,
    // regardless of whether the signup came through password or OAuth.
    await recordActivity('MEMBER', user._id, user._id, 'ACCOUNT_CREATED', {
      field: 'account',
      newValue: effectiveAccountType,
      note: inviteContext
        ? 'User signed up via invitation link'
        : isMemberApplicationSignup
          ? 'User signed up via camp application link'
        : 'User signed up via email/password'
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userResponse,
      inviteContext,
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

    // Update last login by user id (not email) to avoid stale-email write bugs
    await db.updateUserById(user._id, { lastLogin: new Date() });

    // Audit: successful login
    await recordActivity('MEMBER', user._id, user._id, 'LOGIN_SUCCESS', {
      field: 'lastLogin',
      newValue: new Date().toISOString(),
      note: 'User logged in successfully'
    });

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
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const applyCutoffDateUtc = new Date(Date.UTC(currentYear, 8, 15, 0, 0, 0)); // Sep 15

    // Compute isSystemAdmin: User flag, accountType admin with no camp, OR Admin collection super-admin
    let isSystemAdmin = (user.accountType === 'admin' && !user.campId) || !!user.isSystemAdmin;
    if (!isSystemAdmin) {
      const Admin = require('../models/Admin');
      const adminRecord = await Admin.findOne({ user: user._id, isActive: true });
      if (adminRecord && adminRecord.role === 'super-admin') isSystemAdmin = true;
    }
    
    const delegatedCampAccess = {};
    let isRosterMember = false;
    let memberRecords = [];

    // Check if user has delegated camp access in any roster.
    // Camp Leads and Events Leads are personal/member accounts with scoped
    // camp permissions layered on top of their normal account.
    if (user.accountType === 'personal' || user.role === 'member' || user.role === 'camp_lead') {
      const Member = require('../models/Member');
      const Roster = require('../models/Roster');
      
      // CRITICAL FIX: Roster stores Member IDs, not User IDs.
      // A user can have more than one member record across camps, so resolve
      // all linked records before checking active roster entries.
      memberRecords = await Member.find({ user: user._id }).select('_id role status isShiftsOnly');
      
      if (memberRecords.length > 0) {
        console.log('🔍 [Auth /me] Found member records:', memberRecords.map((member) => member._id));
        
        const memberIds = memberRecords.map((member) => member._id);
        const memberById = new Map(memberRecords.map((member) => [member._id.toString(), member]));

        // Find all active rosters where this user has an approved roster entry.
        const rosters = await Roster.find({
          'members': {
            $elemMatch: {
              member: { $in: memberIds },
              $or: [
                { status: { $in: Array.from(ACTIVE_ROSTER_ENTRY_STATUSES) } },
                { status: { $exists: false } }
              ]
            }
          },
          isActive: true
        }).select('camp members _id').populate('camp', 'name slug _id');
        
        if (rosters && rosters.length > 0) {
          for (const roster of rosters) {
            const matchingEntry = roster.members?.find((entry) => {
              const entryMemberId = getIdString(entry?.member);
              const rosterStatus = String(entry?.status || 'approved').toLowerCase();
              return memberById.has(entryMemberId) && ACTIVE_ROSTER_ENTRY_STATUSES.has(rosterStatus);
            });

            if (!matchingEntry || !roster.camp) continue;

            const matchingMemberId = getIdString(matchingEntry.member);
            const matchingMember = memberById.get(matchingMemberId);
            const memberStatus = String(matchingMember?.status || '').toLowerCase();
            const hasRemovedMemberStatus = REMOVED_MEMBER_STATUSES.has(memberStatus);

            if (matchingEntry.isCampLead === true && !delegatedCampAccess.isCampLead) {
              console.log('✅ [Auth /me] User is Camp Lead for camp:', roster.camp.name);
              Object.assign(delegatedCampAccess, {
                isCampLead: true,
                campLeadCampId: roster.camp._id.toString(),
                campLeadCampSlug: roster.camp.slug,
                campLeadCampName: roster.camp.name
              });
            }

            if (matchingEntry.isEventsLead === true && !delegatedCampAccess.isEventsLead) {
              console.log('✅ [Auth /me] User is Events Lead for camp:', roster.camp.name);
              Object.assign(delegatedCampAccess, {
                isEventsLead: true,
                eventsLeadCampId: roster.camp._id.toString(),
                eventsLeadCampSlug: roster.camp.slug,
                eventsLeadCampName: roster.camp.name
              });
            }

            if (!hasRemovedMemberStatus && !isLeadRosterEntry(matchingEntry, matchingMember)) {
              isRosterMember = true;
            }
          }
        } else {
          console.log('ℹ️ [Auth /me] Member found but no active roster access');
        }
      } else {
        console.log('ℹ️ [Auth /me] No member record found for user');
      }
    }
    
    // Enrich personal accounts with shifts-only membership flags.
    let isShiftsOnlyMember = false;
    if (user.accountType === 'personal') {
      const Member = require('../models/Member');
      const shiftsOnlyStatuses = ['roster_only', 'invited', 'active'];
      isShiftsOnlyMember = memberRecords.some((member) => {
        const status = String(member.status || '').toLowerCase();
        return member.isShiftsOnly === true && shiftsOnlyStatuses.includes(status);
      });

      if (!isShiftsOnlyMember) {
        const shiftsOnlyMember = await Member.findOne({
          user: user._id,
          isShiftsOnly: true,
          status: { $in: shiftsOnlyStatuses }
        }).select('_id status isShiftsOnly');
        isShiftsOnlyMember = !!shiftsOnlyMember;
      }
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    res.json({
      user: {
        ...userObj,
        ...delegatedCampAccess,
        isSystemAdmin,
        isRosterMember,
        isShiftsOnlyMember,
        canApplyToCampsNow: !isShiftsOnlyMember || now >= applyCutoffDateUtc
      }
    });
  } catch (error) {
    console.error('❌ [Auth /me] Error fetching Camp Lead status:', error);
    const user = req.user;
    const userObj = user?.toObject ? user.toObject() : (user ? { ...user } : {});
    let fallbackSystemAdmin = user && ((user.accountType === 'admin' && !user.campId) || !!user.isSystemAdmin);
    if (user && !fallbackSystemAdmin) {
      try {
        const Admin = require('../models/Admin');
        const adminRecord = await Admin.findOne({ user: user._id, isActive: true });
        fallbackSystemAdmin = !!(adminRecord && adminRecord.role === 'super-admin');
      } catch (e) {
        // ignore
      }
    }
    res.json({
      user: user ? { ...userObj, isSystemAdmin: fallbackSystemAdmin } : null
    });
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
// @desc    Request password reset (sends email with link; rate limited)
// @access  Public
router.post('/forgot-password', forgotPasswordLimiter, [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select('_id email firstName authProviders');
    if (!user) {
      return res.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
    }

    if (!user.authProviders || !user.authProviders.includes('password')) {
      return res.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 12);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashedToken,
      passwordResetTokenExpiry: expiresAt
    });

    const baseUrl = process.env.CLIENT_URL || 'https://www.g8road.com';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await sendPasswordResetEmail(
      { email: user.email, firstName: user.firstName },
      resetUrl,
      PASSWORD_RESET_EXPIRY_HOURS
    );

    // Audit: password reset requested
    await recordActivity('MEMBER', user._id, user._id, 'PASSWORD_RESET_REQUESTED', {
      field: 'passwordReset',
      action: 'requested',
      note: 'Password reset email requested'
    });

    res.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token (single-use, expiry enforced)
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    const candidates = await User.find({
      passwordResetToken: { $ne: null },
      passwordResetTokenExpiry: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetTokenExpiry _id');

    let userDoc = null;
    for (const u of candidates) {
      const match = await bcrypt.compare(token, u.passwordResetToken);
      if (match) {
        userDoc = await User.findById(u._id);
        break;
      }
    }

    if (!userDoc) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Request a new password reset.' });
    }

    userDoc.password = newPassword;
    userDoc.passwordResetToken = undefined;
    userDoc.passwordResetTokenExpiry = undefined;
    await userDoc.save();

    // Audit: password reset completed
    await recordActivity('MEMBER', userDoc._id, userDoc._id, 'PASSWORD_RESET_COMPLETED', {
      field: 'passwordReset',
      action: 'completed',
      note: 'Password reset completed using reset token'
    });

    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error.message);
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
    await db.updateUserById(user._id, { password: hashedPassword });

    // Audit: password changed while authenticated
    await recordActivity('MEMBER', user._id, req.user._id, 'PASSWORD_CHANGED', {
      field: 'password',
      note: 'Password changed from authenticated session'
    });

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/update-credentials
// @desc    Update user login credentials (email and/or password) - Camp-affiliated accounts
// @access  Private
router.put('/update-credentials', authenticateToken, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array() 
      });
    }

    const { email, currentPassword, newPassword } = req.body;

    // Get user from database
    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Allow camp-affiliated accounts (camp accounts or admin accounts tied to a camp)
    const isCampAffiliatedAccount = user.accountType === 'camp' || (user.accountType === 'admin' && !!user.campId);
    if (!isCampAffiliatedAccount) {
      return res.status(403).json({ 
        success: false,
        message: 'This endpoint is only available for camp-affiliated accounts' 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Check if email is already taken by another user
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail !== normalizeEmail(user.email)) {
      const existingUser = await db.findUser({ email: normalizedEmail });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ 
          success: false,
          message: 'Email address is already registered to another account' 
        });
      }
    }

    // Prepare update payload
    const updatePayload = {
      email: normalizedEmail
    };

    // Hash new password if provided
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      updatePayload.password = hashedPassword;
    }

    // Update user credentials in database (by id, never by email)
    const updatedUser = await db.updateUserById(user._id, updatePayload);
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to persist credential update'
      });
    }

    if (normalizedEmail !== normalizeEmail(user.email)) {
      const propagation = await propagateUserEmailChange({ userId: user._id, newEmail: normalizedEmail });
      if (propagation.errors.length > 0) {
        console.warn('⚠️ [AUTH] Email propagation completed with warnings:', propagation.errors);
      }
    }

    // Audit: credentials updated
    await recordActivity('MEMBER', user._id, req.user._id, 'CREDENTIALS_UPDATED', {
      field: 'credentials',
      emailChanged: normalizedEmail !== normalizeEmail(user.email),
      passwordChanged: !!newPassword,
      note: 'Login credentials updated'
    });

    console.log(`✅ [AUTH] User ${user._id} updated login credentials. Email: ${normalizedEmail !== normalizeEmail(user.email) ? 'changed' : 'same'}, Password: ${newPassword ? 'changed' : 'same'}`);

    res.json({ 
      success: true,
      message: 'Login credentials updated successfully',
      data: {
        email: normalizedEmail,
        emailChanged: normalizedEmail !== normalizeEmail(user.email)
      }
    });

  } catch (error) {
    console.error('Update credentials error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating credentials' 
    });
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
