const mockDB = require('./server/database/mockDatabase');

async function testMemberCreation() {
  console.log('🧪 TESTING MEMBER CREATION');
  console.log('==========================\n');
  
  try {
    await mockDB.ensureLoaded();
    
    // Test creating a member
    const memberData = {
      user: 1000024, // Irlaneide Brasil
      camp: 2000022, // Skips camp
      status: 'active',
      appliedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 1000005
    };
    
    console.log('Creating member with data:', memberData);
    const newMember = await mockDB.createMember(memberData);
    console.log('Created member:', newMember);
    
    if (newMember && newMember._id) {
      console.log('✅ Member creation successful!');
      console.log('Member ID:', newMember._id);
      console.log('Member type:', typeof newMember._id);
    } else {
      console.log('❌ Member creation failed - no ID returned');
    }
    
  } catch (error) {
    console.error('❌ Error during member creation:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMemberCreation();

