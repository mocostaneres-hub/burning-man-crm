/**
 * Tests for the shared invite-acceptance helper.
 *
 * `acceptInviteForUser` is the linchpin that ties Shifts-Only Roster (SOR)
 * invitees back to their pre-existing Member document after the user
 * authenticates. Both `POST /api/auth/register` and `POST /api/oauth/google`
 * (and `/apple`) call it with identical contracts; if it regresses, the
 * camp roster's status will silently stop flipping from "Invited" to
 * "Active" — the exact production bug this helper was extracted to fix.
 *
 * Coverage targets:
 *   1. No-token / no-user no-ops — must NEVER touch the DB.
 *   2. SOR invite happy path — Member.user gets bound, status flips to
 *      'active', invite goes to 'applied', activity log records ACCOUNT_CREATED.
 *   3. Standard (non-SOR) invite — invitedUserId stamped, Member untouched.
 *   4. Hard rejections — invalid token / wrong-recipient / already-used /
 *      camp-not-found return an error string and DO NOT mutate state.
 *   5. Resilience — db.updateMember failing must not block invite stamping
 *      or throw out of the helper. Same for activity log failures.
 *   6. Name-merge rule — empty firstName/lastName must NOT clobber the
 *      Member's pre-existing name (OAuth providers sometimes don't return
 *      names; we keep what the camp originally entered).
 *
 * Style note: we inject a fake `db` adapter via dependency injection rather
 * than spinning up Mongo. This keeps the suite Jest-compatible and runs in
 * milliseconds, matching the rest of `server/__tests__/`.
 */

const path = require('path');
const { acceptInviteForUser } = require(path.resolve(__dirname, '../services/inviteAcceptance.js'));

function makeDb(overrides = {}) {
  // Default: empty repo. Tests override only the methods they care about.
  return {
    findInvite: jest.fn(async () => null),
    findCamp: jest.fn(async () => null),
    updateInviteById: jest.fn(async () => ({})),
    updateMember: jest.fn(async () => ({})),
    ...overrides
  };
}

const baseUser = {
  _id: 'user-abc-123',
  email: 'jane@example.com',
  accountType: 'personal'
};

const NORMALIZED_EMAIL = 'jane@example.com';

describe('acceptInviteForUser — guards', () => {
  test('no-op when inviteToken is missing', async () => {
    const db = makeDb();
    const result = await acceptInviteForUser({
      inviteToken: null,
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result).toEqual({
      inviteContext: null,
      linkedShiftsOnly: false,
      error: null
    });
    expect(db.findInvite).not.toHaveBeenCalled();
    expect(db.updateMember).not.toHaveBeenCalled();
    expect(db.updateInviteById).not.toHaveBeenCalled();
  });

  test('no-op when user is missing or has no _id', async () => {
    const db = makeDb();
    const a = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: null,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    const b = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: { email: 'x@y.z' },
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(a.linkedShiftsOnly).toBe(false);
    expect(b.linkedShiftsOnly).toBe(false);
    expect(db.findInvite).not.toHaveBeenCalled();
  });
});

describe('acceptInviteForUser — hard rejections', () => {
  test('returns error when invite token does not exist', async () => {
    const db = makeDb({ findInvite: jest.fn(async () => null) });
    const result = await acceptInviteForUser({
      inviteToken: 'unknown',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBe('Invitation link is invalid');
    expect(result.linkedShiftsOnly).toBe(false);
    expect(db.updateMember).not.toHaveBeenCalled();
    expect(db.updateInviteById).not.toHaveBeenCalled();
  });

  test('returns error when invite was sent to a different email (email-channel only)', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok-1',
        method: 'email',
        recipient: 'someone-else@domain.com',
        campId: 'camp-1',
        inviteType: 'shifts_only',
        status: 'sent'
      }))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBe('This invitation was sent to a different email address');
    expect(db.updateMember).not.toHaveBeenCalled();
  });

  test('non-email-channel invites skip the recipient match check', async () => {
    // Manual / SMS invites have no recipient email to validate against —
    // historically this caused false rejections for camps that invited via
    // SMS and the user signed up with a different email.
    const invite = {
      _id: 'inv-1',
      token: 'tok-1',
      method: 'manual',
      recipient: '',
      campId: 'camp-1',
      inviteType: 'standard',
      status: 'sent'
    };
    const db = makeDb({
      findInvite: jest.fn(async () => invite),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp Foo' })),
      updateInviteById: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBeNull();
    expect(result.inviteContext).toBeTruthy();
    expect(db.updateInviteById).toHaveBeenCalled();
  });

  test('returns error when invite already applied', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok-1',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        inviteType: 'shifts_only',
        status: 'applied',
        appliedBy: 'user-existing-001',
        appliedAt: new Date('2024-01-01')
      }))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBe('This invitation has already been used');
    expect(db.updateMember).not.toHaveBeenCalled();
    expect(db.updateInviteById).not.toHaveBeenCalled();
  });

  test('returns error when invitedUserId already set', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok-1',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        inviteType: 'shifts_only',
        status: 'sent',
        invitedUserId: 'user-already-bound'
      }))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBe('This invitation has already been used');
  });

  test('returns error when camp lookup fails', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok-1',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-orphan',
        inviteType: 'shifts_only',
        status: 'sent'
      })),
      findCamp: jest.fn(async () => null)
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-1',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      db
    });
    expect(result.error).toBe('Camp not found for this invitation');
  });
});

describe('acceptInviteForUser — SOR happy path', () => {
  function buildSorInvite(overrides = {}) {
    return {
      _id: 'inv-sor-1',
      token: 'tok-sor',
      method: 'email',
      recipient: NORMALIZED_EMAIL,
      campId: 'camp-1',
      memberId: 'member-pre-existing-1',
      inviteType: 'shifts_only',
      status: 'sent',
      createdAt: new Date('2025-01-01'),
      ...overrides
    };
  }

  test('binds Member to User, marks invite applied, logs activity', async () => {
    const invite = buildSorInvite();
    const db = makeDb({
      findInvite: jest.fn(async () => invite),
      findCamp: jest.fn(async () => ({
        _id: 'camp-1',
        name: 'Gallavant',
        slug: 'gallavant'
      })),
      updateMember: jest.fn(async () => ({ _id: invite.memberId, user: baseUser._id })),
      updateInviteById: jest.fn(async () => ({}))
    });
    const recordActivity = jest.fn(async () => ({}));

    const result = await acceptInviteForUser({
      inviteToken: 'tok-sor',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db,
      recordActivity
    });

    // Returned context — what Register.tsx uses to route to onboarding.
    expect(result.error).toBeNull();
    expect(result.linkedShiftsOnly).toBe(true);
    expect(result.inviteContext).toEqual({
      token: 'tok-sor',
      campId: 'camp-1',
      campSlug: 'gallavant',
      inviteType: 'shifts_only',
      isShiftsOnlyInvite: true
    });

    // Member.update — the critical roster-flip side effect.
    expect(db.updateMember).toHaveBeenCalledTimes(1);
    const [memberId, memberUpdates] = db.updateMember.mock.calls[0];
    expect(memberId).toBe('member-pre-existing-1');
    expect(memberUpdates).toMatchObject({
      user: 'user-abc-123',
      status: 'active',
      isShiftsOnly: true,
      signupSource: 'shifts_only_invite',
      inviteToken: 'tok-sor',
      email: NORMALIZED_EMAIL,
      name: 'Jane Doe'
    });
    expect(memberUpdates.joinedAt).toBeInstanceOf(Date);
    expect(memberUpdates.invitedAt).toBeInstanceOf(Date);

    // Invite stamped applied.
    expect(db.updateInviteById).toHaveBeenCalledTimes(1);
    const [inviteId, inviteUpdates] = db.updateInviteById.mock.calls[0];
    expect(inviteId).toBe('inv-sor-1');
    expect(inviteUpdates).toMatchObject({
      invitedUserId: 'user-abc-123',
      status: 'applied',
      appliedBy: 'user-abc-123'
    });
    expect(inviteUpdates.appliedAt).toBeInstanceOf(Date);

    // Activity audit fired against the Member entity.
    expect(recordActivity).toHaveBeenCalledTimes(1);
    const [entityType, entityId, actingUserId, activityType, details] =
      recordActivity.mock.calls[0];
    expect(entityType).toBe('MEMBER');
    expect(entityId).toBe('member-pre-existing-1');
    expect(actingUserId).toBe('user-abc-123');
    expect(activityType).toBe('ACCOUNT_CREATED');
    expect(details).toMatchObject({
      field: 'account',
      campId: 'camp-1',
      linkedUserId: 'user-abc-123',
      inviteId: 'inv-sor-1'
    });
  });

  test('falls back to slug derived from name when camp.slug is absent', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => buildSorInvite()),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: "Camp Foo's Bar!" })),
      updateMember: jest.fn(async () => ({})),
      updateInviteById: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-sor',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
    });
    expect(result.inviteContext.campSlug).toBe('camp-foo-s-bar-');
  });

  test('does NOT overwrite Member.name when firstName and lastName are empty', async () => {
    // Common when OAuth providers omit name fields (e.g. Apple's "hide my
    // email" + name-already-shared-on-prior-signin). We must not blow away
    // the Member's manually-entered or CSV-imported name.
    const db = makeDb({
      findInvite: jest.fn(async () => buildSorInvite()),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Gallavant' })),
      updateMember: jest.fn(async () => ({})),
      updateInviteById: jest.fn(async () => ({}))
    });

    await acceptInviteForUser({
      inviteToken: 'tok-sor',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: '',
      lastName: '',
      db
    });

    const [, memberUpdates] = db.updateMember.mock.calls[0];
    expect(memberUpdates).not.toHaveProperty('name');
  });

  test('still stamps the invite even if updateMember throws', async () => {
    // updateMember failure must not block invite stamping — otherwise a
    // stale Member doc and a fresh User would leave the camp roster
    // permanently un-linkable. Worst case: invitedUserId is recorded
    // (so the invite tracking page reflects "applied") and a sysadmin can
    // back-fill the Member.user later.
    const invite = {
      _id: 'inv-sor-1',
      token: 'tok-sor',
      method: 'email',
      recipient: NORMALIZED_EMAIL,
      campId: 'camp-1',
      memberId: 'member-pre-existing-1',
      inviteType: 'shifts_only',
      status: 'sent'
    };
    const db = makeDb({
      findInvite: jest.fn(async () => invite),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp Foo', slug: 'camp-foo' })),
      updateMember: jest.fn(async () => {
        throw new Error('Mongo unavailable');
      }),
      updateInviteById: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-sor',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
    });
    expect(result.linkedShiftsOnly).toBe(false);
    expect(result.error).toBeNull(); // Helper doesn't surface infra errors
    // invitedUserId still recorded — the invite tracking page is still useful.
    expect(db.updateInviteById).toHaveBeenCalledTimes(1);
    const [, inviteUpdates] = db.updateInviteById.mock.calls[0];
    expect(inviteUpdates.invitedUserId).toBe('user-abc-123');
    // status MUST NOT be 'applied' since the Member link did not happen.
    expect(inviteUpdates.status).not.toBe('applied');
  });

  test('expired invites are re-extended rather than rejected', async () => {
    // We re-arm rather than 400 because the user has already clicked through
    // and probably typed their password — failing them at the finish line
    // is hostile UX.
    const invite = {
      _id: 'inv-sor-1',
      token: 'tok-sor',
      method: 'email',
      recipient: NORMALIZED_EMAIL,
      campId: 'camp-1',
      memberId: 'member-pre-existing-1',
      inviteType: 'shifts_only',
      status: 'sent',
      expiresAt: new Date('2020-01-01') // long past
    };
    const updateInviteById = jest.fn(async () => ({}));
    const db = makeDb({
      findInvite: jest.fn(async () => invite),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp', slug: 'camp' })),
      updateInviteById,
      updateMember: jest.fn(async () => ({}))
    });

    const result = await acceptInviteForUser({
      inviteToken: 'tok-sor',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
    });

    expect(result.linkedShiftsOnly).toBe(true);
    // Two updateInvite calls: the expiry-extension and the final apply.
    expect(updateInviteById).toHaveBeenCalledTimes(2);
    const expiryExtension = updateInviteById.mock.calls[0][1];
    expect(expiryExtension.expiresAt).toBeInstanceOf(Date);
    expect(expiryExtension.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('SOR invite without memberId stamps invitedUserId only (no member link)', async () => {
    // Edge case: SOR invite was created without a pre-existing Member
    // (legacy data, manual workaround). We can't link a member that
    // doesn't exist, but we still want to record the signup.
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-sor-orphan',
        token: 'tok',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        inviteType: 'shifts_only',
        status: 'sent'
        // memberId intentionally absent
      })),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp', slug: 'camp' })),
      updateInviteById: jest.fn(async () => ({})),
      updateMember: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
    });
    expect(result.linkedShiftsOnly).toBe(false);
    expect(db.updateMember).not.toHaveBeenCalled();
    expect(db.updateInviteById).toHaveBeenCalledTimes(1);
    const [, inviteUpdates] = db.updateInviteById.mock.calls[0];
    expect(inviteUpdates.invitedUserId).toBe('user-abc-123');
    expect(inviteUpdates.status).not.toBe('applied');
  });
});

describe('acceptInviteForUser — standard (non-SOR) invites', () => {
  test('records invitedUserId on the invite but does NOT touch any Member', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-fmr-1',
        token: 'tok-fmr',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        inviteType: 'standard',
        status: 'sent'
      })),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp', slug: 'camp' })),
      updateInviteById: jest.fn(async () => ({})),
      updateMember: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok-fmr',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
    });
    expect(result.linkedShiftsOnly).toBe(false);
    expect(result.error).toBeNull();
    expect(result.inviteContext.isShiftsOnlyInvite).toBe(false);
    expect(db.updateMember).not.toHaveBeenCalled();
    expect(db.updateInviteById).toHaveBeenCalledTimes(1);
    const [, inviteUpdates] = db.updateInviteById.mock.calls[0];
    expect(inviteUpdates.invitedUserId).toBe('user-abc-123');
    expect(inviteUpdates.status).not.toBe('applied'); // FMR uses /applications flow
  });
});

describe('acceptInviteForUser — recordActivity is optional', () => {
  test('helper succeeds without recordActivity wired', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        memberId: 'member-1',
        inviteType: 'shifts_only',
        status: 'sent'
      })),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp', slug: 'camp' })),
      updateInviteById: jest.fn(async () => ({})),
      updateMember: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db
      // recordActivity intentionally omitted
    });
    expect(result.linkedShiftsOnly).toBe(true);
    // No throw means it gracefully skipped audit logging.
  });

  test('recordActivity throwing does not break the helper', async () => {
    const db = makeDb({
      findInvite: jest.fn(async () => ({
        _id: 'inv-1',
        token: 'tok',
        method: 'email',
        recipient: NORMALIZED_EMAIL,
        campId: 'camp-1',
        memberId: 'member-1',
        inviteType: 'shifts_only',
        status: 'sent'
      })),
      findCamp: jest.fn(async () => ({ _id: 'camp-1', name: 'Camp', slug: 'camp' })),
      updateInviteById: jest.fn(async () => ({})),
      updateMember: jest.fn(async () => ({}))
    });
    const result = await acceptInviteForUser({
      inviteToken: 'tok',
      user: baseUser,
      normalizedEmail: NORMALIZED_EMAIL,
      firstName: 'Jane',
      lastName: 'Doe',
      db,
      recordActivity: jest.fn(async () => {
        throw new Error('audit log down');
      })
    });
    expect(result.linkedShiftsOnly).toBe(true);
  });
});
