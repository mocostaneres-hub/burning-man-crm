// Script to migrate Mudskippers roster and members from mock data to MongoDB
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const Member = require('./server/models/Member');
const Roster = require('./server/models/Roster');

const migrateRoster = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Load mock data
    const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
    const rawData = await fs.readFile(mockDataPath, 'utf8');
    const mockData = JSON.parse(rawData);

    // Find Mudskippers camp in MongoDB
    const camp = await Camp.findOne({ contactEmail: 'mocostaneres@gmail.com' });
    if (!camp) {
      console.log('❌ Mudskippers camp not found');
      process.exit(1);
    }
    console.log(`✅ Found camp: ${camp.name} (${camp._id})\n`);

    // Find Mudskippers roster in mock data (camp ID 2000022)
    const mockRosters = Array.from(mockData.rosters || []);
    const mudskippersRoster = mockRosters.find(([id, roster]) => roster.camp === 2000022);
    
    if (!mudskippersRoster) {
      console.log('❌ Mudskippers roster not found in mock data');
      process.exit(1);
    }

    const [rosterId, rosterData] = mudskippersRoster;
    console.log(`📋 Found roster: ${rosterData.name}`);
    console.log(`   Members in mock data: ${rosterData.members.length}\n`);

    // Create a map of mock user emails for roster members
    const mockUsers = new Map(mockData.users || []);
    const mockMembers = new Map(mockData.members || []);

    // Process each roster member
    console.log('👥 Processing roster members...\n');
    const newRosterMembers = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const rosterMember of rosterData.members) {
      const mockMember = mockMembers.get(rosterMember.member.toString());
      if (!mockMember) {
        console.log(`  ⚠️  Skipped: Member ${rosterMember.member} not found in mock data`);
        skippedCount++;
        continue;
      }

      const mockUser = Array.from(mockUsers.values()).find(u => u._id === mockMember.user);
      if (!mockUser) {
        console.log(`  ⚠️  Skipped: User for member ${rosterMember.member} not found`);
        skippedCount++;
        continue;
      }

      // Find or create user in MongoDB
      let mongoUser = await User.findOne({ email: mockUser.email });
      
      if (!mongoUser) {
        // Create user with plain password (pre-save hook will hash it)
        const userData = {
          email: mockUser.email,
          password: 'defaultPassword123', // They'll need to reset
          accountType: 'personal',
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          phoneNumber: mockUser.phoneNumber,
          yearsBurned: mockUser.yearsBurned || 0,
          playaName: mockUser.playaName,
          skills: mockUser.skills || [],
          hasTicket: mockUser.hasTicket !== undefined ? mockUser.hasTicket : null,
          hasVehiclePass: mockUser.hasVehiclePass !== undefined ? mockUser.hasVehiclePass : null,
          arrivalDate: mockUser.arrivalDate,
          departureDate: mockUser.departureDate,
          burningManExperience: mockUser.yearsBurned === 0 ? 'virgin' : 'veteran'
        };
        
        mongoUser = await User.create(userData);
        console.log(`  ✅ Created user: ${mongoUser.email}`);
      }

      // Find or create Member record
      let mongoMember = await Member.findOne({ user: mongoUser._id, camp: camp._id });
      
      if (!mongoMember) {
        mongoMember = await Member.create({
          user: mongoUser._id,
          camp: camp._id,
          status: 'active',
          appliedAt: mockMember.appliedAt || new Date(),
          reviewedAt: new Date(),
          reviewedBy: mongoUser._id // Use same user as placeholder
        });
      }

      // Add to roster with roster-specific data
      newRosterMembers.push({
        member: mongoMember._id,
        addedAt: rosterMember.addedAt || new Date(),
        addedBy: mongoUser._id, // Use same user as placeholder
        role: rosterMember.role || 'member',
        // Roster-specific overrides
        playaNameOverride: rosterMember.playaName,
        yearsBurnedOverride: rosterMember.yearsBurned,
        skillsOverride: rosterMember.skills,
        duesStatus: rosterMember.duesStatus || 'unpaid'
      });

      createdCount++;
    }

    console.log(`\n📊 Processed ${createdCount} members, skipped ${skippedCount}\n`);

    // Delete existing roster if any
    await Roster.deleteMany({ camp: camp._id });

    // Create new roster
    const newRoster = await Roster.create({
      name: rosterData.name || "'25 Mudskippers Roster",
      camp: camp._id,
      year: rosterData.year || 2025,
      description: rosterData.description || 'Active camp roster',
      isActive: true,
      members: newRosterMembers,
      createdBy: camp.owner
    });

    console.log(`✅ Created roster: ${newRoster.name}`);
    console.log(`   Roster ID: ${newRoster._id}`);
    console.log(`   Total members: ${newRoster.members.length}\n`);

    console.log('🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateRoster();

