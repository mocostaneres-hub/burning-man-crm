const fs = require('fs');

console.log('🔧 FINAL ROSTER FIX - DEFINITIVE SOLUTION');
console.log('==========================================\n');

// Read the current mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

console.log('Current roster member IDs:', data.rosters[0][1].members.map(m => m.member));

// Create the definitive correct roster with unique member IDs
const correctRosterMembers = [
  {
    "member": 68,
    "addedAt": "2025-09-23T00:51:01.989Z",
    "addedBy": 1000005
  },
  {
    "member": "68d08cdefea5a5dc098bd057",
    "addedAt": "2025-09-23T00:51:01.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d08ce5fea5a5dc098bd058",
    "addedAt": "2025-09-23T00:51:00.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d090df9656afa7651bbed7",
    "addedAt": "2025-09-23T00:50:59.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e3233c2974835a70afd0",
    "addedAt": "2025-09-23T00:50:58.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e32a3c2974835a70afd1",
    "addedAt": "2025-09-23T00:50:57.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1e79b09e48192914b467b",
    "addedAt": "2025-09-23T00:50:56.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1ebfdcfea78ca2a278dd3",
    "addedAt": "2025-09-23T00:50:55.001Z",
    "addedBy": 1000005
  },
  {
    "member": "68d1ec046b28b9ab5a0828c7",
    "addedAt": "2025-09-23T00:50:54.001Z",
    "addedBy": 1000005
  }
];

// Update the roster
data.rosters[0][1].members = correctRosterMembers;
data.rosters[0][1].updatedAt = new Date().toISOString();

console.log('Updated roster member IDs:', data.rosters[0][1].members.map(m => m.member));

// Save the updated data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('\n✅ Roster data updated in file!');
console.log('🔄 Now reloading server data...');

// Wait a moment for the server to start
setTimeout(async () => {
  try {
    const response = await fetch('http://localhost:5001/api/rosters/reload-data', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0'
      }
    });
    
    if (response.ok) {
      console.log('✅ Server data reloaded successfully!');
      console.log('🎉 Roster should now show all 9 unique members!');
    } else {
      console.log('❌ Failed to reload server data');
    }
  } catch (error) {
    console.log('❌ Error reloading server data:', error.message);
  }
}, 3000);
