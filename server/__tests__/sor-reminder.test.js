/**
 * Tests for the Shifts-Only Roster (SOR) reminder flow.
 *
 * These target the pure-function parts of `server/routes/rosters.js` that
 * power `POST /api/rosters/:rosterId/members/:memberId/remind` and the
 * bulk variant. We inline the helpers and the core `sendSorReminder`
 * orchestration so the suite runs without an Express server or MongoDB —
 * same style as `import-csv.test.js`.
 *
 * Coverage:
 *   - 24h cooldown enforcement (REMINDER_COOLDOWN_MS math)
 *   - "Active vs Invited" routing (which email variant is built)
 *   - Email body builders (subject/text/html content guarantees)
 *   - Persisted fields (Member.findByIdAndUpdate called with lastReminderAt)
 *   - Skip reasons (no email) and failure paths (email send throws)
 *   - Bulk summary aggregation (sent / cooldown / skipped / failed)
 *
 * These MUST stay in sync with the route code. Any change to the cooldown
 * duration, status detection, or email payloads needs to be reflected here.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inlined helpers — copied verbatim from server/routes/rosters.js.
// ─────────────────────────────────────────────────────────────────────────────
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function buildInvitedReminderEmail(campName, signupUrl) {
  const subject = `Friendly reminder: ${campName} invited you to sign up for shifts`;
  const text =
    `Hi! This is a friendly reminder that ${campName} invited you to sign up ` +
    `for volunteer shifts. Your invite is still active.\n\n` +
    `Create your account and browse shifts: ${signupUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Friendly reminder: ${campName} invited you to sign up for shifts</h2>
      <p>Hi! This is a friendly reminder that <strong>${campName}</strong> invited you to sign up for volunteer shifts. Your invite link is still active and we'd love to have you join.</p>
      <p><a href="${signupUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Create Account and View Shifts</a></p>
      <p style="color: #666; font-size: 13px;">If you've already signed up, you can ignore this email.</p>
    </div>
  `;
  return { subject, text, html };
}

function buildActiveReminderEmail(campName, shiftsUrl) {
  const subject = `Reminder: Sign up for shifts at ${campName}`;
  const text =
    `Hi! ${campName} still has volunteer shifts available and we'd love your help ` +
    `filling them.\n\nBrowse and sign up: ${shiftsUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reminder: Sign up for shifts at ${campName}</h2>
      <p>Hi! <strong>${campName}</strong> still has volunteer shifts available and we'd love your help filling them.</p>
      <p><a href="${shiftsUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Browse and Sign Up for Shifts</a></p>
      <p style="color: #666; font-size: 13px;">You can sign up for multiple shifts — every hour helps.</p>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Mirror of sendSorReminder from server/routes/rosters.js — dependencies
 * (db, sendEmail, recordActivity, crypto) are injected so the test can
 * observe their invocations and control their outcomes.
 */
async function sendSorReminder({
  member,
  camp,
  Member,
  reqUser,
  sendEmail,
  recordActivity = async () => {},
  createInvite = async () => {},
  genToken = () => 'test-token-xyz',
  clientUrl = 'https://g8road.com'
}) {
  const now = new Date();

  if (member.lastReminderAt) {
    const elapsed = now.getTime() - new Date(member.lastReminderAt).getTime();
    if (elapsed < REMINDER_COOLDOWN_MS) {
      const nextAllowedAt = new Date(
        new Date(member.lastReminderAt).getTime() + REMINDER_COOLDOWN_MS
      );
      return {
        memberId: member._id,
        email: member.email,
        status: 'cooldown',
        nextAllowedAt,
        reason: 'Reminder was sent within the last 24 hours'
      };
    }
  }

  if (!member.email) {
    return { memberId: member._id, status: 'skipped', reason: 'Member has no email address' };
  }

  const campName = camp.name || camp.campName || 'Your camp';
  const isActive = !!member.user;
  let emailPayload;

  try {
    if (isActive) {
      const shiftsUrl = `${clientUrl}/my-shifts?campId=${camp._id}`;
      emailPayload = buildActiveReminderEmail(campName, shiftsUrl);
    } else {
      let token = member.inviteToken;
      if (!token) {
        token = genToken();
        await createInvite({
          campId: camp._id,
          senderId: reqUser._id,
          recipient: member.email,
          method: 'email',
          token,
          status: 'sent',
          inviteType: 'shifts_only',
          signupSource: 'shifts_only_invite',
          memberId: member._id
        });
        await Member.findByIdAndUpdate(member._id, {
          $set: {
            inviteToken: token,
            invitedAt: now,
            status: 'invited',
            isShiftsOnly: true,
            signupSource: 'shifts_only_invite'
          }
        });
      }
      const signupUrl = `${clientUrl}/apply?invite_token=${token}`;
      emailPayload = buildInvitedReminderEmail(campName, signupUrl);
    }

    await sendEmail({
      to: member.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text
    });

    await Member.findByIdAndUpdate(member._id, { $set: { lastReminderAt: now } });

    try {
      await recordActivity('MEMBER', member._id, reqUser._id, 'REMINDER_SENT', {
        campId: camp._id,
        reminderType: isActive ? 'shift_signup' : 'invite',
        field: 'reminder',
        recipient: member.email,
        note: isActive
          ? 'Reminder to claim a shift sent to active SOR member'
          : 'Friendly re-invite reminder sent to pending SOR member'
      });
    } catch {
      /* non-fatal */
    }

    return {
      memberId: member._id,
      email: member.email,
      status: 'sent',
      reminderType: isActive ? 'shift_signup' : 'invite',
      lastReminderAt: now
    };
  } catch (err) {
    return {
      memberId: member._id,
      email: member.email,
      status: 'failed',
      reason: err?.message || 'Email send failed'
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────
function makeMemberFixture(overrides = {}) {
  return {
    _id: 'mem-1',
    email: 'alice@example.com',
    user: null,           // default: Invited
    inviteToken: 'abc123',
    lastReminderAt: null,
    ...overrides
  };
}

function makeCampFixture(overrides = {}) {
  return {
    _id: 'camp-1',
    name: 'Camp Dusty',
    ...overrides
  };
}

function makeReqUser(overrides = {}) {
  return { _id: 'user-admin', ...overrides };
}

/**
 * Minimal Member stub that captures findByIdAndUpdate calls.
 */
function makeMemberStub() {
  const calls = [];
  return {
    findByIdAndUpdate: jest.fn(async (id, update) => {
      calls.push({ id, update });
      return { _id: id };
    }),
    _calls: calls
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Email body builders
// ─────────────────────────────────────────────────────────────────────────────
describe('buildInvitedReminderEmail', () => {
  test('subject uses "Friendly reminder" language', () => {
    const { subject } = buildInvitedReminderEmail('Camp Dusty', 'https://x.com');
    expect(subject).toMatch(/friendly reminder/i);
    expect(subject).toContain('Camp Dusty');
  });

  test('html contains the signup URL as an href', () => {
    const { html } = buildInvitedReminderEmail('Camp Dusty', 'https://g8road.com/apply?invite_token=T');
    expect(html).toContain('href="https://g8road.com/apply?invite_token=T"');
  });

  test('text includes the signup URL', () => {
    const { text } = buildInvitedReminderEmail('Camp Dusty', 'https://g8road.com/apply?invite_token=T');
    expect(text).toContain('https://g8road.com/apply?invite_token=T');
  });
});

describe('buildActiveReminderEmail', () => {
  test('subject targets shift signup', () => {
    const { subject } = buildActiveReminderEmail('Camp Dusty', 'https://x.com');
    expect(subject).toMatch(/sign up for shifts/i);
    expect(subject).toContain('Camp Dusty');
  });

  test('html links to the shifts URL', () => {
    const { html } = buildActiveReminderEmail('Camp Dusty', 'https://g8road.com/my-shifts?campId=camp-1');
    expect(html).toContain('href="https://g8road.com/my-shifts?campId=camp-1"');
  });

  test('does NOT use "Friendly reminder" language (that is the invited variant)', () => {
    const { subject, html } = buildActiveReminderEmail('Camp Dusty', 'https://x.com');
    expect(subject).not.toMatch(/friendly reminder/i);
    expect(html).not.toMatch(/friendly reminder/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown enforcement
// ─────────────────────────────────────────────────────────────────────────────
describe('sendSorReminder — cooldown enforcement', () => {
  test('returns cooldown when lastReminderAt is within 24h', async () => {
    const member = makeMemberFixture({
      lastReminderAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    });
    const sendEmail = jest.fn();
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail
    });

    expect(result.status).toBe('cooldown');
    expect(result.nextAllowedAt).toBeInstanceOf(Date);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('allows send when lastReminderAt is older than 24h', async () => {
    const member = makeMemberFixture({
      lastReminderAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
    });
    const sendEmail = jest.fn(async () => ({ ok: true }));
    const Member = makeMemberStub();
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member,
      reqUser: makeReqUser(),
      sendEmail
    });

    expect(result.status).toBe('sent');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(Member.findByIdAndUpdate).toHaveBeenCalledWith(
      'mem-1',
      expect.objectContaining({ $set: expect.objectContaining({ lastReminderAt: expect.any(Date) }) })
    );
  });

  test('nextAllowedAt is exactly 24h after lastReminderAt', async () => {
    const last = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const member = makeMemberFixture({ lastReminderAt: last });
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail: jest.fn()
    });

    expect(result.status).toBe('cooldown');
    expect(result.nextAllowedAt.getTime()).toBe(last.getTime() + REMINDER_COOLDOWN_MS);
  });

  test('null lastReminderAt never blocks', async () => {
    const member = makeMemberFixture({ lastReminderAt: null });
    const sendEmail = jest.fn(async () => ({}));
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail
    });
    expect(result.status).toBe('sent');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status branching: Active vs Invited
// ─────────────────────────────────────────────────────────────────────────────
describe('sendSorReminder — active vs invited routing', () => {
  test('Invited member (no user) → friendly reminder email with signup link', async () => {
    const member = makeMemberFixture({ user: null, inviteToken: 'tok-123' });
    const sendEmail = jest.fn(async () => ({}));
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail,
      clientUrl: 'https://g8road.com'
    });

    expect(result.status).toBe('sent');
    expect(result.reminderType).toBe('invite');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toMatch(/friendly reminder/i);
    expect(call.html).toContain('/apply?invite_token=tok-123');
    expect(call.text).toContain('/apply?invite_token=tok-123');
  });

  test('Active member (has user) → shift signup reminder with /my-shifts link', async () => {
    const member = makeMemberFixture({ user: 'user-99' });
    const sendEmail = jest.fn(async () => ({}));
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture({ _id: 'camp-xyz' }),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail,
      clientUrl: 'https://g8road.com'
    });

    expect(result.status).toBe('sent');
    expect(result.reminderType).toBe('shift_signup');
    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toMatch(/sign up for shifts/i);
    expect(call.subject).not.toMatch(/friendly reminder/i);
    expect(call.html).toContain('/my-shifts?campId=camp-xyz');
  });

  test('Invited member without inviteToken → regenerates token and persists it', async () => {
    const member = makeMemberFixture({ user: null, inviteToken: null });
    const sendEmail = jest.fn(async () => ({}));
    const createInvite = jest.fn(async () => ({}));
    const Member = makeMemberStub();
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member,
      reqUser: makeReqUser(),
      sendEmail,
      createInvite,
      genToken: () => 'regenerated-xyz'
    });

    expect(result.status).toBe('sent');
    expect(createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'regenerated-xyz',
        inviteType: 'shifts_only',
        memberId: 'mem-1',
        recipient: 'alice@example.com'
      })
    );
    // Member should have two updates: one to persist the invite, one to stamp lastReminderAt
    expect(Member.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(Member._calls[0].update.$set.inviteToken).toBe('regenerated-xyz');
    expect(Member._calls[1].update.$set.lastReminderAt).toBeInstanceOf(Date);
    // The email link should use the newly generated token
    const call = sendEmail.mock.calls[0][0];
    expect(call.html).toContain('/apply?invite_token=regenerated-xyz');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Skip / failure paths
// ─────────────────────────────────────────────────────────────────────────────
describe('sendSorReminder — edge cases', () => {
  test('member with no email → skipped', async () => {
    const member = makeMemberFixture({ email: '' });
    const sendEmail = jest.fn();
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member: makeMemberStub(),
      reqUser: makeReqUser(),
      sendEmail
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toMatch(/no email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('sendEmail throws → returns failed status and does NOT stamp lastReminderAt', async () => {
    const member = makeMemberFixture({ user: 'user-1' });
    const sendEmail = jest.fn(async () => { throw new Error('SMTP timeout'); });
    const Member = makeMemberStub();
    const result = await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member,
      reqUser: makeReqUser(),
      sendEmail
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('SMTP timeout');
    // CRITICAL: a failed send must NOT consume the cooldown window.
    const lastReminderUpdates = Member._calls.filter((c) => c.update?.$set?.lastReminderAt);
    expect(lastReminderUpdates).toHaveLength(0);
  });

  test('successful send stamps lastReminderAt exactly once', async () => {
    const member = makeMemberFixture({ user: 'user-1' });
    const sendEmail = jest.fn(async () => ({}));
    const Member = makeMemberStub();
    await sendSorReminder({
      member,
      camp: makeCampFixture(),
      Member,
      reqUser: makeReqUser(),
      sendEmail
    });
    const lastReminderUpdates = Member._calls.filter((c) => c.update?.$set?.lastReminderAt);
    expect(lastReminderUpdates).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bulk orchestration (result aggregation)
// ─────────────────────────────────────────────────────────────────────────────
describe('bulk reminder — result aggregation', () => {
  /** Simulate the route's bulk loop to verify summary shape. */
  async function runBulk(members, { sendEmailImpl } = {}) {
    const results = [];
    const Member = makeMemberStub();
    for (const m of members) {
      const result = await sendSorReminder({
        member: m,
        camp: makeCampFixture(),
        Member,
        reqUser: makeReqUser(),
        sendEmail: sendEmailImpl || (async () => ({}))
      });
      results.push(result);
    }
    return {
      results,
      summary: {
        sent: results.filter((r) => r.status === 'sent').length,
        cooldown: results.filter((r) => r.status === 'cooldown').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length,
        total: results.length
      }
    };
  }

  test('mixed batch: sent + cooldown + skipped + failed', async () => {
    const members = [
      makeMemberFixture({ _id: 'm1', email: 'a@x.com' }), // will send
      makeMemberFixture({                                  // cooldown
        _id: 'm2',
        email: 'b@x.com',
        lastReminderAt: new Date(Date.now() - 5 * 60 * 1000)
      }),
      makeMemberFixture({ _id: 'm3', email: '' }),        // skipped
      makeMemberFixture({ _id: 'm4', email: 'd@x.com' })  // will fail
    ];

    let call = 0;
    const sendEmailImpl = async () => {
      call += 1;
      // First send (m1) succeeds, second send (m4, after skips) fails.
      if (call === 2) throw new Error('bounce');
      return {};
    };

    const { summary } = await runBulk(members, { sendEmailImpl });
    expect(summary).toEqual({ sent: 1, cooldown: 1, skipped: 1, failed: 1, total: 4 });
  });

  test('all-cooldown batch sends zero emails', async () => {
    const members = [
      makeMemberFixture({ _id: 'm1', lastReminderAt: new Date() }),
      makeMemberFixture({ _id: 'm2', lastReminderAt: new Date() })
    ];
    const sendEmail = jest.fn();
    const { summary } = await runBulk(members, { sendEmailImpl: sendEmail });
    expect(summary).toEqual({ sent: 0, cooldown: 2, skipped: 0, failed: 0, total: 2 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('empty batch produces zero counts', async () => {
    const { summary } = await runBulk([]);
    expect(summary).toEqual({ sent: 0, cooldown: 0, skipped: 0, failed: 0, total: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Roster-ID validation math (pure, no DB)
// ─────────────────────────────────────────────────────────────────────────────
describe('bulk reminder — roster membership validation', () => {
  /** Mirrors the validation step in POST /bulk-remind. */
  function splitByRosterMembership(submittedIds, rosterMemberIdSet) {
    const valid = submittedIds.filter((id) => rosterMemberIdSet.has(id.toString()));
    const invalid = submittedIds.filter((id) => !rosterMemberIdSet.has(id.toString()));
    return { valid, invalid };
  }

  test('partitions IDs into valid / invalid relative to roster', () => {
    const rosterSet = new Set(['m1', 'm2', 'm3']);
    const { valid, invalid } = splitByRosterMembership(['m1', 'm9', 'm2', 'rogue'], rosterSet);
    expect(valid).toEqual(['m1', 'm2']);
    expect(invalid).toEqual(['m9', 'rogue']);
  });

  test('empty roster rejects all submitted IDs', () => {
    const { valid, invalid } = splitByRosterMembership(['m1', 'm2'], new Set());
    expect(valid).toEqual([]);
    expect(invalid).toEqual(['m1', 'm2']);
  });
});
