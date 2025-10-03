const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';
const CAMP_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4NzIzOCwiZXhwIjoxNzU5MTkyMDM4fQ.ErpQWjIz8XCMEC9Atyzs7IndvuiDdZ9QRq65MYabfR0';

async function verifyRoster() {
  console.log('🔍 Verifying Roster Data\n');

  try {
    // Get roster data
    const rosterResponse = await axios.get(`${BASE_URL}/rosters`, {
      headers: { Authorization: `Bearer ${CAMP_TOKEN}` }
    });
    
    const activeRoster = rosterResponse.data.find(r => r.isActive);
    console.log(`✅ Active roster: "${activeRoster.name}"`);
    console.log(`✅ Members in roster: ${activeRoster.members?.length || 0}`);
    
    if (activeRoster.members) {
      console.log('\n📋 Roster member IDs:');
      activeRoster.members.forEach((member, index) => {
        console.log(`   ${index + 1}. Member ID: ${member.member} (Type: ${typeof member.member})`);
      });
    }

    // Get detailed roster with member info
    const rosterDetailsResponse = await axios.get(`${BASE_URL}/rosters/${activeRoster._id}`, {
      headers: { Authorization: `Bearer ${CAMP_TOKEN}` }
    });
    
    const rosterWithMembers = rosterDetailsResponse.data;
    console.log('\n📋 Roster members with details:');
    if (rosterWithMembers.members) {
      rosterWithMembers.members.forEach((member, index) => {
        const user = member.memberDetails?.userDetails;
        if (user) {
          console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (Member ID: ${member.member})`);
        } else {
          console.log(`   ${index + 1}. Unknown member (Member ID: ${member.member})`);
        }
      });
    }

    // Check for Emma Davis and David Miller specifically
    console.log('\n🔍 Looking for specific members:');
    const emmaMember = rosterWithMembers.members?.find(m => 
      m.memberDetails?.userDetails?.firstName === 'Emma' && 
      m.memberDetails?.userDetails?.lastName === 'Davis'
    );
    
    const davidMember = rosterWithMembers.members?.find(m => 
      m.memberDetails?.userDetails?.firstName === 'David' && 
      m.memberDetails?.userDetails?.lastName === 'Miller'
    );
    
    if (emmaMember) {
      console.log(`✅ Emma Davis found: Member ID ${emmaMember.member}`);
    } else {
      console.log('❌ Emma Davis not found');
    }
    
    if (davidMember) {
      console.log(`✅ David Miller found: Member ID ${davidMember.member}`);
    } else {
      console.log('❌ David Miller not found');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    } else {
      console.error('Full error:', error);
    }
  }
}

verifyRoster();
