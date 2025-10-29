/**
 * Quick Script: Update Old User Roles
 * Updates all users without a role field to have the appropriate role
 */

const fs = require('fs');
const path = require('path');

const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');

// Read the mock database
const data = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

console.log('🔧 Updating old user roles...\n');

let updatedCount = 0;
let skippedCount = 0;

// Update users without a role
data.users = data.users.map(([email, user]) => {
  if (!user.role || user.role === 'unassigned') {
    // Determine role based on account type
    const newRole = user.accountType === 'camp' ? 'camp_lead' : 
                   user.accountType === 'admin' ? 'camp_lead' : 
                   'member';
    
    console.log(`✏️  Updating: ${email}`);
    console.log(`   Account Type: ${user.accountType}`);
    console.log(`   Old Role: ${user.role || 'undefined'}`);
    console.log(`   New Role: ${newRole}\n`);
    
    user.role = newRole;
    updatedCount++;
  } else {
    skippedCount++;
  }
  
  return [email, user];
});

// Save the updated data
fs.writeFileSync(mockDataPath, JSON.stringify(data, null, 2), 'utf8');

console.log('✅ Update complete!');
console.log(`   Updated: ${updatedCount}`);
console.log(`   Skipped: ${skippedCount}`);
console.log('\n💡 Next steps:');
console.log('   1. Restart your backend server');
console.log('   2. Users should clear their browser cache or logout/login');

