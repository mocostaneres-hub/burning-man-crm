#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI (or MONGO_URI) environment variable');
  }

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const Task = require('../../server/models/Task');
  const Notification = require('../../server/models/Notification');

  const [taskResult, notificationResult] = await Promise.all([
    Task.deleteMany({
      $or: [{ type: 'volunteer_shift' }, { 'metadata.eventId': { $exists: true } }]
    }),
    Notification.deleteMany({
      type: { $in: ['SHIFT_CREATED', 'SHIFT_UPDATED', 'SHIFT_DELETED', 'SHIFT_SIGNUP', 'SHIFT_UNSIGNUP'] }
    })
  ]);

  console.log('Shift-as-task deprecation migration completed.');
  console.log(`Deleted tasks: ${taskResult.deletedCount || 0}`);
  console.log(`Deleted shift notifications: ${notificationResult.deletedCount || 0}`);

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
