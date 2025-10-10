const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

// @route   GET /api/debug/user/:userId
// @desc    Debug user profile data
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await db.findUser({ _id: userId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data with validation check
    const profileCheck = {
      firstName: { value: user.firstName, valid: !!(user.firstName && user.firstName.trim()) },
      lastName: { value: user.lastName, valid: !!(user.lastName && user.lastName.trim()) },
      phoneNumber: { value: user.phoneNumber, valid: !!(user.phoneNumber && user.phoneNumber.trim()) },
      city: { 
        value: user.city || user.location?.city, 
        valid: !!(user.city && user.city.trim()) || !!(user.location?.city && user.location.city.trim()),
        topLevel: user.city,
        nested: user.location?.city
      },
      yearsBurned: { value: user.yearsBurned, valid: typeof user.yearsBurned === 'number' && user.yearsBurned >= 0 },
      bio: { value: user.bio, valid: !!(user.bio && user.bio.trim()) },
      interestedInEAP: { value: user.interestedInEAP, valid: typeof user.interestedInEAP === 'boolean' },
      interestedInStrike: { value: user.interestedInStrike, valid: typeof user.interestedInStrike === 'boolean' }
    };

    const missingFields = Object.entries(profileCheck)
      .filter(([_, data]) => !data.valid)
      .map(([field, _]) => field);

    res.json({
      userId: user._id,
      email: user.email,
      accountType: user.accountType,
      profileCheck,
      missingFields,
      isComplete: missingFields.length === 0,
      fullUserData: user
    });

  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

