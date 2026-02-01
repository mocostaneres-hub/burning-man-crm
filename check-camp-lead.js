// Production Diagnostic Script - Check Camp Lead Status in Production DB
const mongoose = require('mongoose');
require('dotenv').config();

async function checkProductionCampLead() {
  try {
    console.log('🔍 Connecting to production database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    const User = require('./server/models/User');
    const Member = require('./server/models/Member');
    const Roster = require('./server/models/Roster');

    const userId = '697e4ba0396f69ce26591eb2';
    console.log('=== CHECKING USER: test 8 ===');
    console.log('User ID:', userId, '\n');

    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ USER NOT FOUND!');
      process.exit(1);
    }

    console.log('✅ User:', user.firstName, user.lastName, '-', user.email);
    console.log('Account Type:', user.accountType, '| Role:', user.role, '\n');

    const member = await Member.findOne({ user: userId });
    if (!member) {
      console.log('❌ NO MEMBER RECORD!\n');
      process.exit(0);
    }

    console.log('✅ Member ID:', member._id, '| Camp:', member.camp, '| Status:', member.status, '\n');

    const allRosters = await Roster.find({ 'members.member': member._id }).populate('camp', 'name slug');

    console.log(`Found ${allRosters.length} roster(s):\n`);

    for (const roster of allRosters) {
      console.log('---');
      console.log('Camp:', roster.camp.name, '| Active:', roster.isActive);
      
      const memberEntry = roster.members.find(m => {
        const mId = typeof m.member === 'object' ? m.member._id?.toString() : m.member?.toString();
        return mId === member._id.toString();
      });

      if (memberEntry) {
        console.log('Status:', memberEntry.status, '| isCampLead:', memberEntry.isCampLead);
        if (memberEntry.isCampLead === true) {
          console.log('🎖️  IS CAMP LEAD!');
        } else {
          console.log('⚠️  NOT CAMP LEAD');
        }
      }
      console.log('');
    }

    console.log('=== TESTING /api/auth/me QUERY ===\n');
    
    const campLeadRosters = await Roster.find({
      'members': {
        $elemMatch: {
          user: userId,
          isCampLead: true,
          status: 'approved'
        }
      },
      isActive: true
    }).populate('camp', 'name slug _id');

    if (campLeadRosters && campLeadRosters.length > 0) {
      console.log('✅ /api/auth/me WILL DETECT CAMP LEAD!');
      console.log('Camp:', campLeadRosters[0].camp.name);
    } else {
      console.log('❌ /api/auth/me WILL NOT DETECT CAMP LEAD!');
      console.log('Reason: Query returned no results');
      console.log('Check: isCampLead=true, status=approved, roster active');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkProductionCampLead();
