/**
 * One-time / idempotent backfill: stamp `assignmentMode` on legacy
 * Event.shifts[] documents that pre-date the field.
 *
 * Why this exists:
 *   Before this change, the durable rule for "who can sign up for this
 *   shift?" was implicit — at create time, the camp lead picked a mode
 *   (ALL_ROSTER / LEADS_ONLY / SELECTED_USERS) and the backend wrote one
 *   ShiftAssignment row per eligible user, stamping `modeSnapshot` on
 *   each row. The mode itself was never persisted on the shift, so once
 *   the snapshot was taken the rule was effectively forgotten — the
 *   only way to evaluate eligibility was to read the per-user rows.
 *
 *   We now treat `Event.shifts[].assignmentMode` as the source of truth
 *   so late-joiners can be auto-eligible for ALL_ROSTER shifts. This
 *   backfill brings legacy shifts into that model.
 *
 * Inference rule (per shift):
 *   - If any ShiftAssignment rows exist for the shift, take the most
 *     common `modeSnapshot` among them (majority vote).
 *   - If no rows exist (e.g. a shift with zero current assignees),
 *     default to ALL_ROSTER — the historical default in
 *     resolveAssignmentCandidates and the most permissive choice. We
 *     err on the side of "open access" rather than silently locking
 *     people out, and SELECTED_USERS shifts that already had hand-
 *     picked rows would never hit this branch.
 *
 * Safety guarantees:
 *   - Strictly additive: never deletes shifts, events, or assignments.
 *   - Idempotent: only updates shifts whose `assignmentMode` is unset.
 *     Re-running is a no-op once the backlog is cleared.
 *   - Per-event try/catch — a single malformed event can't abort the
 *     whole run.
 *   - Bounded by `limit` (default 5000) so startup stays fast.
 *
 * Operational notes:
 *   - Runs once at server startup. Cheap after the first successful run.
 *   - Also exposed via the admin route
 *     `POST /api/admin/backfill/shift-assignment-mode` for ad-hoc
 *     invocation with `dryRun` and `limit` query params.
 */
'use strict';

const DEFAULT_LIMIT = 5000;

const VALID_MODES = new Set(['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS']);

/**
 * Compute the dominant modeSnapshot for each shift in a given event by
 * tallying its ShiftAssignment rows. Returns a Map<shiftIdString, mode>.
 *
 * Exposed for unit tests; production callers should go through
 * {@link backfillShiftAssignmentMode}.
 */
async function inferModesForEvent(event, ShiftAssignment) {
  const shiftIds = (event.shifts || [])
    .filter((shift) => !VALID_MODES.has(shift.assignmentMode))
    .map((shift) => shift._id);

  if (shiftIds.length === 0) return new Map();

  // Same dual-mode helper used in backfillSorMemberLinks: production
  // gets a Mongoose Query with chainable `.select().lean()`; tests
  // pass a plain async-returning stub so we can run without Mongo.
  const findResult = ShiftAssignment.find({ shiftId: { $in: shiftIds } });
  const rows = typeof findResult.select === 'function'
    ? await findResult.select('shiftId modeSnapshot').lean()
    : await findResult;

  const tally = new Map(); // shiftId -> { ALL_ROSTER: n, LEADS_ONLY: n, SELECTED_USERS: n }
  for (const row of rows) {
    const sid = row.shiftId.toString();
    const mode = VALID_MODES.has(row.modeSnapshot) ? row.modeSnapshot : 'ALL_ROSTER';
    if (!tally.has(sid)) tally.set(sid, {});
    const counts = tally.get(sid);
    counts[mode] = (counts[mode] || 0) + 1;
  }

  const inferred = new Map();
  for (const shiftId of shiftIds) {
    const sid = shiftId.toString();
    const counts = tally.get(sid);
    if (!counts) {
      // No ShiftAssignment rows for this shift. Historical default
      // matches resolveAssignmentCandidates / createShiftAssignments.
      inferred.set(sid, 'ALL_ROSTER');
      continue;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    inferred.set(sid, dominant);
  }
  return inferred;
}

/**
 * Production entry point. Loads the real Mongoose models and delegates
 * to the dependency-injected core (`runShiftModeBackfill`).
 *
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false] — log decisions without writing.
 * @param {number}  [options.limit=DEFAULT_LIMIT] — max events to scan.
 * @returns {Promise<{
 *   scannedEvents: number,
 *   shiftsConsidered: number,
 *   shiftsUpdated: number,
 *   errors: number
 * }>}
 */
async function backfillShiftAssignmentMode(options = {}) {
  const Event = require('../models/Event');
  const ShiftAssignment = require('../models/ShiftAssignment');
  return runShiftModeBackfill({ Event, ShiftAssignment }, options);
}

/**
 * Pure-ish core, separated for unit testability. Tests inject in-memory
 * stubs for `Event` and `ShiftAssignment`.
 */
async function runShiftModeBackfill(
  { Event, ShiftAssignment },
  { dryRun = false, limit = DEFAULT_LIMIT } = {}
) {
  const stats = {
    scannedEvents: 0,
    shiftsConsidered: 0,
    shiftsUpdated: 0,
    errors: 0
  };

  // Find events that contain at least one shift missing assignmentMode.
  // The $exists / $nin clauses cover both "field never written" and
  // "field present but holds an invalid value" cases.
  const filter = {
    $or: [
      { 'shifts.assignmentMode': { $exists: false } },
      { 'shifts.assignmentMode': { $nin: Array.from(VALID_MODES) } }
    ]
  };

  let candidateEvents;
  try {
    const findResult = Event.find(filter);
    candidateEvents = typeof findResult.limit === 'function'
      ? await findResult.limit(limit).lean()
      : await findResult;
  } catch (err) {
    console.error('[backfill-shift-mode] initial scan failed:', err?.message);
    stats.errors += 1;
    return stats;
  }

  for (const event of candidateEvents) {
    stats.scannedEvents += 1;
    try {
      const inferred = await inferModesForEvent(event, ShiftAssignment);
      if (inferred.size === 0) continue;

      stats.shiftsConsidered += inferred.size;

      if (dryRun) {
        for (const [sid, mode] of inferred.entries()) {
          console.log(`[backfill-shift-mode] DRY-RUN event=${event._id} shift=${sid} → ${mode}`);
        }
        continue;
      }

      // Write each shift's assignmentMode via positional update so we
      // never disturb other fields. Doing it in a loop (rather than
      // bulkWrite) keeps the per-write blast radius tight: a malformed
      // entry only blocks itself.
      for (const [sid, mode] of inferred.entries()) {
        try {
          const result = await Event.updateOne(
            { _id: event._id, 'shifts._id': sid },
            { $set: { 'shifts.$.assignmentMode': mode } }
          );
          if (result.modifiedCount > 0) {
            stats.shiftsUpdated += 1;
          }
        } catch (perShiftErr) {
          stats.errors += 1;
          console.warn(
            `[backfill-shift-mode] event=${event._id} shift=${sid} update failed:`,
            perShiftErr?.message
          );
        }
      }
    } catch (perEventErr) {
      stats.errors += 1;
      console.warn(
        `[backfill-shift-mode] event=${event._id} processing failed:`,
        perEventErr?.message
      );
    }
  }

  return stats;
}

module.exports = backfillShiftAssignmentMode;
module.exports.backfillShiftAssignmentMode = backfillShiftAssignmentMode;
module.exports.runShiftModeBackfill = runShiftModeBackfill;
module.exports.inferModesForEvent = inferModesForEvent;
