const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testPersonalProfileUpdate() {
  console.log('🧪 TESTING PERSONAL ACCOUNT PROFILE UPDATE');
  
  try {
    // Test with a personal user token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDAwMDYsImlhdCI6MTc1ODQ0NTM2MywiZXhwIjoxNzU5MDUwMTYzfQ.HIkSYdndUXvoQ1d_xvmQj1B6fHEz8ZM24w3q80__itk';
    
    // Get current user profile first
    console.log('📤 Getting current user profile...');
    const profileResponse = await fetch('http://localhost:5001/api/users/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const profileResult = await profileResponse.text();
    console.log('📥 Profile response status:', profileResponse.status);
    console.log('📥 Profile response:', profileResult);
    
    if (profileResponse.ok) {
      const profile = JSON.parse(profileResult);
      console.log('👤 User account type:', profile.user.accountType);
      console.log('👤 User email:', profile.user.email);
      
      // Test personal fields that frontend typically sends
      const profileData = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+1234567890',
        city: 'San Francisco',
        yearsBurned: 5,
        previousCamps: 'Previous Camp',
        bio: 'Updated bio for personal account',
        socialMedia: {
          instagram: '@updated',
          facebook: 'facebook.com/updated',
          linkedin: 'linkedin.com/in/updated'
        },
        skills: ['JavaScript', 'React', 'Node.js', 'Testing'],
        interests: ['Technology', 'Art', 'Music', 'Camping'],
        burningManExperience: 'Been to Burning Man multiple times',
        location: 'San Francisco, CA',
        hasTicket: true,
        hasVehiclePass: false,
        arrivalDate: null,
        departureDate: null,
        interestedInEAP: false
      };
      
      console.log('📤 Sending personal account profile update...');
      console.log('Data:', JSON.stringify(profileData, null, 2));
      
      const updateResponse = await fetch('http://localhost:5001/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
      
      const updateResult = await updateResponse.text();
      console.log('📥 Update response status:', updateResponse.status);
      console.log('📥 Update response body:', updateResult);
      
      if (updateResponse.ok) {
        console.log('✅ Personal account profile update successful!');
        const data = JSON.parse(updateResult);
        console.log('👤 Updated user data:', data.user);
      } else {
        console.log('❌ Personal account profile update failed!');
        try {
          const errorData = JSON.parse(updateResult);
          console.log('❌ Error details:', errorData);
        } catch (e) {
          console.log('❌ Raw error response:', updateResult);
        }
      }
    } else {
      console.log('❌ Failed to get profile');
    }
    
  } catch (error) {
    console.error('❌ Error testing personal profile update:', error);
  }
}

testPersonalProfileUpdate();

