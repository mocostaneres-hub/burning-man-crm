#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';
const ADMIN_EMAIL = 'mocostaneres@gmail.com';
const ADMIN_PASSWORD = '08091963';

let authToken = '';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    authToken = response.data.token;
    console.log('✅ Admin login successful');
    return true;
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testSearch(endpoint, searchTerm, description) {
  try {
    const response = await axios.get(`${BASE_URL}/admin/${endpoint}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { search: searchTerm }
    });
    
    const results = response.data.data || response.data.admins || [];
    console.log(`✅ ${description}: Found ${results.length} results`);
    
    if (results.length > 0) {
      const firstResult = results[0];
      console.log(`   First result: ID=${firstResult._id}, Name=${firstResult.firstName || firstResult.campName || 'N/A'}`);
    }
    
    return results.length > 0;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.response?.data || error.message);
    return false;
  }
}

async function runSearchTests() {
  console.log('🔍 Testing Admin Search Functionality\n');
  
  if (!(await login())) {
    return;
  }
  
  console.log('\n📋 Running Search Tests:\n');
  
  // Test user searches
  await testSearch('users', 'momo', 'User search by name "momo"');
  await testSearch('users', '1000025', 'User search by ID "1000025"');
  await testSearch('users', 'mnomnobr', 'User search by email "mnomnobr"');
  await testSearch('users', 'Updated', 'User search by updated name "Updated"');
  
  // Test camp searches
  await testSearch('camps', 'Art', 'Camp search by name "Art"');
  await testSearch('camps', '2000001', 'Camp search by ID "2000001"');
  await testSearch('camps', 'Food', 'Camp search by name "Food"');
  await testSearch('camps', 'Updated', 'Camp search by updated name "Updated"');
  
  // Test admin searches
  await testSearch('admins', '', 'Admin search (all admins)');
  
  console.log('\n🎉 Search functionality testing completed!');
}

// Run the tests
runSearchTests().catch(console.error);

