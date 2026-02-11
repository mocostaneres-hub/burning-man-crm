const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const CAMP_ID = process.env.TEST_CAMP_ID;
const EVENT_ID = process.env.TEST_EVENT_ID;

const CAMP_LEAD_EMAIL = process.env.TEST_CAMP_LEAD_EMAIL;
const CAMP_LEAD_PASSWORD = process.env.TEST_CAMP_LEAD_PASSWORD;

const OTHER_EVENT_ID = process.env.TEST_OTHER_EVENT_ID;

async function login(email, password) {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data.token;
}

async function getEvent(token, eventId) {
  return axios.get(`${API_URL}/shifts/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function updateEvent(token, eventId, payload) {
  return axios.put(`${API_URL}/shifts/events/${eventId}`, payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function run() {
  if (!CAMP_LEAD_EMAIL || !CAMP_LEAD_PASSWORD || !EVENT_ID || !CAMP_ID) {
    console.log('⚠️  Skipping permissions test - set TEST_CAMP_LEAD_EMAIL/PASSWORD, TEST_EVENT_ID, TEST_CAMP_ID.');
    return;
  }

  console.log('🔍 Testing camp lead permissions for events/shifts...');

  const token = await login(CAMP_LEAD_EMAIL, CAMP_LEAD_PASSWORD);
  const eventRes = await getEvent(token, EVENT_ID);
  const event = eventRes.data;

  const payload = {
    eventName: event.eventName,
    description: event.description || '',
    shifts: event.shifts.map((shift) => ({
      title: shift.title,
      description: shift.description || '',
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      maxSignUps: shift.maxSignUps
    }))
  };

  const updateRes = await updateEvent(token, EVENT_ID, payload);
  console.log('✅ Camp lead update allowed:', updateRes.status);

  if (OTHER_EVENT_ID) {
    try {
      await updateEvent(token, OTHER_EVENT_ID, payload);
      console.error('❌ Cross-camp update should not succeed');
    } catch (error) {
      const status = error.response?.status;
      console.log('✅ Cross-camp update blocked:', status);
    }
  } else {
    console.log('⚠️  Skipping cross-camp test - set TEST_OTHER_EVENT_ID.');
  }

  console.log('✅ Permission test completed');
}

run().catch((error) => {
  console.error('❌ Shift permissions test failed:', error.response?.data || error.message);
  process.exit(1);
});
