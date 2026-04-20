/**
 * Migration: fix-event-times-to-pdt.js
 *
 * BACKGROUND
 * ----------
 * Before this fix, event/shift times were saved using:
 *   new Date(`${date}T${time}`)
 * On the Railway server (UTC timezone) this created timestamps in UTC rather
 * than PDT (UTC-7).  A user who entered "10:00 AM" on Aug 31 PDT got
 * 2026-08-31T10:00:00.000Z stored — which is 3:00 AM PDT when displayed.
 *
 * FIX
 * ---
 * Add the PDT offset (7 hours = 25200 seconds) to every event/shift timestamp
 * so that the stored UTC value correctly represents the intended PDT time.
 *
 * Example:
 *   Stored (wrong):  2026-08-31T10:00:00.000Z  →  3:00 AM PDT
 *   After migration: 2026-08-31T17:00:00.000Z  → 10:00 AM PDT  ✓
 *
 * SAFETY
 * ------
 * - Runs in dry-run mode by default. Pass --apply to commit changes.
 * - Skips events already migrated (checked via `pdtMigrated: true` flag).
 * - Prints a detailed summary before and after.
 *
 * USAGE
 * -----
 *   node scripts/migrations/fix-event-times-to-pdt.js          # dry run
 *   node scripts/migrations/fix-event-times-to-pdt.js --apply  # commit changes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const PDT_OFFSET_MS = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
const DRY_RUN = !process.argv.includes('--apply');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI / MONGO_URI not set. Aborting.');
  process.exit(1);
}

const addOffset = (date) => {
  if (!date) return date;
  return new Date(new Date(date).getTime() + PDT_OFFSET_MS);
};

async function run() {
  console.log(`\n🗓️  PDT Event Time Migration — ${DRY_RUN ? 'DRY RUN (pass --apply to commit)' : '⚠️  APPLYING CHANGES'}\n`);

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB\n');

  const Event = require('../../server/models/Event');

  const events = await Event.find({ pdtMigrated: { $ne: true } }).lean();
  console.log(`Found ${events.length} unmigrated event(s)\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    const updates = {
      pdtMigrated: true
    };

    if (event.eventDate) updates.eventDate = addOffset(event.eventDate);
    if (event.startTime) updates.startTime = addOffset(event.startTime);
    if (event.endTime)   updates.endTime   = addOffset(event.endTime);

    const updatedShifts = (event.shifts || []).map((shift) => ({
      ...shift,
      date:      shift.date      ? addOffset(shift.date)      : shift.date,
      startTime: shift.startTime ? addOffset(shift.startTime) : shift.startTime,
      endTime:   shift.endTime   ? addOffset(shift.endTime)   : shift.endTime
    }));

    const hasChanges =
      updates.eventDate || updates.startTime || updates.endTime || updatedShifts.length > 0;

    if (!hasChanges) {
      skippedCount++;
      continue;
    }

    const preview = {
      id: event._id.toString(),
      name: event.eventName,
      before: {
        eventDate: event.eventDate,
        startTime: event.startTime,
        endTime: event.endTime,
        firstShift: event.shifts?.[0]
          ? { date: event.shifts[0].date, startTime: event.shifts[0].startTime, endTime: event.shifts[0].endTime }
          : null
      },
      after: {
        eventDate: updates.eventDate,
        startTime: updates.startTime,
        endTime: updates.endTime,
        firstShift: updatedShifts[0]
          ? { date: updatedShifts[0].date, startTime: updatedShifts[0].startTime, endTime: updatedShifts[0].endTime }
          : null
      }
    };

    console.log(`  Event: "${preview.name}" (${preview.id})`);
    console.log(`    eventDate : ${preview.before.eventDate} → ${preview.after.eventDate}`);
    console.log(`    startTime : ${preview.before.startTime} → ${preview.after.startTime}`);
    console.log(`    endTime   : ${preview.before.endTime} → ${preview.after.endTime}`);
    if (preview.before.firstShift) {
      console.log(`    shift[0]  : date ${preview.before.firstShift.date} → ${preview.after.firstShift.date}`);
      console.log(`    shift[0]  : start ${preview.before.firstShift.startTime} → ${preview.after.firstShift.startTime}`);
      console.log(`    shift[0]  : end   ${preview.before.firstShift.endTime} → ${preview.after.firstShift.endTime}`);
    }
    console.log();

    if (!DRY_RUN) {
      await Event.updateOne(
        { _id: event._id },
        {
          $set: {
            eventDate: updates.eventDate,
            startTime: updates.startTime,
            endTime: updates.endTime,
            shifts: updatedShifts,
            pdtMigrated: true
          }
        }
      );
    }

    migratedCount++;
  }

  console.log(`\n📊 Summary`);
  console.log(`  Events processed : ${migratedCount}`);
  console.log(`  Events skipped   : ${skippedCount}`);
  console.log(DRY_RUN
    ? '\n⚠️  DRY RUN — no changes were written. Re-run with --apply to apply.\n'
    : '\n✅ Migration applied successfully.\n'
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
