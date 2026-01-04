// Migrate old application statuses to new enum values
const mongoose = require('mongoose');
require('dotenv').config();

const MemberApplication = require('./server/models/MemberApplication');

const statusMapping = {
  'ApplicationSubmitted': 'pending',
  'PendingFinalReview': 'under-review',
  'Accepted': 'approved',
  'Rejected': 'rejected'
};

async function migrateStatuses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm');
    console.log('✅ Connected to MongoDB');

    const applications = await MemberApplication.find({});
    console.log(`📊 Found ${applications.length} applications`);

    let updated = 0;
    for (const app of applications) {
      const oldStatus = app.status;
      const newStatus = statusMapping[oldStatus];
      
      if (newStatus && newStatus !== oldStatus) {
        app.status = newStatus;
        await app.save();
        console.log(`✅ Updated ${app._id}: "${oldStatus}" → "${newStatus}"`);
        updated++;
      }
    }

    console.log(`\n✅ Migration complete: ${updated} applications updated`);
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateStatuses();

