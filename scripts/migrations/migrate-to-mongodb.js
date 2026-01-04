// Enhanced script to migrate mock data to MongoDB with proper ID handling
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
    console.log('✅ Connected to MongoDB\n');

    // Read mock data
    const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
    const mockDataRaw = await fs.readFile(mockDataPath, 'utf-8');
    const mockData = JSON.parse(mockDataRaw);

    console.log('📦 Mock data loaded\n');

    // Create ID mapping (old numeric ID -> new MongoDB ObjectId)
    const userIdMap = new Map();
    const campIdMap = new Map();
    const memberIdMap = new Map();

    // Migrate Users (without _id, let MongoDB generate it)
    console.log('👤 Migrating users...');
    const users = Array.from(mockData.users || []);
    let userCount = 0;
    for (const [mapKey, userData] of users) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          // Map both the old numeric _id AND the map key
          userIdMap.set(userData._id, existingUser._id);
          userIdMap.set(mapKey, existingUser._id);
          console.log(`  ⏭️  User already exists: ${userData.email} (${userData._id})`);
          continue;
        }

        // Remove _id and let MongoDB generate a new one
        const { _id, ...userDataWithoutId } = userData;
        const newUser = await User.create(userDataWithoutId);
        // Map both the old numeric _id AND the map key
        userIdMap.set(_id, newUser._id);
        userIdMap.set(mapKey, newUser._id);
        userCount++;
        console.log(`  ✅ Created user: ${userData.email} (${_id} -> ${newUser._id})`);
      } catch (error) {
        console.log(`  ⚠️  Skipped user ${userData.email}: ${error.message}`);
      }
    }
    console.log(`\n  ✅ Migrated ${userCount} users\n`);

    // Migrate Camps with updated owner IDs
    console.log('🏕️  Migrating camps...');
    const camps = Array.from(mockData.camps || []);
    let campCount = 0;
    for (const [mapKey, campData] of camps) {
      try {
        const existingCamp = await Camp.findOne({ slug: campData.slug });
        if (existingCamp) {
          // Map both the old numeric _id AND the map key
          campIdMap.set(campData._id, existingCamp._id);
          campIdMap.set(mapKey, existingCamp._id);
          console.log(`  ⏭️  Camp already exists: ${campData.campName} (${campData._id})`);
          continue;
        }

        // Find owner by contactEmail if owner ID not present
        const { _id, owner, categories, selectedPerks, ...campDataWithoutId } = campData;
        let newOwnerId = userIdMap.get(owner);
        
        if (!newOwnerId && campData.contactEmail) {
          // Try to find user by contact email
          const ownerUser = await User.findOne({ email: campData.contactEmail });
          if (ownerUser) {
            newOwnerId = ownerUser._id;
            console.log(`  📧 Found owner by email: ${campData.contactEmail}`);
          }
        }
        
        if (!newOwnerId) {
          console.log(`  ⚠️  Skipped camp ${campData.campName}: Owner not found (email: ${campData.contactEmail})`);
          continue;
        }

        // Skip categories and selectedPerks as they reference other collections
        const newCamp = await Camp.create({
          ...campDataWithoutId,
          owner: newOwnerId,
          categories: [], // Will be set later
          selectedPerks: [] // Will be set later
        });
        // Map both the old numeric _id AND the map key
        campIdMap.set(_id, newCamp._id);
        campIdMap.set(mapKey, newCamp._id);
        campCount++;
        console.log(`  ✅ Created camp: ${campData.campName} (${_id} -> ${newCamp._id})`);
      } catch (error) {
        console.log(`  ⚠️  Skipped camp ${campData.campName}: ${error.message}`);
      }
    }
    console.log(`\n  ✅ Migrated ${campCount} camps\n`);

    // Migrate Members with updated user and camp IDs
    console.log('👥 Migrating members...');
    const members = Array.from(mockData.members || []);
    let memberCount = 0;
    for (const [mapKey, memberData] of members) {
      try {
        // Map user and camp IDs
        const { _id, user, camp, ...memberDataWithoutId } = memberData;
        const newUserId = userIdMap.get(user);
        const newCampId = campIdMap.get(camp);
        
        if (!newUserId || !newCampId) {
          console.log(`  ⚠️  Skipped member (user: ${user}, camp: ${camp}): User or Camp not found`);
          continue;
        }

        const existingMember = await Member.findOne({ user: newUserId, camp: newCampId });
        if (existingMember) {
          // Map both the old numeric _id AND the map key
          memberIdMap.set(_id, existingMember._id);
          memberIdMap.set(mapKey, existingMember._id);
          console.log(`  ⏭️  Member already exists (${_id})`);
          continue;
        }

        const newMember = await Member.create({
          ...memberDataWithoutId,
          user: newUserId,
          camp: newCampId
        });
        // Map both the old numeric _id AND the map key
        memberIdMap.set(_id, newMember._id);
        memberIdMap.set(mapKey, newMember._id);
        memberCount++;
        console.log(`  ✅ Created member (${_id} -> ${newMember._id})`);
      } catch (error) {
        console.log(`  ⚠️  Skipped member: ${error.message}`);
      }
    }
    console.log(`\n  ✅ Migrated ${memberCount} members\n`);

    // Migrate Rosters with updated member IDs
    console.log('📋 Migrating rosters...');
    const rosters = Array.from(mockData.rosters || []);
    let rosterCount = 0;
    for (const [oldId, rosterData] of rosters) {
      try {
        const existingRoster = await Roster.findOne({ camp: campIdMap.get(rosterData.camp) });
        if (existingRoster) {
          console.log(`  ⏭️  Roster already exists: ${rosterData.name}`);
          continue;
        }

        // Map camp ID and member IDs
        const { _id, camp, members, ...rosterDataWithoutId } = rosterData;
        const newCampId = campIdMap.get(camp);
        
        if (!newCampId) {
          console.log(`  ⚠️  Skipped roster ${rosterData.name}: Camp not found`);
          continue;
        }

        // Map member IDs in the members array
        const newMembers = members.map(memberEntry => ({
          ...memberEntry,
          member: memberIdMap.get(memberEntry.member) || memberEntry.member
        })).filter(m => m.member); // Only keep members that were mapped

        const newRoster = await Roster.create({
          ...rosterDataWithoutId,
          camp: newCampId,
          members: newMembers
        });
        rosterCount++;
        console.log(`  ✅ Created roster: ${rosterData.name} with ${newMembers.length} members`);
      } catch (error) {
        console.log(`  ⚠️  Skipped roster ${rosterData.name}: ${error.message}`);
      }
    }
    console.log(`\n  ✅ Migrated ${rosterCount} rosters\n`);

    // Migrate Applications with updated IDs
    console.log('📝 Migrating applications...');
    const applications = Array.from(mockData.applications || []);
    let appCount = 0;
    for (const [oldId, appData] of applications) {
      try {
        // Map applicant and camp IDs
        const { _id, applicant, camp, ...appDataWithoutId } = appData;
        const newApplicantId = userIdMap.get(applicant);
        const newCampId = campIdMap.get(camp);
        
        if (!newApplicantId || !newCampId) {
          console.log(`  ⚠️  Skipped application: Applicant or Camp not found`);
          continue;
        }

        const existingApp = await MemberApplication.findOne({ 
          applicant: newApplicantId, 
          camp: newCampId 
        });
        if (existingApp) {
          console.log(`  ⏭️  Application already exists`);
          continue;
        }

        await MemberApplication.create({
          ...appDataWithoutId,
          applicant: newApplicantId,
          camp: newCampId
        });
        appCount++;
        console.log(`  ✅ Created application`);
      } catch (error) {
        console.log(`  ⚠️  Skipped application: ${error.message}`);
      }
    }
    console.log(`\n  ✅ Migrated ${appCount} applications\n`);

    // Update the mocostaneres@gmail.com user to link to Mudskippers camp
    console.log('🔗 Linking admin user to Mudskippers camp...');
    const mudskippersCamp = await Camp.findOne({ campName: /mudskipper/i });
    if (mudskippersCamp) {
      await User.findOneAndUpdate(
        { email: 'mocostaneres@gmail.com' },
        { 
          campName: mudskippersCamp.campName,
          accountType: 'admin'
        }
      );
      console.log(`  ✅ Linked mocostaneres@gmail.com to ${mudskippersCamp.campName}\n`);
    } else {
      console.log(`  ⚠️  Mudskippers camp not found\n`);
    }

    console.log('🎉 Migration complete!');
    console.log('\n📊 Summary:');
    console.log(`  Users: ${userCount}`);
    console.log(`  Camps: ${campCount}`);
    console.log(`  Members: ${memberCount}`);
    console.log(`  Rosters: ${rosterCount}`);
    console.log(`  Applications: ${appCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateMockData();

