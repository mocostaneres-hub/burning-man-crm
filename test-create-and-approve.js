const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testCreateAndApprove() {
  console.log('🧪 TESTING CREATE AND APPROVE APPLICATION');
  
  try {
    // Test with a personal user token (to create application)
    const personalToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDYsImlhdCI6MTc1ODQ0NTM2MywiZXhwIjoxNzU5MDUwMTYzfQ.HIkSYdndUXvoQ1d_xvmQj1B6fHEz8ZM24w3q80__itk';
    
    // Test with a camp user token (to approve application)
    const campToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // First, create a new application
    console.log('📤 Creating new application...');
    const applicationData = {
      campId: 2000022,
      applicationData: {
        motivation: 'I want to test the approval flow and see if there are any errors',
        experience: 'I have some experience with camping and community building',
        skills: ['Carpentry', 'Cooking', 'Leadership'],
        hasTicket: true,
        hasVehiclePass: false,
        arrivalDate: '2025-08-25T07:00:00.000Z',
        departureDate: '2025-09-01T07:00:00.000Z',
        interestedInEAP: true
      }
    };
    
    const createResponse = await fetch('http://localhost:5001/api/applications/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personalToken}`
      },
      body: JSON.stringify(applicationData)
    });
    
    const createResult = await createResponse.text();
    console.log('📥 Create response status:', createResponse.status);
    console.log('📥 Create response body:', createResult);
    
    if (createResponse.ok) {
      const newApp = JSON.parse(createResult);
      console.log('✅ Application created successfully! ID:', newApp.application._id);
      
      // Now try to approve it
      console.log('📤 Approving application...');
      const approveResponse = await fetch(`http://localhost:5001/api/applications/${newApp.application._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${campToken}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      
      const approveResult = await approveResponse.text();
      console.log('📥 Approve response status:', approveResponse.status);
      console.log('📥 Approve response body:', approveResult);
      
      if (approveResponse.ok) {
        console.log('✅ Application approval successful!');
      } else {
        console.log('❌ Application approval failed!');
        try {
          const errorData = JSON.parse(approveResult);
          console.log('❌ Error details:', errorData);
        } catch (e) {
          console.log('❌ Raw error response:', approveResult);
        }
      }
    } else {
      console.log('❌ Failed to create application');
      try {
        const errorData = JSON.parse(createResult);
        console.log('❌ Error details:', errorData);
      } catch (e) {
        console.log('❌ Raw error response:', createResult);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing create and approve:', error);
  }
}

testCreateAndApprove();

