const db = require('./server/database/databaseAdapter');
const bcrypt = require('bcryptjs');

async function updateCampPassword() {
  try {
    console.log('🔍 Searching for camp "Celestial Booties"...');
    
    // First, let's search for the camp by name or similar
    const camps = await db.findCamps({});
    const matchingCamps = camps.filter(c => 
      c.campName && (
        c.campName.toLowerCase().includes('celestial') ||
        c.campName.toLowerCase().includes('booties') ||
        c.campName.toLowerCase().includes('celestial booties')
      )
    );
    
    if (matchingCamps.length === 0) {
      console.log('❌ Camp "Celestial Booties" not found');
      console.log('Available camps:');
      camps.slice(0, 10).forEach(c => {
        console.log(`- ${c.campName} (ID: ${c._id})`);
      });
      return;
    }
    
    const camp = matchingCamps[0];
    console.log(`✅ Found camp: ${camp.campName} (ID: ${camp._id})`);
    
    // Find users associated with this camp
    const users = await db.findUsers({ campId: camp._id });
    if (users.length === 0) {
      console.log('❌ No users found for this camp');
      return;
    }
    
    console.log(`\n👥 Found ${users.length} user(s) for this camp:`);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.accountType})`);
    });
    
    // Update password for all users associated with this camp
    const newPassword = 'weh0809';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    console.log('\n🔐 Updating passwords...');
    for (const user of users) {
      try {
        // For MongoDB, we need to use the User model directly to trigger pre-save hooks
        if (process.env.MONGODB_URI) {
          const User = require('./server/models/User');
          const userDoc = await User.findById(user._id);
          if (userDoc) {
            userDoc.password = newPassword; // Let the pre-save hook hash it
            await userDoc.save();
            console.log(`✅ Updated password for ${user.email}`);
          }
        } else {
          // For mock database, hash manually
          await db.updateUser(user.email, { password: hashedPassword });
          console.log(`✅ Updated password for ${user.email}`);
        }
      } catch (error) {
        console.error(`❌ Failed to update password for ${user.email}:`, error.message);
      }
    }
    
    // Test login with new password
    console.log('\n🧪 Testing login with new password...');
    const testUser = users[0];
    const loginTest = await db.comparePassword(testUser, newPassword);
    
    if (loginTest) {
      console.log('✅ Password change and login verification successful!');
      console.log(`\n📋 Summary:`);
      console.log(`- Camp: ${camp.campName}`);
      console.log(`- New password: ${newPassword}`);
      console.log(`- Users updated: ${users.length}`);
      console.log(`- Login test: ✅ Passed`);
    } else {
      console.log('❌ Password change verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

updateCampPassword();
