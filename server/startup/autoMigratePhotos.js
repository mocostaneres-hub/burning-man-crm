/**
 * Auto-migrate photos on startup
 * Runs once automatically when server starts
 * Safe to run multiple times (idempotent)
 */

const Camp = require('../models/Camp');

async function autoMigratePhotosOnStartup() {
  // Only run in production or if explicitly enabled
  const shouldRun = process.env.AUTO_MIGRATE_PHOTOS === 'true' || process.env.NODE_ENV === 'production';
  
  if (!shouldRun) {
    console.log('ℹ️  [Auto-Migration] Skipped (set AUTO_MIGRATE_PHOTOS=true to enable)');
    return;
  }

  try {
    console.log('🔄 [Auto-Migration] Checking for camps needing photo format migration...');
    
    // Quick check: find camps with string photos
    const campsToCheck = await Camp.find({ 
      photos: { $exists: true, $ne: [] } 
    }).limit(10);
    
    let needsMigration = false;
    for (const camp of campsToCheck) {
      if (Array.isArray(camp.photos) && camp.photos.length > 0) {
        if (typeof camp.photos[0] === 'string') {
          needsMigration = true;
          break;
        }
      }
    }
    
    if (!needsMigration) {
      console.log('✅ [Auto-Migration] All camps have correct photo format - skipping migration');
      return;
    }
    
    console.log('⚠️  [Auto-Migration] Found camps with string photos - starting migration...');
    
    const camps = await Camp.find({ photos: { $exists: true, $ne: [] } });
    let migratedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const camp of camps) {
      try {
        let needsCampMigration = false;
        const migratedPhotos = [];
        
        if (Array.isArray(camp.photos)) {
          for (const photo of camp.photos) {
            if (typeof photo === 'string') {
              needsCampMigration = true;
              migratedPhotos.push({
                url: photo,
                caption: '',
                isPrimary: false
              });
            } else if (photo && typeof photo === 'object' && photo.url) {
              migratedPhotos.push({
                url: photo.url,
                caption: photo.caption || '',
                isPrimary: photo.isPrimary || false
              });
            }
          }
        }
        
        if (needsCampMigration) {
          // Set first photo as primary if none are
          if (!migratedPhotos.some(p => p.isPrimary) && migratedPhotos.length > 0) {
            migratedPhotos[0].isPrimary = true;
          }
          
          camp.photos = migratedPhotos;
          await camp.save();
          migratedCount++;
        } else {
          alreadyCorrectCount++;
        }
      } catch (error) {
        console.error(`❌ [Auto-Migration] Error migrating camp ${camp._id}:`, error.message);
      }
    }
    
    console.log('✅ [Auto-Migration] Complete!');
    console.log(`   Migrated: ${migratedCount} camps`);
    console.log(`   Already correct: ${alreadyCorrectCount} camps`);
    
  } catch (error) {
    console.error('❌ [Auto-Migration] Fatal error:', error);
    // Don't crash server, just log error
  }
}

module.exports = { autoMigratePhotosOnStartup };
