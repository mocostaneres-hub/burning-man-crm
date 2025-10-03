const fs = require('fs');

// Read the mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

console.log('=== FIXING ROSTER ===');

// Get the roster
const rosterEntry = Object.values(data.rosters)[0];
const roster = rosterEntry[1];

console.log('Current roster members:', roster.members.length);

// Get all active members for camp 2000022
const membersArray = Object.values(data.members);
const activeMembers = membersArray.filter(memberEntry => {
  const member = memberEntry[1];
  return member.status === 'active' && member.camp === 2000022;
});

console.log('Active members found:', activeMembers.length);

// Add all active members to the roster
const rosterMembers = activeMembers.map(memberEntry => {
  const member = memberEntry[1];
  return {
    member: member._id,
    addedAt: new Date().toISOString(),
    addedBy: 1000005 // Camp owner
  };
});

// Update the roster
roster.members = rosterMembers;
roster.updatedAt = new Date().toISOString();

console.log('Updated roster members:', roster.members.length);
console.log('Roster members:', JSON.stringify(roster.members, null, 2));

// Save the updated data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('✅ Roster fixed! All active members have been added to the roster.');


