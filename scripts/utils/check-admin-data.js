#!/usr/bin/env node

/**
 * Check if admin data exists and counts
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQO0wB@yamanote.proxy.rlwy.net:41945/test';

async function checkData() {
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to database:', mongoose.connection.name);
    console.log('📊 Checking collections:\n');
    console.log('='.repeat(80));

    const collections = [
      'users',
      'camps', 
      'members',
      'rosters',
      'admins',
      'campcategories',
      'globalperks',
      'tasks',
      'events'
    ];

    for (const collName of collections) {
      try {
        const count = await mongoose.connection.db.collection(collName).countDocuments();
        const icon = count > 0 ? '✅' : '⭕';
        console.log(`${icon} ${collName.padEnd(25)} ${count.toString().padStart(6)} documents`);
        
        // For key collections, show sample data
        if (count > 0 && ['users', 'camps', 'admins'].includes(collName)) {
          const sample = await mongoose.connection.db.collection(collName).findOne({}, { projection: { _id: 1, email: 1, campName: 1, name: 1, accountType: 1 } });
          if (sample) {
            console.log(`   Sample: ${JSON.stringify(sample)}`);
          }
        }
      } catch (err) {
        console.log(`❌ ${collName.padEnd(25)} Error: ${err.message}`);
      }
    }

    console.log('='.repeat(80));

    // Check specifically for admin user
    console.log('\n🔍 Checking for admin user: mocostaneres@gmail.com\n');
    
    const adminUser = await mongoose.connection.db.collection('users').findOne(
      { email: 'mocostaneres@gmail.com' },
      { projection: { email: 1, accountType: 1, isSystemAdmin: 1, createdAt: 1 } }
    );

    if (adminUser) {
      console.log('✅ Admin user found:');
      console.log(JSON.stringify(adminUser, null, 2));
    } else {
      console.log('❌ Admin user NOT found!');
      console.log('   Searching for any admin users...');
      
      const anyAdmins = await mongoose.connection.db.collection('users').find(
        { accountType: 'admin' }
      ).limit(5).toArray();
      
      if (anyAdmins.length > 0) {
        console.log(`\n   Found ${anyAdmins.length} admin user(s):`);
        anyAdmins.forEach(admin => {
          console.log(`   - ${admin.email} (accountType: ${admin.accountType})`);
        });
      } else {
        console.log('   No admin users found in database!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

checkData();
