/**
 * Migration: Convert Camp photos from String array to Object array
 * 
 * Issue: Schema had duplicate `photos` field definitions:
 * - Line 86: photos: [{ url, caption, isPrimary }]
 * - Line 272: photos: [String] (was overwriting first definition)
 * 
 * This migration ensures all existing camps have photos in correct format.
 * 
 * Run: node scripts/migrations/migrate-photos-to-objects.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Camp = require('../../server/models/Camp');

async function migrateCampPhotos() {
  try {
    console.log('🔄 [Migration] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ [Migration] Connected to MongoDB');

    console.log('🔍 [Migration] Finding camps with photos...');
    const camps = await Camp.find({ photos: { $exists: true, $ne: [] } });
    console.log(`📊 [Migration] Found ${camps.length} camps with photos`);

    let migratedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;

    for (const camp of camps) {
      try {
        let needsMigration = false;
        const migratedPhotos = [];

        // Check if photos need migration
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
            } else {
              console.warn(`⚠️ [Migration] Camp ${camp._id}: Invalid photo format:`, photo);
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
          console.log(`✅ [Migration] Camp ${camp._id} (${camp.name}): Migrated ${migratedPhotos.length} photos`);
        } else {
          alreadyCorrectCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [Migration] Error migrating camp ${camp._id}:`, error.message);
      }
    }

    console.log('\n📊 [Migration] Summary:');
    console.log(`   Total camps checked: ${camps.length}`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ✓ Already correct: ${alreadyCorrectCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    console.log('\n✅ [Migration] Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ [Migration] Fatal error:', error);
    process.exit(1);
  }
}

// Run migration
migrateCampPhotos();
