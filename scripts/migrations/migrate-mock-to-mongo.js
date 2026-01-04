// Script to migrate mock data to MongoDB
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const Member = require('./server/models/Member');
const Roster = require('./server/models/Roster');
const MemberApplication = require('./server/models/MemberApplication');

const migrateMockData = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Read mock data
    const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
    const mockDataRaw = await fs.readFile(mockDataPath, 'utf-8');
    const mockData = JSON.parse(mockDataRaw);

    console.log('📦 Mock data loaded');

    // Migrate Users (skip if already exist)
    console.log('\n👤 Migrating users...');
    const users = Array.from(mockData.users || []);
    let userCount = 0;
    for (const [id, userData] of users) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (!existingUser) {
          await User.create(userData);
          userCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped user ${userData.email}: ${error.message}`);
      }
    }
    console.log(`  ✅ Migrated ${userCount} users`);

    // Migrate Camps
    console.log('\n🏕️  Migrating camps...');
    const camps = Array.from(mockData.camps || []);
    let campCount = 0;
    for (const [id, campData] of camps) {
      try {
        const existingCamp = await Camp.findOne({ slug: campData.slug });
        if (!existingCamp) {
          await Camp.create(campData);
          campCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped camp ${campData.campName}: ${error.message}`);
      }
    }
    console.log(`  ✅ Migrated ${campCount} camps`);

    // Migrate Members
    console.log('\n👥 Migrating members...');
    const members = Array.from(mockData.members || []);
    let memberCount = 0;
    for (const [id, memberData] of members) {
      try {
        const existingMember = await Member.findOne({ user: memberData.user, camp: memberData.camp });
        if (!existingMember) {
          await Member.create(memberData);
          memberCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped member: ${error.message}`);
      }
    }
    console.log(`  ✅ Migrated ${memberCount} members`);

    // Migrate Rosters
    console.log('\n📋 Migrating rosters...');
    const rosters = Array.from(mockData.rosters || []);
    let rosterCount = 0;
    for (const [id, rosterData] of rosters) {
      try {
        const existingRoster = await Roster.findOne({ _id: rosterData._id });
        if (!existingRoster) {
          await Roster.create(rosterData);
          rosterCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped roster ${rosterData.name}: ${error.message}`);
      }
    }
    console.log(`  ✅ Migrated ${rosterCount} rosters`);

    // Migrate Applications
    console.log('\n📝 Migrating applications...');
    const applications = Array.from(mockData.applications || []);
    let appCount = 0;
    for (const [id, appData] of applications) {
      try {
        const existingApp = await MemberApplication.findOne({ _id: appData._id });
        if (!existingApp) {
          await MemberApplication.create(appData);
          appCount++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped application: ${error.message}`);
      }
    }
    console.log(`  ✅ Migrated ${appCount} applications`);

    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateMockData();

