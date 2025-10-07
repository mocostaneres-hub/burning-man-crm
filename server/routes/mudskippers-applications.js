// Temporary endpoint to create applications for Mudskippers members
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const MemberApplication = require('../models/MemberApplication');
const User = require('../models/User');
const Camp = require('../models/Camp');

// @route   POST /api/mudskippers/create-applications
// @desc    Create applications for 6 specific Mudskippers members
// @access  Private (Admin only)
router.post('/create-applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [POST /api/mudskippers/create-applications] Creating applications...');

    // Find Mudskippers camp
    const camp = await Camp.findOne({ name: 'Mudskippers' });
    if (!camp) {
      return res.status(404).json({ message: 'Mudskippers camp not found' });
    }
    console.log(`✅ Found Mudskippers camp: ${camp._id}`);

    // List of members to create applications for
    const memberNames = [
      { firstName: 'David', lastName: 'Miller' },
      { firstName: 'Lisa', lastName: 'Wilson' },
      { firstName: 'Kate', lastName: 'Thomas' },
      { firstName: 'Ryan', lastName: 'Jackson' },
      { firstName: 'Jessica', lastName: 'White' },
      { firstName: 'Chris', lastName: 'Moore' }
    ];

    const results = {
      created: [],
      existing: [],
      notFound: []
    };

    for (const memberName of memberNames) {
      // Find user
      const user = await User.findOne({
        firstName: { $regex: new RegExp(`^${memberName.firstName}$`, 'i') },
        lastName: { $regex: new RegExp(`^${memberName.lastName}$`, 'i') }
      });

      if (!user) {
        results.notFound.push(`${memberName.firstName} ${memberName.lastName}`);
        console.log(`⚠️  User not found: ${memberName.firstName} ${memberName.lastName}`);
        continue;
      }

      // Check if application already exists
      const existingApp = await MemberApplication.findOne({
        userId: user._id,
        campId: camp._id
      });

      if (existingApp) {
        results.existing.push({
          name: `${user.firstName} ${user.lastName}`,
          status: existingApp.status
        });
        console.log(`ℹ️  Application already exists for ${user.firstName} ${user.lastName} (Status: ${existingApp.status})`);
        continue;
      }

      // Create new application
      const application = new MemberApplication({
        userId: user._id,
        campId: camp._id,
        status: 'pending',
        answers: {
          whyJoin: `I'm excited to join Mudskippers and contribute to the camp community at Burning Man.`,
          skillsToOffer: user.skills?.join(', ') || 'Team player, willing to help wherever needed',
          expectations: 'Looking forward to participating in camp activities and making new connections.',
          previousExperience: user.burningManExperience || 'New to Burning Man, eager to learn.',
          additionalInfo: ''
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await application.save();
      results.created.push(`${user.firstName} ${user.lastName}`);
      console.log(`✅ Created application for ${user.firstName} ${user.lastName}`);
    }

    res.json({
      success: true,
      message: 'Applications processing complete',
      results: results
    });

  } catch (error) {
    console.error('❌ [POST /api/mudskippers/create-applications] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

