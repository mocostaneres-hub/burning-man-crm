const mockDB = require('../../server/database/mockDatabase');

async function testRosterNullIssue() {
  console.log('🧪 TESTING ROSTER NULL ISSUE');
  
  try {
    await mockDB.ensureLoaded();
    
    // Get all rosters
    const rosters = Array.from(mockDB.collections.rosters.values());
    console.log('📊 Total rosters:', rosters.length);
    
    for (let roster of rosters) {
      console.log(`\n🏕️  Roster ID: ${roster._id}`);
      console.log(`📝 Roster name: ${roster.name}`);
      console.log(`👥 Members count: ${roster.members.length}`);
      
      // Check for null members
      const nullMembers = roster.members.filter(m => m.member === null || m.member === undefined);
      if (nullMembers.length > 0) {
        console.log(`❌ Found ${nullMembers.length} null members!`);
        console.log('Null members:', nullMembers);
      } else {
        console.log('✅ No null members found');
      }
      
      // Check for invalid member IDs
      const invalidMembers = roster.members.filter(m => {
        if (!m.member) return true;
        const memberExists = mockDB.collections.members.has(m.member.toString());
        return !memberExists;
      });
      
      if (invalidMembers.length > 0) {
        console.log(`❌ Found ${invalidMembers.length} invalid member references!`);
        console.log('Invalid members:', invalidMembers);
      } else {
        console.log('✅ All member references are valid');
      }
    }
    
    // Test adding a member to roster
    console.log('\n🧪 Testing addMemberToRoster...');
    const testRoster = rosters[0];
    if (testRoster) {
      try {
        const result = await mockDB.addMemberToRoster(testRoster._id, 3000006, 1000005);
        console.log('✅ addMemberToRoster test successful');
      } catch (error) {
        console.log('❌ addMemberToRoster test failed:', error.message);
        console.log('Error details:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing roster null issue:', error);
  }
}

testRosterNullIssue();

