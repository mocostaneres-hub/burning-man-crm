const fs = require('fs');

console.log('🔍 DEBUGGING FRONTEND DATA ISSUE');
console.log('================================\n');

// Read the mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

console.log('1️⃣ ROSTER DATA STRUCTURE');
console.log('-------------------------');
const rosterEntry = Object.values(data.rosters)[0];
const roster = rosterEntry[1];

console.log('Roster ID:', roster._id);
console.log('Roster members count:', roster.members.length);
console.log('Roster members:');
roster.members.forEach((member, index) => {
  console.log(`  ${index + 1}. Member ID: ${member.member}, Added: ${member.addedAt}`);
});

console.log('\n2️⃣ MEMBER DETAILS CHECK');
console.log('------------------------');
const membersArray = Object.values(data.members);
const usersArray = Object.values(data.users);

roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (memberEntry) {
    const member = memberEntry[1];
    const user = usersArray.find(u => u[1]._id === member.user);
    if (user) {
      const userData = user[1];
      console.log(`  ${index + 1}. ${userData.firstName} ${userData.lastName} (Member: ${member._id}, User: ${member.user})`);
    } else {
      console.log(`  ${index + 1}. ❌ User not found for member ${member._id}`);
    }
  } else {
    console.log(`  ${index + 1}. ❌ Member ${rosterMember.member} not found in members collection`);
  }
});

console.log('\n3️⃣ REACT KEY SIMULATION');
console.log('-------------------------');
roster.members.forEach((member, index) => {
  const key = `${member.member}-${member.addedAt}-${index}`;
  console.log(`  ${index + 1}. Key: ${key}`);
});

console.log('\n4️⃣ DUPLICATE CHECK');
console.log('-------------------');
const memberIds = roster.members.map(m => m.member);
const uniqueMemberIds = [...new Set(memberIds)];
console.log(`Total members: ${memberIds.length}`);
console.log(`Unique member IDs: ${uniqueMemberIds.length}`);
console.log(`Has duplicates: ${memberIds.length !== uniqueMemberIds.length ? 'YES' : 'NO'}`);

if (memberIds.length !== uniqueMemberIds.length) {
  console.log('\nDuplicate member IDs:');
  const duplicates = memberIds.filter((id, index) => memberIds.indexOf(id) !== index);
  console.log(duplicates);
}

console.log('\n5️⃣ FRONTEND SIMULATION');
console.log('----------------------');
console.log('Simulating what the frontend would render:');
roster.members.forEach((memberEntry, index) => {
  const memberEntryData = membersArray.find(m => m[1]._id.toString() === memberEntry.member.toString());
  if (memberEntryData) {
    const member = memberEntryData[1];
    const user = usersArray.find(u => u[1]._id === member.user);
    if (user) {
      const userData = user[1];
      console.log(`  Row ${index + 1}: ${userData.firstName} ${userData.lastName}`);
    }
  }
});

console.log('\n✅ DEBUG COMPLETE');


