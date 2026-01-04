const fs = require('fs');
const path = require('path');

// Load mock data directly
const mockDataPath = path.join(__dirname, 'server/database/mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

console.log('🔍 Testing Roster Data Structure\n');

// Find camp 2000022 roster
const roster = mockData.rosters.find(([key, data]) => data.camp === 2000022);
if (roster) {
  const [, rosterData] = roster;
  console.log(`✅ Found roster: "${rosterData.name}"`);
  console.log(`✅ Members in roster: ${rosterData.members.length}`);
  
  console.log('\n📋 Roster members:');
  rosterData.members.forEach((member, index) => {
    console.log(`   ${index + 1}. Member ID: ${member.member} (Type: ${typeof member.member})`);
  });
  
  console.log('\n📋 All members in camp 2000022:');
  const campMembers = mockData.members.filter(([key, data]) => data.camp === 2000022);
  campMembers.forEach(([key, member], index) => {
    console.log(`   ${index + 1}. Member ID: ${member._id} (Type: ${typeof member._id}), User: ${member.user}`);
  });
  
  // Check if roster members exist in members collection
  console.log('\n🔍 Checking roster member existence:');
  rosterData.members.forEach((rosterMember, index) => {
    const memberExists = mockData.members.some(([key, member]) => 
      member._id.toString() === rosterMember.member.toString()
    );
    console.log(`   ${index + 1}. Member ID ${rosterMember.member}: ${memberExists ? 'EXISTS' : 'NOT FOUND'}`);
  });
  
} else {
  console.log('❌ No roster found for camp 2000022');
}


