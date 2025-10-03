const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testCompleteProfileUpdate() {
  console.log('🧪 TESTING COMPLETE PROFILE UPDATE WITH ALL FIELDS');
  
  try {
    // Test with a valid user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // Test with ALL possible fields that the frontend might send
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
      interestedInEAP: false,
      // Add any other fields that might be causing issues
      photos: [],
      campName: 'Skips',
      campBio: 'Test camp bio',
      campPhotos: [],
      campSocialMedia: {},
      campLocation: 'San Francisco',
      campTheme: 'Technology',
      campSize: 50,
      campYearFounded: 2020,
      campWebsite: 'https://example.com',
      campEmail: 'test@example.com'
    };
    
    console.log('📤 Sending complete profile update request...');
    console.log('Data keys:', Object.keys(profileData));
    
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
      console.log('✅ Complete profile update successful!');
    } else {
      console.log('❌ Complete profile update failed!');
      try {
        const errorData = JSON.parse(result);
        console.log('❌ Error details:', errorData);
      } catch (e) {
        console.log('❌ Raw error response:', result);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing complete profile update:', error);
  }
}

testCompleteProfileUpdate();

