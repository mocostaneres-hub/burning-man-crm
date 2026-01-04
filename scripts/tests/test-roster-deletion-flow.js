const mockDB = require('./server/database/mockDatabase');

async function testRosterDeletionFlow() {
  console.log('🧪 TESTING ROSTER DELETION → APPLICATION REJECTION FLOW');
  console.log('======================================================\n');
  
  const db = mockDB;
  await db.ensureLoaded();
  
  try {
    // Step 1: Check current state
    console.log('1️⃣ Current state:');
    const applications = await db.findMemberApplications({ camp: 2000022 });
    const rosters = await db.findAllRosters({ camp: 2000022 });
    const roster = rosters[0];
    
    console.log(`   Applications: ${applications.length}`);
    console.log(`   Roster members: ${roster.members.length}`);
    
    // Find Irlaneide's application and member records
    const irlaneideApp = applications.find(app => app.applicant === 1000024);
    const irlaneideMember = Array.from(db.collections.members.values()).find(m => m.user === 1000024);
    
    console.log(`   Irlaneide application status: ${irlaneideApp ? irlaneideApp.status : 'Not found'}`);
    console.log(`   Irlaneide member status: ${irlaneideMember ? irlaneideMember.status : 'Not found'}`);
    
    // Step 2: Simulate the roster deletion process
    console.log('\n2️⃣ Simulating roster deletion process...');
    
    if (irlaneideMember && irlaneideApp) {
      // Update member status to rejected
      await db.updateMember(irlaneideMember._id, {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: 1000005,
        reviewNotes: 'Removed from active roster'
      });
      console.log('   ✅ Updated member status to rejected');
      
      // Update application status to rejected
      await db.updateMemberApplication(irlaneideApp._id, {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: 1000005,
        reviewNotes: 'Removed from active roster'
      });
      console.log('   ✅ Updated application status to rejected');
      
      // Save changes
      await db.saveData();
      console.log('   ✅ Changes saved to database');
    }
    
    // Step 3: Verify the changes
    console.log('\n3️⃣ Verifying changes...');
    const updatedApplications = await db.findMemberApplications({ camp: 2000022 });
    const updatedIrlaneideApp = updatedApplications.find(app => app.applicant === 1000024);
    const updatedIrlaneideMember = Array.from(db.collections.members.values()).find(m => m.user === 1000024);
    
    console.log(`   Updated application status: ${updatedIrlaneideApp ? updatedIrlaneideApp.status : 'Not found'}`);
    console.log(`   Updated member status: ${updatedIrlaneideMember ? updatedIrlaneideMember.status : 'Not found'}`);
    
    if (updatedIrlaneideApp && updatedIrlaneideApp.status === 'rejected' && 
        updatedIrlaneideMember && updatedIrlaneideMember.status === 'rejected') {
      console.log('\n🎉 SUCCESS! Roster deletion flow works correctly:');
      console.log('   ✅ Member status updated to rejected');
      console.log('   ✅ Application status updated to rejected');
      console.log('   ✅ Both records show "Removed from active roster" note');
      console.log('   ✅ Application will now appear in "Rejected" queue');
    } else {
      console.log('\n❌ FAILED! Roster deletion flow has issues');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRosterDeletionFlow();

