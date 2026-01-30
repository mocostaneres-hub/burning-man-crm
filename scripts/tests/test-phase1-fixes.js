/**
 * PHASE 1 FIX QA TEST SUITE
 * Tests for blocking bug fixes in authentication and onboarding
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_BASE = process.env.API_URL || 'http://localhost:5000/api';
const TEST_EMAIL_PREFIX = 'qa-test-phase1';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (message) console.log(`   ${message}`);
  
  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

function generateTestEmail() {
  return `${TEST_EMAIL_PREFIX}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../../server/models/User');
    const Camp = require('../../server/models/Camp');
    
    // Delete all test users and camps
    const testUsers = await User.find({ email: { $regex: TEST_EMAIL_PREFIX } });
    console.log(`   Found ${testUsers.length} test users to clean up`);
    
    for (const user of testUsers) {
      if (user.campId) {
        await Camp.deleteOne({ _id: user.campId });
      }
    }
    
    await User.deleteMany({ email: { $regex: TEST_EMAIL_PREFIX } });
    console.log('   ✅ Cleanup complete');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('   ⚠️ Cleanup error (non-critical):', error.message);
  }
}

// TEST 1: Member Registration Flow
async function testMemberRegistration() {
  console.log('\n📋 TEST 1: Member Registration and Onboarding');
  console.log('================================================');
  
  const email = generateTestEmail();
  const password = 'TestPass123!';
  let token = null;
  let userId = null;

  try {
    // Step 1: Register new user
    console.log('\n1️⃣ Registering new user...');
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      email,
      password,
      firstName: 'Test',
      lastName: 'Member',
      accountType: 'personal'
    });

    logTest('User registration returns 201', registerRes.status === 201);
    logTest('Registration returns token', !!registerRes.data.token);
    logTest('Registration returns user data', !!registerRes.data.user);
    logTest('User has unassigned role initially', registerRes.data.user.role === 'unassigned');
    logTest('User accountType is personal', registerRes.data.user.accountType === 'personal');
    logTest('User has NO campId initially', !registerRes.data.user.campId, `campId: ${registerRes.data.user.campId}`);

    token = registerRes.data.token;
    userId = registerRes.data.user._id;

    // Step 2: Select member role in onboarding
    console.log('\n2️⃣ Selecting member role...');
    const roleRes = await axios.post(
      `${API_BASE}/onboarding/select-role`,
      { role: 'member' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logTest('Role selection returns 200', roleRes.status === 200);
    logTest('Role updated to member', roleRes.data.user.role === 'member');
    logTest('AccountType remains personal', roleRes.data.user.accountType === 'personal');
    logTest('No camp created for member', !roleRes.data.user.campId);
    logTest('Redirects to user profile', roleRes.data.redirectTo === '/user/profile');

    // Step 3: Verify user can fetch their profile
    console.log('\n3️⃣ Fetching user profile...');
    const profileRes = await axios.get(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    logTest('Profile fetch returns 200', profileRes.status === 200);
    logTest('Profile has correct email', profileRes.data.user.email === email);
    logTest('Profile has correct role', profileRes.data.user.role === 'member');

  } catch (error) {
    logTest('Member registration flow', false, error.response?.data?.message || error.message);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// TEST 2: Camp Lead Registration Flow
async function testCampLeadRegistration() {
  console.log('\n📋 TEST 2: Camp Lead Registration and Camp Creation');
  console.log('====================================================');
  
  const email = generateTestEmail();
  const password = 'TestPass123!';
  let token = null;
  let userId = null;
  let campId = null;

  try {
    // Step 1: Register new user
    console.log('\n1️⃣ Registering new user...');
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      email,
      password,
      firstName: 'Test',
      lastName: 'CampLead',
      accountType: 'personal'
    });

    logTest('User registration returns 201', registerRes.status === 201);
    logTest('User has NO campId after registration', !registerRes.data.user.campId);

    token = registerRes.data.token;
    userId = registerRes.data.user._id;

    // Step 2: Select camp_lead role in onboarding
    console.log('\n2️⃣ Selecting camp_lead role...');
    const roleRes = await axios.post(
      `${API_BASE}/onboarding/select-role`,
      { role: 'camp_lead' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logTest('Role selection returns 200', roleRes.status === 200);
    logTest('Role updated to camp_lead', roleRes.data.user.role === 'camp_lead');
    logTest('AccountType updated to camp', roleRes.data.user.accountType === 'camp');
    logTest('Camp created with campId', !!roleRes.data.user.campId);
    logTest('User has urlSlug', !!roleRes.data.user.urlSlug);
    logTest('Redirects to camp edit', roleRes.data.redirectTo === '/camp/edit');

    campId = roleRes.data.user.campId;

    // Step 3: Verify camp exists and is properly linked
    console.log('\n3️⃣ Verifying camp creation...');
    
    // Connect to DB to verify
    await mongoose.connect(process.env.MONGODB_URI);
    const Camp = require('../../server/models/Camp');
    const User = require('../../server/models/User');

    const camp = await Camp.findById(campId);
    const user = await User.findById(userId);

    logTest('Camp exists in database', !!camp);
    logTest('Camp owner matches user', camp?.owner?.toString() === userId.toString());
    logTest('Camp has slug', !!camp?.slug);
    logTest('Camp name is set', !!camp?.name);
    logTest('User campId matches created camp', user?.campId?.toString() === campId.toString());
    logTest('Camp starts as private', camp?.isPublic === false);
    logTest('Camp not publicly visible initially', camp?.isPubliclyVisible === false);

    await mongoose.disconnect();

  } catch (error) {
    logTest('Camp lead registration flow', false, error.response?.data?.message || error.message);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// TEST 3: Error Scenarios and Rollback
async function testErrorScenarios() {
  console.log('\n📋 TEST 3: Error Scenarios and Transaction Rollback');
  console.log('=====================================================');
  
  try {
    const email = generateTestEmail();
    const password = 'TestPass123!';

    // Register and get token
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      email,
      password,
      firstName: 'Test',
      lastName: 'ErrorTest',
      accountType: 'personal'
    });

    const token = registerRes.data.token;
    const userId = registerRes.data.user._id;

    // Test 3.1: Try to select role twice
    console.log('\n3.1️⃣ Testing duplicate role selection (should fail)...');
    await axios.post(
      `${API_BASE}/onboarding/select-role`,
      { role: 'member' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    try {
      await axios.post(
        `${API_BASE}/onboarding/select-role`,
        { role: 'camp_lead' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logTest('Duplicate role selection blocked', false, 'Should have thrown error');
    } catch (error) {
      logTest('Duplicate role selection blocked', error.response?.status === 400);
      logTest('Error message mentions existing role', error.response?.data?.message?.includes('already has a role'));
    }

    // Test 3.2: Test invalid role
    console.log('\n3.2️⃣ Testing invalid role (should fail)...');
    const email2 = generateTestEmail();
    const registerRes2 = await axios.post(`${API_BASE}/auth/register`, {
      email: email2,
      password,
      firstName: 'Test',
      lastName: 'Invalid',
      accountType: 'personal'
    });

    const token2 = registerRes2.data.token;

    try {
      await axios.post(
        `${API_BASE}/onboarding/select-role`,
        { role: 'invalid_role' },
        { headers: { Authorization: `Bearer ${token2}` } }
      );
      logTest('Invalid role rejected', false, 'Should have thrown error');
    } catch (error) {
      logTest('Invalid role rejected', error.response?.status === 400);
    }

    // Test 3.3: Verify no orphaned data after errors
    console.log('\n3.3️⃣ Verifying data integrity after errors...');
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../../server/models/User');
    const Camp = require('../../server/models/Camp');

    const user1 = await User.findById(userId);
    const user2 = await User.findById(registerRes2.data.user._id);

    logTest('First user has member role', user1.role === 'member');
    logTest('First user has no camp', !user1.campId);
    logTest('Second user still unassigned', user2.role === 'unassigned');
    logTest('Second user has no camp', !user2.campId);

    // Verify no orphaned camps
    const orphanedCamps = await Camp.find({ owner: { $in: [userId, registerRes2.data.user._id] } });
    logTest('No orphaned camps created', orphanedCamps.length === 0);

    await mongoose.disconnect();

  } catch (error) {
    logTest('Error scenario testing', false, error.message);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// TEST 4: Duplicate Camp Name Handling
async function testDuplicateCampNames() {
  console.log('\n📋 TEST 4: Duplicate Camp Name Handling');
  console.log('=========================================');
  
  try {
    // Create first camp lead with name "Test Camp"
    const email1 = generateTestEmail();
    const registerRes1 = await axios.post(`${API_BASE}/auth/register`, {
      email: email1,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Camp',
      accountType: 'personal'
    });

    await axios.post(
      `${API_BASE}/onboarding/select-role`,
      { role: 'camp_lead' },
      { headers: { Authorization: `Bearer ${registerRes1.data.token}` } }
    );

    // Create second camp lead with same name
    const email2 = generateTestEmail();
    const registerRes2 = await axios.post(`${API_BASE}/auth/register`, {
      email: email2,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Camp',
      accountType: 'personal'
    });

    const roleRes2 = await axios.post(
      `${API_BASE}/onboarding/select-role`,
      { role: 'camp_lead' },
      { headers: { Authorization: `Bearer ${registerRes2.data.token}` } }
    );

    logTest('Second camp created successfully', roleRes2.status === 200);
    logTest('Second camp has campId', !!roleRes2.data.user.campId);

    // Verify slugs are different
    await mongoose.connect(process.env.MONGODB_URI);
    const Camp = require('../../server/models/Camp');
    
    const camp1 = await Camp.findById(registerRes1.data.user.campId || 'invalid');
    const camp2 = await Camp.findById(roleRes2.data.user.campId);

    if (camp1 && camp2) {
      logTest('Camps have different slugs', camp1.slug !== camp2.slug, `Slug1: ${camp1.slug}, Slug2: ${camp2.slug}`);
      logTest('Second slug has counter suffix', camp2.slug.includes('-2') || camp2.slug.includes('-3'));
    } else {
      logTest('Both camps exist', false, `Camp1: ${!!camp1}, Camp2: ${!!camp2}`);
    }

    await mongoose.disconnect();

  } catch (error) {
    logTest('Duplicate camp name handling', false, error.message);
    console.error('Error details:', error.response?.data || error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   PHASE 1 FIX QA TEST SUITE                      ║');
  console.log('║   Testing Auth & Onboarding Bug Fixes            ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`\nAPI Base URL: ${API_BASE}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);

  try {
    // Run all tests
    await testMemberRegistration();
    await testCampLeadRegistration();
    await testErrorScenarios();
    await testDuplicateCampNames();

    // Cleanup
    await cleanup();

    // Print summary
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║   TEST SUMMARY                                    ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log(`\n✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total:  ${results.tests.length}`);
    console.log(`\n${results.failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'}`);

    // Print failed tests
    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`   - ${t.name}`);
        if (t.message) console.log(`     ${t.message}`);
      });
    }

    process.exit(results.failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Fatal test error:', error);
    await cleanup();
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Test interrupted, cleaning up...');
  await cleanup();
  process.exit(1);
});

// Run tests
runTests();
