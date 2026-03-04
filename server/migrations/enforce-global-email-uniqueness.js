/**
 * Enforce strict global email uniqueness on User.email.
 *
 * Usage:
 *   node server/migrations/enforce-global-email-uniqueness.js --dry-run
 *   node server/migrations/enforce-global-email-uniqueness.js --apply
 *
 * Behavior:
 *  - Normalizes all user emails to lowercase+trim
 *  - Detects duplicate normalized emails
 *  - Refuses to create unique index while duplicates exist
 *  - Rebuilds email index as unique when safe
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
  await mongoose.connect(uri);
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
}

async function normalizeAllEmails({ apply }) {
  const users = await User.find({}, { _id: 1, email: 1 }).lean();
  const ops = [];
  let wouldChange = 0;

  for (const user of users) {
    const nextEmail = normalizeEmail(user.email);
    if (nextEmail && nextEmail !== user.email) {
      wouldChange += 1;
      if (apply) {
        ops.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { email: nextEmail } }
          }
        });
      }
    }
  }

  if (apply && ops.length > 0) {
    await User.bulkWrite(ops, { ordered: false });
  }

  return { totalUsers: users.length, wouldChange };
}

async function findDuplicateEmails() {
  const duplicates = await User.aggregate([
    {
      $project: {
        normalizedEmail: { $toLower: { $trim: { input: '$email' } } },
        email: 1,
        accountType: 1,
        isActive: 1,
        updatedAt: 1
      }
    },
    {
      $group: {
        _id: '$normalizedEmail',
        count: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            email: '$email',
            accountType: '$accountType',
            isActive: '$isActive',
            updatedAt: '$updatedAt'
          }
        }
      }
    },
    { $match: { _id: { $ne: '' }, count: { $gt: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);

  return duplicates;
}

async function rebuildUniqueEmailIndex({ apply }) {
  const collection = mongoose.connection.collection('users');
  const indexes = await collection.indexes();
  const emailIndexes = indexes.filter((idx) => idx.key && idx.key.email === 1);

  if (!apply) {
    return {
      existingEmailIndexes: emailIndexes.map((i) => i.name),
      created: false
    };
  }

  for (const idx of emailIndexes) {
    await collection.dropIndex(idx.name);
  }

  await collection.createIndex({ email: 1 }, { unique: true, name: 'email_1_unique_global' });

  return {
    existingEmailIndexes: emailIndexes.map((i) => i.name),
    created: true
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;

  console.log(`\n🔎 Enforce Global Email Uniqueness`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log('--------------------------------------------------');

  await connect();

  try {
    const normalized = await normalizeAllEmails({ apply });
    console.log(`Users scanned: ${normalized.totalUsers}`);
    console.log(`Emails needing normalization: ${normalized.wouldChange}`);

    const duplicates = await findDuplicateEmails();
    if (duplicates.length > 0) {
      console.log(`\n❌ Duplicate normalized emails found: ${duplicates.length}`);
      for (const group of duplicates) {
        console.log(`- ${group._id} (${group.count} users)`);
        for (const u of group.users) {
          console.log(`  • ${u._id} | ${u.email} | type=${u.accountType} | active=${u.isActive}`);
        }
      }
      console.log('\nResolve duplicates first, then re-run migration.');
      process.exitCode = 1;
      return;
    }

    const indexResult = await rebuildUniqueEmailIndex({ apply });
    console.log(`\nEmail indexes detected: ${indexResult.existingEmailIndexes.join(', ') || '(none)'}`);
    console.log(apply ? '✅ Unique email index created/rebuilt.' : 'ℹ️ Dry-run: unique index not modified.');
    console.log('\nDone.');
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

