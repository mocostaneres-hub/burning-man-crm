require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is required');
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('Starting roster dues schema migration...');

  await db.collection('rosters').updateMany(
    {},
    {
      $set: {
        'members.$[member].duesStatus': 'UNPAID',
        'members.$[member].duesInstructedAt': null,
        'members.$[member].duesPaidAt': null,
        'members.$[member].duesReceiptSentAt': null,
        'members.$[member].duesPaidByUserId': null
      }
    },
    {
      arrayFilters: [{ 'member.duesStatus': { $exists: false } }]
    }
  );

  await db.collection('camps').updateMany(
    { duesInstructionsSubject: { $exists: false } },
    { $set: { duesInstructionsSubject: null } }
  );
  await db.collection('camps').updateMany(
    { duesInstructionsBody: { $exists: false } },
    { $set: { duesInstructionsBody: null } }
  );
  await db.collection('camps').updateMany(
    { duesReceiptSubject: { $exists: false } },
    { $set: { duesReceiptSubject: null } }
  );
  await db.collection('camps').updateMany(
    { duesReceiptBody: { $exists: false } },
    { $set: { duesReceiptBody: null } }
  );

  console.log('Roster dues schema migration complete.');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
