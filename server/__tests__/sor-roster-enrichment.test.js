/**
 * Tests for shift-signup enrichment on GET /api/rosters/active.
 *
 * The route augments each roster member with:
 *   • shiftSignupCount — aggregated from ShiftSignup via $group
 *   • lastReminderAt   — pass-through from the Member document
 *
 * Shift counts apply to every active roster type. Reminder metadata remains
 * shifts-only behavior.
 */

/**
 * Mirror of the enrichment loop. Accepts an injected aggregate function so
 * the test can stub out ShiftSignup.aggregate without MongoDB.
 */
async function enrichRosterShiftCounts(roster, aggregateFn) {
  if (!roster || !Array.isArray(roster.members)) {
    return roster;
  }

  const userIds = [];
  for (const entry of roster.members) {
    const userRef = entry?.member?.user;
    if (userRef) {
      const id = typeof userRef === 'object' ? userRef._id : userRef;
      if (id) userIds.push(id);
    }
  }

  const counts = userIds.length
    ? await aggregateFn([
        { $match: { userId: { $in: userIds }, campId: roster.camp } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
      ])
    : [];
  const countByUserId = new Map(counts.map((c) => [c._id.toString(), c.count]));

  for (const entry of roster.members) {
    if (!entry?.member || typeof entry.member !== 'object') continue;
    const userRef = entry.member.user;
    const userIdStr =
      userRef && typeof userRef === 'object'
        ? userRef._id?.toString()
        : userRef?.toString();
    entry.member.shiftSignupCount = userIdStr ? countByUserId.get(userIdStr) || 0 : 0;
    if (roster.rosterType === 'shifts_only' && entry.member.lastReminderAt === undefined) {
      entry.member.lastReminderAt = null;
    }
  }

  return roster;
}

describe('enrichRosterShiftCounts — all active roster types', () => {
  test('FMR rosters receive current shift counts without reminder metadata', async () => {
    const roster = {
      rosterType: 'full_membership',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: { _id: 'u1' } } }
      ]
    };
    const aggregate = jest.fn(async () => [{ _id: 'u1', count: 5 }]);
    const result = await enrichRosterShiftCounts(roster, aggregate);

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(result.members[0].member.shiftSignupCount).toBe(5);
    expect(result.members[0].member.lastReminderAt).toBeUndefined();
  });

  test('legacy roster types still receive shift counts', async () => {
    const roster = {
      rosterType: 'legacy_unknown_value',
      camp: 'camp-1',
      members: [{ member: { _id: 'm1', user: { _id: 'u1' } } }]
    };
    const aggregate = jest.fn(async () => [{ _id: 'u1', count: 2 }]);
    await enrichRosterShiftCounts(roster, aggregate);
    expect(roster.members[0].member.shiftSignupCount).toBe(2);
  });

  test('null roster is passed through safely', async () => {
    const result = await enrichRosterShiftCounts(null, jest.fn());
    expect(result).toBeNull();
  });

  test('SOR roster with no members skips aggregation', async () => {
    const roster = { rosterType: 'shifts_only', camp: 'camp-1', members: [] };
    const aggregate = jest.fn();
    await enrichRosterShiftCounts(roster, aggregate);
    expect(aggregate).not.toHaveBeenCalled();
  });
});

describe('enrichRosterShiftCounts — shift count attachment', () => {
  test('attaches shiftSignupCount for members with a linked user', async () => {
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: { _id: 'u1' } } },
        { member: { _id: 'm2', user: { _id: 'u2' } } }
      ]
    };
    const aggregate = jest.fn(async () => [
      { _id: 'u1', count: 3 },
      { _id: 'u2', count: 7 }
    ]);

    await enrichRosterShiftCounts(roster, aggregate);

    expect(roster.members[0].member.shiftSignupCount).toBe(3);
    expect(roster.members[1].member.shiftSignupCount).toBe(7);
  });

  test('defaults to 0 for users with no signups', async () => {
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: { _id: 'u1' } } },
        { member: { _id: 'm2', user: { _id: 'u2' } } }
      ]
    };
    const aggregate = jest.fn(async () => [{ _id: 'u1', count: 2 }]);
    await enrichRosterShiftCounts(roster, aggregate);
    expect(roster.members[0].member.shiftSignupCount).toBe(2);
    expect(roster.members[1].member.shiftSignupCount).toBe(0);
  });

  test('Invited members (no user) get shiftSignupCount = 0 without failing', async () => {
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: null, email: 'a@x.com' } },
        { member: { _id: 'm2', user: { _id: 'u2' } } }
      ]
    };
    const aggregate = jest.fn(async () => [{ _id: 'u2', count: 4 }]);
    await enrichRosterShiftCounts(roster, aggregate);
    expect(roster.members[0].member.shiftSignupCount).toBe(0);
    expect(roster.members[1].member.shiftSignupCount).toBe(4);
  });

  test('$match pipeline scopes by campId + userIds (prevents cross-camp leak)', async () => {
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-ABC',
      members: [{ member: { _id: 'm1', user: { _id: 'u1' } } }]
    };
    const aggregate = jest.fn(async () => []);
    await enrichRosterShiftCounts(roster, aggregate);
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.campId).toBe('camp-ABC');
    expect(pipeline[0].$match.userId.$in).toEqual(['u1']);
  });
});

describe('enrichRosterShiftCounts — shifts-only reminder passthrough', () => {
  test('preserves existing lastReminderAt on member', async () => {
    const now = new Date();
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: null, lastReminderAt: now } }
      ]
    };
    await enrichRosterShiftCounts(roster, async () => []);
    expect(roster.members[0].member.lastReminderAt).toBe(now);
  });

  test('defaults missing lastReminderAt to null', async () => {
    const roster = {
      rosterType: 'shifts_only',
      camp: 'camp-1',
      members: [
        { member: { _id: 'm1', user: null /* no lastReminderAt field */ } }
      ]
    };
    await enrichRosterShiftCounts(roster, async () => []);
    expect(roster.members[0].member.lastReminderAt).toBeNull();
  });
});
