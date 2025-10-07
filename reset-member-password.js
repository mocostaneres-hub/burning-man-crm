const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config();

const resetPassword = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'mnomnobr@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
      process.exit(1);
    }

    console.log('Found user:', user.email);
    console.log('Current account type:', user.accountType);
    console.log('Name:', user.firstName, user.lastName);

    // Reset password - set to plain text, pre-save hook will hash it
    const newPassword = 'weh0809';
    user.password = newPassword;
    await user.save();

    console.log('\n✅ Password reset successfully!');
    console.log('Email:', email);
    console.log('New password:', newPassword);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
};

resetPassword();

