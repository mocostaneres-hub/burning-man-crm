const fs = require('fs');
const path = require('path');

// Load the mock data
const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

console.log('Fixing duplicate users...');

// Convert to Map for easier manipulation
const users = new Map(mockData.users);

// Remove users with undefined names
const usersToRemove = [];
for (let [email, user] of users.entries()) {
  if (!user.firstName || user.firstName === undefined) {
    console.log('Removing user with undefined name:', email, 'ID:', user._id);
    usersToRemove.push(email);
  }
}

// Remove the duplicate entries
for (let email of usersToRemove) {
  users.delete(email);
}

// Convert back to array
mockData.users = Array.from(users.entries());

// Save the fixed data
fs.writeFileSync(mockDataPath, JSON.stringify(mockData, null, 2));

console.log(`Removed ${usersToRemove.length} duplicate users with undefined names`);
console.log('Mock data fixed!');
