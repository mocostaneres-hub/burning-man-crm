const fs = require('fs');
const path = require('path');

// Load existing mock data
const mockDataPath = path.join(__dirname, 'server/database/mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

// Convert maps to objects for easier manipulation
const users = new Map(mockData.users || []);
const applications = new Map(mockData.applications || []);

console.log('🔧 Fixing application applicant references...');

// Create a mapping of email to user ID
const emailToUserId = new Map();
for (let [email, user] of users.entries()) {
  emailToUserId.set(email, user._id);
}

// Mock users we created
const mockUserEmails = [
  'alex.johnson@email.com',
  'sarah.williams@email.com', 
  'mike.brown@email.com',
  'emma.davis@email.com',
  'david.miller@email.com',
  'lisa.wilson@email.com',
  'chris.moore@email.com',
  'amy.taylor@email.com',
  'john.anderson@email.com',
  'kate.thomas@email.com',
  'ryan.jackson@email.com',
  'jessica.white@email.com',
  'matt.harris@email.com',
  'rachel.martin@email.com',
  'tom.garcia@email.com'
];

// Fix applications to reference correct user IDs
const fixedApplications = new Map();
for (let [key, application] of applications.entries()) {
  // Find the user by email from our mock users
  let correctUserId = null;
  for (let email of mockUserEmails) {
    if (emailToUserId.has(email)) {
      const user = users.get(email);
      // Check if this application's data matches this user
      if (application.applicationData && application.applicationData.skills) {
        const appSkills = application.applicationData.skills.sort().join(',');
        const userSkills = (user.skills || []).sort().join(',');
        if (appSkills === userSkills && user.firstName && user.lastName) {
          correctUserId = user._id;
          console.log(`✅ Fixed application ${application._id}: ${user.firstName} ${user.lastName} (${email})`);
          break;
        }
      }
    }
  }
  
  // Update the application with correct applicant ID
  if (correctUserId) {
    fixedApplications.set(key, {
      ...application,
      applicant: correctUserId
    });
  } else {
    // Keep applications that don't match our mock users (like Mo Costa-Neres)
    fixedApplications.set(key, application);
  }
}

// Update mock data
const updatedMockData = {
  users: Array.from(users.entries()),
  camps: mockData.camps || [],
  members: mockData.members || [],
  applications: Array.from(fixedApplications.entries()),
  rosters: mockData.rosters || []
};

// Save updated mock data
fs.writeFileSync(mockDataPath, JSON.stringify(updatedMockData, null, 2));

console.log('✅ Fixed application applicant references!');
console.log(`📊 Summary:`);
console.log(`- ${fixedApplications.size} applications processed`);
console.log(`- Applications now reference correct user IDs`);
console.log(`- Ready to test the applications page`);
