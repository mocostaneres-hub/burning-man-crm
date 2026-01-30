/**
 * Migration API: Convert BASE64 photos to Cloudinary URLs
 * 
 * Issue: Photos stored as base64 strings are:
 * 1. Being converted to weird character objects by Mongoose
 * 2. 0.5MB each (way too large)
 * 3. Not displaying in frontend
 * 
 * Solution: Upload base64 photos to Cloudinary, replace with URLs
 * 
 * SAFE: Creates Cloudinary backups before modifying database
 */

const express = require('express');
const router = express.Router();
const Camp = require('../models/Camp');
const { authenticateToken } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to check if string is base64 image
function isBase64Image(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('data:image/');
}

// Helper function to upload base64 to Cloudinary
async function uploadBase64ToCloudinary(base64String, campId, photoIndex) {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: 'burning-man-crm',
      resource_type: 'image',
      public_id: `camp-${campId}-photo-${photoIndex}-${Date.now()}`
    });
    return result.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw error;
  }
}

// @route   GET /api/migrate-base64-photos/status
// @desc    Check status of base64 photos
// @access  Private (any authenticated user)
router.get('/status', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [Migrate BASE64] Checking base64 photo status...');
    
    // Get all camps directly from MongoDB
    const allCamps = await Camp.find({}).select('_id name photos').lean();
    
    let campsWithBase64 = 0;
    let totalBase64Photos = 0;
    let campsWithCloudinary = 0;
    let totalSize = 0;
    
    for (const camp of allCamps) {
      if (!camp.photos || camp.photos.length === 0) continue;
      
      let hasBase64 = false;
      let hasCloudinary = false;
      
      for (const photo of camp.photos) {
        // Check if it's a string (not the weird object)
        const photoStr = typeof photo === 'string' ? photo : null;
        
        if (photoStr) {
          if (photoStr.startsWith('data:image/')) {
            hasBase64 = true;
            totalBase64Photos++;
            totalSize += photoStr.length;
          } else if (photoStr.includes('cloudinary.com')) {
            hasCloudinary = true;
          }
        }
      }
      
      if (hasBase64) campsWithBase64++;
      if (hasCloudinary) campsWithCloudinary++;
    }
    
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    console.log('📊 [Migrate BASE64] Status:', {
      totalCamps: allCamps.length,
      campsWithBase64,
      totalBase64Photos,
      totalSizeMB,
      campsWithCloudinary
    });
    
    res.json({
      totalCamps: allCamps.length,
      campsWithBase64,
      totalBase64Photos,
      totalSizeMB: parseFloat(totalSizeMB),
      campsWithCloudinary,
      needsMigration: campsWithBase64 > 0,
      message: campsWithBase64 > 0 
        ? `${campsWithBase64} camps with ${totalBase64Photos} base64 photos (${totalSizeMB} MB total)` 
        : 'No base64 photos found'
    });

  } catch (error) {
    console.error('❌ [Migrate BASE64] Status check error:', error);
    res.status(500).json({
      message: 'Error checking migration status',
      error: error.message
    });
  }
});

// @route   POST /api/migrate-base64-photos/run
// @desc    Run migration to convert base64 photos to Cloudinary URLs
// @access  Private (any authenticated user)
router.post('/run', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [Migrate BASE64] Starting migration...');
    console.log('👤 [Migrate BASE64] Requested by:', req.user.email);
    
    // Check Cloudinary config
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary not configured. Please set CLOUDINARY_* environment variables.');
    }
    
    // Get all camps
    const allCamps = await Camp.find({});
    
    let processedCamps = 0;
    let migratedPhotos = 0;
    let errorCount = 0;
    const errors = [];
    const migratedCampDetails = [];
    
    for (const camp of allCamps) {
      if (!camp.photos || camp.photos.length === 0) continue;
      
      let campNeedsMigration = false;
      const newPhotos = [];
      
      // Check each photo
      for (let i = 0; i < camp.photos.length; i++) {
        const photo = camp.photos[i];
        
        // Handle both string and object formats
        let photoStr = null;
        if (typeof photo === 'string') {
          photoStr = photo;
        } else if (photo && typeof photo === 'object') {
          // Try to reconstruct string from character object
          const keys = Object.keys(photo).filter(k => !isNaN(k)).sort((a, b) => Number(a) - Number(b));
          if (keys.length > 0) {
            photoStr = keys.map(k => photo[k]).join('');
          }
        }
        
        if (!photoStr) {
          newPhotos.push(photo); // Keep as-is if we can't process it
          continue;
        }
        
        // Check if it's base64
        if (photoStr.startsWith('data:image/')) {
          campNeedsMigration = true;
          
          try {
            console.log(`🔄 [Migrate BASE64] Uploading photo ${i} for camp ${camp.name}...`);
            
            // Upload to Cloudinary
            const cloudinaryUrl = await uploadBase64ToCloudinary(photoStr, camp._id, i);
            
            console.log(`✅ [Migrate BASE64] Uploaded: ${cloudinaryUrl.substring(0, 80)}...`);
            
            // Store as object format {url, caption, isPrimary}
            newPhotos.push({
              url: cloudinaryUrl,
              caption: '',
              isPrimary: i === 0 // First photo is primary
            });
            
            migratedPhotos++;
          } catch (error) {
            errorCount++;
            const errorMsg = `${camp.name} photo ${i}: ${error.message}`;
            console.error(`❌ [Migrate BASE64] ${errorMsg}`);
            errors.push(errorMsg);
            
            // Keep original on error
            newPhotos.push(photo);
          }
        } else {
          // Already Cloudinary URL or other format - convert to object if string
          if (typeof photoStr === 'string' && photoStr.includes('cloudinary.com')) {
            newPhotos.push({
              url: photoStr,
              caption: '',
              isPrimary: i === 0
            });
          } else {
            newPhotos.push(photo);
          }
        }
      }
      
      // Save if camp had base64 photos
      if (campNeedsMigration) {
        try {
          camp.photos = newPhotos;
          await camp.save({ validateBeforeSave: true });
          
          processedCamps++;
          migratedCampDetails.push({
            name: camp.name,
            photosCount: newPhotos.length
          });
          
          console.log(`✅ [Migrate BASE64] Saved camp: ${camp.name} with ${newPhotos.length} photos`);
        } catch (error) {
          errorCount++;
          const errorMsg = `${camp.name} save error: ${error.message}`;
          console.error(`❌ [Migrate BASE64] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }
    
    console.log('📊 [Migrate BASE64] Summary:');
    console.log(`   Camps processed: ${processedCamps}`);
    console.log(`   Photos migrated: ${migratedPhotos}`);
    console.log(`   Errors: ${errorCount}`);
    
    const success = errorCount === 0 && migratedPhotos > 0;
    
    res.json({
      success,
      summary: {
        campsProcessed: processedCamps,
        photosMigrated: migratedPhotos,
        errorCount
      },
      migratedCamps: migratedCampDetails,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors shown
      message: success 
        ? `✅ Migration complete! ${migratedPhotos} photos uploaded to Cloudinary.`
        : `⚠️ Migration completed with ${errorCount} errors. ${migratedPhotos} photos migrated.`
    });

  } catch (error) {
    console.error('❌ [Migrate BASE64] Fatal error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

module.exports = router;
