const mockDB = require('./server/database/mockDatabase');

async function testRosterPopulation() {
  console.log('🧪 TESTING ROSTER POPULATION');
  console.log('=============================\n');
  
  const db = mockDB;
  await db.ensureLoaded();
  
  // Get the roster
  const rosters = await db.findAllRosters({ camp: 2000022 });
  console.log('Found rosters:', rosters.length);
  
  if (rosters.length > 0) {
    const roster = rosters[0];
    console.log('Roster members count:', roster.members.length);
    console.log('Roster member IDs:', roster.members.map(m => m.member));
    
    // Test population like the server does
    const populatedMembers = [];
    for (const memberEntry of roster.members) {
      console.log(`\nLooking up member ID: ${memberEntry.member} (type: ${typeof memberEntry.member})`);
      const member = await db.findMember({ _id: memberEntry.member });
      if (member) {
        console.log(`  Found member: ${member._id} (user: ${member.user})`);
        const user = await db.findUser({ _id: member.user });
        if (user) {
          console.log(`  Found user: ${user.firstName} ${user.lastName}`);
          populatedMembers.push({
            ...memberEntry,
            memberDetails: {
              ...member,
              userDetails: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
              }
            }
          });
        } else {
          console.log(`  User not found for member ${member._id}`);
        }
      } else {
        console.log(`  Member not found for ID ${memberEntry.member}`);
      }
    }
    
    console.log('\n📋 Final populated members:');
    populatedMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.memberDetails.userDetails.firstName} ${member.memberDetails.userDetails.lastName} (Member ID: ${member.member})`);
    });
  }
}

testRosterPopulation().catch(console.error);

