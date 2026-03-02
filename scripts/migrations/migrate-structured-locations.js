/**
 * Migration: Backfill structured location from legacy city fields.
 *
 * Usage:
 *   node scripts/migrations/migrate-structured-locations.js            # dry-run
 *   node scripts/migrations/migrate-structured-locations.js --apply    # write changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../../server/models/User');
const Camp = require('../../server/models/Camp');

const shouldApply = process.argv.includes('--apply');

const buildBackfilledLocation = (existingLocation, legacyCity) => {
  if (!legacyCity || typeof legacyCity !== 'string' || !legacyCity.trim()) return existingLocation;
  const nextLocation = { ...(existingLocation || {}) };
  if (!nextLocation.city) nextLocation.city = legacyCity.trim();
  return nextLocation;
};

async function runMigration() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Connected to MongoDB (${shouldApply ? 'apply' : 'dry-run'})`);

  const users = await User.find({});
  const camps = await Camp.find({});

  let usersUpdated = 0;
  let campsUpdated = 0;

  for (const user of users) {
    const legacyCity = user.city;
    const nextLocation = buildBackfilledLocation(user.location, legacyCity);
    const changed = JSON.stringify(nextLocation || {}) !== JSON.stringify(user.location || {});
    if (changed) {
      usersUpdated += 1;
      if (shouldApply) {
        user.location = nextLocation;
        await user.save();
      }
    }
  }

  for (const camp of camps) {
    const legacyHometown = camp.hometown;
    const nextLocation = buildBackfilledLocation(camp.location, legacyHometown);
    const changed = JSON.stringify(nextLocation || {}) !== JSON.stringify(camp.location || {});
    if (changed) {
      campsUpdated += 1;
      if (shouldApply) {
        camp.location = nextLocation;
        await camp.save();
      }
    }
  }

  console.log(`Users needing backfill: ${usersUpdated}`);
  console.log(`Camps needing backfill: ${campsUpdated}`);

  if (!shouldApply) {
    console.log('Dry run complete. Re-run with --apply to persist changes.');
  } else {
    console.log('Migration applied successfully.');
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Location migration failed:', error.message);
    process.exit(1);
  });
