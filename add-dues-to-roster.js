const fs = require('fs');
const path = require('path');

// Load the mock data
const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

console.log('Adding duesStatus to roster members...');

// Update all roster members to include duesStatus
let updatedCount = 0;
for (const rosterEntry of mockData.rosters) {
  const roster = rosterEntry[1]; // Get the actual roster object
  if (roster.members && Array.isArray(roster.members)) {
    for (const member of roster.members) {
      if (!member.duesStatus) {
        member.duesStatus = 'Unpaid'; // Default to Unpaid
        updatedCount++;
      }
    }
  }
}

// Save the updated data
fs.writeFileSync(mockDataPath, JSON.stringify(mockData, null, 2));

console.log(`✅ Added duesStatus to ${updatedCount} roster members`);
console.log('✅ Mock data updated successfully');

