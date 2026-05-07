const {
  standardFullMembershipInviteBlocksResend
} = require('../utils/fullMembershipInviteDuplicate');

describe('standardFullMembershipInviteBlocksResend', () => {
  test('does not block when invite is shifts_only (SOR path shares Invite collection)', () => {
    expect(
      standardFullMembershipInviteBlocksResend({
        inviteType: 'shifts_only',
        recipient: 'a@b.com',
        status: 'sent',
        expiresAt: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
  });

  test('blocks active standard sent invite before expiry', () => {
    expect(
      standardFullMembershipInviteBlocksResend({
        inviteType: 'standard',
        status: 'sent',
        expiresAt: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  test('does not block standard invite past expiresAt (re-invite same email)', () => {
    expect(
      standardFullMembershipInviteBlocksResend({
        inviteType: 'standard',
        status: 'sent',
        expiresAt: new Date(Date.now() - 86400000)
      })
    ).toBe(false);
  });

  test('blocks applied standard invite', () => {
    expect(
      standardFullMembershipInviteBlocksResend({
        inviteType: 'standard',
        status: 'applied',
        expiresAt: new Date(Date.now() - 86400000)
      })
    ).toBe(true);
  });

  test('does not block expired status', () => {
    expect(
      standardFullMembershipInviteBlocksResend({
        inviteType: 'standard',
        status: 'expired',
        expiresAt: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
  });
});
