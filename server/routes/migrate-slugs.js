const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const User = require('../models/User');

// @route   POST /api/migrate/slugs
// @desc    Generate URL slugs for camps and users
// @access  Admin only (for security)
router.post('/slugs', async (req, res) => {
  try {
    console.log('🚀 Starting URL slug migration...');
    
    // Generate camp slugs
    console.log('🔄 Generating camp slugs...');
    const camps = await Camp.find({});
    let campUpdatedCount = 0;
    
    for (const camp of camps) {
      const expectedSlug = camp.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      if (!camp.slug || camp.slug !== expectedSlug) {
        // Check if slug already exists
        const existingCamp = await Camp.findOne({ slug: expectedSlug, _id: { $ne: camp._id } });
        let finalSlug = expectedSlug;
        
        if (existingCamp) {
          // If slug exists, append camp ID to make it unique
          finalSlug = `${expectedSlug}-${camp._id}`;
        }
        
        camp.slug = finalSlug;
        await camp.save();
        campUpdatedCount++;
        console.log(`✅ Updated camp "${camp.name}" with slug: ${camp.slug}`);
      }
    }
    
    // Generate user slugs
    console.log('🔄 Generating user URL slugs...');
    const users = await User.find({ accountType: 'personal' });
    let userUpdatedCount = 0;
    
    for (const user of users) {
      const nameToUse = user.playaName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
      
      if (nameToUse) {
        const expectedSlug = nameToUse
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        if (!user.urlSlug || user.urlSlug !== expectedSlug) {
          // Check if slug already exists
          const existingUser = await User.findOne({ urlSlug: expectedSlug, _id: { $ne: user._id } });
          let finalSlug = expectedSlug;
          
          if (existingUser) {
            // If slug exists, append user ID to make it unique
            finalSlug = `${expectedSlug}-${user._id}`;
          }
          
          user.urlSlug = finalSlug;
          await user.save();
          userUpdatedCount++;
          console.log(`✅ Updated user "${nameToUse}" with URL slug: ${user.urlSlug}`);
        }
      }
    }
    
    console.log(`🎉 Migration completed! Updated ${campUpdatedCount} camps and ${userUpdatedCount} users`);
    
    res.json({
      success: true,
      message: 'URL slug migration completed successfully',
      stats: {
        campsUpdated: campUpdatedCount,
        usersUpdated: userUpdatedCount,
        totalCamps: camps.length,
        totalUsers: users.length
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

module.exports = router;
