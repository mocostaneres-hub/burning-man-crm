const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testApplicationApproval() {
  console.log('🧪 TESTING APPLICATION APPROVAL PROCESS');
  
  try {
    // Test with a valid camp user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // First, get all applications for the camp
    console.log('📤 Getting applications for camp...');
    const applicationsResponse = await fetch('http://localhost:5001/api/applications/camp/2000022', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const applicationsResult = await applicationsResponse.text();
    console.log('📥 Applications response status:', applicationsResponse.status);
    
    if (applicationsResponse.ok) {
      const response = JSON.parse(applicationsResult);
      const applications = response.applications || response;
      console.log('📋 Total applications:', applications.length);
      console.log('📋 Applications:', applications);
      
      // Find a pending application to approve
      const pendingApp = applications.find(app => app.status === 'pending');
      if (pendingApp) {
        console.log('📝 Found pending application:', pendingApp._id);
        
        // Try to approve it
        console.log('📤 Approving application...');
        const approveResponse = await fetch(`http://localhost:5001/api/applications/${pendingApp._id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
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
        console.log('ℹ️  No pending applications found');
      }
    } else {
      console.log('❌ Failed to get applications');
      console.log('Response:', applicationsResult);
    }
    
  } catch (error) {
    console.error('❌ Error testing application approval:', error);
  }
}

testApplicationApproval();
