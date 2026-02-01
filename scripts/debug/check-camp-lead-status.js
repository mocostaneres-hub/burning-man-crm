// DEBUG SCRIPT - Check Camp Lead Status for test 8
// Run with: node scripts/debug/check-camp-lead-status.js

const mongoose = require('mongoose');
require('dotenv').config();

const checkCampLeadStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('../../server/models/User');
    const Roster = require('../../server/models/Roster');
    const Member = require('../../server/models/Member');

    // Find test 8
    const userId = '697e4ba0396f69ce26591eb2';
    console.log('\n=== CHECKING USER: test 8 ===');
    console.log('User ID:', userId);

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ USER NOT FOUND!');
      process.exit(1);
    }

    console.log('\n📋 User Details:');
    console.log('Name:', user.firstName, user.lastName);
    console.log('Email:', user.email);
    console.log('Account Type:', user.accountType);
    console.log('Role:', user.role);

    // Find member record
    const member = await Member.findOne({ user: userId });
    if (!member) {
      console.log('\n❌ NO MEMBER RECORD FOUND!');
      console.log('User is not in any roster yet.');
      process.exit(0);
    }

    console.log('\n📋 Member Record:');
    console.log('Member ID:', member._id);
    console.log('Camp ID:', member.camp);
    console.log('Status:', member.status);

    // Find roster entry
    const rosters = await Roster.find({
      'members.member': member._id,
      isActive: true
    }).populate('camp', 'name slug');

    if (!rosters || rosters.length === 0) {
      console.log('\n❌ NO ROSTER ENTRY FOUND!');
      console.log('Member exists but is not in any active roster.');
      process.exit(0);
    }

    console.log('\n📋 Roster Entries:');
    for (const roster of rosters) {
      console.log('\n---');
      console.log('Roster ID:', roster._id);
      console.log('Camp:', roster.camp.name);
      console.log('Camp Slug:', roster.camp.slug);
      
      const memberEntry = roster.members.find(m => 
        m.member?.toString() === member._id.toString() ||
        m.member?._id?.toString() === member._id.toString()
      );

      if (memberEntry) {
        console.log('\n✅ MEMBER FOUND IN ROSTER!');
        console.log('Status:', memberEntry.status);
        console.log('Is Camp Lead:', memberEntry.isCampLead);
        console.log('Added At:', memberEntry.addedAt);
        console.log('Dues Status:', memberEntry.duesStatus);
        console.log('Overrides:', memberEntry.overrides);
        
        if (memberEntry.isCampLead) {
          console.log('\n🎖️ USER IS CAMP LEAD!');
        } else {
          console.log('\n⚠️ isCampLead is FALSE or undefined');
          console.log('Need to grant Camp Lead role');
        }
      } else {
        console.log('\n❌ Member ID found in roster.members but entry not parsed correctly');
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log('User exists:', !!user);
    console.log('Member record exists:', !!member);
    console.log('In active roster:', rosters.length > 0);
    const hasLeadRole = rosters.some(r => {
      const entry = r.members.find(m => m.member?.toString() === member._id.toString());
      return entry?.isCampLead === true;
    });
    console.log('Has Camp Lead role:', hasLeadRole);

    if (!hasLeadRole) {
      console.log('\n💡 ACTION: Grant Camp Lead role via roster edit UI');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

checkCampLeadStatus();
