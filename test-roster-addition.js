const mockDB = require('./server/database/mockDatabase');

async function testRosterAddition() {
  console.log('🧪 TESTING ROSTER ADDITION');
  console.log('===========================\n');
  
  try {
    await mockDB.ensureLoaded();
    
    // Get the active roster
    const rosters = await mockDB.findAllRosters({ camp: 2000022 });
    const roster = rosters[0];
    
    console.log('Current roster:', roster);
    console.log('Roster members count:', roster.members.length);
    
    // Test adding a member to the roster
    const memberId = 3000003; // The member we just created
    const addedBy = 1000005; // Camp owner
    
    console.log(`\nAdding member ${memberId} to roster ${roster._id}...`);
    const updatedRoster = await mockDB.addMemberToRoster(roster._id, memberId, addedBy);
    
    console.log('Updated roster members count:', updatedRoster.members.length);
    console.log('Updated roster members:', updatedRoster.members);
    
    if (updatedRoster.members.length > 0) {
      console.log('✅ Roster addition successful!');
    } else {
      console.log('❌ Roster addition failed - no members added');
    }
    
  } catch (error) {
    console.error('❌ Error during roster addition:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRosterAddition();