const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testApplicationFlow() {
  console.log('🧪 TESTING APPLICATION APPROVAL FLOW');
  console.log('=====================================\n');
  
  const authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
  const baseUrl = 'http://localhost:5001/api';
  
  try {
    // Step 1: Check current roster count
    console.log('1️⃣ Checking current roster...');
    const rosterResponse = await fetch(`${baseUrl}/rosters`, {
      headers: { 'Authorization': authToken }
    });
    const rosters = await rosterResponse.json();
    const currentRosterCount = rosters[0].members.length;
    console.log(`   Current roster has ${currentRosterCount} members`);
    
    // Step 2: Create a test application
    console.log('\n2️⃣ Creating test application...');
    const testApplication = {
      campId: 2000022,
      applicationData: {
        motivation: "I want to test the application approval flow to verify it works correctly for roster management.",
        experience: "I have experience in testing and verification processes.",
        skills: ["Testing", "Verification"],
        hasTicket: true,
        hasVehiclePass: false,
        arrivalDate: "2025-08-25T07:00:00.000Z",
        departureDate: "2025-09-01T07:00:00.000Z",
        interestedInEAP: true
      }
    };
    
    const createResponse = await fetch(`${baseUrl}/applications/apply`, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testApplication)
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.log(`   ❌ Failed to create application: ${error}`);
      return;
    }
    
    const newApplication = await createResponse.json();
    console.log(`   ✅ Created application ID: ${newApplication.applicationId}`);
    
    // Step 3: Get the application to approve it
    console.log('\n3️⃣ Getting application details...');
    const getAppResponse = await fetch(`${baseUrl}/applications/camp/2000022`, {
      headers: { 'Authorization': authToken }
    });
    const applications = await getAppResponse.json();
    
    if (applications.applications.length === 0) {
      console.log('   ❌ No applications found');
      return;
    }
    
    const application = applications.applications[0];
    console.log(`   Found application: ${application.applicant.firstName} ${application.applicant.lastName}`);
    
    // Step 4: Approve the application
    console.log('\n4️⃣ Approving application...');
    const approveResponse = await fetch(`${baseUrl}/applications/${application._id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reviewNotes: "Test approval for roster verification"
      })
    });
    
    if (!approveResponse.ok) {
      const error = await approveResponse.text();
      console.log(`   ❌ Failed to approve application: ${error}`);
      return;
    }
    
    const approvalResult = await approveResponse.json();
    console.log(`   ✅ Application approved: ${approvalResult.message}`);
    
    // Step 5: Check roster count after approval
    console.log('\n5️⃣ Checking roster after approval...');
    const newRosterResponse = await fetch(`${baseUrl}/rosters`, {
      headers: { 'Authorization': authToken }
    });
    const newRosters = await newRosterResponse.json();
    const newRosterCount = newRosters[0].members.length;
    console.log(`   New roster has ${newRosterCount} members`);
    
    // Step 6: Verify the new member is in the roster
    console.log('\n6️⃣ Verifying new member in roster...');
    const newMember = newRosters[0].members.find(m => 
      m.memberDetails.userDetails.firstName === application.applicant.firstName &&
      m.memberDetails.userDetails.lastName === application.applicant.lastName
    );
    
    if (newMember) {
      console.log(`   ✅ SUCCESS! New member found in roster:`);
      console.log(`      Name: ${newMember.memberDetails.userDetails.firstName} ${newMember.memberDetails.userDetails.lastName}`);
      console.log(`      Member ID: ${newMember.member}`);
      console.log(`      Added at: ${newMember.addedAt}`);
    } else {
      console.log(`   ❌ FAILED! New member not found in roster`);
    }
    
    console.log('\n🎯 CONCLUSION:');
    if (newRosterCount > currentRosterCount && newMember) {
      console.log('✅ Application approval flow works correctly!');
      console.log('✅ Approved applications are automatically added to the roster!');
    } else {
      console.log('❌ Application approval flow has issues');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testApplicationFlow();
