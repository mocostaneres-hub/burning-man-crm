const axios = require('axios');

async function resetApplicationStatus() {
  try {
    // Configuration
    const API_URL = 'https://burning-man-crm-production.up.railway.app/api';
    
    // Admin credentials from memory - Test Account
    const ADMIN_EMAIL = 'mudskipperscafe@gmail.com';
    const ADMIN_PASSWORD = 'weh0809';
    
    // Target member and camp
    const MEMBER_ID = '68e73fc6cf9aaf071e461ea0';
    const CAMP_NAME = 'Mudskippers';

    console.log('🔐 Step 1: Logging in as admin...');
    
    // Login as admin
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginResponse.data.token;
    const adminUser = loginResponse.data.user;
    
    console.log('✅ Logged in as:', adminUser.firstName, adminUser.lastName);
    console.log('✅ Account type:', adminUser.accountType);
    console.log('✅ Admin campId:', adminUser.campId);

    // Get Mudskippers camp ID
    console.log('\n🔍 Step 2: Finding Mudskippers camp...');
    
    // The admin's campId should be the Mudskippers camp
    const campId = adminUser.campId;
    
    if (!campId) {
      console.error('❌ No campId found for admin user');
      return;
    }
    
    console.log('✅ Camp ID:', campId);

    // Reset the application status
    console.log('\n🔄 Step 3: Resetting application status...');
    
    const resetResponse = await axios.patch(
      `${API_URL}/applications/reset/${MEMBER_ID}/${campId}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('\n✅ Reset complete!');
    console.log('📊 Results:', resetResponse.data);
    console.log('\n✅ Member can now reapply to the camp!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

resetApplicationStatus();

