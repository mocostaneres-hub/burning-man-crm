/**
 * Cleanup Script: Delete Orphaned Event Tasks
 * 
 * This script finds and deletes tasks that reference events that no longer exist.
 * These tasks were likely created before the event deletion cleanup was implemented.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const db = require('./server/database/databaseAdapter');
const Task = require('./server/models/Task');

async function cleanupOrphanedEventTasks() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Searching for orphaned event tasks...\n');

    // Find all volunteer_shift tasks that have an eventId
    const tasks = await Task.find({
      type: 'volunteer_shift',
      'metadata.eventId': { $exists: true, $ne: null }
    });

    console.log(`📊 Found ${tasks.length} volunteer_shift tasks with eventId\n`);

    let orphanedCount = 0;
    let validCount = 0;
    const deletedTasks = [];
    const errors = [];

    for (const task of tasks) {
      try {
        const eventId = task.metadata?.eventId;
        if (!eventId) {
          continue;
        }

        // Check if the event still exists
        const event = await db.findEvent({ _id: eventId });
        
        if (!event) {
          // Event doesn't exist - this is an orphaned task
          console.log(`🗑️  Orphaned task found: ${task._id}`);
          console.log(`   Task: ${task.title}`);
          console.log(`   Event ID: ${eventId}`);
          console.log(`   Assigned to: ${task.assignedTo?.length || 0} user(s)`);
          
          // Delete the orphaned task
          await db.deleteTask(task._id);
          orphanedCount++;
          deletedTasks.push({
            taskId: task._id,
            taskTitle: task.title,
            eventId: eventId,
            assignedToCount: task.assignedTo?.length || 0
          });
          
          console.log(`   ✅ Deleted orphaned task ${task._id}\n`);
        } else {
          validCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing task ${task._id}:`, error.message);
        errors.push({ taskId: task._id, error: error.message });
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Total tasks checked: ${tasks.length}`);
    console.log(`   Valid tasks: ${validCount}`);
    console.log(`   Orphaned tasks deleted: ${orphanedCount}`);
    console.log(`   Errors: ${errors.length}\n`);

    if (deletedTasks.length > 0) {
      console.log('🗑️  Deleted Tasks:');
      deletedTasks.forEach((deleted, index) => {
        console.log(`   ${index + 1}. Task ${deleted.taskId}: "${deleted.taskTitle}"`);
        console.log(`      Event ID: ${deleted.eventId}`);
        console.log(`      Was assigned to ${deleted.assignedToCount} user(s)\n`);
      });
    }

    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Task ${err.taskId}: ${err.error}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedEventTasks();


