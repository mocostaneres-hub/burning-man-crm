// Script to create applications for 6 Mudskippers members
const mongoose = require('mongoose');
require('dotenv').config();

const MemberApplication = require('./server/models/MemberApplication');
const User = require('./server/models/User');
const Camp = require('./server/models/Camp');

async function createApplications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm');
    console.log('✅ Connected to MongoDB');

    // Find Mudskippers camp
    const camp = await Camp.findOne({ name: 'Mudskippers' });
    if (!camp) {
      console.error('❌ Mudskippers camp not found');
      process.exit(1);
    }
    console.log(`✅ Found Mudskippers camp: ${camp._id}`);

    // List of members to create applications for
    const memberNames = [
      { firstName: 'David', lastName: 'Miller' },
      { firstName: 'Lisa', lastName: 'Wilson' },
      { firstName: 'Kate', lastName: 'Thomas' },
      { firstName: 'Ryan', lastName: 'Jackson' },
      { firstName: 'Jessica', lastName: 'White' },
      { firstName: 'Chris', lastName: 'Moore' }
    ];

    const createdApplications = [];
    const notFoundUsers = [];

    for (const memberName of memberNames) {
      // Find user
      const user = await User.findOne({
        firstName: { $regex: new RegExp(`^${memberName.firstName}$`, 'i') },
        lastName: { $regex: new RegExp(`^${memberName.lastName}$`, 'i') }
      });

      if (!user) {
        notFoundUsers.push(`${memberName.firstName} ${memberName.lastName}`);
        console.log(`⚠️  User not found: ${memberName.firstName} ${memberName.lastName}`);
        continue;
      }

      // Check if application already exists
      const existingApp = await MemberApplication.findOne({
        userId: user._id,
        campId: camp._id
      });

      if (existingApp) {
        console.log(`ℹ️  Application already exists for ${user.firstName} ${user.lastName} (Status: ${existingApp.status})`);
        continue;
      }

      // Create new application
      const application = new MemberApplication({
        userId: user._id,
        campId: camp._id,
        status: 'pending',
        answers: {
          whyJoin: `I'm excited to join Mudskippers and contribute to the camp community at Burning Man.`,
          skillsToOffer: user.skills?.join(', ') || 'Team player, willing to help wherever needed',
          expectations: 'Looking forward to participating in camp activities and making new connections.',
          previousExperience: user.burningManExperience || 'New to Burning Man, eager to learn.',
          additionalInfo: ''
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await application.save();
      createdApplications.push(`${user.firstName} ${user.lastName}`);
      console.log(`✅ Created application for ${user.firstName} ${user.lastName}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Applications created: ${createdApplications.length}`);
    if (createdApplications.length > 0) {
      console.log('   - ' + createdApplications.join('\n   - '));
    }
    if (notFoundUsers.length > 0) {
      console.log(`⚠️  Users not found: ${notFoundUsers.length}`);
      console.log('   - ' + notFoundUsers.join('\n   - '));
    }

    await mongoose.disconnect();
    console.log('\n✅ Script completed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createApplications();

