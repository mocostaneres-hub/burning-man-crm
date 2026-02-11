const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const SHIFT_ID = process.env.TEST_SHIFT_ID;

const USER1_EMAIL = process.env.TEST_MEMBER_EMAIL_1;
const USER1_PASSWORD = process.env.TEST_MEMBER_PASSWORD_1;
const USER2_EMAIL = process.env.TEST_MEMBER_EMAIL_2;
const USER2_PASSWORD = process.env.TEST_MEMBER_PASSWORD_2;

async function login(email, password) {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data.token;
}

async function signupShift(token, shiftId) {
  return axios.post(`${API_URL}/shifts/shifts/${shiftId}/signup`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function cancelShift(token, shiftId) {
  return axios.delete(`${API_URL}/shifts/shifts/${shiftId}/signup`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function safeCancel(token, shiftId) {
  try {
    await cancelShift(token, shiftId);
  } catch (error) {
    // Ignore if not signed up
    if (error.response?.status !== 400 && error.response?.status !== 404) {
      throw error;
    }
  }
}

async function run() {
  if (!SHIFT_ID || !USER1_EMAIL || !USER1_PASSWORD || !USER2_EMAIL || !USER2_PASSWORD) {
    console.log('⚠️  Skipping shift capacity test - set TEST_SHIFT_ID, TEST_MEMBER_EMAIL_1/2 and TEST_MEMBER_PASSWORD_1/2.');
    return;
  }

  console.log('🔍 Testing shift capacity enforcement...');

  const token1 = await login(USER1_EMAIL, USER1_PASSWORD);
  const token2 = await login(USER2_EMAIL, USER2_PASSWORD);

  // Ensure a clean state
  await safeCancel(token1, SHIFT_ID);
  await safeCancel(token2, SHIFT_ID);

  const results = await Promise.allSettled([
    signupShift(token1, SHIFT_ID),
    signupShift(token2, SHIFT_ID)
  ]);

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const conflictCount = results.filter(r => r.status === 'rejected' && r.reason?.response?.status === 409).length;

  console.log(`✅ Concurrent signup results: success=${successCount}, conflicts=${conflictCount}`);

  if (successCount !== 1 || conflictCount !== 1) {
    throw new Error('Expected exactly one success and one 409 conflict');
  }

  // Cancel the successful signup to free slot
  const successfulIndex = results.findIndex(r => r.status === 'fulfilled');
  const winningToken = successfulIndex === 0 ? token1 : token2;
  const losingToken = successfulIndex === 0 ? token2 : token1;

  await cancelShift(winningToken, SHIFT_ID);

  // Now the other user should be able to sign up
  const retry = await signupShift(losingToken, SHIFT_ID);
  console.log('✅ Slot freed after cancel:', retry.status);

  // Cleanup
  await safeCancel(losingToken, SHIFT_ID);
  console.log('✅ Shift capacity test completed');
}

run().catch((error) => {
  console.error('❌ Shift capacity test failed:', error.response?.data || error.message);
  process.exit(1);
});
