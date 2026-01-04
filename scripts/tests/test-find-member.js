const mockDB = require('./server/database/mockDatabase');

async function testFindMember() {
  console.log('🧪 TESTING findMember METHOD');
  console.log('============================\n');
  
  const db = mockDB;
  await db.ensureLoaded();
  
  // Test finding different members
  const memberIds = [68, "68d08cdefea5a5dc098bd057", "68d08ce5fea5a5dc098bd058"];
  
  for (const memberId of memberIds) {
    console.log(`Testing member ID: ${memberId} (type: ${typeof memberId})`);
    const member = await db.findMember({ _id: memberId });
    if (member) {
      console.log(`  Found: ${member._id} (user: ${member.user})`);
    } else {
      console.log(`  Not found`);
    }
  }
  
  console.log('\n📋 All members in database:');
  for (let member of db.collections.members.values()) {
    console.log(`  ID: ${member._id} (type: ${typeof member._id}), User: ${member.user}`);
  }
}

testFindMember().catch(console.error);
