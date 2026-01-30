// Debug photos endpoint - check if photo data exists
const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');

// @route   GET /api/debug-photos
// @desc    Check if camp photos data exists in database
// @access  Public (remove after debugging)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [Debug Photos] Checking camp photos in database...');
    
    // Get all camps directly from MongoDB (not through adapter)
    const allCamps = await Camp.find({}).select('_id name slug photos primaryPhotoIndex').lean();
    
    console.log('📊 [Debug Photos] Total camps:', allCamps.length);
    
    // Analyze photo data
    const campsWithPhotos = allCamps.filter(camp => camp.photos && camp.photos.length > 0);
    const campsWithStringPhotos = allCamps.filter(camp => 
      camp.photos && camp.photos.length > 0 && typeof camp.photos[0] === 'string'
    );
    const campsWithObjectPhotos = allCamps.filter(camp => 
      camp.photos && camp.photos.length > 0 && typeof camp.photos[0] === 'object'
    );
    const campsWithoutPhotos = allCamps.filter(camp => !camp.photos || camp.photos.length === 0);
    
    console.log('📊 [Debug Photos] Camps with photos:', campsWithPhotos.length);
    console.log('📊 [Debug Photos] Camps with string photos:', campsWithStringPhotos.length);
    console.log('📊 [Debug Photos] Camps with object photos:', campsWithObjectPhotos.length);
    console.log('📊 [Debug Photos] Camps without photos:', campsWithoutPhotos.length);
    
    // Sample camps with photos
    const sampleCampsWithPhotos = campsWithPhotos.slice(0, 5).map(camp => ({
      _id: camp._id,
      name: camp.name,
      photoCount: camp.photos?.length || 0,
      photoFormat: camp.photos && camp.photos.length > 0 ? typeof camp.photos[0] : 'none',
      photos: camp.photos,
      primaryPhotoIndex: camp.primaryPhotoIndex
    }));
    
    // Sample camps without photos
    const sampleCampsWithoutPhotos = campsWithoutPhotos.slice(0, 5).map(camp => ({
      _id: camp._id,
      name: camp.name,
      photos: camp.photos
    }));
    
    res.json({
      summary: {
        totalCamps: allCamps.length,
        campsWithPhotos: campsWithPhotos.length,
        campsWithStringPhotos: campsWithStringPhotos.length,
        campsWithObjectPhotos: campsWithObjectPhotos.length,
        campsWithoutPhotos: campsWithoutPhotos.length
      },
      sampleCampsWithPhotos,
      sampleCampsWithoutPhotos,
      message: 'Photo data check complete'
    });

  } catch (error) {
    console.error('❌ [Debug Photos] Error:', error.message);
    console.error('❌ [Debug Photos] Stack:', error.stack);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
