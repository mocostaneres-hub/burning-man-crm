// Production Diagnostic Script - Check Camp Lead Status in Production DB
// This will query the actual production database to verify Camp Lead setup

const mongoose = require('mongoose');
require('dotenv').config();

async function checkProductionCampLead() {
  try {
    console.log('🔍 Connecting to production database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    const User = require('../server/models/User');
    const Member = require('../server/models/Member');
    const Roster = require('../server/models/Roster');

    // Find test 8 user by ID
    const userId = '697e4ba0396f69ce26591eb2';
    console.log('=== CHECKING USER: test 8 ===');
    console.log('User ID:', userId, '\n');

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ USER NOT FOUND IN DATABASE!');
      console.log('This user may not exist or the ID is wrong.\n');
      process.exit(1);
    }

    console.log('✅ User Found:');
    console.log('  Name:', user.firstName, user.lastName);
    console.log('  Email:', user.email);
    console.log('  Account Type:', user.accountType);
    console.log('  Role:', user.role);
    console.log('');

    // Find member record
    const member = await Member.findOne({ user: userId });
    if (!member) {
      console.log('❌ NO MEMBER RECORD!');
      console.log('User is not a member of any camp.\n');
      process.exit(0);
    }

    console.log('✅ Member Record Found:');
    console.log('  Member ID:', member._id);
    console.log('  Camp ID:', member.camp);
    console.log('  Status:', member.status);
    console.log('');

    // Find ALL rosters where this user appears
    console.log('🔍 Searching all rosters for this user...\n');
    
    const allRosters = await Roster.find({
      'members.member': member._id
    }).populate('camp', 'name slug');

    if (!allRosters || allRosters.length === 0) {
      console.log('❌ USER NOT IN ANY ROSTER!');
      console.log('Member record exists but not added to roster.\n');
      process.exit(0);
    }

    console.log(`✅ Found ${allRosters.length} roster(s):\n`);

    for (const roster of allRosters) {
      console.log('-----------------------------------');
      console.log('Roster ID:', roster._id);
      console.log('Camp:', roster.camp.name);
      console.log('Camp Slug:', roster.camp.slug);
      console.log('Camp ID:', roster.camp._id);
      console.log('Is Active:', roster.isActive);
      console.log('Is Archived:', roster.isArchived);

      // Find the specific member entry
      const memberEntry = roster.members.find(m => {
        const mId = typeof m.member === 'object' ? m.member._id?.toString() : m.member?.toString();
        return mId === member._id.toString();
      });

      if (memberEntry) {
        console.log('\n📋 Member Entry in Roster:');
        console.log('  Status:', memberEntry.status);
        console.log('  Is Camp Lead:', memberEntry.isCampLead);
        console.log('  Dues Status:', memberEntry.duesStatus);
        console.log('  Added At:', memberEntry.addedAt);

        if (memberEntry.isCampLead === true) {
          console.log('\n🎖️  ✅ USER IS CAMP LEAD!');
        } else {
          console.log('\n⚠️  USER IS NOT CAMP LEAD (isCampLead is false or undefined)');
        }
      } else {
        console.log('\n❌ Member ID not found in roster.members array');
      }
      console.log('');
    }

    // Now simulate the /api/auth/me query
    console.log('=== SIMULATING /api/auth/me QUERY ===\n');
    
    const campLeadRosters = await Roster.find({
      'members': {
        $elemMatch: {
          user: userId,
          isCampLead: true,
          status: 'approved'
        }
      },
      isActive: true
    }).select('camp _id').populate('camp', 'name slug _id');

    console.log('Query used by /api/auth/me:');
    console.log(JSON.stringify({
      'members': {
        $elemMatch: {
          user: userId,
          isCampLead: true,
          status: 'approved'
        }
      },
      isActive: true
    }, null, 2));
    console.log('');

    if (campLeadRosters && campLeadRosters.length > 0) {
      console.log('✅ QUERY FOUND CAMP LEAD ROSTER!');
      console.log('Number of rosters:', campLeadRosters.length);
      console.log('\nCamp Lead Camp:');
      console.log('  Name:', campLeadRosters[0].camp.name);
      console.log('  Slug:', campLeadRosters[0].camp.slug);
      console.log('  ID:', campLeadRosters[0].camp._id);
      console.log('\n🎉 /api/auth/me WILL RETURN isCampLead: true');
    } else {
      console.log('❌ QUERY RETURNED NO RESULTS!');
      console.log('\nThis means /api/auth/me will NOT detect Camp Lead status.');
      console.log('\nPossible reasons:');
      console.log('  1. isCampLead is not set to true in roster');
      console.log('  2. status is not "approved"');
      console.log('  3. Roster is not active');
      console.log('  4. Query is checking wrong field (user vs member)');
    }

    console.log('\n=== DIAGNOSIS COMPLETE ===\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from database\n');
  }
}

checkProductionCampLead();
