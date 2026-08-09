const db = require('../database/databaseAdapter');
const Event = require('../models/Event');
const ShiftAssignment = require('../models/ShiftAssignment');
const ShiftSignup = require('../models/ShiftSignup');
const { createBulkNotifications } = require('./notificationService');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

function shiftTimesOverlap(firstShift, secondShift) {
  const firstStart = new Date(firstShift?.startTime).getTime();
  const firstEnd = new Date(firstShift?.endTime).getTime();
  const secondStart = new Date(secondShift?.startTime).getTime();
  const secondEnd = new Date(secondShift?.endTime).getTime();

  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)) {
    return false;
  }

  // A shift ending exactly when another begins is allowed.
  return firstStart < secondEnd && secondStart < firstEnd;
}

function findShiftTimeConflict(candidateShift, scheduledShifts = []) {
  const candidateId = normalizeId(candidateShift?._id || candidateShift?.shiftId);

  return scheduledShifts.find((scheduledShift) => {
    const scheduledId = normalizeId(scheduledShift?._id || scheduledShift?.shiftId);
    if (candidateId && scheduledId === candidateId) return false;
    if (scheduledShift?.status === 'cancelled') return false;
    return shiftTimesOverlap(candidateShift, scheduledShift);
  }) || null;
}

function areEventShiftDropsLocked(event) {
  return event?.shiftDropsLocked === true;
}

async function findShiftTimeConflictForUser({
  userId,
  legacyMemberIds = [],
  candidateShift
}) {
  const signupRows = await ShiftSignup.find({ userId })
    .select('shiftId eventId')
    .lean();
  const signedShiftIds = new Set(
    signupRows.map((row) => normalizeId(row.shiftId)).filter(Boolean)
  );
  const eventIds = [
    ...new Set(signupRows.map((row) => normalizeId(row.eventId)).filter(Boolean))
  ];
  const embeddedIdentityIds = [
    ...new Set([userId, ...legacyMemberIds].map(normalizeId).filter(Boolean))
  ];
  const ownershipConditions = [];

  if (eventIds.length > 0) {
    ownershipConditions.push({ _id: { $in: eventIds } });
  }
  if (embeddedIdentityIds.length > 0) {
    ownershipConditions.push({ 'shifts.memberIds': { $in: embeddedIdentityIds } });
  }
  if (ownershipConditions.length === 0) return null;

  const events = await Event.find({
    status: { $ne: 'cancelled' },
    $or: ownershipConditions
  }).select('eventName shifts').lean();

  const scheduledShifts = [];
  for (const event of events) {
    for (const shift of event.shifts || []) {
      const shiftId = normalizeId(shift._id);
      const isCanonicalSignup = signedShiftIds.has(shiftId);
      const isLegacySignup = (shift.memberIds || []).some((memberId) =>
        embeddedIdentityIds.includes(normalizeId(memberId))
      );
      if (!isCanonicalSignup && !isLegacySignup) continue;

      scheduledShifts.push({
        ...shift,
        eventId: event._id,
        eventName: event.eventName
      });
    }
  }

  return findShiftTimeConflict(candidateShift, scheduledShifts);
}

function getDirectAssignmentUserIds(shift, fallbackUserIds = []) {
  const embeddedIds = (shift?.directAssignmentUserIds || [])
    .map((id) => normalizeId(id))
    .filter(Boolean);
  const sourceIds = embeddedIds.length > 0 ? embeddedIds : fallbackUserIds;
  return [...new Set((sourceIds || []).map((id) => normalizeId(id)).filter(Boolean))];
}

function hasExclusiveDirectAssignmentLock(shift, fallbackUserIds = []) {
  const directUserIds = getDirectAssignmentUserIds(shift, fallbackUserIds);
  if (directUserIds.length === 0) return false;

  // Broad invite modes apply only to the unfilled capacity. Direct assignees
  // keep their confirmed spots, but they do not block other eligible members.
  // A missing mode with direct IDs is treated as a legacy exclusive shift.
  return !shift?.assignmentMode || shift.assignmentMode === 'SELECTED_USERS';
}

function isShiftDirectAssignmentLockedForUser(shift, userId, fallbackUserIds = []) {
  if (!hasExclusiveDirectAssignmentLock(shift, fallbackUserIds)) return false;
  const directUserIds = getDirectAssignmentUserIds(shift, fallbackUserIds);
  return !directUserIds.includes(normalizeId(userId));
}

function buildShiftSignupReservationFilter({
  eventId,
  shiftId,
  maxSignUps,
  userId,
  assignmentMode
}) {
  const shiftFilter = {
    _id: shiftId,
    currentSignups: { $lt: maxSignUps }
  };

  // Keep the direct-assignment audience check in the same atomic reservation
  // only for exclusive/legacy shifts. ALL_ROSTER and LEADS_ONLY leave their
  // remaining capacity open even when some spots were directly assigned.
  if (!assignmentMode || assignmentMode === 'SELECTED_USERS') {
    shiftFilter.$or = [
      { directAssignmentUserIds: { $exists: false } },
      { directAssignmentUserIds: { $size: 0 } },
      { directAssignmentUserIds: userId }
    ];
  }

  return {
    _id: eventId,
    shifts: {
      $elemMatch: shiftFilter
    }
  };
}

function buildDirectAssignmentReservationPlan({
  requestedUserIds = [],
  signupUserIds = [],
  legacyMemberIds = [],
  currentSignups = 0,
  maxSignUps = 0
}) {
  const requested = [...new Set(requestedUserIds.map(normalizeId).filter(Boolean))];
  const signupSet = new Set(signupUserIds.map(normalizeId).filter(Boolean));
  const reservedSet = new Set([
    ...signupSet,
    ...legacyMemberIds.map(normalizeId).filter(Boolean)
  ]);
  const occupiedCount = Math.max(
    reservedSet.size,
    Number.isFinite(Number(currentSignups)) ? Number(currentSignups) : 0
  );
  const availableSpots = Math.max(Number(maxSignUps || 0) - occupiedCount, 0);
  const userIdsNeedingReservation = requested.filter((userId) => !reservedSet.has(userId));

  return {
    requestedUserIds: requested,
    signupUserIds: signupSet,
    occupiedCount,
    availableSpots,
    userIdsNeedingReservation,
    canReserve: userIdsNeedingReservation.length <= availableSpots
  };
}

function shouldReconcileShiftAssignments({
  isNewShift = false,
  existingMode,
  incomingMode,
  existingSelectedUserIds = [],
  incomingSelectedUserIds,
  incomingDirectAssignmentUserIds,
  manualAddIds = [],
  manualRemoveIds = []
}) {
  if (isNewShift) return true;

  const persistedMode = existingMode || 'ALL_ROSTER';
  const requestedMode = incomingMode || persistedMode;
  if (requestedMode !== persistedMode) return true;

  if (
    requestedMode !== 'SELECTED_USERS' &&
    ((manualAddIds || []).length > 0 || (manualRemoveIds || []).length > 0)
  ) {
    return true;
  }

  const incomingSelection = requestedMode === 'SELECTED_USERS'
    ? (Array.isArray(incomingSelectedUserIds)
      ? incomingSelectedUserIds
      : (Array.isArray(incomingDirectAssignmentUserIds)
        ? incomingDirectAssignmentUserIds
        : null))
    : (Array.isArray(incomingDirectAssignmentUserIds)
      ? incomingDirectAssignmentUserIds
      : null);
  if (incomingSelection === null) {
    return false;
  }

  const existingIds = new Set(
    (existingSelectedUserIds || []).map(normalizeId).filter(Boolean)
  );
  const incomingIds = new Set(incomingSelection.map(normalizeId).filter(Boolean));
  if (existingIds.size !== incomingIds.size) return true;

  for (const userId of existingIds) {
    if (!incomingIds.has(userId)) return true;
  }
  return false;
}

function mergeDirectAssignmentUserIdsForUpdate({
  assignmentMode,
  hasExplicitSelectedUsers = false,
  assignmentCandidates = [],
  existingDirectAssignmentUserIds = [],
  validatedIncomingDirectAssignmentUserIds = []
}) {
  if (assignmentMode === 'SELECTED_USERS' && hasExplicitSelectedUsers) {
    return [...new Set(
      assignmentCandidates.map(normalizeId).filter(Boolean)
    )];
  }

  // In broad modes, changing the invitation audience must never implicitly
  // unassign a confirmed person. Explicit removals go through the unassign
  // endpoint so the reserved signup and counter are released together.
  return [...new Set([
    ...existingDirectAssignmentUserIds.map(normalizeId).filter(Boolean),
    ...validatedIncomingDirectAssignmentUserIds.map(normalizeId).filter(Boolean)
  ])];
}

async function getPersistedShift(eventId, shiftId) {
  const event = await Event.findOne({
    _id: eventId,
    'shifts._id': shiftId
  }).select('shifts').lean();
  return (event?.shifts || []).find((shift) => normalizeId(shift._id) === normalizeId(shiftId)) || null;
}

/**
 * Converts manager-selected assignees into real signups immediately. The
 * direct-assignment marker must already contain these users. SELECTED_USERS
 * enforces it as an exclusive lock; broad modes compete atomically only for
 * the capacity that remains.
 */
async function reserveShiftSpotsForUsers({ eventId, shiftId, campId, userIds = [] }) {
  const requestedUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  if (requestedUserIds.length === 0) {
    return { confirmedUserIds: [], newlyReservedUserIds: [] };
  }

  const [shift, signupRows] = await Promise.all([
    getPersistedShift(eventId, shiftId),
    ShiftSignup.find({ shiftId }).select('userId').lean()
  ]);
  if (!shift) {
    const error = new Error('Shift not found while reserving direct assignments');
    error.code = 'SHIFT_NOT_FOUND';
    throw error;
  }

  const plan = buildDirectAssignmentReservationPlan({
    requestedUserIds,
    signupUserIds: signupRows.map((row) => row.userId),
    legacyMemberIds: shift.memberIds || [],
    currentSignups: shift.currentSignups,
    maxSignUps: shift.maxSignUps
  });
  if (!plan.canReserve) {
    const error = new Error(
      `Only ${plan.availableSpots} shift spot(s) remain, but ${plan.userIdsNeedingReservation.length} new reservation(s) were requested.`
    );
    error.code = 'SHIFT_CAPACITY_EXCEEDED';
    error.statusCode = 409;
    error.availableSpots = plan.availableSpots;
    throw error;
  }

  // Heal a stale embedded counter before taking new capacity. This only raises
  // the counter, so it cannot overwrite a concurrent reservation.
  await Event.updateOne(
    { _id: eventId, 'shifts._id': shiftId },
    { $max: { 'shifts.$.currentSignups': plan.occupiedCount } }
  );

  // Legacy memberIds already reserve capacity. Add their canonical signup row
  // without incrementing the embedded count a second time.
  const missingCanonicalRows = plan.requestedUserIds.filter(
    (userId) =>
      !plan.signupUserIds.has(userId) &&
      (shift.memberIds || []).some((memberId) => normalizeId(memberId) === userId)
  );
  for (const userId of missingCanonicalRows) {
    await ShiftSignup.updateOne(
      { shiftId, userId },
      {
        $setOnInsert: {
          shiftId,
          eventId,
          campId,
          userId,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  const newlyReservedUserIds = [];
  try {
    for (const userId of plan.userIdsNeedingReservation) {
      const reservation = await Event.updateOne(
        buildShiftSignupReservationFilter({
          eventId,
          shiftId,
          maxSignUps: shift.maxSignUps,
          userId,
          assignmentMode: shift.assignmentMode
        }),
        {
          $inc: { 'shifts.$.currentSignups': 1 },
          $addToSet: { 'shifts.$.memberIds': userId }
        }
      );
      if (!reservation?.modifiedCount) {
        const error = new Error('This shift no longer has enough room for the direct assignment.');
        error.code = 'SHIFT_CAPACITY_EXCEEDED';
        error.statusCode = 409;
        throw error;
      }

      try {
        await ShiftSignup.create({
          shiftId,
          eventId,
          campId,
          userId,
          createdAt: new Date()
        });
        newlyReservedUserIds.push(userId);
      } catch (signupError) {
        if (signupError?.code === 11000) {
          // A concurrent signup won the unique row. It already owns the spot,
          // so undo only this helper's duplicate counter increment.
          await Event.updateOne(
            { _id: eventId, 'shifts._id': shiftId, 'shifts.currentSignups': { $gt: 0 } },
            { $inc: { 'shifts.$.currentSignups': -1 } }
          );
          continue;
        }

        await Event.updateOne(
          { _id: eventId, 'shifts._id': shiftId, 'shifts.currentSignups': { $gt: 0 } },
          {
            $inc: { 'shifts.$.currentSignups': -1 },
            $pull: { 'shifts.$.memberIds': userId }
          }
        );
        throw signupError;
      }
    }
  } catch (error) {
    if (newlyReservedUserIds.length > 0) {
      await ShiftSignup.deleteMany({
        shiftId,
        userId: { $in: newlyReservedUserIds }
      });
      await Event.updateOne(
        { _id: eventId, 'shifts._id': shiftId },
        {
          $inc: { 'shifts.$.currentSignups': -newlyReservedUserIds.length },
          $pull: { 'shifts.$.memberIds': { $in: newlyReservedUserIds } }
        }
      );
    }
    throw error;
  }

  return {
    confirmedUserIds: plan.requestedUserIds,
    newlyReservedUserIds
  };
}

async function releaseShiftSpotsForUsers({ eventId, shiftId, userIds = [] }) {
  const requestedUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  if (requestedUserIds.length === 0) {
    return { releasedUserIds: [] };
  }

  const [shift, signupRows] = await Promise.all([
    getPersistedShift(eventId, shiftId),
    ShiftSignup.find({ shiftId, userId: { $in: requestedUserIds } }).select('userId').lean()
  ]);
  if (!shift) return { releasedUserIds: [] };

  const reservedSet = new Set([
    ...signupRows.map((row) => normalizeId(row.userId)),
    ...(shift.memberIds || []).map(normalizeId)
  ]);
  const releasedUserIds = requestedUserIds.filter((userId) => reservedSet.has(userId));

  await ShiftSignup.deleteMany({ shiftId, userId: { $in: requestedUserIds } });
  await Event.updateOne(
    { _id: eventId, 'shifts._id': shiftId },
    { $pull: { 'shifts.$.memberIds': { $in: requestedUserIds } } }
  );

  // Recompute from both canonical and legacy stores so a removal repairs any
  // stale counter rather than blindly decrementing it.
  const [remainingSignupRows, refreshedShift] = await Promise.all([
    ShiftSignup.find({ shiftId }).select('userId').lean(),
    getPersistedShift(eventId, shiftId)
  ]);
  const remainingUserIds = new Set([
    ...remainingSignupRows.map((row) => normalizeId(row.userId)),
    ...(refreshedShift?.memberIds || []).map(normalizeId)
  ]);
  await Event.updateOne(
    { _id: eventId, 'shifts._id': shiftId },
    { $set: { 'shifts.$.currentSignups': remainingUserIds.size } }
  );

  return { releasedUserIds };
}

async function resolveDirectAssignmentUserIds({ shift, shiftId }) {
  const embeddedIds = getDirectAssignmentUserIds(shift);
  if (embeddedIds.length > 0 || shift?.assignmentMode !== 'SELECTED_USERS') {
    return embeddedIds;
  }

  // Legacy SELECTED_USERS shifts pre-date the embedded lock field. Their
  // selected assignment rows are the authoritative fallback and are lazily
  // materialized onto Event.shifts by the signup route.
  const rows = await ShiftAssignment.find({
    shiftId: shiftId || shift?._id,
    modeSnapshot: 'SELECTED_USERS'
  }).select('userId').lean();
  return [...new Set(rows.map((row) => normalizeId(row.userId)).filter(Boolean))];
}

async function getMemberCampIds(userId) {
  const memberRecords = await db.findMembers({ user: userId, status: 'active' });
  const campIds = [...new Set((memberRecords || []).map((member) => normalizeId(member.camp)).filter(Boolean))];
  return campIds;
}

async function getCampRosterUsers(campId) {
  const activeRoster = await db.findActiveRoster({ camp: campId });
  if (!activeRoster?.members?.length) return [];

  const users = [];
  for (const entry of activeRoster.members) {
    const rosterStatus = (entry.status || '').toLowerCase();
    if (rosterStatus !== 'approved') continue;
    const memberDoc = entry.member;
    const userRef = memberDoc?.user;
    if (!userRef) continue;
    users.push({
      userId: normalizeId(userRef),
      isLead: entry.isCampLead === true || ['lead', 'admin'].includes((entry.role || '').toLowerCase())
    });
  }

  return users;
}

async function resolveAssignmentCandidates({
  campId,
  mode,
  selectedUserIds = [],
  manualAddIds = [],
  manualRemoveIds = []
}) {
  const rosterUsers = await getCampRosterUsers(campId);
  const rosterSet = new Set(rosterUsers.map((user) => user.userId));
  const leadSet = new Set(rosterUsers.filter((user) => user.isLead).map((user) => user.userId));
  const output = new Set();

  if (mode === 'ALL_ROSTER') {
    for (const userId of rosterSet) output.add(userId);
  } else if (mode === 'LEADS_ONLY') {
    for (const userId of leadSet) output.add(userId);
  } else {
    for (const userId of selectedUserIds.map((id) => normalizeId(id)).filter(Boolean)) {
      if (rosterSet.has(userId)) output.add(userId);
    }
  }

  for (const userId of manualAddIds.map((id) => normalizeId(id)).filter(Boolean)) {
    if (rosterSet.has(userId)) output.add(userId);
  }
  for (const userId of manualRemoveIds.map((id) => normalizeId(id)).filter(Boolean)) {
    output.delete(userId);
  }

  return Array.from(output);
}

async function createShiftAssignments({
  shiftId,
  eventId,
  campId,
  assignedBy,
  mode,
  candidates = [],
  source = 'CREATE_MODE'
}) {
  if (!candidates.length) return { insertedUserIds: [], insertedCount: 0 };

  const docs = candidates.map((userId) => ({
    shiftId,
    eventId,
    campId,
    userId,
    assignedBy,
    assignedAt: new Date(),
    source,
    modeSnapshot: mode || 'SELECTED_USERS'
  }));

  try {
    await ShiftAssignment.insertMany(docs, { ordered: false });
  } catch (error) {
    if (error?.code !== 11000 && !Array.isArray(error?.writeErrors)) {
      throw error;
    }
  }

  const inserted = await ShiftAssignment.find({ shiftId, userId: { $in: candidates } }).select('userId').lean();
  const insertedUserIds = [...new Set(inserted.map((item) => normalizeId(item.userId)).filter(Boolean))];

  const [camp, event] = await Promise.all([
    db.findCamp({ _id: campId }),
    db.findEvent({ _id: eventId })
  ]);
  const campName = camp?.name || camp?.campName || 'Camp';
  const eventName = event?.eventName || 'Event';

  // Notify newly assigned users.
  try {
    const isDirectAssignment = mode === 'SELECTED_USERS';
    await createBulkNotifications(insertedUserIds, {
      actor: assignedBy,
      campId,
      type: NOTIFICATION_TYPES.SHIFT_ASSIGNED,
      title: isDirectAssignment ? 'A shift was assigned to you' : 'Please sign up for shifts',
      message: isDirectAssignment
        ? `"${campName}" assigned you to "${eventName}". Your spot is confirmed unless you drop the shift.`
        : `"${campName}" needs your help with "${eventName}"`,
      link: '/my-shifts',
      metadata: { shiftId, eventId }
    });
  } catch (notificationError) {
    console.error('Shift assignment notification error:', notificationError);
  }

  return {
    insertedUserIds,
    insertedCount: insertedUserIds.length
  };
}

async function getShiftAssignmentState({ shiftId, campId, assignedUserIds }) {
  const [assignments, rosterUsers] = await Promise.all([
    assignedUserIds === undefined
      ? ShiftAssignment.find({ shiftId }).select('userId assignedAt').lean()
      : Promise.resolve((assignedUserIds || []).map((userId) => ({ userId }))),
    getCampRosterUsers(campId)
  ]);

  const assignedSet = new Set(assignments.map((item) => normalizeId(item.userId)).filter(Boolean));
  const rosterUserMap = new Map(rosterUsers.map((user) => [user.userId, user]));
  const assignedUsers = Array.from(assignedSet).map((userId) => ({
    ...(rosterUserMap.get(userId) || { userId, isLead: false }),
    isActiveRosterMember: rosterUserMap.has(userId)
  }));
  const unassignedUsers = rosterUsers.filter((user) => !assignedSet.has(user.userId));

  return {
    assignedUsers,
    unassignedUsers
  };
}

/**
 * Pure helper: given the events for a camp, the user's already-existing
 * assignment shiftIds, signup counts, optional mode-inference map, and
 * the user's lead-ness, decide which new ShiftAssignment rows should
 * be created.
 *
 * Extracted so the eligibility rules are unit-testable without spinning
 * up MongoDB. See `autoAssignRosterUserToOpenShifts` below for the
 * production caller.
 *
 * Returns plain objects ready for ShiftAssignment.insertMany. Order
 * matches event/shift iteration order, which makes the function
 * deterministic for tests.
 */
function decideAssignmentsForJoiner({
  events,
  alreadyAssignedShiftIds,
  signupCountByShift,
  inferredModeByShift = new Map(),
  campId,
  userId,
  assignedBy,
  isLead
}) {
  const alreadyAssigned = alreadyAssignedShiftIds instanceof Set
    ? alreadyAssignedShiftIds
    : new Set(alreadyAssignedShiftIds || []);
  const signups = signupCountByShift instanceof Map
    ? signupCountByShift
    : new Map(Object.entries(signupCountByShift || {}));

  const newAssignments = [];
  for (const event of events || []) {
    for (const shift of event.shifts || []) {
      const shiftId = normalizeId(shift._id);
      if (!shiftId) continue;

      // Skip shifts the user is already assigned to — re-running this
      // helper must be idempotent.
      if (alreadyAssigned.has(shiftId)) continue;

      // Capacity gate. Full shifts are not auto-extended; a late-joiner
      // can still see/sign-up via the live-rule fallback if a spot
      // opens up later, but we don't pre-create a row that can't be
      // honoured.
      const signupCount = signups.get(shiftId) || 0;
      if (signupCount >= (shift.maxSignUps || 0)) continue;

      // Mode resolution: explicit on the shift wins, then inferred
      // from existing modeSnapshot rows (legacy data), then default
      // ALL_ROSTER.
      const mode =
        shift.assignmentMode ||
        inferredModeByShift.get(shiftId) ||
        (getDirectAssignmentUserIds(shift).length > 0 ? 'SELECTED_USERS' : 'ALL_ROSTER');

      // Hand-picked audiences are never widened. If a camp lead
      // explicitly chose SELECTED_USERS, late-joiners stay out.
      if (mode === 'SELECTED_USERS') continue;

      // LEADS_ONLY only includes Camp Leads. A new plain member gets
      // nothing here; if they're later promoted to lead, the role-
      // grant code path can re-trigger this helper.
      if (mode === 'LEADS_ONLY' && !isLead) continue;

      newAssignments.push({
        shiftId,
        eventId: normalizeId(event._id),
        campId: normalizeId(campId),
        userId: normalizeId(userId),
        assignedBy: normalizeId(assignedBy),
        source: 'ROSTER_AUTO_ADD',
        modeSnapshot: mode
      });
    }
  }
  return newAssignments;
}

/**
 * Late-joiner hook. Run this whenever a member is added to the active
 * roster (CSV import, manual add, FMR application approval, SOR invite
 * acceptance) so that ALL_ROSTER and (where applicable) LEADS_ONLY
 * shifts pick up the new user automatically.
 *
 * Mode awareness — IMPORTANT for backward compatibility with shifts
 * that explicitly chose specific assignees:
 *   • ALL_ROSTER     — always assign.
 *   • LEADS_ONLY     — assign only when isLead=true.
 *   • SELECTED_USERS — never auto-add. Expanding a hand-picked audience
 *                      after the fact would silently violate the camp
 *                      lead's intent.
 *
 * Legacy shifts pre-dating the assignmentMode field are inferred from
 * the modeSnapshot stamped on existing ShiftAssignment rows for that
 * shift; the startup backfill will normalise them eventually, but this
 * runtime fallback keeps things sane between deploy and backfill.
 *
 * @param {Object} params
 * @param {string} params.campId
 * @param {string} params.userId   — the joining roster member's User _id
 * @param {string} params.assignedBy — actor recorded on the audit row
 * @param {boolean} [params.isLead=false] — pass true when the joining
 *   member is a Camp Lead so LEADS_ONLY shifts pick them up too.
 */
async function autoAssignRosterUserToOpenShifts({ campId, userId, assignedBy, isLead = false }) {
  const [events, existingAssignments, signups] = await Promise.all([
    db.findEvents({ campId }),
    ShiftAssignment.find({ campId, userId }).select('shiftId').lean(),
    ShiftSignup.find({ campId }).select('shiftId').lean()
  ]);

  const alreadyAssignedShiftIds = new Set(existingAssignments.map((item) => normalizeId(item.shiftId)).filter(Boolean));
  const signupCountByShift = new Map();
  for (const signup of signups) {
    const shiftId = normalizeId(signup.shiftId);
    signupCountByShift.set(shiftId, (signupCountByShift.get(shiftId) || 0) + 1);
  }

  // Build the inferred-mode map for legacy shifts (no assignmentMode
  // field yet). Mirrors the backfill's logic: dominant modeSnapshot
  // among the shift's existing assignments wins, with ALL_ROSTER
  // fallback when no rows exist.
  const shiftsMissingMode = [];
  for (const event of events || []) {
    for (const shift of event.shifts || []) {
      if (!shift.assignmentMode) {
        const sid = normalizeId(shift._id);
        if (sid) shiftsMissingMode.push(sid);
      }
    }
  }
  const inferredModeByShift = new Map();
  if (shiftsMissingMode.length > 0) {
    try {
      const sampleRows = await ShiftAssignment.find({
        shiftId: { $in: shiftsMissingMode }
      })
        .select('shiftId modeSnapshot')
        .lean();
      const tally = new Map();
      for (const row of sampleRows) {
        const sid = normalizeId(row.shiftId);
        if (!tally.has(sid)) tally.set(sid, {});
        const counts = tally.get(sid);
        const k = row.modeSnapshot || 'ALL_ROSTER';
        counts[k] = (counts[k] || 0) + 1;
      }
      for (const [sid, counts] of tally.entries()) {
        const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        inferredModeByShift.set(sid, dominant);
      }
    } catch (err) {
      // Inference is best-effort. Falling through with an empty map
      // means legacy shifts default to ALL_ROSTER — the safe direction
      // (opens access; SELECTED_USERS still can't be widened because
      // that requires either the field or explicit snapshot rows,
      // which would have already populated `alreadyAssignedShiftIds`
      // for users who were originally picked).
      console.warn('[autoAssignRosterUserToOpenShifts] mode inference failed:', err?.message);
    }
  }

  const newAssignments = decideAssignmentsForJoiner({
    events,
    alreadyAssignedShiftIds,
    signupCountByShift,
    inferredModeByShift,
    campId,
    userId,
    assignedBy,
    isLead
  });

  if (!newAssignments.length) return { created: 0 };

  try {
    await ShiftAssignment.insertMany(newAssignments, { ordered: false });
  } catch (error) {
    if (error?.code !== 11000 && !Array.isArray(error?.writeErrors)) {
      throw error;
    }
  }

  // Notify user about auto assignments.
  try {
    await createBulkNotifications([normalizeId(userId)], {
      actor: assignedBy,
      campId,
      type: NOTIFICATION_TYPES.SHIFT_ASSIGNED,
      title: 'New shifts available to you',
      message: 'You were auto-assigned to open camp shifts.',
      link: '/my-shifts',
      metadata: { count: newAssignments.length }
    });
  } catch (notificationError) {
    console.error('Auto-assignment notification error:', notificationError);
  }

  return { created: newAssignments.length };
}

async function buildMyShiftsPayload(userId) {
  const campIds = await getMemberCampIds(userId);
  if (campIds.length === 0) {
    return {
      camps: [],
      availableShifts: [],
      signedUpShifts: []
    };
  }

  const camps = await db.findCamps({ _id: { $in: campIds } });
  const campMap = new Map((camps || []).map((camp) => [normalizeId(camp._id), camp]));

  // Determine, per camp, whether the user is a Camp Lead. This is the
  // input to the LEADS_ONLY live rule below. We tolerate a missing
  // active roster (some camps may not have one yet).
  const userIdStr = userId.toString();
  const isLeadByCamp = new Map();
  await Promise.all(
    campIds.map(async (campId) => {
      try {
        const roster = await db.findActiveRoster({ camp: campId });
        if (!roster?.members?.length) {
          isLeadByCamp.set(campId, false);
          return;
        }
        let lead = false;
        for (const entry of roster.members) {
          const memberDoc = entry.member;
          const userRef = memberDoc?.user;
          if (!userRef) continue;
          if (normalizeId(userRef) !== userIdStr) continue;
          lead = entry.isCampLead === true || ['lead', 'admin'].includes((entry.role || '').toLowerCase());
          break;
        }
        isLeadByCamp.set(campId, lead);
      } catch (e) {
        isLeadByCamp.set(campId, false);
      }
    })
  );

  const eventsByCamp = await Promise.all(campIds.map((campId) => db.findEvents({ campId })));
  const events = eventsByCamp.flat();
  const allShiftIds = [];
  const shiftIndex = new Map();
  for (const event of events) {
    const eventCampId = normalizeId(event.campId?._id || event.campId);
    const camp = campMap.get(eventCampId);
    const campName = camp?.name || camp?.campName || 'Camp';
    for (const shift of event.shifts || []) {
      const shiftId = normalizeId(shift._id);
      allShiftIds.push(shiftId);
      shiftIndex.set(shiftId, {
        event,
        shift,
        campId: eventCampId,
        campName
      });
    }
  }

  const legacyDirectShiftIds = [];
  for (const [shiftId, indexed] of shiftIndex.entries()) {
    if (
      indexed.shift.assignmentMode === 'SELECTED_USERS' &&
      getDirectAssignmentUserIds(indexed.shift).length === 0
    ) {
      legacyDirectShiftIds.push(shiftId);
    }
  }

  const [assignments, signups, legacyDirectAssignments] = await Promise.all([
    ShiftAssignment.find({ userId, shiftId: { $in: allShiftIds } })
      .select('shiftId assignedAt createdAt')
      .lean(),
    ShiftSignup.find({ shiftId: { $in: allShiftIds } }).select('shiftId userId').lean(),
    legacyDirectShiftIds.length > 0
      ? ShiftAssignment.find({
        shiftId: { $in: legacyDirectShiftIds },
        modeSnapshot: 'SELECTED_USERS'
      }).select('shiftId userId').lean()
      : Promise.resolve([])
  ]);

  const legacyDirectIdsByShift = new Map();
  for (const row of legacyDirectAssignments) {
    const shiftId = normalizeId(row.shiftId);
    if (!legacyDirectIdsByShift.has(shiftId)) legacyDirectIdsByShift.set(shiftId, []);
    legacyDirectIdsByShift.get(shiftId).push(normalizeId(row.userId));
  }

  const directlyAssignedShiftIds = new Set();
  for (const [shiftId, indexed] of shiftIndex.entries()) {
    const directUserIds = getDirectAssignmentUserIds(
      indexed.shift,
      legacyDirectIdsByShift.get(shiftId) || []
    );
    if (directUserIds.includes(userIdStr)) {
      directlyAssignedShiftIds.add(shiftId);
    }
  }

  const assignedShiftIds = new Set(assignments.map((item) => normalizeId(item.shiftId)).filter(Boolean));
  const assignmentByShiftId = new Map(
    assignments.map((item) => [normalizeId(item.shiftId), item])
  );
  const signedShiftIds = new Set(
    signups
      .filter((signup) => normalizeId(signup.userId) === normalizeId(userId))
      .map((signup) => normalizeId(signup.shiftId))
      .filter(Boolean)
  );

  const coworkerIds = new Set();
  const availableShifts = [];
  const signedUpShifts = [];

  const signupByShift = new Map();
  for (const signup of signups) {
    const shiftId = normalizeId(signup.shiftId);
    if (!signupByShift.has(shiftId)) signupByShift.set(shiftId, []);
    signupByShift.get(shiftId).push(normalizeId(signup.userId));
  }

  // Live-rule expansion. Layered on top of the assignment-row source
  // of truth so SELECTED_USERS shifts are never silently widened:
  //
  //   • A shift is "live-eligible" iff its assignmentMode is
  //     ALL_ROSTER, OR LEADS_ONLY and the user is a Camp Lead.
  //   • Legacy shifts without assignmentMode are treated as
  //     ALL_ROSTER (matches the historical default of
  //     resolveAssignmentCandidates and the createShiftAssignments
  //     fallback). This is the only safe inference here because My
  //     Shifts is read-only — it can't read modeSnapshot from a row
  //     that doesn't exist for this user yet.
  //
  // Note we do NOT auto-write ShiftAssignment rows from a list endpoint
  // — keeping reads side-effect-free. Materialisation happens lazily at
  // signup time, where it's needed for capacity tracking and audit.
  const liveEligibleShiftIds = new Set();
  for (const [shiftId, indexed] of shiftIndex.entries()) {
    const mode = indexed.shift.assignmentMode || 'ALL_ROSTER';
    if (mode === 'ALL_ROSTER') {
      liveEligibleShiftIds.add(shiftId);
    } else if (mode === 'LEADS_ONLY' && isLeadByCamp.get(indexed.campId)) {
      liveEligibleShiftIds.add(shiftId);
    }
    // SELECTED_USERS: rely strictly on assignedShiftIds.
  }

  // Show shifts in My Shifts if the user is assigned, signed up, OR
  // live-eligible. Live-eligibility ensures late-joiners see shifts
  // that pre-date their roster membership without waiting for an
  // explicit re-assignment write.
  const relevantShiftIds = new Set([
    ...assignedShiftIds,
    ...signedShiftIds,
    ...liveEligibleShiftIds,
    ...directlyAssignedShiftIds
  ]);
  for (const shiftId of relevantShiftIds) {
    const indexed = shiftIndex.get(shiftId);
    if (!indexed) continue;
    const { event, shift, campId, campName } = indexed;
    const directAssignmentUserIds = getDirectAssignmentUserIds(
      shift,
      legacyDirectIdsByShift.get(shiftId) || []
    );
    const isDirectlyAssignedToMe = directAssignmentUserIds.includes(userIdStr);
    const isDirectAssignmentLocked = hasExclusiveDirectAssignmentLock(
      shift,
      legacyDirectIdsByShift.get(shiftId) || []
    );
    const legacyMemberIds = (shift.memberIds || []).map((id) => normalizeId(id)).filter(Boolean);
    if (legacyMemberIds.includes(userIdStr)) {
      signedShiftIds.add(shiftId);
    }

    // Existing signups remain visible, but a member who is not one of the
    // direct assignees must not see this shift as available to claim.
    if (
      isDirectAssignmentLocked &&
      !isDirectlyAssignedToMe &&
      !signedShiftIds.has(shiftId)
    ) {
      continue;
    }
    const memberIds = [...new Set([...(signupByShift.get(shiftId) || []), ...legacyMemberIds])];
    memberIds.forEach((memberId) => {
      if (memberId && memberId !== userIdStr) coworkerIds.add(memberId);
    });

    const baseShift = {
      shiftId,
      eventId: normalizeId(event._id),
      eventName: event.eventName,
      campId,
      campName,
      title: shift.title,
      description: shift.description || '',
      requiredSkills: Array.isArray(shift.requiredSkills) ? shift.requiredSkills : [],
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      maxSignUps: shift.maxSignUps || 0,
      signedUpCount: memberIds.length,
      remainingSpots: Math.max((shift.maxSignUps || 0) - memberIds.length, 0),
      isFull: memberIds.length >= (shift.maxSignUps || 0),
      isDirectAssignmentLocked,
      isDirectlyAssignedToMe,
      shiftDropsLocked: areEventShiftDropsLocked(event),
      assignedAt: assignmentByShiftId.get(shiftId)?.assignedAt
        || assignmentByShiftId.get(shiftId)?.createdAt
        || shift.createdAt
        || event.createdAt
        || null,
      memberIds
    };

    if (signedShiftIds.has(shiftId)) {
      signedUpShifts.push(baseShift);
    } else {
      availableShifts.push(baseShift);
    }
  }

  const coworkersRaw = coworkerIds.size > 0 ? await db.findUsers({ _id: { $in: Array.from(coworkerIds) } }) : [];
  const coworkers = (coworkersRaw || []).map((user) => ({
    _id: normalizeId(user._id),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    playaName: user.playaName || '',
    email: user.email || '',
    profilePhoto: user.profilePhoto || null
  }));

  const withCoworkers = (shift) => ({
    ...shift,
    coworkers: shift.memberIds
      .filter((memberId) => memberId !== userIdStr)
      .map((memberId) => coworkers.find((coworker) => coworker._id === memberId))
      .filter(Boolean)
  });

  const sortByTimeAsc = (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

  return {
    camps: campIds.map((campId) => ({
      _id: campId,
      name: campMap.get(campId)?.name || campMap.get(campId)?.campName || 'Camp'
    })),
    availableShifts: availableShifts.map(withCoworkers).sort(sortByTimeAsc),
    signedUpShifts: signedUpShifts.map(withCoworkers).sort(sortByTimeAsc)
  };
}

module.exports = {
  getMemberCampIds,
  getCampRosterUsers,
  resolveAssignmentCandidates,
  createShiftAssignments,
  getShiftAssignmentState,
  autoAssignRosterUserToOpenShifts,
  decideAssignmentsForJoiner,
  buildMyShiftsPayload,
  getDirectAssignmentUserIds,
  hasExclusiveDirectAssignmentLock,
  isShiftDirectAssignmentLockedForUser,
  buildShiftSignupReservationFilter,
  buildDirectAssignmentReservationPlan,
  shouldReconcileShiftAssignments,
  mergeDirectAssignmentUserIdsForUpdate,
  reserveShiftSpotsForUsers,
  releaseShiftSpotsForUsers,
  resolveDirectAssignmentUserIds,
  shiftTimesOverlap,
  findShiftTimeConflict,
  findShiftTimeConflictForUser,
  areEventShiftDropsLocked
};
