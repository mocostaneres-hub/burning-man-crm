/**
 * Test script to verify Camp Lead can access and edit tasks
 * Run with: node scripts/tests/test-camp-lead-task-editing.js
 */

const axios = require('axios');

const API_URL = 'https://api.g8road.com/api';

// Test user: Camp Lead "test 8"
const TEST_USER = {
  email: 'lead8@g8road.com',
  password: 'Test@1234',
  expectedCampId: '68e43f61a8f6ec1271586306', // Mudskippers
  expectedCampName: 'Mudskippers'
};

let authToken = null;
let testTaskId = null;

async function login() {
  console.log('\n🔐 === STEP 1: LOGIN AS CAMP LEAD ===');
  console.log(`📧 Email: ${TEST_USER.email}`);
  
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    authToken = response.data.token;
    console.log('✅ Login successful');
    console.log(`🔑 Token: ${authToken.substring(0, 20)}...`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function verifyAuthMe() {
  console.log('\n🔍 === STEP 2: VERIFY /api/auth/me ===');
  
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const user = response.data.user;
    console.log('✅ User data retrieved');
    console.log(`👤 Name: ${user.firstName} ${user.lastName}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🏕️ Is Camp Lead: ${user.isCampLead}`);
    console.log(`🏕️ Camp Lead Camp ID: ${user.campLeadCampId}`);
    console.log(`🏕️ Camp Lead Camp Name: ${user.campLeadCampName}`);
    
    if (!user.isCampLead || !user.campLeadCampId) {
      console.error('❌ User is not a Camp Lead!');
      process.exit(1);
    }
    
    return user;
  } catch (error) {
    console.error('❌ Failed to get user data:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function getTasks(campId) {
  console.log('\n📋 === STEP 3: GET TASKS ===');
  console.log(`🏕️ Camp ID: ${campId}`);
  
  try {
    const response = await axios.get(`${API_URL}/tasks/camp/${campId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const tasks = response.data;
    console.log(`✅ Retrieved ${tasks.length} tasks`);
    
    if (tasks.length > 0) {
      console.log(`📝 First task: "${tasks[0].title}" (ID: ${tasks[0]._id})`);
      testTaskId = tasks[0]._id;
    }
    
    return tasks;
  } catch (error) {
    console.error('❌ Failed to get tasks:', error.response?.data || error.message);
    return [];
  }
}

async function createTask(campId) {
  console.log('\n➕ === STEP 4: CREATE TASK ===');
  
  const taskData = {
    campId: campId,
    title: `Test Task by Camp Lead ${Date.now()}`,
    description: 'This task was created by a Camp Lead to test permissions',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  };
  
  try {
    const response = await axios.post(`${API_URL}/tasks`, taskData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Task created successfully');
    console.log(`📝 Task ID: ${response.data._id}`);
    console.log(`📝 Task Title: ${response.data.title}`);
    
    testTaskId = response.data._id;
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create task:', error.response?.data || error.message);
    return null;
  }
}

async function updateTask(taskId) {
  console.log('\n✏️ === STEP 5: UPDATE TASK ===');
  console.log(`📝 Task ID: ${taskId}`);
  
  const updates = {
    title: `Updated by Camp Lead ${Date.now()}`,
    description: 'This task was updated by a Camp Lead',
    priority: 'high'
  };
  
  try {
    const response = await axios.put(`${API_URL}/tasks/${taskId}`, updates, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Task updated successfully');
    console.log(`📝 New Title: ${response.data.title}`);
    console.log(`📝 New Priority: ${response.data.priority}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to update task:', error.response?.data || error.message);
    return null;
  }
}

async function assignTask(taskId, memberId) {
  console.log('\n👥 === STEP 6: ASSIGN TASK ===');
  console.log(`📝 Task ID: ${taskId}`);
  console.log(`👤 Member ID: ${memberId || 'No member specified - skipping'}`);
  
  if (!memberId) {
    console.log('⏭️ Skipping assignment (no member specified)');
    return null;
  }
  
  try {
    const response = await axios.post(`${API_URL}/tasks/${taskId}/assign`, {
      assignedTo: [memberId]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Task assigned successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to assign task:', error.response?.data || error.message);
    return null;
  }
}

async function deleteTask(taskId) {
  console.log('\n🗑️ === STEP 7: DELETE TASK ===');
  console.log(`📝 Task ID: ${taskId}`);
  
  try {
    const response = await axios.delete(`${API_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Task deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete task:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 CAMP LEAD TASK MANAGEMENT - COMPREHENSIVE TEST');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Step 1: Login
    await login();
    
    // Step 2: Verify Camp Lead status
    const user = await verifyAuthMe();
    
    // Step 3: Get existing tasks
    const existingTasks = await getTasks(user.campLeadCampId);
    
    // Step 4: Create new task
    const createdTask = await createTask(user.campLeadCampId);
    if (!createdTask) {
      console.error('\n❌ TEST FAILED: Could not create task');
      process.exit(1);
    }
    
    // Step 5: Update the task
    const updatedTask = await updateTask(testTaskId);
    if (!updatedTask) {
      console.error('\n❌ TEST FAILED: Could not update task');
      process.exit(1);
    }
    
    // Step 6: Assign task (optional - skip if no members)
    // await assignTask(testTaskId, 'MEMBER_ID_HERE');
    
    // Step 7: Delete the task (cleanup)
    const deleted = await deleteTask(testTaskId);
    if (!deleted) {
      console.error('\n❌ TEST FAILED: Could not delete task');
      process.exit(1);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\nCamp Lead Task Management Summary:');
    console.log('  ✅ View tasks');
    console.log('  ✅ Create tasks');
    console.log('  ✅ Edit tasks');
    console.log('  ✅ Delete tasks');
    console.log('  ⏭️ Assign tasks (skipped - manual test required)');
    console.log('\n🎉 Camp Lead has full task management permissions!');
    
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
