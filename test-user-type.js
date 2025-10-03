const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testUserType() {
  console.log('🧪 TESTING USER TYPE AND ALLOWED FIELDS');
  
  try {
    // Test with a valid user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDUsImlhdCI6MTc1ODU4ODczNSwiZXhwIjoxNzU5MTkzNTM1fQ.VozdVI-Ee9XTRZ_AguWDXqWPh77hIRsHlwG4eYm44o0';
    
    // First, get the user profile to see account type
    console.log('📤 Getting user profile...');
    const profileResponse = await fetch('http://localhost:5001/api/users/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const profileResult = await profileResponse.text();
    console.log('📥 Profile response:', profileResult);
    
    if (profileResponse.ok) {
      const profile = JSON.parse(profileResult);
      console.log('👤 User account type:', profile.user.accountType);
      console.log('👤 User email:', profile.user.email);
      
      if (profile.user.accountType === 'camp') {
        console.log('🏕️  This is a CAMP account - only camp fields are allowed');
        console.log('🏕️  Allowed fields: campName, campBio, campPhotos, campSocialMedia, campLocation, campTheme, campSize, campYearFounded, campWebsite, campEmail');
      } else {
        console.log('👤 This is a PERSONAL account - personal fields are allowed');
        console.log('👤 Allowed fields: firstName, lastName, phoneNumber, city, yearsBurned, previousCamps, bio, profilePhoto, photos, socialMedia, skills, interests, burningManExperience, location, hasTicket, hasVehiclePass, arrivalDate, departureDate, interestedInEAP');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing user type:', error);
  }
}

testUserType();

