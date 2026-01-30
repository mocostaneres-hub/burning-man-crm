// Debug visibility flags
const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');

// @route   GET /api/debug-visibility
// @desc    Check camp visibility flags
// @access  Public (remove after debugging)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [Debug Visibility] Checking camp visibility flags...');
    
    const allCamps = await Camp.find({}).select('_id name slug status isPubliclyVisible isPublic').lean();
    
    const visibleCamps = allCamps.filter(camp => camp.isPubliclyVisible === true);
    const notVisibleCamps = allCamps.filter(camp => camp.isPubliclyVisible !== true);
    const oldIsPublicTrue = allCamps.filter(camp => camp.isPublic === true);
    
    console.log('📊 [Debug Visibility] Camps with isPubliclyVisible=true:', visibleCamps.length);
    console.log('📊 [Debug Visibility] Camps with isPubliclyVisible!=true:', notVisibleCamps.length);
    console.log('📊 [Debug Visibility] Camps with old isPublic=true:', oldIsPublicTrue.length);
    
    res.json({
      summary: {
        totalCamps: allCamps.length,
        visibleCamps: visibleCamps.length,
        notVisibleCamps: notVisibleCamps.length,
        oldIsPublicTrue: oldIsPublicTrue.length
      },
      sampleVisible: visibleCamps.slice(0, 3).map(c => ({
        _id: c._id,
        name: c.name,
        isPubliclyVisible: c.isPubliclyVisible,
        isPublic: c.isPublic
      })),
      sampleNotVisible: notVisibleCamps.slice(0, 5).map(c => ({
        _id: c._id,
        name: c.name,
        status: c.status,
        isPubliclyVisible: c.isPubliclyVisible,
        isPublic: c.isPublic
      })),
      message: 'Visibility check complete'
    });

  } catch (error) {
    console.error('❌ [Debug Visibility] Error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
