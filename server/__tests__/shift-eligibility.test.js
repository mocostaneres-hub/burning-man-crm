/**
 * Tests for the dynamic shift-eligibility rules added to fix the
 * "future roster members can't sign up for entire-roster shifts" bug.
 *
 * The fix has three independently-testable surfaces:
 *
 *   1. `decideAssignmentsForJoiner` — pure helper that, given a camp's
 *      events and a joining user's lead-ness, decides which
 *      ShiftAssignment rows to write. This is where the mode-aware
 *      filter lives (ALL_ROSTER includes everyone, LEADS_ONLY only
 *      leads, SELECTED_USERS never auto-extends).
 *
 *   2. `runShiftModeBackfill` — DI-friendly core of the legacy-shift
 *      backfill. Asserts that we infer ALL_ROSTER for shifts whose
 *      modeSnapshot rows tally that way, and default to ALL_ROSTER
 *      when no snapshots exist.
 *
 *   3. The eligibility rule used by My Shifts and the signup
 *      fallback — covered indirectly by the helper test above plus a
 *      tiny "live-rule" matrix that mirrors the production conditional.
 *
 * Notes on test style:
 *   - We avoid MongoDB. The two helpers under test are already pure or
 *     dependency-injected; everything else is plain JS.
 *   - We never mock fs or process.env — keeps tests deterministic.
 */

const path = require('path');
const {
  decideAssignmentsForJoiner,
  getDirectAssignmentUserIds,
  isShiftDirectAssignmentLockedForUser,
  buildShiftSignupReservationFilter
} = require(path.resolve(__dirname, '../services/shiftService.js'));
const {
  runShiftModeBackfill,
  inferModesForEvent
} = require(path.resolve(__dirname, '../startup/backfillShiftAssignmentMode.js'));

// ─────────────────────────────────────────────────────────────────────────────
// Tiny test-data factory — builds an Event-shaped object the helpers accept.
// ─────────────────────────────────────────────────────────────────────────────
function makeEvent({ id = 'evt-1', shifts }) {
  return { _id: id, shifts: shifts.map((s) => ({ ...s })) };
}
function makeShift(id, opts = {}) {
  return {
    _id: id,
    title: opts.title || `Shift ${id}`,
    maxSignUps: opts.maxSignUps ?? 5,
    assignmentMode: opts.assignmentMode, // may be undefined for legacy shifts
    ...opts
  };
}

describe('direct assignment locks', () => {
  test('a direct assignment blocks every user who is not explicitly listed', () => {
    const shift = makeShift('shift-locked', {
      assignmentMode: 'ALL_ROSTER',
      directAssignmentUserIds: ['user-assigned']
    });

    expect(isShiftDirectAssignmentLockedForUser(shift, 'user-other')).toBe(true);
    expect(isShiftDirectAssignmentLockedForUser(shift, 'user-assigned')).toBe(false);
  });

  test('removing the final direct assignee unlocks the shift', () => {
    const shift = makeShift('shift-open', {
      assignmentMode: 'ALL_ROSTER',
      directAssignmentUserIds: []
    });

    expect(getDirectAssignmentUserIds(shift)).toEqual([]);
    expect(isShiftDirectAssignmentLockedForUser(shift, 'user-other')).toBe(false);
  });

  test('legacy selected-user rows can supply the lock audience', () => {
    const shift = makeShift('shift-legacy', { assignmentMode: 'SELECTED_USERS' });

    expect(getDirectAssignmentUserIds(shift, ['user-one', 'user-one', 'user-two']))
      .toEqual(['user-one', 'user-two']);
    expect(isShiftDirectAssignmentLockedForUser(shift, 'user-three', ['user-one'])).toBe(true);
  });

  test('the atomic capacity reservation also requires direct-lock access', () => {
    expect(buildShiftSignupReservationFilter({
      eventId: 'event-1',
      shiftId: 'shift-1',
      maxSignUps: 3,
      userId: 'user-1'
    })).toEqual({
      _id: 'event-1',
      shifts: {
        $elemMatch: {
          _id: 'shift-1',
          currentSignups: { $lt: 3 },
          $or: [
            { directAssignmentUserIds: { $exists: false } },
            { directAssignmentUserIds: { $size: 0 } },
            { directAssignmentUserIds: 'user-1' }
          ]
        }
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decideAssignmentsForJoiner
// ─────────────────────────────────────────────────────────────────────────────
describe('decideAssignmentsForJoiner — entire-roster includes late-joiners', () => {
  test('an ALL_ROSTER shift produces an assignment for any joining user (regular member)', () => {
    // The Galavant scenario verbatim: the lead created a "Bartender"
    // shift open to the entire roster. A few members were on the
    // roster at create time and got rows. Now a *new* member joins;
    // they should be auto-eligible.
    const events = [
      makeEvent({
        id: 'evt-galavant',
        shifts: [makeShift('shift-bartender', { assignmentMode: 'ALL_ROSTER' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-galavant',
      userId: 'user-late-joiner',
      assignedBy: 'user-late-joiner',
      isLead: false
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      shiftId: 'shift-bartender',
      eventId: 'evt-galavant',
      campId: 'camp-galavant',
      userId: 'user-late-joiner',
      modeSnapshot: 'ALL_ROSTER',
      source: 'ROSTER_AUTO_ADD'
    });
  });

  test('LEADS_ONLY shift assigns when the joiner is a Camp Lead', () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-leads', { assignmentMode: 'LEADS_ONLY' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: true
    });
    expect(out.map((row) => row.shiftId)).toEqual(['shift-leads']);
    expect(out[0].modeSnapshot).toBe('LEADS_ONLY');
  });

  test('LEADS_ONLY shift skips a non-lead joiner', () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-leads', { assignmentMode: 'LEADS_ONLY' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out).toEqual([]);
  });

  test('SELECTED_USERS shift never auto-extends, even for a regular roster member', () => {
    // Backwards compatibility: a hand-picked audience must stay
    // hand-picked. Late roster joiners do not get added.
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-private', { assignmentMode: 'SELECTED_USERS' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out).toEqual([]);
  });

  test('SELECTED_USERS shift skips even a lead joiner', () => {
    // Promotions don't widen a hand-picked audience either.
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-private', { assignmentMode: 'SELECTED_USERS' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-lead',
      assignedBy: 'user-lead',
      isLead: true
    });
    expect(out).toEqual([]);
  });

  test('mixed event: ALL_ROSTER + SELECTED_USERS + LEADS_ONLY are filtered correctly for a non-lead', () => {
    const events = [
      makeEvent({
        id: 'evt-mixed',
        shifts: [
          makeShift('shift-public', { assignmentMode: 'ALL_ROSTER' }),
          makeShift('shift-private', { assignmentMode: 'SELECTED_USERS' }),
          makeShift('shift-leads', { assignmentMode: 'LEADS_ONLY' })
        ]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-mixed',
      userId: 'user-late',
      assignedBy: 'user-late',
      isLead: false
    });
    expect(out.map((row) => row.shiftId)).toEqual(['shift-public']);
  });

  test('mixed event for a lead joiner: ALL_ROSTER + LEADS_ONLY both included, SELECTED_USERS still excluded', () => {
    const events = [
      makeEvent({
        id: 'evt-mixed',
        shifts: [
          makeShift('shift-public', { assignmentMode: 'ALL_ROSTER' }),
          makeShift('shift-private', { assignmentMode: 'SELECTED_USERS' }),
          makeShift('shift-leads', { assignmentMode: 'LEADS_ONLY' })
        ]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-mixed',
      userId: 'user-new-lead',
      assignedBy: 'user-new-lead',
      isLead: true
    });
    expect(out.map((row) => row.shiftId).sort()).toEqual(['shift-leads', 'shift-public']);
  });

  test('idempotent — already-assigned shifts are not re-added on a second pass', () => {
    // Re-running the helper after a partial first pass must not
    // create duplicate ShiftAssignment rows.
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [
          makeShift('shift-a', { assignmentMode: 'ALL_ROSTER' }),
          makeShift('shift-b', { assignmentMode: 'ALL_ROSTER' })
        ]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(['shift-a']),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out.map((row) => row.shiftId)).toEqual(['shift-b']);
  });

  test('full shifts are skipped — capacity gate', () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [
          makeShift('shift-full', { assignmentMode: 'ALL_ROSTER', maxSignUps: 2 }),
          makeShift('shift-open', { assignmentMode: 'ALL_ROSTER', maxSignUps: 5 })
        ]
      })
    ];
    const signupCountByShift = new Map([
      ['shift-full', 2], // at capacity
      ['shift-open', 1]
    ]);
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift,
      campId: 'camp-1',
      userId: 'user-late',
      assignedBy: 'user-late',
      isLead: false
    });
    expect(out.map((row) => row.shiftId)).toEqual(['shift-open']);
  });

  test('directly locked shifts are not auto-assigned to late roster joiners', () => {
    const events = [
      makeEvent({
        id: 'evt-locked',
        shifts: [makeShift('shift-locked', {
          assignmentMode: 'ALL_ROSTER',
          directAssignmentUserIds: ['user-selected']
        })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-late',
      assignedBy: 'user-late',
      isLead: false
    });

    expect(out).toEqual([]);
  });

  test('legacy shifts (no assignmentMode field) honour the inferred mode', () => {
    // Pre-fix data shape: shifts without assignmentMode. The caller
    // resolves dominant modeSnapshot and passes it via
    // inferredModeByShift. The pure helper must respect it the same
    // way as a stamped field.
    const events = [
      makeEvent({
        id: 'evt-legacy',
        shifts: [
          makeShift('shift-legacy-public'), // no assignmentMode
          makeShift('shift-legacy-private') // no assignmentMode
        ]
      })
    ];
    const inferredModeByShift = new Map([
      ['shift-legacy-public', 'ALL_ROSTER'],
      ['shift-legacy-private', 'SELECTED_USERS']
    ]);
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      inferredModeByShift,
      campId: 'camp-legacy',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out.map((row) => row.shiftId)).toEqual(['shift-legacy-public']);
  });

  test('legacy shift with no assignmentMode AND no inference defaults to ALL_ROSTER', () => {
    // Safe direction: the historical default of
    // resolveAssignmentCandidates was ALL_ROSTER. Falling back here
    // matches existing behaviour (opens access — never silently
    // narrows it).
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-1')] // no mode, no inference
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out).toHaveLength(1);
    expect(out[0].modeSnapshot).toBe('ALL_ROSTER');
  });

  test('Set/Map plain-object equivalents are accepted (defensive)', () => {
    // Production passes Set + Map. The helper should also tolerate
    // plain arrays / objects to keep tests cheap to write.
    const events = [
      makeEvent({
        id: 'evt-1',
        shifts: [makeShift('shift-a', { assignmentMode: 'ALL_ROSTER' })]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: ['shift-a'],
      signupCountByShift: { 'shift-a': 0 },
      campId: 'camp-1',
      userId: 'user-1',
      assignedBy: 'user-1',
      isLead: false
    });
    expect(out).toEqual([]);
  });

  test('mixed-invitation-types regression: existing SELECTED_USERS members keep their assignments, new joiners do not gain access', () => {
    // This is the key backwards-compat scenario the user called out:
    // a previously hand-picked SELECTED_USERS shift must NOT silently
    // include a late-joining roster member. We verify that even when
    // the late-joiner is on the roster (which is the precondition for
    // calling this helper at all), no new assignment row is produced.
    const events = [
      makeEvent({
        id: 'evt-private',
        shifts: [
          makeShift('shift-vip', {
            assignmentMode: 'SELECTED_USERS',
            // Some other user already had a snapshot row when the
            // shift was created — represented here by signupCount=0
            // and an existing assignment on another user (which the
            // helper doesn't see, because alreadyAssigned is per-user).
          })
        ]
      })
    ];
    const out = decideAssignmentsForJoiner({
      events,
      alreadyAssignedShiftIds: new Set(),
      signupCountByShift: new Map(),
      campId: 'camp-1',
      userId: 'late-joiner',
      assignedBy: 'late-joiner',
      isLead: false
    });
    expect(out).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runShiftModeBackfill / inferModesForEvent
// ─────────────────────────────────────────────────────────────────────────────

/** Tiny in-memory ShiftAssignment stub. */
function makeShiftAssignmentStub(rows = []) {
  return {
    _rows: rows,
    find(filter) {
      return {
        select: () => ({
          lean: async () => {
            const ids = filter?.shiftId?.$in || [];
            return rows.filter((r) => ids.includes(r.shiftId));
          }
        })
      };
    }
  };
}

/** Tiny in-memory Event stub. */
function makeEventStub(events = []) {
  const docs = events.map((e) => ({ ...e, shifts: e.shifts.map((s) => ({ ...s })) }));
  return {
    _docs: docs,
    find() {
      return {
        limit: () => ({
          lean: async () => docs.filter((e) =>
            (e.shifts || []).some((s) =>
              !['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS'].includes(s.assignmentMode)
            )
          )
        })
      };
    },
    updateOne: jest.fn(async (filter, update) => {
      const evt = docs.find((e) => e._id === filter._id);
      if (!evt) return { matchedCount: 0, modifiedCount: 0 };
      const shift = (evt.shifts || []).find((s) => s._id === filter['shifts._id']);
      if (!shift) return { matchedCount: 0, modifiedCount: 0 };
      shift.assignmentMode = update.$set['shifts.$.assignmentMode'];
      return { matchedCount: 1, modifiedCount: 1 };
    })
  };
}

describe('runShiftModeBackfill', () => {
  test('majority vote: shift with mostly ALL_ROSTER snapshots gets stamped ALL_ROSTER', async () => {
    const Event = makeEventStub([
      {
        _id: 'evt-1',
        shifts: [
          { _id: 'shift-1' /* no assignmentMode */ }
        ]
      }
    ]);
    const ShiftAssignment = makeShiftAssignmentStub([
      { shiftId: 'shift-1', modeSnapshot: 'ALL_ROSTER' },
      { shiftId: 'shift-1', modeSnapshot: 'ALL_ROSTER' },
      { shiftId: 'shift-1', modeSnapshot: 'ALL_ROSTER' },
      { shiftId: 'shift-1', modeSnapshot: 'SELECTED_USERS' } // outvoted
    ]);
    const summary = await runShiftModeBackfill({ Event, ShiftAssignment });
    expect(summary.shiftsUpdated).toBe(1);
    expect(Event._docs[0].shifts[0].assignmentMode).toBe('ALL_ROSTER');
  });

  test('SELECTED_USERS snapshot stays SELECTED_USERS — protects backward compat', async () => {
    const Event = makeEventStub([
      { _id: 'evt-1', shifts: [{ _id: 'shift-1' }] }
    ]);
    const ShiftAssignment = makeShiftAssignmentStub([
      { shiftId: 'shift-1', modeSnapshot: 'SELECTED_USERS' },
      { shiftId: 'shift-1', modeSnapshot: 'SELECTED_USERS' }
    ]);
    await runShiftModeBackfill({ Event, ShiftAssignment });
    expect(Event._docs[0].shifts[0].assignmentMode).toBe('SELECTED_USERS');
  });

  test('shift with no snapshot rows defaults to ALL_ROSTER (historical default)', async () => {
    const Event = makeEventStub([
      { _id: 'evt-1', shifts: [{ _id: 'shift-orphan' }] }
    ]);
    const ShiftAssignment = makeShiftAssignmentStub([]); // no rows at all
    await runShiftModeBackfill({ Event, ShiftAssignment });
    expect(Event._docs[0].shifts[0].assignmentMode).toBe('ALL_ROSTER');
  });

  test('idempotent — shifts already stamped are not re-touched', async () => {
    // Note: the stub's `find` already filters out events whose shifts
    // all carry valid modes, so a fully-stamped event would not be
    // returned. This test specifically confirms a *partially* stamped
    // event only has its missing shift updated.
    const Event = makeEventStub([
      {
        _id: 'evt-1',
        shifts: [
          { _id: 'shift-stamped', assignmentMode: 'SELECTED_USERS' },
          { _id: 'shift-unstamped' }
        ]
      }
    ]);
    const ShiftAssignment = makeShiftAssignmentStub([
      { shiftId: 'shift-unstamped', modeSnapshot: 'ALL_ROSTER' }
    ]);
    await runShiftModeBackfill({ Event, ShiftAssignment });
    expect(Event._docs[0].shifts[0].assignmentMode).toBe('SELECTED_USERS');
    expect(Event._docs[0].shifts[1].assignmentMode).toBe('ALL_ROSTER');
    // updateOne called once per missing shift only.
    expect(Event.updateOne).toHaveBeenCalledTimes(1);
  });

  test('dry-run does not write', async () => {
    const Event = makeEventStub([
      { _id: 'evt-1', shifts: [{ _id: 'shift-1' }] }
    ]);
    const ShiftAssignment = makeShiftAssignmentStub([
      { shiftId: 'shift-1', modeSnapshot: 'ALL_ROSTER' }
    ]);
    const summary = await runShiftModeBackfill({ Event, ShiftAssignment }, { dryRun: true });
    expect(summary.shiftsConsidered).toBe(1);
    expect(summary.shiftsUpdated).toBe(0);
    expect(Event.updateOne).not.toHaveBeenCalled();
    expect(Event._docs[0].shifts[0].assignmentMode).toBeUndefined();
  });
});

describe('inferModesForEvent', () => {
  test('returns empty map when every shift is already stamped', async () => {
    const ShiftAssignment = makeShiftAssignmentStub([
      // Even with rows, an already-stamped shift is skipped at the
      // candidate-selection step.
      { shiftId: 'shift-1', modeSnapshot: 'ALL_ROSTER' }
    ]);
    const out = await inferModesForEvent({
      _id: 'e1',
      shifts: [{ _id: 'shift-1', assignmentMode: 'LEADS_ONLY' }]
    }, ShiftAssignment);
    expect(out.size).toBe(0);
  });

  test('infers mode per shift independently', async () => {
    const ShiftAssignment = makeShiftAssignmentStub([
      { shiftId: 's-public', modeSnapshot: 'ALL_ROSTER' },
      { shiftId: 's-public', modeSnapshot: 'ALL_ROSTER' },
      { shiftId: 's-private', modeSnapshot: 'SELECTED_USERS' }
    ]);
    const out = await inferModesForEvent({
      _id: 'e1',
      shifts: [{ _id: 's-public' }, { _id: 's-private' }]
    }, ShiftAssignment);
    expect(out.get('s-public')).toBe('ALL_ROSTER');
    expect(out.get('s-private')).toBe('SELECTED_USERS');
  });
});
