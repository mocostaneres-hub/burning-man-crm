const fs = require('fs');

console.log('🔄 RESTORING ROSTER DATA');
console.log('========================\n');

// Read the current mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

console.log('Current data:');
console.log('- Users:', data.users.length);
console.log('- Camps:', data.camps.length);
console.log('- Members:', data.members.length);
console.log('- Rosters:', data.rosters.length);

// Create the members data for camp 2000022 (Skips)
const members = [
  ["68", {
    "_id": 68,
    "user": 1000006,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-20T23:28:55.551Z",
    "reviewedAt": "2025-09-21T22:05:22.855Z",
    "reviewedBy": 1000005
  }],
  ["68d08cdefea5a5dc098bd057", {
    "_id": "68d08cdefea5a5dc098bd057",
    "user": 1000009,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:51.935Z",
    "reviewedAt": "2025-09-21T23:18:51.935Z",
    "reviewedBy": 1000005
  }],
  ["68d08ce5fea5a5dc098bd058", {
    "_id": "68d08ce5fea5a5dc098bd058",
    "user": 1000014,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:58.355Z",
    "reviewedAt": "2025-09-21T23:18:58.355Z",
    "reviewedBy": 1000005
  }],
  ["68d090df9656afa7651bbed7", {
    "_id": "68d090df9656afa7651bbed7",
    "user": 1000015,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:59.720Z",
    "reviewedAt": "2025-09-21T23:18:59.720Z",
    "reviewedBy": 1000005
  }],
  ["68d1e3233c2974835a70afd0", {
    "_id": "68d1e3233c2974835a70afd0",
    "user": 1000013,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:57.137Z",
    "reviewedAt": "2025-09-21T23:18:57.137Z",
    "reviewedBy": 1000005
  }],
  ["68d1e32a3c2974835a70afd1", {
    "_id": "68d1e32a3c2974835a70afd1",
    "user": 1000012,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:55.893Z",
    "reviewedAt": "2025-09-21T23:18:55.893Z",
    "reviewedBy": 1000005
  }],
  ["68d1e79b09e48192914b467b", {
    "_id": "68d1e79b09e48192914b467b",
    "user": 1000010,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:18:53.226Z",
    "reviewedAt": "2025-09-21T23:18:53.226Z",
    "reviewedBy": 1000005
  }],
  ["68d1ebfdcfea78ca2a278dd3", {
    "_id": "68d1ebfdcfea78ca2a278dd3",
    "user": 1000011,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-03T20:19:38.470Z",
    "reviewedAt": "2025-09-23T00:38:21.601Z",
    "reviewedBy": 1000005
  }],
  ["68d1ec046b28b9ab5a0828c7", {
    "_id": "68d1ec046b28b9ab5a0828c7",
    "user": 1000019,
    "camp": 2000022,
    "status": "active",
    "appliedAt": "2025-09-21T23:19:04.268Z",
    "reviewedAt": "2025-09-21T23:19:04.268Z",
    "reviewedBy": 1000005
  }]
];

// Create the roster data
const rosters = [
  ["5000001", {
    "_id": 5000001,
    "name": "1st roster ever",
    "camp": 2000022,
    "isActive": true,
    "createdBy": 1000005,
    "createdAt": "2025-09-23T00:50:00.000Z",
    "updatedAt": "2025-09-23T00:51:02.002Z",
    "members": [
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
    ]
  }]
];

// Update the data
data.members = members;
data.rosters = rosters;

console.log('Restored data:');
console.log('- Members:', data.members.length);
console.log('- Rosters:', data.rosters.length);

// Save the updated data
fs.writeFileSync('server/database/mockData.json', JSON.stringify(data, null, 2));

console.log('\n✅ Roster data restored successfully!');
console.log('📋 Roster members:');
data.rosters[0][1].members.forEach((member, index) => {
  const memberData = data.members.find(m => m[1]._id.toString() === member.member.toString());
  if (memberData) {
    const userData = data.users.find(u => u[1]._id === memberData[1].user);
    if (userData) {
      console.log(`  ${index + 1}. ${userData[1].firstName} ${userData[1].lastName}`);
    }
  }
});

