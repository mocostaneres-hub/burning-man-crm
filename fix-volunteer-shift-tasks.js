#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();
const Task = require('./server/models/Task');

// Use the same connection logic as other scripts
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';

async function fixVolunteerShiftTasks() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find volunteer shift tasks missing type/metadata
    const tasks = await Task.find({
      title: /^Volunteer Shift:/,
      $or: [
        { type: { $exists: false } },
        { metadata: { $exists: false } }
      ]
    });

    console.log(`📊 Found ${tasks.length} volunteer shift tasks missing type/metadata`);

    if (tasks.length === 0) {
      console.log('✅ All volunteer shift tasks already have proper type and metadata');
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      try {
        console.log(`\n🔧 Updating task: ${task._id}`);
        console.log(`   Title: ${task.title}`);

        // Extract event and shift info from description
        const desc = task.description;
        const eventMatch = desc.match(/Event: (.+)/);
        const shiftMatch = desc.match(/Shift: (.+)/);

        if (eventMatch && shiftMatch) {
          const updateData = {
            type: 'volunteer_shift',
            metadata: {
              eventName: eventMatch[1].trim(),
              shiftTitle: shiftMatch[1].trim()
            }
          };

          await Task.updateOne({ _id: task._id }, updateData);
          console.log(`   ✅ Updated with type: ${updateData.type}`);
          console.log(`   ✅ Updated with metadata:`, updateData.metadata);
          updatedCount++;
        } else {
          console.log(`   ⚠️ Could not extract event/shift info from description`);
          console.log(`   Description: ${desc}`);
          failedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error updating task ${task._id}:`, error.message);
        failedCount++;
      }
    }

    console.log(`\n🎉 Update complete:`);
    console.log(`   ✅ Successfully updated: ${updatedCount} tasks`);
    console.log(`   ❌ Failed to update: ${failedCount} tasks`);

  } catch (error) {
    console.error('❌ Critical error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixVolunteerShiftTasks();
