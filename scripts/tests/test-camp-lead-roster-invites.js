/**
 * Test script to verify Camp Lead roster + invites access and dues toggle
 * Run with:
 *   TEST_CAMP_LEAD_EMAIL=... TEST_CAMP_LEAD_PASSWORD=... node scripts/tests/test-camp-lead-roster-invites.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'https://api.g8road.com/api';

const TEST_USER = {
  email: process.env.TEST_CAMP_LEAD_EMAIL,
  password: process.env.TEST_CAMP_LEAD_PASSWORD
};

if (!TEST_USER.email || !TEST_USER.password) {
  console.log('⚠️  Skipping camp lead roster/invites test - set TEST_CAMP_LEAD_EMAIL and TEST_CAMP_LEAD_PASSWORD to run.');
  process.exit(0);
}

let authToken = null;

async function login() {
  console.log('\n🔐 === STEP 1: LOGIN AS CAMP LEAD ===');
  const response = await axios.post(`${API_URL}/auth/login`, {
    email: TEST_USER.email,
    password: TEST_USER.password
  });
  authToken = response.data.token;
  console.log('✅ Login successful');
}

async function getAuthMe() {
  console.log('\n🔍 === STEP 2: VERIFY /api/auth/me ===');
  const response = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const user = response.data.user;
  console.log(`✅ User: ${user.firstName} ${user.lastName} | Camp Lead: ${user.isCampLead}`);
  return user;
}

async function getActiveRoster(campId) {
  console.log('\n📋 === STEP 3: GET ACTIVE ROSTER ===');
  const response = await axios.get(`${API_URL}/rosters/active?campId=${campId}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log(`✅ Roster retrieved: ${response.data._id}`);
  return response.data;
}

async function getInvites(campId) {
  console.log('\n✉️ === STEP 4: GET INVITES ===');
  const response = await axios.get(`${API_URL}/camps/${campId}/invites`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log(`✅ Invites retrieved: ${response.data.invites?.length || 0}`);
}

async function getInviteTemplates(campId) {
  console.log('\n📝 === STEP 5: GET INVITE TEMPLATES ===');
  const response = await axios.get(`${API_URL}/camps/${campId}/invites/template`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log('✅ Invite templates retrieved');
  return response.data;
}

async function toggleDues(rosterId, memberEntry) {
  console.log('\n💵 === STEP 6: TOGGLE DUES (AND REVERT) ===');
  const memberId = typeof memberEntry.member === 'object' ? memberEntry.member._id : memberEntry.member;
  const currentStatus = memberEntry.duesStatus || 'Unpaid';
  const nextStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';

  await axios.put(`${API_URL}/rosters/${rosterId}/members/${memberId}/dues`, { duesStatus: nextStatus }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log(`✅ Dues updated: ${currentStatus} → ${nextStatus}`);

  await axios.put(`${API_URL}/rosters/${rosterId}/members/${memberId}/dues`, { duesStatus: currentStatus }, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log(`✅ Dues reverted: ${nextStatus} → ${currentStatus}`);
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 CAMP LEAD ROSTER + INVITES TEST');
  console.log('═══════════════════════════════════════════════════════');

  try {
    await login();
    const user = await getAuthMe();
    if (!user.isCampLead || !user.campLeadCampId) {
      console.error('❌ User is not a Camp Lead or no campLeadCampId');
      process.exit(1);
    }

    const roster = await getActiveRoster(user.campLeadCampId);
    const firstMember = roster.members?.[0];
    if (!firstMember) {
      console.error('❌ No roster members found to test dues');
      process.exit(1);
    }

    await getInvites(user.campLeadCampId);
    await getInviteTemplates(user.campLeadCampId);
    await toggleDues(roster._id, firstMember);

    console.log('\n✅ ALL CAMP LEAD ROSTER/INVITES TESTS PASSED');
  } catch (error) {
    console.error('❌ Camp Lead roster/invites test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
