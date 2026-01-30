// Debug admin user permissions
const express = require('express');
const router = express.Router();
const db = require('../database/databaseAdapter');

// @route   GET /api/debug-admin/:email
// @desc    Check admin user permissions
// @access  Public (remove after debugging)
router.get('/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    console.log('🔍 [Debug Admin] Looking up user:', email);
    
    const user = await db.findUser({ email });
    
    if (!user) {
      return res.json({
        found: false,
        message: `User ${email} not found in database`
      });
    }

    // Check permissions
    const permissions = {
      accountType: user.accountType,
      isSystemAdmin: user.isSystemAdmin,
      isActive: user.isActive,
      canAccessAdmin: user.accountType === 'admin' || user.isSystemAdmin === true
    };

    res.json({
      found: true,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
        isSystemAdmin: user.isSystemAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      permissions,
      message: permissions.canAccessAdmin ? 
        '✅ User HAS admin access' : 
        '❌ User DOES NOT have admin access'
    });

  } catch (error) {
    console.error('❌ [Debug Admin] Error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
