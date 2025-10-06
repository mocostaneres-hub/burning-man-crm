// Script to fix the Mudskippers camp
const mongoose = require('mongoose');
require('dotenv').config();

const Camp = require('./server/models/Camp');
const User = require('./server/models/User');

const fixCamp = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find the mocostaneres user
    const mocostaneresUser = await User.findOne({ email: 'mocostaneres@gmail.com' });
    if (!mocostaneresUser) {
      console.log('❌ mocostaneres@gmail.com user not found');
      process.exit(1);
    }

    console.log(`✅ Found mocostaneres user: ${mocostaneresUser._id}\n`);

    // Find the camp owned by this user
    let camp = await Camp.findOne({ owner: mocostaneresUser._id });
    
    if (!camp) {
      console.log('❌ Camp not found for mocostaneres user');
      process.exit(1);
    }

    console.log(`✅ Found camp: ${camp._id}`);
    console.log(`   Current campName: ${camp.campName}`);
    console.log(`   Contact Email: ${camp.contactEmail}\n`);

    // Update the camp to have the correct campName
    camp.campName = 'Mudskippers';
    camp.slug = 'mudskippers';
    await camp.save();

    console.log('✅ Camp updated successfully!\n');

    // Update the user to link to this camp
    mocostaneresUser.campName = 'Mudskippers';
    mocostaneresUser.accountType = 'camp';
    await mocostaneresUser.save();

    console.log('✅ User updated successfully!\n');

    console.log('📋 Final state:');
    console.log(`   Camp Name: ${camp.campName}`);
    console.log(`   Camp ID: ${camp._id}`);
    console.log(`   User Email: ${mocostaneresUser.email}`);
    console.log(`   User Account Type: ${mocostaneresUser.accountType}`);
    console.log(`   User Camp Name: ${mocostaneresUser.campName}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixCamp();

