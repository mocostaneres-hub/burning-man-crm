/**
 * Migration: Sync isPubliclyVisible with isPublic flag
 * 
 * Issue: Schema field renamed from `isPublic` to `isPubliclyVisible`
 * but existing camps weren't migrated.
 * 
 * Solution: Set isPubliclyVisible = true for all camps where isPublic = true
 * 
 * SAFE: Only adds missing flag, doesn't delete photos or other data
 * 
 * Run: node scripts/migrations/migrate-visibility-flags.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Camp = require('../../server/models/Camp');

async function migrateVisibilityFlags() {
  try {
    console.log('🔄 [Migration] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ [Migration] Connected to MongoDB');

    console.log('🔍 [Migration] Finding camps with visibility flag issues...');
    
    // Find camps where isPublic=true but isPubliclyVisible is not true
    const campsToFix = await Camp.find({
      $or: [
        { isPublic: true, isPubliclyVisible: { $ne: true } },
        { isPublic: true, isPubliclyVisible: { $exists: false } }
      ]
    });
    
    console.log(`📊 [Migration] Found ${campsToFix.length} camps to fix`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const camp of campsToFix) {
      try {
        console.log(`🔄 [Migration] Processing camp: ${camp.name} (${camp._id})`);
        console.log(`   - Current isPublic: ${camp.isPublic}`);
        console.log(`   - Current isPubliclyVisible: ${camp.isPubliclyVisible}`);
        console.log(`   - Photos count: ${camp.photos?.length || 0}`);
        
        // SAFE: Only set isPubliclyVisible, don't touch photos or other data
        camp.isPubliclyVisible = true;
        
        await camp.save({ validateBeforeSave: true });
        
        migratedCount++;
        console.log(`✅ [Migration] Camp ${camp._id} (${camp.name}): Set isPubliclyVisible=true`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ [Migration] Error migrating camp ${camp._id}:`, error.message);
      }
    }

    console.log('\n📊 [Migration] Summary:');
    console.log(`   Total camps checked: ${campsToFix.length}`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    // Verify results
    console.log('\n🔍 [Migration] Verifying results...');
    const visibleCount = await Camp.countDocuments({ isPubliclyVisible: true });
    const oldPublicCount = await Camp.countDocuments({ isPublic: true });
    
    console.log(`   📊 Camps with isPubliclyVisible=true: ${visibleCount}`);
    console.log(`   📊 Camps with isPublic=true: ${oldPublicCount}`);
    
    if (visibleCount >= oldPublicCount) {
      console.log('\n✅ [Migration] SUCCESS: All camps migrated!');
    } else {
      console.log('\n⚠️ [Migration] WARNING: Some camps may still need attention');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ [Migration] Fatal error:', error);
    console.error('❌ [Migration] Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrateVisibilityFlags();
