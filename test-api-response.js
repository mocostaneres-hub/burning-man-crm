const https = require('https');
const http = require('http');

console.log('🧪 TESTING API RESPONSE');
console.log('=======================\n');

// Test the public camps endpoint first
console.log('1️⃣ Testing public camps endpoint...');
const campsUrl = 'http://localhost:5001/api/camps';

http.get(campsUrl, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const skipsCamp = response.camps.find(camp => camp._id === 2000022);
      
      if (skipsCamp) {
        console.log('✅ Skips camp found');
        console.log(`   Camp ID: ${skipsCamp._id}`);
        console.log(`   Camp Name: ${skipsCamp.campName}`);
        console.log(`   Total Members: ${skipsCamp.stats?.totalMembers || 'N/A'}`);
        console.log(`   Total Applications: ${skipsCamp.stats?.totalApplications || 'N/A'}`);
      } else {
        console.log('❌ Skips camp not found');
      }
      
      console.log('\n2️⃣ Testing roster endpoint (requires auth)...');
      console.log('   Note: This endpoint requires authentication, so we cannot test it directly.');
      console.log('   The issue is likely that the frontend is using cached data.');
      
      console.log('\n3️⃣ RECOMMENDATIONS:');
      console.log('   - Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)');
      console.log('   - Open browser dev tools and disable cache');
      console.log('   - Check if the frontend is making the correct API calls');
      console.log('   - Verify that the roster API is returning populated member details');
      
    } catch (error) {
      console.log('❌ Error parsing response:', error.message);
    }
  });
}).on('error', (error) => {
  console.log('❌ Error making request:', error.message);
});

console.log('   Making request to:', campsUrl);


