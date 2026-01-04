const fs = require('fs');

console.log('🔧 FIXING DUPLICATE ROSTER MEMBERS');
console.log('===================================\n');

// Read the mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

// Get the roster
const rosterEntry = Object.values(data.rosters)[0];
const roster = rosterEntry[1];

console.log('Current roster members:', roster.members.length);
console.log('Current roster has duplicates:', roster.members.length !== [...new Set(roster.members.map(m => m.member))].length);

// Get all active members for camp 2000022
const membersArray = Object.values(data.members);
const activeMembers = membersArray.filter(memberEntry => {
  const member = memberEntry[1];
  return member.status === 'active' && member.camp === 2000022;
});

console.log('Active members found:', activeMembers.length);

// Create unique roster members with proper data
const rosterMembers = activeMembers.map((memberEntry, index) => {
  const member = memberEntry[1];
  return {
    member: member._id,
    addedAt: new Date(Date.now() - (index * 1000)).toISOString(), // Stagger the dates
    addedBy: 1000005 // Camp owner
  };
});

// Update the roster
roster.members = rosterMembers;
roster.updatedAt = new Date().toISOString();

console.log('Updated roster members:', roster.members.length);
console.log('Unique member IDs:', [...new Set(roster.members.map(m => m.member))].length);

// Verify the fix
const uniqueMemberIds = [...new Set(roster.members.map(m => m.member))];
console.log('Has duplicates after fix:', roster.members.length !== uniqueMemberIds.length ? 'YES' : 'NO');

// Show the roster members
console.log('\n📋 Roster members after fix:');
roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (memberEntry) {
    const member = memberEntry[1];
    const usersArray = Object.values(data.users);
    const user = usersArray.find(u => u[1]._id === member.user);
    if (user) {
      const userData = user[1];
      console.log(`  ${index + 1}. ${userData.firstName} ${userData.lastName} (Member: ${member._id})`);
    }
  }
});

// Save the updated data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('\n✅ Roster fixed! All duplicate members removed and replaced with unique active members.');

