// Script to reset mocostaneres password
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./server/models/User');

const resetPassword = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: 'mocostaneres@gmail.com' });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('Found user:', user.email);
    console.log('Current account type:', user.accountType);
    console.log('Current campId:', user.campId);
    console.log('Current campName:', user.campName);

    // Reset password - set to plain text, pre-save hook will hash it
    const newPassword = 'weh0809';
    user.password = newPassword;
    await user.save();

    console.log('\n✅ Password reset successfully!');
    console.log('New password:', newPassword);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetPassword();

