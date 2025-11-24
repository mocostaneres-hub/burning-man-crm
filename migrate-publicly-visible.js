/**
 * Migration Script: Set isPubliclyVisible to true for all existing camps
 * 
 * This script ensures all existing camps remain publicly visible (backward compatibility).
 * New camps will default to false (private) until camp admin makes them public.
 * 
 * Run with: node migrate-publicly-visible.js
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

async function migratePubliclyVisible() {
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
        // Check if already has the field set
        if (camp.isPubliclyVisible !== undefined) {
          console.log(`⏭️  Skipping ${camp.name || camp.campName || camp._id} - already has isPubliclyVisible field`);
          skippedCount++;
          continue;
        }

        // Set to true for all existing camps (backward compatibility)
        await Camp.updateOne(
          { _id: camp._id },
          { 
            $set: { 
              isPubliclyVisible: true 
            } 
          }
        );

        console.log(`✅ Migrated ${camp.name || camp.campName || camp._id} - set isPubliclyVisible to true`);
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
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify all existing camps have isPubliclyVisible: true');
    console.log('   2. New camps will automatically default to isPubliclyVisible: false');
    console.log('   3. Camp admins can toggle visibility from their profile edit page');
    console.log('   4. System admins can control visibility from admin dashboard');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migratePubliclyVisible();

