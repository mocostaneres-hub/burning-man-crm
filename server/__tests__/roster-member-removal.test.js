/**
 * Tests for full-membership roster removal status transitions and notifications.
 */

const path = require('path');
const {
  applyRosterRemovalStatusUpdates,
  isFullMembershipRoster,
  resolveMemberUserId
} = require(path.resolve(__dirname, '../services/rosterMemberRemoval.js'));

function makeDb(overrides = {}) {
  return {
    updateMember: jest.fn(async () => ({})),
    findMemberApplication: jest.fn(async () => null),
    updateMemberApplication: jest.fn(async () => ({})),
    findUser: jest.fn(async () => null),
    ...overrides
  };
}

const camp = { _id: 'camp-1', name: 'Test Camp' };
const member = { _id: 'member-1', user: 'user-1' };
const applicant = { _id: 'user-1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' };
const application = { _id: 'app-1', status: 'approved' };

describe('isFullMembershipRoster', () => {
  test('treats missing rosterType as full membership', () => {
    expect(isFullMembershipRoster({})).toBe(true);
  });

  test('detects shifts_only roster', () => {
    expect(isFullMembershipRoster({ rosterType: 'shifts_only' })).toBe(false);
  });
});

describe('resolveMemberUserId', () => {
  test('extracts string user id from populated or raw member', () => {
    expect(resolveMemberUserId({ user: 'abc' })).toBe('abc');
    expect(resolveMemberUserId({ user: { _id: 'xyz' } })).toBe('xyz');
  });
});

describe('applyRosterRemovalStatusUpdates', () => {
  test('full membership: moves application to undecided and member to inactive', async () => {
    const sendRosterRemovalUndecidedNotification = jest.fn(async () => {});
    const sendRejectionNotification = jest.fn(async () => {});
    const db = makeDb({
      findMemberApplication: jest.fn(async () => application),
      findUser: jest.fn(async () => applicant)
    });

    const result = await applyRosterRemovalStatusUpdates({
      db,
      camp,
      member,
      relatedMemberDocs: [member],
      activeRoster: { rosterType: 'full_membership' },
      reviewedBy: 'admin-1',
      notifications: { sendRosterRemovalUndecidedNotification, sendRejectionNotification }
    });

    expect(result.queue).toBe('undecided');
    expect(result.applicationStatus).toBe('undecided');
    expect(result.memberStatus).toBe('inactive');
    expect(db.updateMember).toHaveBeenCalledWith('member-1', expect.objectContaining({
      status: 'inactive',
      reviewNotes: 'Removed from roster - moved to undecided queue'
    }));
    expect(db.updateMemberApplication).toHaveBeenCalledWith('app-1', expect.objectContaining({
      status: 'undecided',
      memberId: null
    }));
    expect(sendRosterRemovalUndecidedNotification).toHaveBeenCalledWith(
      applicant,
      camp,
      'Jane Doe'
    );
    expect(sendRejectionNotification).not.toHaveBeenCalled();
    expect(result.notified).toBe(true);
  });

  test('shifts_only roster: keeps rejected status without sending rejection email', async () => {
    const sendRosterRemovalUndecidedNotification = jest.fn(async () => {});
    const sendRejectionNotification = jest.fn(async () => {});
    const db = makeDb({
      findMemberApplication: jest.fn(async () => application),
      findUser: jest.fn(async () => applicant)
    });

    const result = await applyRosterRemovalStatusUpdates({
      db,
      camp,
      member,
      relatedMemberDocs: [member],
      activeRoster: { rosterType: 'shifts_only' },
      reviewedBy: 'admin-1',
      notifications: { sendRosterRemovalUndecidedNotification, sendRejectionNotification }
    });

    expect(result.queue).toBe('rejected');
    expect(result.applicationStatus).toBe('rejected');
    expect(result.memberStatus).toBe('rejected');
    expect(db.updateMember).toHaveBeenCalledWith('member-1', expect.objectContaining({
      status: 'rejected'
    }));
    expect(db.updateMemberApplication).toHaveBeenCalledWith('app-1', expect.objectContaining({
      status: 'rejected'
    }));
    expect(sendRejectionNotification).not.toHaveBeenCalled();
    expect(sendRosterRemovalUndecidedNotification).not.toHaveBeenCalled();
    expect(result.notified).toBe(false);
  });

  test('skips notifications when notifyApplicant is false', async () => {
    const sendRosterRemovalUndecidedNotification = jest.fn(async () => {});
    const sendRejectionNotification = jest.fn(async () => {});
    const db = makeDb({
      findMemberApplication: jest.fn(async () => application),
      findUser: jest.fn(async () => applicant)
    });

    const result = await applyRosterRemovalStatusUpdates({
      db,
      camp,
      member,
      relatedMemberDocs: [member],
      activeRoster: { rosterType: 'full_membership' },
      reviewedBy: 'admin-1',
      notifyApplicant: false,
      notifications: { sendRosterRemovalUndecidedNotification, sendRejectionNotification }
    });

    expect(result.notified).toBe(false);
    expect(sendRosterRemovalUndecidedNotification).not.toHaveBeenCalled();
    expect(sendRejectionNotification).not.toHaveBeenCalled();
  });
});
