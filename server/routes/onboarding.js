const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');

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

    // Update user role
    const updatedUser = await db.updateUserById(userId, { 
      role: role,
      updatedAt: new Date()
    });

    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update user role' });
    }

    // For camp_lead role, also update accountType to 'camp' if it's not already
    if (role === 'camp_lead' && user.accountType === 'personal') {
      await db.updateUserById(userId, { 
        accountType: 'camp',
        updatedAt: new Date()
      });
      updatedUser.accountType = 'camp';
    }

    // For member role, ensure accountType is 'personal'
    if (role === 'member' && user.accountType !== 'personal') {
      await db.updateUserById(userId, { 
        accountType: 'personal',
        updatedAt: new Date()
      });
      updatedUser.accountType = 'personal';
    }

    // Return success response with user data
    const userResponse = { ...updatedUser };
    delete userResponse.password;

    res.json({
      message: 'Role selected successfully',
      user: userResponse,
      redirectTo: role === 'camp_lead' ? '/camp/edit' : '/user/profile'
    });

  } catch (error) {
    console.error('Role selection error:', error);
    res.status(500).json({ message: 'Server error during role selection' });
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
