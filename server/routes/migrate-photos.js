/**
 * Photo Migration Endpoint
 * Allows running migration via HTTP request (admin only)
 * 
 * Usage: GET /api/migrate/photos-to-objects
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Camp = require('../models/Camp');

// Allow any authenticated user to run migration (safe, idempotent)
// Admin-only version kept as /admin/photos-to-objects if needed
router.get('/photos-to-objects', authenticateToken, async (req, res) => {
  try {
    console.log('📸 [Migration] Starting photo format migration...');
    console.log('📸 [Migration] Requested by user:', req.user.email, '(', req.user.accountType, ')');
    
    const camps = await Camp.find({ photos: { $exists: true, $ne: [] } });
    console.log(`📊 [Migration] Found ${camps.length} camps with photos`);

    let migratedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const camp of camps) {
      try {
        let needsMigration = false;
        const migratedPhotos = [];

        if (Array.isArray(camp.photos)) {
          for (const photo of camp.photos) {
            if (typeof photo === 'string') {
              // String format - needs migration
              needsMigration = true;
              migratedPhotos.push({
                url: photo,
                caption: '',
                isPrimary: false
              });
            } else if (photo && typeof photo === 'object' && photo.url) {
              // Object format - already correct
              migratedPhotos.push({
                url: photo.url,
                caption: photo.caption || '',
                isPrimary: photo.isPrimary || false
              });
            }
          }
        }

        if (needsMigration) {
          // Set first photo as primary if none are primary
          const hasPrimary = migratedPhotos.some(p => p.isPrimary);
          if (!hasPrimary && migratedPhotos.length > 0) {
            migratedPhotos[0].isPrimary = true;
          }

          camp.photos = migratedPhotos;
          await camp.save();
          
          migratedCount++;
          console.log(`✅ [Migration] ${camp.name} (${camp._id}): Migrated ${migratedPhotos.length} photos`);
        } else {
          alreadyCorrectCount++;
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `Camp ${camp._id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ [Migration] ${errorMsg}`);
      }
    }

    const summary = {
      success: true,
      totalCampsChecked: camps.length,
      migrated: migratedCount,
      alreadyCorrect: alreadyCorrectCount,
      errors: errorCount,
      errorDetails: errors
    };

    console.log('📊 [Migration] Summary:', summary);
    
    res.json({
      message: 'Photo migration completed',
      ...summary
    });

  } catch (error) {
    console.error('❌ [Migration] Fatal error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Migration failed', 
      error: error.message 
    });
  }
});

// Status endpoint - check if migration is needed (any authenticated user)
router.get('/photos-status', authenticateToken, async (req, res) => {
  try {
    const camps = await Camp.find({ photos: { $exists: true, $ne: [] } }).limit(100);
    
    let stringPhotoCount = 0;
    let objectPhotoCount = 0;
    
    for (const camp of camps) {
      if (Array.isArray(camp.photos) && camp.photos.length > 0) {
        if (typeof camp.photos[0] === 'string') {
          stringPhotoCount++;
        } else {
          objectPhotoCount++;
        }
      }
    }
    
    const needsMigration = stringPhotoCount > 0;
    
    res.json({
      totalCampsChecked: camps.length,
      campsWithStringPhotos: stringPhotoCount,
      campsWithObjectPhotos: objectPhotoCount,
      needsMigration,
      message: needsMigration 
        ? `⚠️ ${stringPhotoCount} camps need migration`
        : '✅ All camps have correct photo format'
    });
  } catch (error) {
    console.error('❌ [Migration Status] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
