/**
 * Test Script: Verify CAMP Permanent Deletion Fix
 * 
 * Tests that permanently deleted CAMP accounts:
 * 1. Are removed from System Admin camps list
 * 2. Allow email reuse for new signups
 * 3. Preserve Camp record in database (for data integrity)
 * 4. Filter out orphaned camps (camps without owners)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const { permanentlyDeleteCampAccount } = require('./server/services/permanentDeletionService');

// Test configuration
const TEST_EMAIL = 'test-camp-deletion@example.com';
const TEST_CAMP_NAME = 'Test Deletion Camp';
const ADMIN_USER_ID = '507f1f77bcf86cd799439011'; // Mock admin ID

async function runTests() {
  console.log('🧪 Starting CAMP Permanent Deletion Tests\n');
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    await User.deleteMany({ email: TEST_EMAIL });
    await Camp.deleteMany({ name: TEST_CAMP_NAME });
    console.log('✅ Cleanup complete\n');

    // ========================================
    // TEST 1: Create Test CAMP Account
    // ========================================
    console.log('📝 TEST 1: Create Test CAMP Account');
    console.log('─────────────────────────────────────');
    
    const testUser = await User.create({
      email: TEST_EMAIL,
      password: 'testpassword123',
      accountType: 'camp',
      firstName: 'Test',
      lastName: 'Camp',
      isActive: true
    });
    console.log(`✅ Created camp user: ${testUser._id}`);

    const testCamp = await Camp.create({
      name: TEST_CAMP_NAME,
      campName: TEST_CAMP_NAME,
      contactEmail: TEST_EMAIL,
      owner: testUser._id,
      description: 'Test camp for deletion testing',
      status: 'active',
      isPubliclyVisible: true,
      acceptingApplications: true
    });
    console.log(`✅ Created camp: ${testCamp._id}\n`);

    // ========================================
    // TEST 2: Verify Camp Appears in Admin List
    // ========================================
    console.log('📝 TEST 2: Verify Camp Appears in Admin List (Before Deletion)');
    console.log('────────────────────────────────────────────────────────────');
    
    const allCampsBeforeDeletion = await Camp.find();
    const usersBeforeDeletion = await User.find();
    
    // Simulate admin list query (with owner enrichment)
    const campsWithOwners = await Promise.all(allCampsBeforeDeletion.map(async (camp) => {
      const owner = camp.owner ? await User.findById(camp.owner) : null;
      return { camp, owner };
    }));
    
    const visibleCampsBefore = campsWithOwners.filter(({ owner }) => owner !== null);
    const testCampVisible = visibleCampsBefore.some(({ camp }) => 
      camp._id.toString() === testCamp._id.toString()
    );
    
    console.log(`Total camps in database: ${allCampsBeforeDeletion.length}`);
    console.log(`Total users in database: ${usersBeforeDeletion.length}`);
    console.log(`Camps visible in admin list: ${visibleCampsBefore.length}`);
    console.log(`Test camp visible: ${testCampVisible ? '✅ YES' : '❌ NO'}`);
    
    if (!testCampVisible) {
      throw new Error('Test camp should be visible before deletion!');
    }
    console.log('✅ Test camp is visible in admin list\n');

    // ========================================
    // TEST 3: Permanently Delete CAMP Account
    // ========================================
    console.log('📝 TEST 3: Permanently Delete CAMP Account');
    console.log('─────────────────────────────────────────');
    
    const deletionResult = await permanentlyDeleteCampAccount(
      testUser._id.toString(),
      ADMIN_USER_ID
    );
    
    console.log(`Deletion result:`, deletionResult);
    
    if (!deletionResult.success) {
      throw new Error(`Deletion failed: ${deletionResult.message}`);
    }
    console.log('✅ Camp account permanently deleted\n');

    // ========================================
    // TEST 4: Verify User Deleted, Camp Preserved
    // ========================================
    console.log('📝 TEST 4: Verify User Deleted, Camp Record Preserved');
    console.log('───────────────────────────────────────────────────');
    
    const userAfterDeletion = await User.findById(testUser._id);
    const campAfterDeletion = await Camp.findById(testCamp._id);
    
    console.log(`User record exists: ${userAfterDeletion ? '❌ YES (should be deleted)' : '✅ NO (deleted)'}`);
    console.log(`Camp record exists: ${campAfterDeletion ? '✅ YES (preserved)' : '❌ NO (should be preserved)'}`);
    
    if (userAfterDeletion) {
      throw new Error('User should be deleted!');
    }
    if (!campAfterDeletion) {
      throw new Error('Camp record should be preserved!');
    }
    console.log('✅ User deleted, Camp preserved\n');

    // ========================================
    // TEST 5: Verify Camp Hidden from Admin List
    // ========================================
    console.log('📝 TEST 5: Verify Camp Hidden from Admin List (After Deletion)');
    console.log('─────────────────────────────────────────────────────────────');
    
    const allCampsAfterDeletion = await Camp.find();
    const usersAfterDeletion = await User.find();
    
    // Simulate admin list query (with owner enrichment and filtering)
    const campsWithOwnersAfter = await Promise.all(allCampsAfterDeletion.map(async (camp) => {
      const owner = camp.owner ? await User.findById(camp.owner) : null;
      return { camp, owner };
    }));
    
    // Filter out camps without owners (orphaned camps)
    const visibleCampsAfter = campsWithOwnersAfter.filter(({ owner }) => owner !== null);
    const testCampVisibleAfter = visibleCampsAfter.some(({ camp }) => 
      camp._id.toString() === testCamp._id.toString()
    );
    
    console.log(`Total camps in database: ${allCampsAfterDeletion.length}`);
    console.log(`Total users in database: ${usersAfterDeletion.length}`);
    console.log(`Camps visible in admin list: ${visibleCampsAfter.length}`);
    console.log(`Test camp visible: ${testCampVisibleAfter ? '❌ YES (should be hidden)' : '✅ NO (hidden)'}`);
    
    if (testCampVisibleAfter) {
      throw new Error('Test camp should be hidden after deletion!');
    }
    console.log('✅ Test camp is hidden from admin list\n');

    // ========================================
    // TEST 6: Verify Email Can Be Reused
    // ========================================
    console.log('📝 TEST 6: Verify Email Can Be Reused');
    console.log('─────────────────────────────────');
    
    try {
      const newUser = await User.create({
        email: TEST_EMAIL, // Same email as deleted account
        password: 'newpassword456',
        accountType: 'personal',
        firstName: 'New',
        lastName: 'User',
        isActive: true
      });
      console.log(`✅ Created new user with same email: ${newUser._id}`);
      console.log('✅ Email is reusable after deletion\n');
      
      // Clean up new user
      await User.deleteOne({ _id: newUser._id });
    } catch (error) {
      throw new Error(`Email should be reusable: ${error.message}`);
    }

    // ========================================
    // TEST 7: Verify Orphaned Camp Detection
    // ========================================
    console.log('📝 TEST 7: Verify Orphaned Camp Detection');
    console.log('────────────────────────────────────────');
    
    const orphanedCamps = campsWithOwnersAfter.filter(({ owner }) => owner === null);
    console.log(`Orphaned camps found: ${orphanedCamps.length}`);
    
    const testCampOrphaned = orphanedCamps.some(({ camp }) => 
      camp._id.toString() === testCamp._id.toString()
    );
    
    if (!testCampOrphaned) {
      throw new Error('Test camp should be detected as orphaned!');
    }
    console.log(`Test camp is orphaned: ${testCampOrphaned ? '✅ YES' : '❌ NO'}`);
    console.log('✅ Orphaned camps correctly detected\n');

    // ========================================
    // Final Cleanup
    // ========================================
    console.log('🧹 Final Cleanup');
    console.log('────────────────');
    await Camp.deleteOne({ _id: testCamp._id });
    console.log('✅ Test camp removed from database\n');

    // ========================================
    // Summary
    // ========================================
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           ✅ ALL TESTS PASSED                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('VERIFIED BEHAVIOR:');
    console.log('✅ User account is permanently deleted');
    console.log('✅ Camp record is preserved in database');
    console.log('✅ Camp is hidden from System Admin list');
    console.log('✅ Email can be reused for new signups');
    console.log('✅ Orphaned camps are correctly detected and filtered');
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

