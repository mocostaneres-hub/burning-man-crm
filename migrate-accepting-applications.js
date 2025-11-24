/**
 * Migration Script: Consolidate acceptingNewMembers and showApplyNow into acceptingApplications
 * 
 * This script migrates existing camps to use the new consolidated acceptingApplications field.
 * Logic: If either acceptingNewMembers OR showApplyNow is true, set acceptingApplications to true
 * 
 * Run with: node migrate-accepting-applications.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Use MONGODB_URI or MONGO_URI from environment
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Error: MONGODB_URI or MONGO_URI environment variable is not set');
  process.exit(1);
}

const campSchema = new mongoose.Schema({}, { strict: false });
const Camp = mongoose.model('Camp', campSchema);

async function migrateAcceptingApplications() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Analyzing existing camps...');
    
    // Find all camps
    const camps = await Camp.find({});
    console.log(`Found ${camps.length} camps`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const camp of camps) {
      try {
        // Determine new acceptingApplications value
        // If either old field is true, set new field to true
        const acceptingNewMembers = camp.acceptingNewMembers !== false; // default true
        const showApplyNow = camp.showApplyNow !== false; // default true
        const acceptingApplications = acceptingNewMembers || showApplyNow;

        // Check if already has the new field and matches our logic
        if (camp.acceptingApplications !== undefined && camp.acceptingApplications === acceptingApplications) {
          console.log(`⏭️  Skipping ${camp.name || camp._id} - already migrated`);
          skippedCount++;
          continue;
        }

        // Update the camp with new field
        await Camp.updateOne(
          { _id: camp._id },
          { 
            $set: { 
              acceptingApplications: acceptingApplications 
            } 
          }
        );

        console.log(`✅ Migrated ${camp.name || camp._id}:`);
        console.log(`   - acceptingNewMembers: ${acceptingNewMembers}`);
        console.log(`   - showApplyNow: ${showApplyNow}`);
        console.log(`   - acceptingApplications: ${acceptingApplications}`);
        
        migratedCount++;
      } catch (err) {
        console.error(`❌ Error migrating camp ${camp._id}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total: ${camps.length}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  Next Steps:');
    console.log('   1. Verify the migration in your database');
    console.log('   2. Deploy the updated code that uses acceptingApplications');
    console.log('   3. After successful deployment, you can remove acceptingNewMembers and showApplyNow fields');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrateAcceptingApplications();

