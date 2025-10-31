// Script to make a specific camp public so it appears in camp discovery
const mongoose = require('mongoose');
require('dotenv').config();

const db = require('./server/database/databaseAdapter');

const makeCampPublic = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Camp ID to update (from user's issue)
    const campId = '69040bc9c29fb8449b249806';

    // Find the camp
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      console.log('❌ Camp not found:', campId);
      process.exit(1);
    }

    console.log('🔍 Found camp:', camp.name);
    console.log('🔍 Current isPublic:', camp.isPublic);

    // Update camp to be public
    const updatedCamp = await db.updateCampById(campId, {
      isPublic: true
    });

    if (updatedCamp) {
      console.log('✅ Camp updated successfully!');
      console.log('✅ Camp name:', updatedCamp.name);
      console.log('✅ Camp is now public:', updatedCamp.isPublic);
    } else {
      console.log('❌ Failed to update camp');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

makeCampPublic();

