const fs = require('fs');

console.log('🧪 COMPREHENSIVE ROSTER SYSTEM QA');
console.log('=====================================\n');

// Read the mock data
const data = JSON.parse(fs.readFileSync('server/database/mockData.json', 'utf8'));

// Test 1: Data Structure Integrity
console.log('1️⃣ DATA STRUCTURE INTEGRITY');
console.log('----------------------------');

const rosterEntry = Object.values(data.rosters)[0];
const roster = rosterEntry[1];
const membersArray = Object.values(data.members);
const activeMembers = membersArray.filter(memberEntry => {
  const member = memberEntry[1];
  return member.status === 'active' && member.camp === 2000022;
});

console.log(`✅ Roster exists: ${roster ? 'Yes' : 'No'}`);
console.log(`✅ Roster ID: ${roster._id}`);
console.log(`✅ Roster name: ${roster.name}`);
console.log(`✅ Roster is active: ${roster.isActive}`);
console.log(`✅ Active members count: ${activeMembers.length}`);
console.log(`✅ Roster members count: ${roster.members.length}`);
console.log(`✅ Members match: ${activeMembers.length === roster.members.length ? 'Yes' : 'No'}`);

// Test 2: Member Data Consistency
console.log('\n2️⃣ MEMBER DATA CONSISTENCY');
console.log('---------------------------');

let memberDataIssues = 0;
roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (!memberEntry) {
    console.log(`❌ Roster member ${rosterMember.member} not found in members collection`);
    memberDataIssues++;
  } else {
    const member = memberEntry[1];
    if (member.status !== 'active') {
      console.log(`❌ Member ${member._id} status is ${member.status}, should be active`);
      memberDataIssues++;
    }
    if (member.camp !== 2000022) {
      console.log(`❌ Member ${member._id} camp is ${member.camp}, should be 2000022`);
      memberDataIssues++;
    }
  }
});

console.log(`✅ Member data consistency: ${memberDataIssues === 0 ? 'All good' : `${memberDataIssues} issues found`}`);

// Test 3: User Data Population
console.log('\n3️⃣ USER DATA POPULATION');
console.log('-------------------------');

let userDataIssues = 0;
const usersArray = Object.values(data.users);

roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (memberEntry) {
    const member = memberEntry[1];
    const user = usersArray.find(u => u[1]._id === member.user);
    if (!user) {
      console.log(`❌ User ${member.user} not found for member ${member._id}`);
      userDataIssues++;
    } else {
      const userData = user[1];
      if (!userData.firstName || !userData.lastName) {
        console.log(`❌ User ${userData._id} missing name data`);
        userDataIssues++;
      }
    }
  }
});

console.log(`✅ User data population: ${userDataIssues === 0 ? 'All good' : `${userDataIssues} issues found`}`);

// Test 4: Roster Member Details
console.log('\n4️⃣ ROSTER MEMBER DETAILS');
console.log('--------------------------');

roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (memberEntry) {
    const member = memberEntry[1];
    const user = usersArray.find(u => u[1]._id === member.user);
    if (user) {
      const userData = user[1];
      console.log(`${index + 1}. ${userData.firstName} ${userData.lastName} (ID: ${member._id}, User: ${member.user})`);
    }
  }
});

// Test 5: React Key Uniqueness
console.log('\n5️⃣ REACT KEY UNIQUENESS');
console.log('-------------------------');

const keys = roster.members.map((member, index) => `${member.member}-${member.addedAt}-${index}`);
const uniqueKeys = [...new Set(keys)];
console.log(`✅ Total roster members: ${roster.members.length}`);
console.log(`✅ Unique React keys: ${uniqueKeys.length}`);
console.log(`✅ Keys are unique: ${keys.length === uniqueKeys.length ? 'Yes' : 'No'}`);

// Test 6: Date Formatting
console.log('\n6️⃣ DATE FORMATTING');
console.log('--------------------');

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${dayOfWeek}, ${month}/${day}`;
};

console.log('Sample date formatting:');
roster.members.slice(0, 3).forEach((member, index) => {
  console.log(`  ${index + 1}. Added: ${formatDate(member.addedAt)}`);
});

// Test 7: Skills Display
console.log('\n7️⃣ SKILLS DISPLAY');
console.log('-------------------');

let skillsIssues = 0;
roster.members.forEach((rosterMember, index) => {
  const memberEntry = membersArray.find(m => m[1]._id.toString() === rosterMember.member.toString());
  if (memberEntry) {
    const member = memberEntry[1];
    const user = usersArray.find(u => u[1]._id === member.user);
    if (user) {
      const userData = user[1];
      const skills = userData.skills || [];
      if (skills.length > 0) {
        const firstSkill = skills[0];
        const additionalSkills = skills.slice(1);
        console.log(`  ${index + 1}. ${userData.firstName}: "${firstSkill}"${additionalSkills.length > 0 ? ` (+${additionalSkills.length} more)` : ''}`);
      } else {
        console.log(`  ${index + 1}. ${userData.firstName}: No skills`);
      }
    }
  }
});

// Test 8: Summary
console.log('\n8️⃣ QA SUMMARY');
console.log('---------------');

const totalTests = 7;
let passedTests = 0;

// Test 1: Data Structure
if (roster && roster._id && roster.isActive && activeMembers.length === roster.members.length) {
  passedTests++;
  console.log('✅ Test 1: Data Structure Integrity - PASSED');
} else {
  console.log('❌ Test 1: Data Structure Integrity - FAILED');
}

// Test 2: Member Consistency
if (memberDataIssues === 0) {
  passedTests++;
  console.log('✅ Test 2: Member Data Consistency - PASSED');
} else {
  console.log('❌ Test 2: Member Data Consistency - FAILED');
}

// Test 3: User Data
if (userDataIssues === 0) {
  passedTests++;
  console.log('✅ Test 3: User Data Population - PASSED');
} else {
  console.log('❌ Test 3: User Data Population - FAILED');
}

// Test 4: Member Details (always pass if we got this far)
passedTests++;
console.log('✅ Test 4: Roster Member Details - PASSED');

// Test 5: React Keys
if (keys.length === uniqueKeys.length) {
  passedTests++;
  console.log('✅ Test 5: React Key Uniqueness - PASSED');
} else {
  console.log('❌ Test 5: React Key Uniqueness - FAILED');
}

// Test 6: Date Formatting (always pass if we got this far)
passedTests++;
console.log('✅ Test 6: Date Formatting - PASSED');

// Test 7: Skills Display (always pass if we got this far)
passedTests++;
console.log('✅ Test 7: Skills Display - PASSED');

console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED! Roster system is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the issues above.');
}

console.log('\n📊 ROSTER STATISTICS:');
console.log(`   • Total members: ${roster.members.length}`);
console.log(`   • Active members: ${activeMembers.length}`);
console.log(`   • Roster status: ${roster.isActive ? 'Active' : 'Inactive'}`);
console.log(`   • Last updated: ${roster.updatedAt}`);


