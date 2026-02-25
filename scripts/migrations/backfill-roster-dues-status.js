require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is required');
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('Starting dues status backfill...');

  const rosters = await db.collection('rosters').find({}).toArray();
  let touchedRosters = 0;

  for (const roster of rosters) {
    if (!Array.isArray(roster.members) || roster.members.length === 0) {
      continue;
    }

    let changed = false;
    const members = roster.members.map((member) => {
      const next = { ...member };
      const paidBoolean = typeof next.paid === 'boolean' ? next.paid : next.duesPaid;
      const legacyStatus = next.duesStatus;

      if (paidBoolean === true || legacyStatus === 'Paid' || legacyStatus === 'PAID') {
        next.duesStatus = 'PAID';
        next.paid = true;
        next.duesPaidAt = next.duesPaidAt || next.paidAt || new Date();
        changed = true;
        return next;
      }

      if (paidBoolean === false || legacyStatus === 'Unpaid' || !legacyStatus) {
        next.duesStatus = 'UNPAID';
        next.paid = false;
        changed = true;
        return next;
      }

      if (legacyStatus === 'INSTRUCTED' || legacyStatus === 'UNPAID' || legacyStatus === 'PAID') {
        return next;
      }

      next.duesStatus = 'UNPAID';
      next.paid = false;
      changed = true;
      return next;
    });

    if (changed) {
      await db.collection('rosters').updateOne(
        { _id: roster._id },
        { $set: { members, updatedAt: new Date() } }
      );
      touchedRosters += 1;
    }
  }

  const nullDuesStatusCount = await db.collection('rosters').countDocuments({
    members: { $elemMatch: { duesStatus: { $in: [null, ''] } } }
  });

  console.log('Backfill complete.');
  console.log(`Rosters updated: ${touchedRosters}`);
  console.log(`Remaining NULL/empty duesStatus entries: ${nullDuesStatusCount}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Backfill failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
