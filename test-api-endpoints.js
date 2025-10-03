const axios = require('axios');

async function testEndpoints() {
  try {
    console.log('🔍 Testing API endpoints...\n');

    // First, let's login to get a proper token
    console.log('1. Testing login...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mocostaneres@gmail.com',
      password: '08091963'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...\n');

    // Test my-camp endpoint
    console.log('2. Testing /camps/my-camp...');
    try {
      const myCampResponse = await axios.get('http://localhost:5001/api/camps/my-camp', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ My camp response:', JSON.stringify(myCampResponse.data, null, 2));
    } catch (error) {
      console.log('❌ My camp error:', error.response?.data || error.message);
    }

    // Test applications endpoint
    console.log('\n3. Testing /applications/camp/2000022...');
    try {
      const applicationsResponse = await axios.get('http://localhost:5001/api/applications/camp/2000022', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Applications response:', JSON.stringify(applicationsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Applications error:', error.response?.data || error.message);
    }

    // Test rosters endpoint
    console.log('\n4. Testing /rosters...');
    try {
      const rostersResponse = await axios.get('http://localhost:5001/api/rosters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Rosters response:', JSON.stringify(rostersResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Rosters error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEndpoints();
