#!/usr/bin/env node

const fetch = require('node-fetch');

// Test the fix endpoint
async function testFixEndpoint() {
  try {
    console.log('🔧 Testing volunteer shift task fix endpoint...\n');

    // You'll need to provide your admin token
    const token = process.argv[2];
    
    if (!token) {
      console.error('❌ Please provide your admin token as an argument:');
      console.error('   node test-fix-volunteer-tasks.js YOUR_TOKEN');
      console.error('\nTo get your token:');
      console.error('   1. Log in as admin at https://burning-man-crm.vercel.app');
      console.error('   2. Open DevTools Console');
      console.error('   3. Run: localStorage.getItem("token")');
      process.exit(1);
    }

    const response = await fetch('https://burning-man-crm-production.up.railway.app/api/tasks/fix-volunteer-shifts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    console.log('📊 Response status:', response.status);
    console.log('📊 Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Fix completed successfully!');
      console.log(`   Updated: ${data.updatedCount} tasks`);
      console.log(`   Failed: ${data.failedCount} tasks`);
      console.log(`   Total found: ${data.totalFound} tasks`);
    } else {
      console.log('\n❌ Fix failed:', data.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testFixEndpoint();

