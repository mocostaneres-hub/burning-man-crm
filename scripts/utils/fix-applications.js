const fs = require('fs');
const path = require('path');

// Load existing mock data
const mockDataPath = path.join(__dirname, 'server/database/mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

// Convert maps to objects for easier manipulation
const users = new Map(mockData.users || []);
const camps = new Map(mockData.camps || []);
const members = new Map(mockData.members || []);
const applications = new Map(mockData.applications || []);

// Find Skips camp
let skipsCamp = null;
for (let [key, camp] of camps.entries()) {
  if (camp.campName === 'Skips') {
    skipsCamp = camp;
    break;
  }
}

if (!skipsCamp) {
  console.error('Skips camp not found!');
  process.exit(1);
}

console.log('🔧 Fixing applications to be pending instead of approved...');

// Remove all the auto-created member records (keep only Mo Costa-Neres)
const membersToKeep = new Map();
for (let [key, member] of members.entries()) {
  // Keep Mo Costa-Neres (user 1000006) and any existing members
  if (member.user === 1000006) {
    membersToKeep.set(key, member);
  }
}

// Update applications to be pending
const applicationsToKeep = new Map();
for (let [key, application] of applications.entries()) {
  // Keep Mo Costa-Neres application as approved
  if (application.applicant === 1000006) {
    applicationsToKeep.set(key, application);
  } else {
    // Change all other applications to pending
    const pendingApplication = {
      ...application,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: '',
      lastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    applicationsToKeep.set(key, pendingApplication);
  }
}

// Update mock data
const updatedMockData = {
  users: Array.from(users.entries()),
  camps: Array.from(camps.entries()),
  members: Array.from(membersToKeep.entries()),
  applications: Array.from(applicationsToKeep.entries()),
  rosters: mockData.rosters || []
};

// Save updated mock data
fs.writeFileSync(mockDataPath, JSON.stringify(updatedMockData, null, 2));

console.log('✅ Fixed applications!');
console.log(`📊 Summary:`);
console.log(`- Kept Mo Costa-Neres as approved member`);
console.log(`- Changed ${applicationsToKeep.size - 1} applications to pending status`);
console.log(`- Removed auto-created member records`);
console.log(`- Applications now need to be reviewed through the interface`);

// Count pending applications
let pendingCount = 0;
for (let [key, application] of applicationsToKeep.entries()) {
  if (application.status === 'pending') {
    pendingCount++;
  }
}

console.log(`🎯 ${pendingCount} pending applications ready for review!`);
