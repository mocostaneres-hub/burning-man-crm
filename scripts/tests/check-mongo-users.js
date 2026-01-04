// Script to check all users in MongoDB
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');
const Camp = require('./server/models/Camp');

const checkUsers = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).limit(10);
    console.log(`📋 Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Account Type: ${user.accountType}`);
      console.log(`   Camp Name: ${user.campName || 'NOT SET'}\n`);
    });

    const camps = await Camp.find({});
    console.log(`\n🏕️  Found ${camps.length} camps:\n`);
    
    camps.forEach((camp, index) => {
      console.log(`${index + 1}. ${camp.campName}`);
      console.log(`   ID: ${camp._id}`);
      console.log(`   Contact Email: ${camp.contactEmail}`);
      console.log(`   Owner ID: ${camp.owner}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkUsers();

