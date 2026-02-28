#!/usr/bin/env node

/**
 * One-time camp owner repair script (targeted, safe by default).
 *
 * Usage:
 *   node scripts/utils/repair-camp-owner-link.js --slug mudskippers
 *   node scripts/utils/repair-camp-owner-link.js --campId <id>
 *   node scripts/utils/repair-camp-owner-link.js --slug mudskippers --apply
 *
 * Notes:
 * - Dry-run by default (no writes unless --apply is passed)
 * - Does not change roles/permissions globally
 * - Only links camp.owner to an existing user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Camp = require('../../server/models/Camp');
const User = require('../../server/models/User');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function run() {
  const campIdArg = getArg('--campId');
  const slugArg = getArg('--slug');
  const apply = hasFlag('--apply');

  if (!campIdArg && !slugArg) {
    console.error('❌ Provide either --campId or --slug');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI or MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  try {
    const campQuery = campIdArg ? { _id: campIdArg } : { slug: slugArg };
    const camp = await Camp.findOne(campQuery).lean();

    if (!camp) {
      console.error('❌ Camp not found for query:', campQuery);
      process.exit(1);
    }

    const campName = camp.name || camp.campName || 'Unknown Camp';
    const ownerRef = camp.owner ? camp.owner.toString() : null;
    const ownerUser = ownerRef ? await User.findById(ownerRef).lean() : null;

    console.log('\n🔍 Camp Owner Diagnosis');
    console.log('Camp ID:         ', camp._id.toString());
    console.log('Camp Name:       ', campName);
    console.log('Camp Slug:       ', camp.slug || '(none)');
    console.log('Contact Email:   ', camp.contactEmail || '(none)');
    console.log('Owner Ref:       ', ownerRef || '(null)');
    console.log('Owner User Found:', !!ownerUser);

    if (ownerUser) {
      console.log('✅ Camp owner is already valid. No repair needed.');
      return;
    }

    let candidate = null;
    if (camp.contactEmail) {
      candidate = await User.findOne({ email: String(camp.contactEmail).toLowerCase().trim() }).lean();
    }

    if (!candidate) {
      candidate = await User.findOne({ accountType: 'camp', campId: camp._id }).lean();
    }

    if (!candidate) {
      console.log('⚠️ No candidate owner user found. No changes made.');
      return;
    }

    console.log('\n🛠️ Proposed repair');
    console.log('New owner userId:', candidate._id.toString());
    console.log('New owner email: ', candidate.email);
    console.log('Apply mode:      ', apply ? 'YES' : 'NO (dry-run)');

    if (!apply) return;

    await Camp.updateOne({ _id: camp._id }, { $set: { owner: candidate._id } });

    // Keep user<->camp linkage consistent if missing
    if (!candidate.campId) {
      await User.updateOne({ _id: candidate._id }, { $set: { campId: camp._id } });
    }

    console.log('✅ Repair applied successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error('❌ Repair script failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // no-op
  }
  process.exit(1);
});

