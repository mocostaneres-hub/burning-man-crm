const fs = require('fs');

console.log('🚨 EMERGENCY ROSTER FIX - DIRECT SERVER MODIFICATION');
console.log('====================================================\n');

// Read the current mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

// Get the roster
const roster = data.rosters[0][1];

console.log('Current roster members:', roster.members.length);
console.log('Current member IDs:', roster.members.map(m => m.member));

// Create the correct roster with unique member IDs
const correctMembers = [
  { "member": 68, "addedAt": "2025-09-23T00:51:01.989Z", "addedBy": 1000005 },
  { "member": "68d08cdefea5a5dc098bd057", "addedAt": "2025-09-23T00:51:01.001Z", "addedBy": 1000005 },
  { "member": "68d08ce5fea5a5dc098bd058", "addedAt": "2025-09-23T00:51:00.001Z", "addedBy": 1000005 },
  { "member": "68d090df9656afa7651bbed7", "addedAt": "2025-09-23T00:50:59.001Z", "addedBy": 1000005 },
  { "member": "68d1e3233c2974835a70afd0", "addedAt": "2025-09-23T00:50:58.001Z", "addedBy": 1000005 },
  { "member": "68d1e32a3c2974835a70afd1", "addedAt": "2025-09-23T00:50:57.001Z", "addedBy": 1000005 },
  { "member": "68d1e79b09e48192914b467b", "addedAt": "2025-09-23T00:50:56.001Z", "addedBy": 1000005 },
  { "member": "68d1ebfdcfea78ca2a278dd3", "addedAt": "2025-09-23T00:50:55.001Z", "addedBy": 1000005 },
  { "member": "68d1ec046b28b9ab5a0828c7", "addedAt": "2025-09-23T00:50:54.001Z", "addedBy": 1000005 }
];

// Update the roster
roster.members = correctMembers;
roster.updatedAt = new Date().toISOString();

console.log('Updated member IDs:', roster.members.map(m => m.member));

// Save the data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('\n✅ File updated! Now testing the API...');

// Test the API after a short delay
setTimeout(() => {
  const { exec } = require('child_process');
  exec('curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0" http://localhost:5001/api/rosters | jq \'.[0].members[] | {member: .member, firstName: .memberDetails.userDetails.firstName, lastName: .memberDetails.userDetails.lastName}\'', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Error testing API:', error.message);
      return;
    }
    console.log('API Response:');
    console.log(stdout);
  });
}, 2000);
