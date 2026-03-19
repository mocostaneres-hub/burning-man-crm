const db = require('../database/databaseAdapter');

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

  const userIdStr = userId.toString();
  const coworkerIds = new Set();
  const availableShifts = [];
  const signedUpShifts = [];

  for (const event of events) {
    const eventCampId = normalizeId(event.campId?._id || event.campId);
    const camp = campMap.get(eventCampId);
    const campName = camp?.name || camp?.campName || 'Camp';

    for (const shift of event.shifts || []) {
      const memberIds = (shift.memberIds || []).map((id) => normalizeId(id));
      const isSignedUp = memberIds.includes(userIdStr);

      memberIds.forEach((memberId) => {
        if (memberId && memberId !== userIdStr) coworkerIds.add(memberId);
      });

      const baseShift = {
        shiftId: normalizeId(shift._id),
        eventId: normalizeId(event._id),
        eventName: event.eventName,
        campId: eventCampId,
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

      if (isSignedUp) {
        signedUpShifts.push(baseShift);
      } else {
        availableShifts.push(baseShift);
      }
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
  buildMyShiftsPayload
};
