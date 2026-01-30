// Debug raw camp data to see what's being returned
const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');

// @route   GET /api/debug-camp-raw/:slug
// @desc    Get raw camp data directly from MongoDB
// @access  Public (remove after debugging)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('🔍 [Debug Camp Raw] Fetching camp:', slug);
    
    // Get camp directly from MongoDB
    const camp = await Camp.findOne({ slug });
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Check photo data
    const photoInfo = camp.photos ? {
      count: camp.photos.length,
      formats: camp.photos.map((p, i) => ({
        index: i,
        type: typeof p,
        isString: typeof p === 'string',
        isObject: typeof p === 'object',
        hasUrl: p && typeof p === 'object' ? 'url' in p : false,
        length: typeof p === 'string' ? p.length : 0,
        preview: typeof p === 'string' ? p.substring(0, 100) : JSON.stringify(p).substring(0, 100)
      }))
    } : { error: 'No photos field' };
    
    res.json({
      campId: camp._id,
      campName: camp.name,
      slug: camp.slug,
      photoInfo,
      rawPhotosField: camp.photos ? 'exists' : 'missing',
      message: 'Raw camp data retrieved'
    });

  } catch (error) {
    console.error('❌ [Debug Camp Raw] Error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
