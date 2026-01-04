const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testProfileUpdate() {
  console.log('🧪 TESTING PROFILE UPDATE FUNCTIONALITY');
  
  try {
    // Test with a valid user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // Test profile update with skills array
    const updateData = {
      firstName: 'Test',
      lastName: 'User',
      skills: ['JavaScript', 'React', 'Node.js'],
      interests: ['Technology', 'Art'],
      burningManExperience: 'First time burner',
      location: 'San Francisco, CA',
      hasTicket: true,
      hasVehiclePass: false
    };
    
    console.log('📤 Sending profile update request...');
    console.log('Data:', JSON.stringify(updateData, null, 2));
    
    const response = await fetch('http://localhost:5001/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.text();
    console.log('📥 Response status:', response.status);
    console.log('📥 Response body:', result);
    
    if (response.ok) {
      console.log('✅ Profile update successful!');
    } else {
      console.log('❌ Profile update failed!');
    }
    
  } catch (error) {
    console.error('❌ Error testing profile update:', error);
  }
}

testProfileUpdate();