const fetch = require('node-fetch');

async function testAdminLogin() {
  try {
    console.log('Testing admin login...');
    
    // First, try to login
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@burningman.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.token) {
      console.log('Login successful, testing profile access...');
      
      // Test profile access
      const profileResponse = await fetch('http://localhost:5001/api/users/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginData.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      const profileData = await profileResponse.json();
      console.log('Profile response:', profileData);
      
      if (profileData.user) {
        console.log('User account type:', profileData.user.accountType);
        console.log('Admin access test:', profileData.user.accountType === 'admin');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminLogin();

