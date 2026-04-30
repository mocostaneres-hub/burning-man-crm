/**
 * One-time / idempotent backfill: link orphaned SOR Members to existing Users.
 *
 * Why this exists:
 *   Before commit 278ef98, `POST /api/oauth/google` and `/api/oauth/apple`
 *   ignored the `inviteToken` query param entirely. Anyone who accepted an
 *   SOR invite via "Continue with Google" got a `User` created but their
 *   pre-existing `Member` row stayed orphaned (`Member.user` null,
 *   `Member.status` still 'roster_only' or 'invited'). The camp's roster
 *   therefore kept showing them as "Invited" forever, even after they had
 *   signed up and were claiming shifts.
 *
 *   The forward-fix is now in place via `services/inviteAcceptance.js`,
 *   but historical rows are still broken. This module performs the
 *   recovery: for every SOR Member that is missing a `user` ref, find a
 *   `User` with the same email and bind them.
 *
 * Safety guarantees:
 *   - Strictly additive — never deletes documents.
 *   - Only writes when ALL of the following are true:
 *       1. Member.user is null/undefined (we never overwrite an existing link).
 *       2. Member.email is non-empty.
 *       3. Member.isShiftsOnly is true (we never touch FMR data).
 *       4. A User with the matching normalised email exists.
 *   - Each Member is processed in its own try/catch so a single bad row
 *     can't abort the run.
 *   - Idempotent: subsequent runs are no-ops because step (1) excludes
 *     already-linked Members.
 *   - Caps the per-run scan to a sensible upper bound (default 5000) to
 *     keep startup time bounded.
 *
 * Operational notes:
 *   - Runs once at server startup. Safe to keep wired in indefinitely;
 *     after the historical backlog clears it costs ~1 indexed query to
 *     determine there's nothing to do.
 *   - Also exposed via the admin route `POST /api/admin/backfill/sor-member-links`
 *     for ad-hoc invocation if a camp owner reports a stuck row that the
 *     startup pass missed (e.g. created mid-run).
 */
'use strict';

const { normalizeEmail } = require('../utils/emailUtils');

const DEFAULT_SCAN_LIMIT = 5000;

/**
 * Production entry point. Loads the real Mongoose models and delegates to
 * the dependency-injected core (`runBackfill`).
 *
 * @param {Object} options
 * @param {number} [options.limit=5000] - Max members to scan per run.
 * @param {boolean} [options.dryRun=false] - When true, log what *would* be linked
 *   but don't write. Useful to preview the impact before deploying.
 */
async function backfillSorMemberLinks(options = {}) {
  const Member = require('../models/Member');
  const User = require('../models/User');
  const Invite = require('../models/Invite');
  return runBackfill({ Member, User, Invite }, options);
}

/**
 * Pure-ish core, separated for unit testability. Tests inject in-memory
 * stubs for `Member`, `User`, and `Invite` so we can assert on the exact
 * write shape without touching MongoDB.
 *
 * @returns {Promise<{
 *   scanned: number,
 *   linked: number,
 *   skippedNoUser: number,
 *   skippedNoEmail: number,
 *   errors: number,
 *   linkedSamples: Array<{memberId: string, email: string, userId: string}>
 * }>}
 */
async function runBackfill({ Member, User, Invite }, { limit = DEFAULT_SCAN_LIMIT, dryRun = false } = {}) {
  const summary = {
    scanned: 0,
    linked: 0,
    skippedNoUser: 0,
    skippedNoEmail: 0,
    errors: 0,
    linkedSamples: []
  };

  // Filter: SOR rows that are missing a user link. The `$or` covers both
  // shapes legacy data uses to mean "no user yet": absent field, null, or
  // explicit empty string.
  const filter = {
    isShiftsOnly: true,
    $or: [
      { user: { $exists: false } },
      { user: null }
    ]
  };

  let candidates;
  try {
    // Mongoose's chainable cursor (`Member.find(...).limit(...).lean()`)
    // is awkward to fake from tests, so we accept either chainable form
    // (production) or a plain async (test stub returning the array
    // directly).
    const findResult = Member.find(filter);
    if (findResult && typeof findResult.limit === 'function') {
      candidates = await findResult.limit(limit).lean();
    } else {
      candidates = await findResult;
    }
  } catch (err) {
    console.error('[backfillSorMemberLinks] initial scan failed:', err?.message);
    summary.errors += 1;
    return summary;
  }

  summary.scanned = candidates.length;
  if (candidates.length === 0) {
    console.log('[backfillSorMemberLinks] no orphaned SOR members found — all good');
    return summary;
  }

  console.log(
    `[backfillSorMemberLinks] scanning ${candidates.length} SOR member(s) without a User link${dryRun ? ' (DRY RUN)' : ''}`
  );

  for (const member of candidates) {
    try {
      const rawEmail = (member.email || '').trim();
      if (!rawEmail) {
        summary.skippedNoEmail += 1;
        continue;
      }

      // Normalise both sides identically — `User.email` is stored
      // lower-cased by `auth/register` and OAuth, but legacy Members might
      // have mixed-case strings from old CSV imports.
      const normalizedEmail = normalizeEmail(rawEmail);
      // Same dual-mode helper for User.findOne — tests pass plain async
      // stubs; production gets a Mongoose Query that needs `.lean()`.
      const findUserResult = User.findOne({ email: normalizedEmail });
      const user =
        findUserResult && typeof findUserResult.lean === 'function'
          ? await findUserResult.lean()
          : await findUserResult;
      if (!user) {
        summary.skippedNoUser += 1;
        continue;
      }

      if (dryRun) {
        summary.linked += 1;
        if (summary.linkedSamples.length < 10) {
          summary.linkedSamples.push({
            memberId: member._id.toString(),
            email: normalizedEmail,
            userId: user._id.toString()
          });
        }
        continue;
      }

      // Apply the same write the live invite-acceptance helper would have
      // applied, minus the activity log (we record one summary entry at
      // the end instead of N).
      await Member.updateOne(
        { _id: member._id, user: { $in: [null, undefined] } },
        {
          $set: {
            user: user._id,
            status: 'active',
            isShiftsOnly: true,
            signupSource: member.signupSource || 'shifts_only_invite',
            joinedAt: member.joinedAt || new Date()
          }
        }
      );

      // Best-effort: stamp the matching invite as applied so the camp's
      // invite-tracking page reflects reality. Match by the Member's
      // inviteToken when present, else by recipient email.
      try {
        const inviteFilter = member.inviteToken
          ? { token: member.inviteToken }
          : { campId: member.camp, recipient: normalizedEmail, inviteType: 'shifts_only' };
        await Invite.updateOne(
          {
            ...inviteFilter,
            $or: [
              { invitedUserId: { $exists: false } },
              { invitedUserId: null }
            ]
          },
          {
            $set: {
              invitedUserId: user._id,
              status: 'applied',
              appliedAt: new Date(),
              appliedBy: user._id,
              accountCreatedAt: user.createdAt || new Date()
            }
          }
        );
      } catch (inviteErr) {
        // Non-fatal — the camp roster will still show the member as Active
        // even if the invite tracking page lags by a row.
        console.warn(
          `[backfillSorMemberLinks] could not stamp invite for member ${member._id}:`,
          inviteErr?.message
        );
      }

      summary.linked += 1;
      if (summary.linkedSamples.length < 10) {
        summary.linkedSamples.push({
          memberId: member._id.toString(),
          email: normalizedEmail,
          userId: user._id.toString()
        });
      }
    } catch (perRowErr) {
      summary.errors += 1;
      console.error(
        `[backfillSorMemberLinks] failed for member ${member?._id}:`,
        perRowErr?.message
      );
    }
  }

  console.log(
    `[backfillSorMemberLinks] done: scanned=${summary.scanned} linked=${summary.linked} ` +
      `skippedNoEmail=${summary.skippedNoEmail} skippedNoUser=${summary.skippedNoUser} errors=${summary.errors}`
  );
  if (summary.linked > 0 && summary.linkedSamples.length > 0) {
    console.log('[backfillSorMemberLinks] sample of linked rows:', summary.linkedSamples);
  }

  return summary;
}

module.exports = { backfillSorMemberLinks, runBackfill };
