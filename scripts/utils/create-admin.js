// Script to create initial admin user
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./server/models/User');

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'mudskipperscafe@gmail.com' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('weh0809', salt);

    // Create admin user
    const admin = new User({
      email: 'mudskipperscafe@gmail.com',
      password: hashedPassword,
      accountType: 'admin',
      firstName: 'Mo',
      lastName: 'Costa-Neres',
      isActive: true,
      isVerified: true,
      phoneNumber: '+1 310-890-8708',
      city: 'Venice, CA',
      yearsBurned: 0,
      previousCamps: 'BRC Weekly, UT',
      socialMedia: {
        instagram: 'mano_lax',
        facebook: 'mocostaneres',
        linkedin: 'https://www.linkedin.com/in/manolax/'
      }
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('   Email: mudskipperscafe@gmail.com');
    console.log('   Password: weh0809');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAdmin();

