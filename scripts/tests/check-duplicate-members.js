const fs = require('fs');

console.log('🔍 CHECKING FOR DUPLICATE MEMBERS');
console.log('==================================\n');

// Read the mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

// Get all active members for camp 2000022
const membersArray = Object.values(data.members);
const activeMembers = membersArray.filter(memberEntry => {
  const member = memberEntry[1];
  return member.status === 'active' && member.camp === 2000022;
});

console.log('Active members found:', activeMembers.length);

// Group by user ID to find duplicates
const membersByUser = {};
activeMembers.forEach(memberEntry => {
  const member = memberEntry[1];
  if (!membersByUser[member.user]) {
    membersByUser[member.user] = [];
  }
  membersByUser[member.user].push(member);
});

console.log('\n📋 Members grouped by user:');
Object.keys(membersByUser).forEach(userId => {
  const members = membersByUser[userId];
  if (members.length > 1) {
    console.log(`❌ User ${userId} has ${members.length} member records:`);
    members.forEach(member => {
      console.log(`   - Member ID: ${member._id}, Applied: ${member.appliedAt}`);
    });
  } else {
    console.log(`✅ User ${userId}: 1 member record (ID: ${members[0]._id})`);
  }
});

// Find users with duplicate member records
const duplicateUsers = Object.keys(membersByUser).filter(userId => membersByUser[userId].length > 1);
console.log(`\n🔍 Found ${duplicateUsers.length} users with duplicate member records`);

if (duplicateUsers.length > 0) {
  console.log('\n📋 Duplicate users:');
  duplicateUsers.forEach(userId => {
    const members = membersByUser[userId];
    console.log(`User ${userId}:`);
    members.forEach((member, index) => {
      console.log(`  ${index + 1}. Member ID: ${member._id}, Applied: ${member.appliedAt}, Reviewed: ${member.reviewedAt}`);
    });
  });
}

