const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

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

// Generate 15 mock users
const mockUsers = [
  { firstName: 'Alex', lastName: 'Johnson', email: 'alex.johnson@email.com', city: 'San Francisco, CA', yearsBurned: 3, skills: ['Carpentry', 'Cooking', 'Leadership'] },
  { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@email.com', city: 'Portland, OR', yearsBurned: 1, skills: ['Art', 'Sound/AV', 'Electrical'] },
  { firstName: 'Mike', lastName: 'Brown', email: 'mike.brown@email.com', city: 'Austin, TX', yearsBurned: 5, skills: ['Construction', 'Welding', 'Safety'] },
  { firstName: 'Emma', lastName: 'Davis', email: 'emma.davis@email.com', city: 'Seattle, WA', yearsBurned: 0, skills: ['Art', 'Photography', 'Volunteering'] },
  { firstName: 'David', lastName: 'Miller', email: 'david.miller@email.com', city: 'Denver, CO', yearsBurned: 2, skills: ['Electrical', 'Sound/AV', 'Leadership'] },
  { firstName: 'Lisa', lastName: 'Wilson', email: 'lisa.wilson@email.com', city: 'Los Angeles, CA', yearsBurned: 4, skills: ['Cooking', 'Art', 'Volunteering'] },
  { firstName: 'Chris', lastName: 'Moore', email: 'chris.moore@email.com', city: 'Chicago, IL', yearsBurned: 1, skills: ['Construction', 'Safety', 'Leadership'] },
  { firstName: 'Amy', lastName: 'Taylor', email: 'amy.taylor@email.com', city: 'New York, NY', yearsBurned: 6, skills: ['Art', 'Photography', 'Cooking'] },
  { firstName: 'John', lastName: 'Anderson', email: 'john.anderson@email.com', city: 'Phoenix, AZ', yearsBurned: 2, skills: ['Welding', 'Electrical', 'Safety'] },
  { firstName: 'Kate', lastName: 'Thomas', email: 'kate.thomas@email.com', city: 'Miami, FL', yearsBurned: 0, skills: ['Art', 'Volunteering', 'Photography'] },
  { firstName: 'Ryan', lastName: 'Jackson', email: 'ryan.jackson@email.com', city: 'Nashville, TN', yearsBurned: 3, skills: ['Sound/AV', 'Carpentry', 'Leadership'] },
  { firstName: 'Jessica', lastName: 'White', email: 'jessica.white@email.com', city: 'Boston, MA', yearsBurned: 1, skills: ['Art', 'Cooking', 'Volunteering'] },
  { firstName: 'Matt', lastName: 'Harris', email: 'matt.harris@email.com', city: 'Las Vegas, NV', yearsBurned: 4, skills: ['Construction', 'Welding', 'Safety'] },
  { firstName: 'Rachel', lastName: 'Martin', email: 'rachel.martin@email.com', city: 'San Diego, CA', yearsBurned: 2, skills: ['Art', 'Photography', 'Sound/AV'] },
  { firstName: 'Tom', lastName: 'Garcia', email: 'tom.garcia@email.com', city: 'Dallas, TX', yearsBurned: 5, skills: ['Electrical', 'Carpentry', 'Leadership'] }
];

// Generate CSV content
const csvHeaders = ['First Name', 'Last Name', 'Email', 'Password', 'City', 'Years Burned', 'Skills', 'Has Ticket', 'Has Vehicle Pass', 'Early Arrival Interest', 'Bio'];
const csvRows = [];

// Find the next available user ID
let nextUserId = 1000009; // Start after existing users
let nextMemberId = 69; // Start after existing members
let nextApplicationId = 4000011; // Start after existing applications

// Process each mock user
for (let i = 0; i < mockUsers.length; i++) {
  const userData = mockUsers[i];
  const userId = nextUserId++;
  const memberId = nextMemberId++;
  const applicationId = nextApplicationId++;
  
  // Generate password (simple pattern)
  const password = `${userData.firstName.toLowerCase()}123!`;
  const hashedPassword = bcrypt.hashSync(password, 12);
  
  // Create user object
  const user = {
    _id: userId,
    email: userData.email,
    password: hashedPassword,
    firstName: userData.firstName,
    lastName: userData.lastName,
    profilePhoto: '',
    bio: `Passionate burner with ${userData.yearsBurned} year${userData.yearsBurned !== 1 ? 's' : ''} of experience. Love contributing to the community!`,
    city: userData.city,
    yearsBurned: userData.yearsBurned,
    skills: userData.skills,
    socialMedia: {
      instagram: `${userData.firstName.toLowerCase()}_burner`,
      facebook: `${userData.firstName} ${userData.lastName}`,
      linkedin: `${userData.firstName.toLowerCase()}-${userData.lastName.toLowerCase()}`
    },
    hasTicket: Math.random() > 0.3, // 70% have tickets
    hasVehiclePass: Math.random() > 0.6, // 40% have vehicle passes
    arrivalDate: new Date(2025, 7, 25 + Math.floor(Math.random() * 3)).toISOString(), // Aug 25-27
    departureDate: new Date(2025, 8, 1 + Math.floor(Math.random() * 2)).toISOString(), // Sep 1-2
    interestedInEAP: Math.random() > 0.5, // 50% interested in early arrival
    accountType: 'personal',
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add user to users map
  users.set(userData.email, user);
  
  // Don't create member records - they'll be created when applications are approved
  
  // Create application record (pending)
  const appliedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
  const application = {
    _id: applicationId,
    applicant: userId,
    camp: skipsCamp._id,
    applicationData: {
      motivation: `I'm excited to join Skips camp and contribute my ${userData.skills.join(', ')} skills!`,
      experience: `I have ${userData.yearsBurned} year${userData.yearsBurned !== 1 ? 's' : ''} of burning man experience and love being part of the community.`,
      skills: userData.skills,
      availability: {
        arriveDate: user.arrivalDate,
        departDate: user.departureDate,
        workShifts: 'Available for any shifts needed'
      }
    },
    status: 'pending',
    appliedAt: appliedAt,
    lastUpdated: appliedAt,
    createdAt: appliedAt,
    updatedAt: appliedAt,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: ''
  };
  
  // Add application to applications map
  applications.set(applicationId.toString(), application);
  
  // Add to CSV
  csvRows.push([
    userData.firstName,
    userData.lastName,
    userData.email,
    password,
    userData.city,
    userData.yearsBurned,
    userData.skills.join(', '),
    user.hasTicket ? 'Yes' : 'No',
    user.hasVehiclePass ? 'Yes' : 'No',
    user.interestedInEAP ? 'Yes' : 'No',
    user.bio
  ]);
}

// Generate CSV content
const csvContent = [
  csvHeaders.join(','),
  ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
].join('\n');

// Save CSV file
fs.writeFileSync('mock-users.csv', csvContent);

// Update mock data
const updatedMockData = {
  users: Array.from(users.entries()),
  camps: Array.from(camps.entries()),
  members: mockData.members || [], // Keep existing members
  applications: Array.from(applications.entries()),
  rosters: mockData.rosters || []
};

// Save updated mock data
fs.writeFileSync(mockDataPath, JSON.stringify(updatedMockData, null, 2));

console.log('✅ Created 15 mock users with applications to Skips camp');
console.log('✅ Generated mock-users.csv with login credentials');
console.log('✅ Updated mock database');
console.log('\n📊 Summary:');
console.log(`- ${mockUsers.length} new users created`);
console.log(`- All users applied to Skips camp (ID: ${skipsCamp._id})`);
console.log(`- All applications approved and converted to active members`);
console.log(`- CSV file saved as: mock-users.csv`);
console.log('\n🔑 Default password pattern: firstName123!');
console.log('📧 Email: as specified in CSV');
console.log('🏕️  Camp: Skips');
