const axios = require('axios');

async function updateCampSlug() {
  try {
    const API_URL = process.env.API_URL || 'https://burning-man-crm-production.up.railway.app/api';
    // Try admin account first, fallback to camp account
    const ADMIN_EMAIL = process.argv[2] || 'mudskipperscafe@gmail.com';
    const ADMIN_PASSWORD = process.argv[3] || 'weh0809';
    const CAMP_ID = '6904abe817ecb6e13d219ec2';
    const NEW_SLUG = 'bananahammocks';

    console.log('🔐 Step 1: Logging in as admin...');
    console.log(`   API URL: ${API_URL}`);
    
    // Login as admin
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginResponse.data.token;
    const adminUser = loginResponse.data.user;
    
    if (!token) {
      console.error('❌ Login failed - no token received');
      console.error('Response:', loginResponse.data);
      process.exit(1);
    }
    
    console.log('✅ Logged in as:', adminUser.firstName, adminUser.lastName);
    console.log('✅ Account type:', adminUser.accountType);
    
    if (adminUser.accountType !== 'admin') {
      console.error('❌ User is not an admin account');
      process.exit(1);
    }

    console.log(`\n🔄 Step 2: Updating camp slug for ID: ${CAMP_ID}`);
    console.log(`   New slug: ${NEW_SLUG}`);
    
    // Update the slug
    const updateResponse = await axios.put(
      `${API_URL}/camps/${CAMP_ID}/slug`,
      { slug: NEW_SLUG },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Slug update successful!');
    console.log('📊 Results:', JSON.stringify(updateResponse.data, null, 2));
    console.log(`\n🌐 New camp URL: ${updateResponse.data.camp?.url || `https://www.g8road.com/camps/${NEW_SLUG}`}`);

  } catch (error) {
    console.error('\n❌ Error updating camp slug:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data?.message || error.response.data);
      console.error('   Full response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received. Check if the server is running and accessible.');
      console.error('   URL attempted:', error.config?.url);
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

updateCampSlug();

