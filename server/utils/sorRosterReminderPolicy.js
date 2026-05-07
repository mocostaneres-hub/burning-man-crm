/**
 * Policy for manual SOR (shifts-only roster) reminder emails — the per-row
 * "Remind" button and bulk-remind API on POST /api/rosters/:id/members/.../remind.
 *
 * Product rules:
 *   • No reminders after the member has created an account from the invite link
 *     (Member.user is set).
 *   • Invite nudges for not-yet-signed-up members are gated by
 *     SOR_ROSTER_REMINDERS_ENABLED=true (default / unset = off).
 */

function sorInviteRemindersGloballyEnabled() {
  return process.env.SOR_ROSTER_REMINDERS_ENABLED === 'true';
}

function sorMemberHasSignedUp(member) {
  const u = member?.user;
  if (!u) return false;
  if (typeof u === 'object') return !!(u._id || u.id);
  return String(u).length > 0;
}

/**
 * @returns {string|null} Human-readable skip reason, or null if send may proceed.
 */
function getSorManualReminderSkipReason(member) {
  if (sorMemberHasSignedUp(member)) {
    return 'Reminders are not sent after a member has signed up';
  }
  if (!sorInviteRemindersGloballyEnabled()) {
    return (
      'SOR roster reminders are disabled. Set environment variable ' +
      'SOR_ROSTER_REMINDERS_ENABLED=true to allow invite reminders for members who have not signed up yet.'
    );
  }
  return null;
}

module.exports = {
  sorInviteRemindersGloballyEnabled,
  sorMemberHasSignedUp,
  getSorManualReminderSkipReason
};
