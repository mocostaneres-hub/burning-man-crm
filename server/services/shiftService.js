const db = require('../database/databaseAdapter');
const ShiftAssignment = require('../models/ShiftAssignment');
const ShiftSignup = require('../models/ShiftSignup');
const { createBulkNotifications } = require('./notificationService');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

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
    await createBulkNotifications(insertedUserIds, {
      actor: assignedBy,
      campId,
      type: NOTIFICATION_TYPES.SHIFT_ASSIGNED,
      title: 'Please sign up for shifts',
      message: `"${campName}" needs your help with "${eventName}"`,
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

async function getShiftAssignmentState({ shiftId, campId }) {
  const [assignments, rosterUsers] = await Promise.all([
    ShiftAssignment.find({ shiftId }).select('userId assignedAt').lean(),
    getCampRosterUsers(campId)
  ]);

  const assignedSet = new Set(assignments.map((item) => normalizeId(item.userId)).filter(Boolean));
  const assignedUsers = rosterUsers.filter((user) => assignedSet.has(user.userId));
  const unassignedUsers = rosterUsers.filter((user) => !assignedSet.has(user.userId));

  return {
    assignedUsers,
    unassignedUsers
  };
}

async function autoAssignRosterUserToOpenShifts({ campId, userId, assignedBy }) {
  const [events, existingAssignments, signups] = await Promise.all([
    db.findEvents({ campId }),
    ShiftAssignment.find({ campId, userId }).select('shiftId').lean(),
    ShiftSignup.find({ campId }).select('shiftId').lean()
  ]);

  const alreadyAssigned = new Set(existingAssignments.map((item) => normalizeId(item.shiftId)).filter(Boolean));
  const signupCountByShift = new Map();
  for (const signup of signups) {
    const shiftId = normalizeId(signup.shiftId);
    signupCountByShift.set(shiftId, (signupCountByShift.get(shiftId) || 0) + 1);
  }

  const newAssignments = [];
  for (const event of events || []) {
    for (const shift of event.shifts || []) {
      const shiftId = normalizeId(shift._id);
      if (!shiftId || alreadyAssigned.has(shiftId)) continue;

      const signupCount = signupCountByShift.get(shiftId) || 0;
      if (signupCount >= (shift.maxSignUps || 0)) continue;

      newAssignments.push({
        shiftId,
        eventId: normalizeId(event._id),
        campId: normalizeId(campId),
        userId: normalizeId(userId),
        assignedBy: normalizeId(assignedBy),
        source: 'ROSTER_AUTO_ADD',
        modeSnapshot: 'ALL_ROSTER'
      });
    }
  }

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

  const [assignments, signups] = await Promise.all([
    ShiftAssignment.find({ userId, shiftId: { $in: allShiftIds } }).select('shiftId').lean(),
    ShiftSignup.find({ shiftId: { $in: allShiftIds } }).select('shiftId userId').lean()
  ]);

  const assignedShiftIds = new Set(assignments.map((item) => normalizeId(item.shiftId)).filter(Boolean));
  const signedShiftIds = new Set(
    signups
      .filter((signup) => normalizeId(signup.userId) === normalizeId(userId))
      .map((signup) => normalizeId(signup.shiftId))
      .filter(Boolean)
  );

  const userIdStr = userId.toString();
  const coworkerIds = new Set();
  const availableShifts = [];
  const signedUpShifts = [];

  const signupByShift = new Map();
  for (const signup of signups) {
    const shiftId = normalizeId(signup.shiftId);
    if (!signupByShift.has(shiftId)) signupByShift.set(shiftId, []);
    signupByShift.get(shiftId).push(normalizeId(signup.userId));
  }

  for (const shiftId of assignedShiftIds) {
    const indexed = shiftIndex.get(shiftId);
    if (!indexed) continue;
    const { event, shift, campId, campName } = indexed;
    const legacyMemberIds = (shift.memberIds || []).map((id) => normalizeId(id)).filter(Boolean);
    const memberIds = [...new Set([...(signupByShift.get(shiftId) || []), ...legacyMemberIds])];
    if (legacyMemberIds.includes(userIdStr)) {
      signedShiftIds.add(shiftId);
    }
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
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      maxSignUps: shift.maxSignUps || 0,
      signedUpCount: memberIds.length,
      remainingSpots: Math.max((shift.maxSignUps || 0) - memberIds.length, 0),
      isFull: memberIds.length >= (shift.maxSignUps || 0),
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
  buildMyShiftsPayload
};
