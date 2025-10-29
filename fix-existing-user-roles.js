/**
 * Migration Script: Fix Existing User Roles
 * 
 * This script updates all existing users who have null/undefined roles
 * to set their role based on their accountType:
 * - accountType: 'camp' -> role: 'camp_lead'
 * - accountType: 'personal' -> role: 'member'
 */

const db = require('./server/database/databaseAdapter');

async function fixExistingUserRoles() {
  try {
    console.log('🔧 Starting user role migration...\n');

    // Load all users
    const mockDb = require('./server/database/mockDatabase');
    await mockDb.loadData();

    const users = Array.from(mockDb.collections.users.values());
    console.log(`📊 Found ${users.length} total users\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if user needs role assignment
      if (!user.role || user.role === 'unassigned') {
        const newRole = user.accountType === 'camp' ? 'camp_lead' : 'member';
        
        console.log(`✏️  Updating user: ${user.email}`);
        console.log(`   - Account Type: ${user.accountType}`);
        console.log(`   - Old Role: ${user.role || 'null/undefined'}`);
        console.log(`   - New Role: ${newRole}`);

        // Update the user
        user.role = newRole;
        mockDb.collections.users.set(user._id, user);
        updatedCount++;
        console.log(`   ✅ Updated!\n`);
      } else {
        console.log(`⏭️  Skipping user: ${user.email} (already has role: ${user.role})`);
        skippedCount++;
      }
    }

    // Save the updated data
    await mockDb.saveData();

    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   - Total Users: ${users.length}`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log('='.repeat(50) + '\n');

    if (updatedCount > 0) {
      console.log('💡 Next Steps:');
      console.log('   1. Restart your backend server');
      console.log('   2. Clear localStorage in your browser (or logout/login)');
      console.log('   3. Test logging in with existing accounts\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixExistingUserRoles();

