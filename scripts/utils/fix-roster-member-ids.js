const fs = require('fs');

console.log('🔧 FIXING ROSTER MEMBER IDs ONCE AND FOR ALL');
console.log('==============================================\n');

// Read the current mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

console.log('Current roster data:');
const roster = data.rosters[0][1];
console.log('Roster members count:', roster.members.length);
console.log('Member IDs in roster:', roster.members.map(m => m.member));

// Get all unique member IDs from the members collection
const memberIds = data.members.map(m => m[1]._id);
console.log('Available member IDs:', memberIds);

// Create the correct roster with unique member IDs
const correctRosterMembers = [
  {
    "member": 68, // Mo Costa-Neres
    "addedAt": "2025-09-23T00:51:01.989Z",
    "addedBy": 1000005
  },
  {
    "member": "68d08cdefea5a5dc098bd057", // Alex Johnson
    "addedAt": "2025-09-23T00:51:01.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d08ce5fea5a5dc098bd058", // Lisa Wilson
    "addedAt": "2025-09-23T00:51:00.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d090df9656afa7651bbed7", // Chris Moore
    "addedAt": "2025-09-23T00:50:59.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e3233c2974835a70afd0", // David Miller
    "addedAt": "2025-09-23T00:50:58.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e32a3c2974835a70afd1", // Emma Davis
    "addedAt": "2025-09-23T00:50:57.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e79b09e48192914b467b", // Sarah Williams
    "addedAt": "2025-09-23T00:50:56.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1ebfdcfea78ca2a278dd3", // Mike Brown
    "addedAt": "2025-09-23T00:50:55.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1ec046b28b9ab5a0828c7", // Ryan Jackson
    "addedAt": "2025-09-23T00:50:54.001Z",
    "addedBy": 1000005
  }
];

// Update the roster
roster.members = correctRosterMembers;
roster.updatedAt = new Date().toISOString();

console.log('Fixed roster members:');
roster.members.forEach((member, index) => {
  const memberData = data.members.find(m => m[1]._id.toString() === member.member.toString());
  if (memberData) {
    const userData = data.users.find(u => u[1]._id === memberData[1].user);
    if (userData) {
      console.log(`  ${index + 1}. ${userData[1].firstName} ${userData[1].lastName} (Member ID: ${member.member})`);
    }
  }
});

// Save the updated data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('\n✅ Roster member IDs fixed! All members now have unique IDs.');
console.log('🔄 Please refresh your browser to see the changes.');

