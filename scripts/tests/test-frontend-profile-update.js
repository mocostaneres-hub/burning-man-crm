const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFrontendProfileUpdate() {
  console.log('🧪 TESTING FRONTEND PROFILE UPDATE SIMULATION');
  
  try {
    // Test with a valid user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // Simulate the exact data structure that the frontend sends
    const profileData = {
      firstName: 'Mo',
      lastName: 'Costa-Neres',
      phoneNumber: '+1234567890',
      city: 'San Francisco',
      yearsBurned: 5,
      previousCamps: 'Test Camp',
      bio: 'Test bio',
      profilePhoto: '',
      socialMedia: {
        instagram: '@test',
        facebook: 'facebook.com/test',
        linkedin: 'linkedin.com/in/test'
      },
      skills: ['JavaScript', 'React', 'Node.js'],
      interests: ['Technology', 'Art'],
      burningManExperience: 'First time burner',
      location: 'San Francisco, CA',
      hasTicket: true,
      hasVehiclePass: false,
      arrivalDate: null,
      departureDate: null,
      interestedInEAP: false
    };
    
    console.log('📤 Sending profile update request...');
    console.log('Data:', JSON.stringify(profileData, null, 2));
    
    const response = await fetch('http://localhost:5001/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
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

testFrontendProfileUpdate();