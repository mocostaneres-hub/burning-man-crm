const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

const CAMP_ID = process.env.TEST_CAMP_ID;
const MEMBER_USER_ID = process.env.TEST_MEMBER_USER_ID;

const CAMP_ADMIN_EMAIL = process.env.TEST_CAMP_ADMIN_EMAIL;
const CAMP_ADMIN_PASSWORD = process.env.TEST_CAMP_ADMIN_PASSWORD;

const CAMP_LEAD_EMAIL = process.env.TEST_CAMP_LEAD_EMAIL;
const CAMP_LEAD_PASSWORD = process.env.TEST_CAMP_LEAD_PASSWORD;

const UNAUTHORIZED_EMAIL = process.env.TEST_UNAUTHORIZED_EMAIL;
const UNAUTHORIZED_PASSWORD = process.env.TEST_UNAUTHORIZED_PASSWORD;

const OTHER_CAMP_ID = process.env.TEST_OTHER_CAMP_ID;

async function login(email, password) {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data.token;
}

async function fetchContact360(token, campId, userId) {
  return axios.get(`${API_URL}/camps/${campId}/contacts/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

function assertArray(payload, key) {
  if (!Array.isArray(payload[key])) {
    throw new Error(`Expected ${key} to be an array`);
  }
}

async function run() {
  if (!CAMP_ID || !MEMBER_USER_ID) {
    console.log('⚠️  Skipping 360 contact test - set TEST_CAMP_ID and TEST_MEMBER_USER_ID.');
    return;
  }

  console.log('🔍 Testing Contact360 (camp admin/lead access)\n');

  if (CAMP_ADMIN_EMAIL && CAMP_ADMIN_PASSWORD) {
    console.log('1) Camp admin access...');
    const token = await login(CAMP_ADMIN_EMAIL, CAMP_ADMIN_PASSWORD);
    const res = await fetchContact360(token, CAMP_ID, MEMBER_USER_ID);
    console.log('✅ Camp admin access ok:', res.status);
    assertArray(res.data, 'rosterHistory');
    assertArray(res.data, 'applications');
    assertArray(res.data, 'tasks');
    assertArray(res.data, 'volunteerShifts');
    assertArray(res.data, 'activityLog');
  } else {
    console.log('⚠️  Skipping camp admin access - set TEST_CAMP_ADMIN_EMAIL/PASSWORD.');
  }

  if (CAMP_LEAD_EMAIL && CAMP_LEAD_PASSWORD) {
    console.log('\n2) Camp lead access...');
    const token = await login(CAMP_LEAD_EMAIL, CAMP_LEAD_PASSWORD);
    const res = await fetchContact360(token, CAMP_ID, MEMBER_USER_ID);
    console.log('✅ Camp lead access ok:', res.status);
    assertArray(res.data, 'rosterHistory');
    assertArray(res.data, 'applications');
    assertArray(res.data, 'tasks');
    assertArray(res.data, 'volunteerShifts');
    assertArray(res.data, 'activityLog');
  } else {
    console.log('⚠️  Skipping camp lead access - set TEST_CAMP_LEAD_EMAIL/PASSWORD.');
  }

  console.log('\n3) Unauthorized access (no token)...');
  try {
    await fetchContact360(null, CAMP_ID, MEMBER_USER_ID);
    console.error('❌ Expected unauthorized to fail but request succeeded');
  } catch (error) {
    const status = error.response?.status;
    console.log('✅ Unauthorized blocked:', status);
  }

  if (UNAUTHORIZED_EMAIL && UNAUTHORIZED_PASSWORD) {
    console.log('\n4) Unauthorized access (non-admin/lead)...');
    try {
      const token = await login(UNAUTHORIZED_EMAIL, UNAUTHORIZED_PASSWORD);
      await fetchContact360(token, CAMP_ID, MEMBER_USER_ID);
      console.error('❌ Expected unauthorized role to fail but request succeeded');
    } catch (error) {
      const status = error.response?.status;
      console.log('✅ Unauthorized role blocked:', status);
    }
  } else {
    console.log('⚠️  Skipping unauthorized role test - set TEST_UNAUTHORIZED_EMAIL/PASSWORD.');
  }

  if (OTHER_CAMP_ID && CAMP_ADMIN_EMAIL && CAMP_ADMIN_PASSWORD) {
    console.log('\n5) Cross-camp access attempt...');
    try {
      const token = await login(CAMP_ADMIN_EMAIL, CAMP_ADMIN_PASSWORD);
      await fetchContact360(token, OTHER_CAMP_ID, MEMBER_USER_ID);
      console.error('❌ Expected cross-camp access to fail but request succeeded');
    } catch (error) {
      const status = error.response?.status;
      console.log('✅ Cross-camp blocked:', status);
    }
  } else {
    console.log('⚠️  Skipping cross-camp test - set TEST_OTHER_CAMP_ID and camp admin credentials.');
  }

  console.log('\n✅ Contact360 tests completed');
}

run().catch((error) => {
  console.error('❌ Contact360 tests failed:', error.response?.data || error.message);
  process.exit(1);
});
