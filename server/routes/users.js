const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove password from response
    const userResponse = { ...user };
    delete userResponse.password;
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phoneNumber').optional().trim().isLength({ min: 10, max: 20 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('yearsBurned').optional().isInt({ min: 0, max: 50 }),
  body('previousCamps').optional().trim().isLength({ max: 1000 }),
  body('bio').optional().trim().isLength({ max: 1000 }),
  body('playaName').optional().trim().isLength({ max: 100 }),
  body('socialMedia.instagram').optional().trim().isLength({ max: 200 }),
  body('socialMedia.facebook').optional().trim().isLength({ max: 200 }),
  body('socialMedia.linkedin').optional().trim().isLength({ max: 200 }),
  body('skills').optional().isArray(),
  body('interests').optional().isArray(),
  body('burningManExperience').optional().trim().isLength({ max: 1000 }),
  body('location').optional().trim().isLength({ max: 200 }),
  body('hasTicket').optional().isBoolean(),
  body('hasVehiclePass').optional().isBoolean(),
  body('arrivalDate').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    return new Date(value).toString() !== 'Invalid Date';
  }),
  body('departureDate').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    return new Date(value).toString() !== 'Invalid Date';
  }),
  body('interestedInEAP').optional().isBoolean(),
  body('interestedInStrike').optional().isBoolean(),
  body('campName').optional().trim().isLength({ min: 1, max: 100 }),
  body('campBio').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Debug: Log the request body
    console.log('🔍 [PUT /api/users/profile] Request body:', req.body);
    console.log('🔍 [PUT /api/users/profile] playaName in body:', req.body.playaName);

    // Update allowed fields based on account type
    const allowedFields = [];
    
           if (user.accountType === 'personal') {
             allowedFields.push('firstName', 'lastName', 'phoneNumber', 'city', 'yearsBurned', 'previousCamps', 'bio', 'playaName', 'profilePhoto', 'photos', 'socialMedia', 'skills', 'interests', 'burningManExperience', 'location', 'hasTicket', 'hasVehiclePass', 'arrivalDate', 'departureDate', 'interestedInEAP', 'interestedInStrike');
    } else if (user.accountType === 'camp') {
      // Camp accounts can update both personal and camp fields
      allowedFields.push('firstName', 'lastName', 'phoneNumber', 'city', 'yearsBurned', 'previousCamps', 'bio', 'playaName', 'profilePhoto', 'photos', 'socialMedia', 'skills', 'interests', 'burningManExperience', 'location', 'hasTicket', 'hasVehiclePass', 'arrivalDate', 'departureDate', 'interestedInEAP', 'interestedInStrike');
      allowedFields.push('campName', 'campBio', 'campPhotos', 'campSocialMedia', 'campLocation', 'campTheme', 'campSize', 'campYearFounded', 'campWebsite', 'campEmail');
    } else {
      // Admin or other account types - allow all fields
      allowedFields.push('firstName', 'lastName', 'phoneNumber', 'city', 'yearsBurned', 'previousCamps', 'bio', 'playaName', 'profilePhoto', 'photos', 'socialMedia', 'skills', 'interests', 'burningManExperience', 'location', 'hasTicket', 'hasVehiclePass', 'arrivalDate', 'departureDate', 'interestedInEAP', 'interestedInStrike');
      allowedFields.push('campName', 'campBio', 'campPhotos', 'campSocialMedia', 'campLocation', 'campTheme', 'campSize', 'campYearFounded', 'campWebsite', 'campEmail');
    }

    // Update only allowed fields
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Debug: Log the updates object
    console.log('🔍 [PUT /api/users/profile] Updates object:', updates);
    console.log('🔍 [PUT /api/users/profile] playaName in updates:', updates.playaName);

    // Update user using database adapter
    let updatedUser;
    try {
      updatedUser = await db.updateUser(user.email, updates);
      
      // Debug: Log the updated user
      console.log('🔍 [PUT /api/users/profile] Updated user playaName:', updatedUser?.playaName);
      console.log('🔍 [PUT /api/users/profile] Full updated user:', JSON.stringify(updatedUser, null, 2));
      
      if (!updatedUser) {
        console.error('❌ [PUT /api/users/profile] updateUser returned null/undefined');
        return res.status(404).json({ message: 'User not found or update failed' });
      }
    } catch (dbError) {
      console.error('❌ [PUT /api/users/profile] Database error:', dbError);
      return res.status(500).json({ 
        message: 'Internal server error during user update',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
    
    // Update related applications and roster entries to reflect profile changes
    // This is done in a separate try-catch so profile updates succeed even if sync fails
    try {
      console.log('🔄 [PUT /api/users/profile] Starting applications and roster sync...');
      
      // Update applications where this user is the applicant
      const applications = await db.findMemberApplications({ applicant: user._id });
      console.log(`🔍 [PUT /api/users/profile] Found ${applications.length} applications to update`);
      
      for (const application of applications) {
        if (application && application.applicant) {
          try {
            await db.updateMemberApplication(application._id, {
              applicantDetails: {
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email,
                profilePhoto: updatedUser.profilePhoto,
                bio: updatedUser.bio,
                playaName: updatedUser.playaName,
                city: updatedUser.city,
                yearsBurned: updatedUser.yearsBurned,
                previousCamps: updatedUser.previousCamps,
                socialMedia: updatedUser.socialMedia,
                hasTicket: updatedUser.hasTicket,
                hasVehiclePass: updatedUser.hasVehiclePass,
                arrivalDate: updatedUser.arrivalDate,
                departureDate: updatedUser.departureDate,
                interestedInEAP: updatedUser.interestedInEAP,
                interestedInStrike: updatedUser.interestedInStrike,
                skills: updatedUser.skills
              }
            });
            console.log(`✅ [PUT /api/users/profile] Updated application ${application._id}`);
          } catch (appError) {
            console.error(`❌ [PUT /api/users/profile] Failed to update application ${application._id}:`, appError);
          }
        }
      }

      // Update roster entries where this user is a member
      const rosters = await db.findRosters({});
      console.log(`🔍 [PUT /api/users/profile] Found ${rosters.length} rosters to check`);
      
      for (const roster of rosters) {
        if (roster.members && roster.members.length > 0) {
          try {
            let rosterUpdated = false;
            const updatedMembers = roster.members.map(memberEntry => {
              if (memberEntry && memberEntry.member && memberEntry.member.toString() === user._id.toString()) {
                rosterUpdated = true;
                return {
                  ...memberEntry,
                  memberDetails: {
                    userDetails: {
                      firstName: updatedUser.firstName,
                      lastName: updatedUser.lastName,
                      email: updatedUser.email,
                      profilePhoto: updatedUser.profilePhoto,
                      bio: updatedUser.bio,
                      playaName: updatedUser.playaName,
                      city: updatedUser.city,
                      yearsBurned: updatedUser.yearsBurned,
                      previousCamps: updatedUser.previousCamps,
                      socialMedia: updatedUser.socialMedia,
                      hasTicket: updatedUser.hasTicket,
                      hasVehiclePass: updatedUser.hasVehiclePass,
                      arrivalDate: updatedUser.arrivalDate,
                      departureDate: updatedUser.departureDate,
                      interestedInEAP: updatedUser.interestedInEAP,
                      interestedInStrike: updatedUser.interestedInStrike,
                      skills: updatedUser.skills
                    }
                  }
                };
              }
              return memberEntry;
            });

            if (rosterUpdated) {
              await db.updateRoster(roster._id, { members: updatedMembers });
              console.log(`✅ [PUT /api/users/profile] Updated roster ${roster._id}`);
            }
          } catch (rosterError) {
            console.error(`❌ [PUT /api/users/profile] Failed to update roster ${roster._id}:`, rosterError);
          }
        }
      }
      
      console.log('✅ [PUT /api/users/profile] Applications and roster sync completed');
    } catch (syncError) {
      console.error('❌ [PUT /api/users/profile] Error during applications/roster sync:', syncError);
      // Don't fail the profile update if sync fails - this is non-critical
    }
    
    // Final safety check before sending response
    if (!updatedUser) {
      console.error('❌ [PUT /api/users/profile] updatedUser is null/undefined before response');
      return res.status(500).json({ message: 'User update failed - no data to return' });
    }

    // Remove password from response
    const userResponse = { ...updatedUser };
    delete userResponse.password;

    console.log('✅ [PUT /api/users/profile] Sending response with playaName:', userResponse.playaName);

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('❌ [PUT /api/users/profile] Update profile error:', error);
    console.error('❌ [PUT /api/users/profile] Error stack:', error.stack);
    console.error('❌ [PUT /api/users/profile] Error message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/password
// @desc    Change password
// @access  Private
router.put('/password', authenticateToken, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await db.comparePassword(user, currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password using database adapter
    await db.updateUser(user.email, { password: newPassword });

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', authenticateToken, [
  body('notifications').optional().isObject(),
  body('privacy').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update preferences
    const updates = {};
    if (req.body.notifications) {
      updates['preferences.notifications'] = { ...user.preferences?.notifications, ...req.body.notifications };
    }

    if (req.body.privacy) {
      updates['preferences.privacy'] = { ...user.preferences?.privacy, ...req.body.privacy };
    }

    const updatedUser = await db.updateUser(user.email, updates);

    res.json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticateToken, [
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;

    const user = await db.findUser({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isMatch = await db.comparePassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    // Deactivate account instead of deleting (for data integrity)
    await db.updateUser(user.email, { isActive: false });

    res.json({ message: 'Account deactivated successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/search
// @desc    Search users (for camp recruitment)
// @access  Private
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, location, skills, experience } = req.query;

    const query = {
      accountType: 'personal',
      isActive: true,
      'preferences.privacy.profileVisibility': 'public'
    };

    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ];
    }

    if (location) {
      query['location.city'] = { $regex: location, $options: 'i' };
    }

    if (skills) {
      query.skills = { $in: skills.split(',') };
    }

    if (experience) {
      query.burningManExperience = experience;
    }

    // For now, return empty array since mock database doesn't support complex queries
    // In a real implementation, you would implement search functionality in the database adapter
    const users = [];

    res.json({ users });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/public/:id
// @desc    Get public member profile
// @access  Public
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Public profile request for ID:', id);

    const member = await db.findUser({ _id: parseInt(id) });
    console.log('🔍 Member found:', member ? `ID: ${member._id}, Type: ${member.accountType}, Active: ${member.isActive}` : 'null');
    console.log('🔍 Profile visibility:', member?.preferences?.privacy?.profileVisibility);
    
    // Check if member exists and meets criteria
    if (!member) {
      return res.status(404).json({ message: 'Member profile not found' });
    }
    
    if (member.accountType !== 'personal') {
      return res.status(404).json({ message: 'Profile not available for this account type' });
    }
    
    if (!member.isActive) {
      return res.status(404).json({ message: 'Member profile is not active' });
    }
    
    // For now, allow all personal accounts to be viewed publicly (remove strict privacy check)
    // TODO: Implement proper privacy controls when user preferences are fully set up
    // if (member.preferences?.privacy?.profileVisibility !== 'public') {
    //   return res.status(404).json({ message: 'Member profile is not set to public' });
    // }
    
    // Remove sensitive fields
    const publicMember = { ...member };
    delete publicMember.password;
    delete publicMember.email;
    delete publicMember.phoneNumber;
    delete publicMember.googleId;
    delete publicMember.appleId;
    delete publicMember.isVerified;
    delete publicMember.lastLogin;
    delete publicMember.preferences;

    res.json({ member: publicMember });

  } catch (error) {
    console.error('Get public member profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/change-email
// @desc    Change user email
// @access  Private
router.put('/change-email', authenticateToken, [
  body('newEmail').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Current password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newEmail, password } = req.body;
    const userId = req.user._id;

    // Find user and verify current password
    const user = await db.findUser({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Check if new email already exists
    const existingUser = await db.findUser({ email: newEmail });
    if (existingUser && existingUser._id !== userId) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Update user email
    const updatedUser = await db.updateUserById(userId, { email: newEmail });
    
    // Remove password from response
    const userResponse = { ...updatedUser };
    delete userResponse.password;
    
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Find user and verify current password
    const user = await db.findUser({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await db.updateUserById(userId, { password: hashedPassword });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
