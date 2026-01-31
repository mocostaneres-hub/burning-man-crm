const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');
const { generateUniqueCampSlug } = require('../utils/slugGenerator');

// @route   POST /api/onboarding/select-role
// @desc    Select role for new user (member or camp_lead)
// @access  Private
router.post('/select-role', [
  authenticateToken,
  body('role').isIn(['member', 'camp_lead']).withMessage('Role must be either member or camp_lead')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role } = req.body;
    const userId = req.user._id;

    // Get current user
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user already has a role assigned
    if (user.role && user.role !== 'unassigned') {
      return res.status(400).json({ 
        message: 'User already has a role assigned',
        currentRole: user.role
      });
    }

    // VALIDATION: Check for conflicting states
    if (role === 'camp_lead') {
      // Prevent admin accounts from becoming camp leads
      if (user.accountType === 'admin') {
        return res.status(400).json({ 
          message: 'Admin accounts cannot become camp leads'
        });
      }
      
      // Check if user already has a camp
      if (user.campId) {
        console.log('⚠️ [Onboarding] User already has campId:', user.campId);
        // Continue but don't create duplicate camp
      }
    }

    if (role === 'member') {
      // Warn if user already owns a camp
      if (user.campId) {
        console.warn(`⚠️ [Onboarding] User ${user.email} selected 'member' but already owns camp ${user.campId}`);
        return res.status(400).json({
          message: 'You already own a camp. Please select "Lead a Camp" role instead, or contact support if you need to transfer ownership.'
        });
      }
    }

    // START TRANSACTION for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();
    
    console.log('🔄 [Onboarding] Transaction started for role:', role, 'userId:', userId);

    try {
      const User = require('../models/User');
      const Camp = require('../models/Camp');
      
      console.log('📋 [Onboarding] Models loaded successfully');

      // Update user role
      console.log('🔄 [Onboarding] Updating user role to:', role);
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { role: role, updatedAt: new Date() },
        { new: true, session }
      );

      if (!updatedUser) {
        throw new Error('Failed to update user role');
      }

      console.log('✅ [Onboarding] Updated role to:', role);

      // For camp_lead role, also update accountType to 'camp' and create camp
      if (role === 'camp_lead') {
        // Update accountType to 'camp'
        if (updatedUser.accountType !== 'camp') {
          await User.findByIdAndUpdate(
            userId,
            { accountType: 'camp', updatedAt: new Date() },
            { session }
          );
          updatedUser.accountType = 'camp';
          console.log('✅ [Onboarding] Updated accountType to: camp');
        }

        // Create camp ONLY if user doesn't have one
        if (!user.campId) {
          // Generate camp name from user's name
          const campName = user.campName || `${user.firstName} ${user.lastName}`.trim() || 'My Camp';
          
          // Generate unique slug using utility (prevents collisions)
          const slug = await generateUniqueCampSlug(campName);

          // Create camp data with required fields
          const campData = {
            owner: user._id,
            name: campName,
            slug: slug,
            description: `Welcome to ${campName}! We're excited to share our camp experience with you.`,
            contactEmail: user.email,
            status: 'active',
            isRecruiting: true,
            isPublic: false, // Start private - user can make public after completing profile
            isPubliclyVisible: false, // Ensure it doesn't appear in discovery until ready
            acceptingNewMembers: true,
            showApplyNow: true,
            showMemberCount: true
          };

          console.log('🏕️ [Onboarding] Creating camp with slug:', slug);

          // Create camp record
          const camp = new Camp(campData);
          await camp.save({ session });

          console.log('✅ [Onboarding] Camp created:', camp._id);

          // Update user with campId and urlSlug
          await User.findByIdAndUpdate(
            user._id,
            { 
              campId: camp._id,
              urlSlug: slug,
              updatedAt: new Date()
            },
            { session }
          );
          
          updatedUser.campId = camp._id;
          updatedUser.urlSlug = slug;

          console.log('✅ [Onboarding] Linked user to camp');
        } else {
          console.log('ℹ️ [Onboarding] User already has camp, skipping creation');
        }
      }

      // For member role, ensure accountType is 'personal'
      if (role === 'member' && updatedUser.accountType !== 'personal') {
        await User.findByIdAndUpdate(
          userId,
          { accountType: 'personal', updatedAt: new Date() },
          { session }
        );
        updatedUser.accountType = 'personal';
        console.log('✅ [Onboarding] Updated accountType to: personal');
      }

      // COMMIT TRANSACTION - All operations succeeded
      await session.commitTransaction();
      console.log('✅ [Onboarding] Transaction committed successfully');

      // Use the updatedUser we already have instead of fetching again
      // (Fetching immediately after commit can sometimes fail due to replication lag)
      console.log('📋 [Onboarding] Preparing response with updatedUser');
      
      // Return success response with user data
      const userResponse = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser };
      delete userResponse.password;

      console.log('✅ [Onboarding] Sending success response');
      
      res.json({
        message: 'Role selected successfully',
        user: userResponse,
        redirectTo: role === 'camp_lead' ? '/camp/edit' : '/user/profile'
      });

    } catch (transactionError) {
      // ROLLBACK TRANSACTION on any error
      await session.abortTransaction();
      console.error('❌ [Onboarding] Transaction aborted:', transactionError);
      console.error('❌ [Onboarding] Error stack:', transactionError.stack);
      console.error('❌ [Onboarding] Error details:', {
        name: transactionError.name,
        message: transactionError.message,
        code: transactionError.code,
        role: role,
        userId: userId
      });

      // Return specific error messages
      if (transactionError.code === 11000) {
        // Duplicate key error (shouldn't happen with generateUniqueCampSlug, but just in case)
        return res.status(409).json({ 
          message: 'A camp with this name already exists. Please try again or contact support.',
          error: process.env.NODE_ENV === 'development' ? transactionError.message : undefined
        });
      }

      if (transactionError.message.includes('Camp owner')) {
        return res.status(500).json({
          message: 'Unable to create camp. Please contact support.',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@g8road.com'
        });
      }

      // Generic error
      return res.status(500).json({ 
        message: 'Failed to complete onboarding. Please try again.',
        error: process.env.NODE_ENV === 'development' ? transactionError.message : undefined
      });
    } finally {
      // Always end the session
      session.endSession();
    }

  } catch (error) {
    console.error('❌ [Onboarding] Outer catch - Role selection error:', error);
    console.error('❌ [Onboarding] Outer catch - Error stack:', error.stack);
    console.error('❌ [Onboarding] Outer catch - Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({ 
      message: 'Server error during role selection',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/onboarding/status
// @desc    Check if user needs to complete onboarding
// @access  Private
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await db.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const needsOnboarding = user.role === 'unassigned' || !user.role;
    
    res.json({
      needsOnboarding,
      currentRole: user.role,
      accountType: user.accountType
    });

  } catch (error) {
    console.error('Onboarding status check error:', error);
    res.status(500).json({ message: 'Server error during status check' });
  }
});

module.exports = router;
