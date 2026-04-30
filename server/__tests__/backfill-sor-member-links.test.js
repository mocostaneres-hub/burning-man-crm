/**
 * Tests for the SOR Member→User link backfill.
 *
 * The backfill is the recovery mechanism for users who signed up via
 * Google/Apple OAuth before commit 278ef98 (which fixed the OAuth route
 * to actually process inviteToken). Their User exists, but their Member
 * row's `user` field is null, so the camp roster keeps showing them as
 * "Invited". This pass scans for orphaned SOR Members and links them.
 *
 * We test against in-memory stubs instead of MongoDB so the suite is
 * fast and matches the rest of `server/__tests__/`. The stubs implement
 * just enough of the Mongoose Model API (`find`, `findOne`, `updateOne`)
 * to exercise every code path in `runBackfill`.
 */

const path = require('path');
const { runBackfill } = require(
  path.resolve(__dirname, '../startup/backfillSorMemberLinks.js')
);

/**
 * Tiny in-memory model factory — covers `find`, `findOne`, `updateOne`.
 * Filters are evaluated by a callback so each test can declare what
 * matches without re-implementing Mongo's query language.
 */
function makeModel(name, initialDocs = []) {
  const docs = initialDocs.map((d) => ({ ...d }));
  return {
    _name: name,
    _docs: docs,
    find: jest.fn((filter) => ({
      limit: () => ({
        lean: async () => docs.filter((d) => matchesFilter(d, filter, name))
      })
    })),
    findOne: jest.fn((filter) => ({
      lean: async () => docs.find((d) => matchesFilter(d, filter, name)) || null
    })),
    updateOne: jest.fn(async (filter, update) => {
      const idx = docs.findIndex((d) => matchesFilter(d, filter, name));
      if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
      const $set = update.$set || {};
      docs[idx] = { ...docs[idx], ...$set };
      return { matchedCount: 1, modifiedCount: 1 };
    })
  };
}

/**
 * Minimal filter matcher — handles only the operators the backfill uses:
 * direct equality, `$or` with `{$exists}`/`{$in}` clauses, and
 * `$in: [null, undefined]`.
 */
function matchesFilter(doc, filter, modelName) {
  for (const [k, v] of Object.entries(filter || {})) {
    if (k === '$or') {
      const orMatch = v.some((sub) => matchesFilter(doc, sub, modelName));
      if (!orMatch) return false;
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$exists' in v) {
        const has = Object.prototype.hasOwnProperty.call(doc, k) && doc[k] !== undefined;
        if (v.$exists && !has) return false;
        if (!v.$exists && has) return false;
        continue;
      }
      if ('$in' in v) {
        if (!v.$in.includes(doc[k])) return false;
        continue;
      }
    }
    if (doc[k] !== v) return false;
  }
  return true;
}

describe('runBackfill — happy path', () => {
  test('links Justin-shape SOR Member to its existing User and stamps the invite', async () => {
    // This is the exact data shape the Justin Thistle case had on
    // production: SOR Member with user=null, User exists with the
    // matching email, Invite was never marked applied.
    const Member = makeModel('Member', [
      {
        _id: 'm-justin',
        camp: 'camp-gallavant',
        email: 'djth1zl@gmail.com',
        isShiftsOnly: true,
        user: null,
        status: 'invited',
        inviteToken: 'tok-justin-001'
      }
    ]);
    const User = makeModel('User', [
      {
        _id: 'u-justin',
        email: 'djth1zl@gmail.com',
        firstName: 'Justin',
        lastName: 'Thistle',
        createdAt: new Date('2025-04-15')
      }
    ]);
    const Invite = makeModel('Invite', [
      {
        _id: 'inv-justin',
        token: 'tok-justin-001',
        campId: 'camp-gallavant',
        recipient: 'djth1zl@gmail.com',
        inviteType: 'shifts_only',
        status: 'sent',
        invitedUserId: null
      }
    ]);

    const summary = await runBackfill({ Member, User, Invite });

    expect(summary).toMatchObject({
      scanned: 1,
      linked: 1,
      skippedNoUser: 0,
      skippedNoEmail: 0,
      errors: 0
    });

    // Member.user populated, status flipped to active.
    const justinMember = Member._docs[0];
    expect(justinMember.user).toBe('u-justin');
    expect(justinMember.status).toBe('active');
    expect(justinMember.isShiftsOnly).toBe(true);
    expect(justinMember.signupSource).toBe('shifts_only_invite');
    expect(justinMember.joinedAt).toBeInstanceOf(Date);

    // Invite stamped applied.
    const justinInvite = Invite._docs[0];
    expect(justinInvite.invitedUserId).toBe('u-justin');
    expect(justinInvite.status).toBe('applied');
    expect(justinInvite.appliedBy).toBe('u-justin');
    expect(justinInvite.appliedAt).toBeInstanceOf(Date);

    // Sample carries enough info for ops debugging.
    expect(summary.linkedSamples).toHaveLength(1);
    expect(summary.linkedSamples[0]).toEqual({
      memberId: 'm-justin',
      email: 'djth1zl@gmail.com',
      userId: 'u-justin'
    });
  });

  test('preserves an existing joinedAt rather than overwriting', async () => {
    const existingJoinedAt = new Date('2024-12-01');
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: null,
        joinedAt: existingJoinedAt
      }
    ]);
    const User = makeModel('User', [
      { _id: 'u-1', email: 'foo@bar.com' }
    ]);
    const Invite = makeModel('Invite', []);

    await runBackfill({ Member, User, Invite });

    expect(Member._docs[0].joinedAt).toBe(existingJoinedAt);
  });

  test('preserves existing signupSource if Member already had one', async () => {
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: null,
        signupSource: 'csv_import' // Some legacy value
      }
    ]);
    const User = makeModel('User', [{ _id: 'u-1', email: 'foo@bar.com' }]);
    const Invite = makeModel('Invite', []);

    await runBackfill({ Member, User, Invite });

    expect(Member._docs[0].signupSource).toBe('csv_import');
  });

  test('normalises Member.email mixed-case for User lookup', async () => {
    // Old CSV imports stored emails verbatim; Users are always lowercased.
    // Backfill must bridge the two case worlds.
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: '   Mixed.Case@Example.COM ',
        isShiftsOnly: true,
        user: null
      }
    ]);
    const User = makeModel('User', [
      { _id: 'u-1', email: 'mixed.case@example.com' }
    ]);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.linked).toBe(1);
    expect(Member._docs[0].user).toBe('u-1');
  });
});

describe('runBackfill — guards and idempotency', () => {
  test('does NOT touch FMR members (isShiftsOnly !== true)', async () => {
    // FMR data must be left strictly alone — the only filter that the
    // initial scan applies is `isShiftsOnly: true`.
    const Member = makeModel('Member', [
      {
        _id: 'fmr-1',
        camp: 'c-1',
        email: 'fmr@x.com',
        isShiftsOnly: false,
        user: null
      }
    ]);
    const User = makeModel('User', [{ _id: 'u-1', email: 'fmr@x.com' }]);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.scanned).toBe(0);
    expect(summary.linked).toBe(0);
    expect(Member._docs[0].user).toBeNull(); // untouched
  });

  test('does NOT overwrite a Member that already has a user link', async () => {
    // Defence in depth: even if the initial filter goof'd, the updateOne
    // filter (`user: { $in: [null, undefined] }`) prevents the write.
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: 'u-already-linked'
      }
    ]);
    const User = makeModel('User', [
      { _id: 'u-different', email: 'foo@bar.com' }
    ]);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.scanned).toBe(0); // filter excludes already-linked
    expect(Member._docs[0].user).toBe('u-already-linked');
  });

  test('skips members with no email (cannot match a User)', async () => {
    const Member = makeModel('Member', [
      { _id: 'm-1', camp: 'c-1', email: '', isShiftsOnly: true, user: null },
      { _id: 'm-2', camp: 'c-1', email: '   ', isShiftsOnly: true, user: null }
    ]);
    const User = makeModel('User', []);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.scanned).toBe(2);
    expect(summary.skippedNoEmail).toBe(2);
    expect(summary.linked).toBe(0);
  });

  test('skips members where no User exists yet (still in flight)', async () => {
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'pending@x.com',
        isShiftsOnly: true,
        user: null
      }
    ]);
    const User = makeModel('User', []); // no matching user
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.skippedNoUser).toBe(1);
    expect(summary.linked).toBe(0);
    expect(Member._docs[0].user).toBeNull();
  });

  test('idempotent: a second run is a no-op once members are linked', async () => {
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: null
      }
    ]);
    const User = makeModel('User', [{ _id: 'u-1', email: 'foo@bar.com' }]);
    const Invite = makeModel('Invite', []);

    const first = await runBackfill({ Member, User, Invite });
    const second = await runBackfill({ Member, User, Invite });

    expect(first.linked).toBe(1);
    expect(second.scanned).toBe(0); // initial filter excludes linked rows
    expect(second.linked).toBe(0);
  });

  test('dryRun: summary is populated but no docs are mutated', async () => {
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: null
      }
    ]);
    const User = makeModel('User', [{ _id: 'u-1', email: 'foo@bar.com' }]);
    const Invite = makeModel('Invite', [
      {
        _id: 'inv-1',
        campId: 'c-1',
        recipient: 'foo@bar.com',
        inviteType: 'shifts_only',
        status: 'sent',
        invitedUserId: null
      }
    ]);

    const summary = await runBackfill({ Member, User, Invite }, { dryRun: true });
    expect(summary.linked).toBe(1);
    // Both docs left intact.
    expect(Member._docs[0].user).toBeNull();
    expect(Invite._docs[0].status).toBe('sent');
  });
});

describe('runBackfill — resilience', () => {
  test('a single bad row does not abort the run', async () => {
    // We place a poison row in the middle. updateOne for that row throws,
    // but the rows before and after should still be linked.
    const Member = makeModel('Member', [
      { _id: 'm-good-1', camp: 'c', email: 'a@x.com', isShiftsOnly: true, user: null },
      { _id: 'm-bad', camp: 'c', email: 'b@x.com', isShiftsOnly: true, user: null },
      { _id: 'm-good-2', camp: 'c', email: 'c@x.com', isShiftsOnly: true, user: null }
    ]);
    const originalUpdateOne = Member.updateOne;
    Member.updateOne = jest.fn(async (filter, update) => {
      if (filter._id === 'm-bad') throw new Error('mongo blip');
      return originalUpdateOne(filter, update);
    });
    const User = makeModel('User', [
      { _id: 'u-a', email: 'a@x.com' },
      { _id: 'u-b', email: 'b@x.com' },
      { _id: 'u-c', email: 'c@x.com' }
    ]);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });

    expect(summary.scanned).toBe(3);
    expect(summary.linked).toBe(2);
    expect(summary.errors).toBe(1);
    expect(Member._docs[0].user).toBe('u-a');
    expect(Member._docs[2].user).toBe('u-c');
  });

  test('initial scan failure returns early with errors=1', async () => {
    const Member = {
      find: jest.fn(() => {
        throw new Error('connection refused');
      })
    };
    const User = makeModel('User', []);
    const Invite = makeModel('Invite', []);

    const summary = await runBackfill({ Member, User, Invite });
    expect(summary.errors).toBe(1);
    expect(summary.scanned).toBe(0);
    expect(summary.linked).toBe(0);
  });

  test('invite stamping failure does not block Member link', async () => {
    // The Member-side write is the user-visible fix; the Invite stamp is
    // bookkeeping. If only the latter fails we still want the roster to
    // flip from "Invited" to "Active".
    const Member = makeModel('Member', [
      {
        _id: 'm-1',
        camp: 'c-1',
        email: 'foo@bar.com',
        isShiftsOnly: true,
        user: null,
        inviteToken: 'tok-1'
      }
    ]);
    const User = makeModel('User', [{ _id: 'u-1', email: 'foo@bar.com' }]);
    const Invite = makeModel('Invite', [
      {
        _id: 'inv-1',
        token: 'tok-1',
        invitedUserId: null,
        status: 'sent'
      }
    ]);
    Invite.updateOne = jest.fn(async () => {
      throw new Error('invite shard down');
    });

    const summary = await runBackfill({ Member, User, Invite });

    expect(summary.linked).toBe(1);
    expect(summary.errors).toBe(0); // invite errors are non-fatal warnings
    expect(Member._docs[0].user).toBe('u-1');
    expect(Member._docs[0].status).toBe('active');
  });
});
