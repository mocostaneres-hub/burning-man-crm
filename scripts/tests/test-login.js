const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Testing login...');
    
    const response = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mudskipperscafe@gmail.com',
      password: 'weh0809'
    });
    
    console.log('✅ Login successful!');
    console.log('Token:', response.data.token);
    
    // Test FAQ endpoint
    console.log('📋 Testing FAQ endpoint...');
    const faqResponse = await axios.get('http://localhost:5001/api/admin/faqs', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ FAQ endpoint working!');
    console.log('FAQs count:', faqResponse.data.faqs.length);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testLogin();
