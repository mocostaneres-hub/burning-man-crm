/**
 * Whether an existing Invite row should block POST /invites (full-membership /
 * standard) for the same camp + email.
 *
 * Shifts-only roster invites share the Invite collection (`inviteType:
 * 'shifts_only'`) but must not block FMR full-membership invites after a camp
 * archives SOR or otherwise returns to full-membership flows.
 *
 * Expired (by status or by expiresAt) standard invites do not block so camps
 * can re-invite the same address.
 *
 * @param {object|null|undefined} invite
 * @returns {boolean}
 */
function standardFullMembershipInviteBlocksResend(invite) {
  if (!invite) return false;
  const inviteType = invite.inviteType || 'standard';
  if (inviteType === 'shifts_only') return false;

  const status = (invite.status || 'pending').toLowerCase();
  if (status === 'applied') return true;
  if (status === 'expired') return false;

  const exp = invite.expiresAt != null ? new Date(invite.expiresAt) : null;
  const expiredByDate =
    exp && !Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now();
  if (expiredByDate) return false;

  return status === 'pending' || status === 'sent';
}

module.exports = { standardFullMembershipInviteBlocksResend };
