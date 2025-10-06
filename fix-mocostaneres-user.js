// Script to create/update mocostaneres@gmail.com user properly
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./server/models/User');

const fixMocostaneresUser = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'mocostaneres@gmail.com';
    
    let user = await User.findOne({ email });

    if (user) {
      console.log('👤 User already exists, updating...');
      user.accountType = 'camp';
      user.campName = 'Mudskippers';
      await user.save();
      console.log('✅ User updated successfully!\n');
    } else {
      console.log('👤 Creating new user...');
      const hashedPassword = await bcrypt.hash('weh0809', 10);
      user = await User.create({
        email,
        password: hashedPassword,
        accountType: 'camp',
        firstName: 'Mo',
        lastName: 'Costa-Neres',
        campName: 'Mudskippers',
        phoneNumber: '+1 310-890-8708',
        yearsBurned: 5,
        burningManExperience: 'veteran',
        hasTicket: true,
        hasVehiclePass: true,
        arrivalDate: new Date('2026-09-25'),
        departureDate: new Date('2026-10-02')
      });
      console.log('✅ User created successfully!\n');
    }

    console.log('📋 User details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Account Type: ${user.accountType}`);
    console.log(`   Camp Name: ${user.campName}`);
    console.log(`   ID: ${user._id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixMocostaneresUser();

