const axios = require('axios');

async function testSimpleLogin() {
  try {
    console.log('🔐 Testing simple login...');
    
    // Test with minimal data
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mudskipperscafe@gmail.com',
      password: 'weh0809'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ Login successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Login failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Full error:', error.response?.data);
  }
}

testSimpleLogin();
