/**
 * Migration API: Sync isPubliclyVisible with isPublic flag
 * 
 * Issue: Schema field renamed from `isPublic` to `isPubliclyVisible`
 * but existing camps weren't migrated.
 * 
 * SAFE: Only adds missing flag, doesn't delete photos or other data
 */

const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/migrate-visibility/status
// @desc    Check status of visibility flags
// @access  Private (any authenticated user)
router.get('/status', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [Migrate Visibility] Checking visibility status...');
    
    const totalCamps = await Camp.countDocuments({});
    const visibleCamps = await Camp.countDocuments({ isPubliclyVisible: true });
    const oldPublicCamps = await Camp.countDocuments({ isPublic: true });
    const needsMigration = await Camp.countDocuments({
      $or: [
        { isPublic: true, isPubliclyVisible: { $ne: true } },
        { isPublic: true, isPubliclyVisible: { $exists: false } }
      ]
    });
    
    console.log('📊 [Migrate Visibility] Status:', {
      totalCamps,
      visibleCamps,
      oldPublicCamps,
      needsMigration
    });
    
    res.json({
      totalCamps,
      visibleCamps,
      oldPublicCamps,
      needsMigration,
      status: needsMigration > 0 ? 'Migration needed' : 'All camps migrated',
      message: `${needsMigration} camps need migration`
    });

  } catch (error) {
    console.error('❌ [Migrate Visibility] Status check error:', error);
    res.status(500).json({
      message: 'Error checking migration status',
      error: error.message
    });
  }
});

// @route   POST /api/migrate-visibility/run
// @desc    Run migration to sync visibility flags
// @access  Private (any authenticated user)
router.post('/run', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [Migrate Visibility] Starting migration...');
    console.log('👤 [Migrate Visibility] Requested by:', req.user.email);
    
    // Find camps where isPublic=true but isPubliclyVisible is not true
    const campsToFix = await Camp.find({
      $or: [
        { isPublic: true, isPubliclyVisible: { $ne: true } },
        { isPublic: true, isPubliclyVisible: { $exists: false } }
      ]
    });
    
    console.log(`📊 [Migrate Visibility] Found ${campsToFix.length} camps to fix`);

    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const camp of campsToFix) {
      try {
        console.log(`🔄 [Migrate Visibility] Processing: ${camp.name} (${camp._id})`);
        console.log(`   - isPublic: ${camp.isPublic}, isPubliclyVisible: ${camp.isPubliclyVisible}`);
        console.log(`   - Photos: ${camp.photos?.length || 0}, Status: ${camp.status}`);
        
        // SAFE: Only set isPubliclyVisible, don't touch photos or other data
        camp.isPubliclyVisible = true;
        
        await camp.save({ validateBeforeSave: true });
        
        migratedCount++;
        console.log(`✅ [Migrate Visibility] ${camp.name}: Set isPubliclyVisible=true`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `${camp.name} (${camp._id}): ${error.message}`;
        console.error(`❌ [Migrate Visibility] Error:`, errorMsg);
        errors.push(errorMsg);
      }
    }

    // Verify results
    const finalVisibleCount = await Camp.countDocuments({ isPubliclyVisible: true });
    const finalOldPublicCount = await Camp.countDocuments({ isPublic: true });
    
    console.log('📊 [Migrate Visibility] Summary:');
    console.log(`   Camps checked: ${campsToFix.length}`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Final visible count: ${finalVisibleCount}`);
    console.log(`   Final old public count: ${finalOldPublicCount}`);
    
    const success = finalVisibleCount >= finalOldPublicCount;
    
    res.json({
      success,
      summary: {
        campsChecked: campsToFix.length,
        migratedCount,
        errorCount,
        finalVisibleCount,
        finalOldPublicCount
      },
      errors: errors.length > 0 ? errors : undefined,
      message: success 
        ? `✅ Migration complete! ${migratedCount} camps updated.`
        : `⚠️ Migration completed with issues. ${migratedCount} camps updated, ${errorCount} errors.`
    });

  } catch (error) {
    console.error('❌ [Migrate Visibility] Fatal error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

module.exports = router;
