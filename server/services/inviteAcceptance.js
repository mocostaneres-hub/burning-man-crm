'use strict';

/**
 * Shared helper for accepting an invite token during account creation.
 *
 * Both the email/password registration route (`POST /api/auth/register`) and
 * the OAuth routes (`POST /api/oauth/google`, `POST /api/oauth/apple`) need to
 * run the *same* post-signup logic when the user came in via an invite link:
 *   1. Look up the invite by token and validate it.
 *   2. For Shifts-Only Roster (SOR) invites, link the pre-existing Member
 *      document to the freshly created/just-linked User, flip its status to
 *      `active`, and stamp the invite as `applied`.
 *   3. For standard FMR invites, just record `invitedUserId` on the invite so
 *      the camp's invite tracking page reflects that the recipient signed up.
 *   4. Add an `ACCOUNT_CREATED` entry to the camp-side member activity log so
 *      the Contact 360 timeline tells a continuous story
 *      ("manually added → invited → account created → signed up for shifts").
 *
 * Historical bug this fixes:
 *   `POST /api/oauth/google` (and `/apple`) used to ignore `inviteToken`
 *   entirely. Members who accepted their SOR invite by clicking
 *   "Continue with Google" had their User created but never linked back to
 *   their Member row. The camp's roster therefore kept showing them as
 *   "Invited" forever, even though they had signed up and could see shifts.
 *
 * Failure isolation:
 *   This helper NEVER throws. Auth flows must succeed even if the invite
 *   logic hits a database hiccup — the user has already been created, and
 *   we'd rather log a warning than surface a 500 to the client.
 *
 * @param {Object} params
 * @param {string|null|undefined} params.inviteToken
 *   The raw token value from the request body. Pass through as-is; we no-op
 *   on falsy.
 * @param {Object} params.user
 *   The authenticated/just-created User document (must have `_id` and
 *   `email`).
 * @param {string} params.normalizedEmail
 *   Lowercased/trimmed email used for invite-recipient mismatch checks.
 * @param {string} [params.firstName='']
 * @param {string} [params.lastName='']
 *   Used to refresh the SOR Member's `name` field if the invite preceded
 *   the user supplying real names. OAuth flows should pass `user.firstName`
 *   / `user.lastName`.
 * @param {Object} params.db - Database adapter (`databaseAdapter` instance).
 * @param {Function} [params.recordActivity] - activityLogger.recordActivity.
 *   Optional; if absent we skip the audit step.
 *
 * @returns {Promise<{
 *   inviteContext: Object|null,
 *   linkedShiftsOnly: boolean,
 *   error: string|null
 * }>}
 *   `inviteContext` is the shape Register.tsx expects in the response so it
 *   can route the user into the SOR onboarding. `linkedShiftsOnly` is true
 *   iff we successfully linked an SOR Member to the user.
 *   `error` is a user-facing message if the invite was hard-rejected
 *   (wrong email, already used, missing camp); the caller should decide
 *   whether to honour it (Register.tsx returns 400; OAuth ignores it so the
 *   sign-in still completes).
 */
async function acceptInviteForUser({
  inviteToken,
  user,
  normalizedEmail,
  firstName = '',
  lastName = '',
  db,
  recordActivity
}) {
  if (!inviteToken) {
    return { inviteContext: null, linkedShiftsOnly: false, error: null };
  }

  if (!user || !user._id) {
    return { inviteContext: null, linkedShiftsOnly: false, error: null };
  }

  let invite;
  try {
    invite = await db.findInvite({ token: inviteToken });
  } catch (err) {
    console.warn('[acceptInviteForUser] findInvite failed:', err?.message);
    return { inviteContext: null, linkedShiftsOnly: false, error: null };
  }

  if (!invite) {
    return {
      inviteContext: null,
      linkedShiftsOnly: false,
      error: 'Invitation link is invalid'
    };
  }

  // Recipient-email guard: only enforced for email-channel invites where the
  // recipient address is meaningful. SMS/manual invites have no recipient
  // email to compare against.
  const normalizedInviteRecipient =
    typeof invite.recipient === 'string'
      ? invite.recipient.trim().toLowerCase()
      : '';
  if (
    invite.method === 'email' &&
    normalizedInviteRecipient &&
    normalizedInviteRecipient !== normalizedEmail
  ) {
    return {
      inviteContext: null,
      linkedShiftsOnly: false,
      error: 'This invitation was sent to a different email address'
    };
  }

  // Already-used guard. We allow the signup itself to continue silently
  // (idempotent reload of an invite link should not nuke the user's session)
  // but we report it back so callers that want to fail-fast can.
  if (
    invite.invitedUserId ||
    invite.status === 'applied' ||
    invite.appliedBy ||
    invite.appliedAt
  ) {
    return {
      inviteContext: null,
      linkedShiftsOnly: false,
      error: 'This invitation has already been used'
    };
  }

  // Re-extend an expired invite. We choose to re-arm rather than reject
  // because the user has clearly intended to accept it; rejecting on
  // boundary cases (e.g. the invite expired between email click and signup
  // submit) makes for a frustrating dead-end.
  const isExpired = invite.expiresAt && new Date(invite.expiresAt) <= new Date();
  if (isExpired || invite.status === 'expired') {
    try {
      await db.updateInviteById(invite._id, {
        status: invite.status === 'expired' ? 'sent' : invite.status,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      });
    } catch (err) {
      console.warn('[acceptInviteForUser] re-extend expired invite failed:', err?.message);
    }
  }

  let camp;
  try {
    camp = await db.findCamp({ _id: invite.campId });
  } catch (err) {
    console.warn('[acceptInviteForUser] findCamp failed:', err?.message);
    camp = null;
  }
  if (!camp) {
    return {
      inviteContext: null,
      linkedShiftsOnly: false,
      error: 'Camp not found for this invitation'
    };
  }

  const campSlug =
    camp.slug ||
    camp.urlSlug ||
    (camp.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isShiftsOnly = (invite.inviteType || 'standard') === 'shifts_only';

  const inviteContext = {
    token: inviteToken,
    campId: invite.campId,
    campSlug,
    inviteType: invite.inviteType || 'standard',
    isShiftsOnlyInvite: isShiftsOnly
  };

  const inviteUpdates = {
    invitedUserId: user._id,
    accountCreatedAt: invite.accountCreatedAt || new Date(),
    status: invite.status === 'expired' ? 'sent' : invite.status
  };

  let linkedShiftsOnly = false;

  // SOR-only: bind the pre-created Member to the new User so the camp's
  // roster flips from "Invited" to "Active". This is the linchpin of the
  // bug fix; without it the OAuth path leaves the Member's `user` ref null
  // forever.
  if (isShiftsOnly && invite.memberId) {
    try {
      const composedName = `${firstName || ''} ${lastName || ''}`.trim();
      await db.updateMember(invite.memberId, {
        user: user._id,
        status: 'active',
        joinedAt: new Date(),
        invitedAt: invite.createdAt || new Date(),
        isShiftsOnly: true,
        signupSource: 'shifts_only_invite',
        inviteToken: invite.token,
        email: normalizedEmail,
        // Only overwrite the Member's name if the user actually provided one.
        // OAuth flows might call us with empty firstName/lastName when the
        // provider didn't expose them; in that case we keep the CSV-imported
        // or manually-entered name as-is.
        ...(composedName ? { name: composedName } : {})
      });
      inviteUpdates.status = 'applied';
      inviteUpdates.appliedAt = new Date();
      inviteUpdates.appliedBy = user._id;
      linkedShiftsOnly = true;
    } catch (err) {
      console.warn('[acceptInviteForUser] SOR member link failed:', err?.message);
      // Fall through and at least record invitedUserId — the cleanup script
      // can re-run; far worse to fail the whole signup.
    }
  }

  try {
    await db.updateInviteById(invite._id, inviteUpdates);
  } catch (err) {
    console.warn('[acceptInviteForUser] updateInviteById failed:', err?.message);
  }

  // Activity audit (best-effort). We log against the Member entity rather
  // than the User so the camp-side Contact 360 view shows a coherent
  // timeline. recordActivity already swallows its own errors, but we wrap
  // anyway in case the helper isn't available.
  if (linkedShiftsOnly && recordActivity && invite.memberId) {
    try {
      await recordActivity('MEMBER', invite.memberId, user._id, 'ACCOUNT_CREATED', {
        field: 'account',
        campId: invite.campId,
        newValue: user.accountType || 'personal',
        note: 'Member completed signup via shifts-only invite',
        inviteId: invite._id,
        linkedUserId: user._id
      });
    } catch (err) {
      console.warn('[acceptInviteForUser] recordActivity (member) failed:', err?.message);
    }
  }

  return { inviteContext, linkedShiftsOnly, error: null };
}

module.exports = { acceptInviteForUser };
