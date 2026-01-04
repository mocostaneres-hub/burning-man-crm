// Script to list all camps in MongoDB
const mongoose = require('mongoose');
require('dotenv').config();

const Camp = require('./server/models/Camp');
const User = require('./server/models/User');

const listCamps = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const camps = await Camp.find({}).limit(5);
    console.log(`📋 Found ${camps.length} camps:\n`);
    
    camps.forEach((camp, index) => {
      console.log(`${index + 1}. ${camp.campName}`);
      console.log(`   ID: ${camp._id}`);
      console.log(`   Owner Email: ${camp.contactEmail}`);
      console.log(`   Slug: ${camp.slug}\n`);
    });

    // Check admin user
    const admin = await User.findOne({ email: 'mudskipperscafe@gmail.com' });
    if (admin) {
      console.log('👤 Admin user:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Camp Name: ${admin.campName || 'NOT SET'}`);
      console.log(`   Account Type: ${admin.accountType}\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

listCamps();

