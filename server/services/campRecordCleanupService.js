const mongoose = require('mongoose');

const ShiftAssignment = require('../models/ShiftAssignment');
const ShiftSignup = require('../models/ShiftSignup');
const Event = require('../models/Event');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyResponseMember = require('../models/SurveyResponseMember');

function mongoBackedRecordsAvailable() {
  return mongoose.connection.readyState === 1 || !!process.env.MONGODB_URI || !!process.env.MONGO_URI;
}

function asStringId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
}

function uniqueIdList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(asStringId).filter(Boolean))];
}

function emptyCampRecordCleanup() {
  return {
    shiftAssignmentsDeleted: 0,
    shiftSignupsDeleted: 0,
    shiftSignupCountsRecalculated: 0,
    surveyAssignmentsDeleted: 0,
    surveyResponseMembersDeleted: 0,
    submittedSurveyResponsesDeleted: 0,
    emptySurveyResponsesDeleted: 0,
    surveyResponsesUncovered: 0,
    surveyResponsesPruned: 0
  };
}

function answerValueReferencesAnyMember(value, memberIds) {
  if (!value) return false;
  if (typeof value !== 'object') return memberIds.has(asStringId(value));
  const candidate = value.memberId || value._id || value.id || value.value;
  return memberIds.has(asStringId(candidate));
}

function pruneMembersFromAnswerValue(value, memberIds) {
  if (Array.isArray(value)) {
    const nextValue = value.filter((item) => !answerValueReferencesAnyMember(item, memberIds));
    return nextValue.length === value.length ? value : nextValue;
  }
  if (answerValueReferencesAnyMember(value, memberIds)) return null;
  return value;
}

async function removeRosterMembersSurveyRecords({ campId, memberIds, userId }) {
  const normalizedMemberIds = uniqueIdList(memberIds);
  const memberIdSet = new Set(normalizedMemberIds);
  const submitterPredicates = [];
  if (normalizedMemberIds.length > 0) {
    submitterPredicates.push({ submittedByMemberId: { $in: normalizedMemberIds } });
  }
  if (userId) {
    submitterPredicates.push({ submittedByUserId: userId });
  }

  const submittedResponses = submitterPredicates.length > 0
    ? await SurveyResponse.find({
        campId,
        $or: submitterPredicates
      })
        .select('_id')
        .lean()
    : [];
  const submittedResponseIds = submittedResponses.map((response) => response._id);

  const coverageRows = normalizedMemberIds.length > 0
    ? await SurveyResponseMember.find({
        campId,
        memberId: { $in: normalizedMemberIds }
      })
        .select('responseId')
        .lean()
    : [];
  const coveredResponseIds = coverageRows.map((row) => row.responseId).filter(Boolean);
  const submittedResponseIdSet = new Set(submittedResponseIds.map(asStringId));
  const externallySubmittedCoveredResponseIds = coveredResponseIds.filter(
    (responseId) => !submittedResponseIdSet.has(asStringId(responseId))
  );

  const responseMemberDeletePredicates = [];
  if (normalizedMemberIds.length > 0) {
    responseMemberDeletePredicates.push(
      { memberId: { $in: normalizedMemberIds } },
      { submitterMemberId: { $in: normalizedMemberIds } }
    );
  }
  if (submittedResponseIds.length > 0) {
    responseMemberDeletePredicates.push({ responseId: { $in: submittedResponseIds } });
  }
  if (userId) {
    responseMemberDeletePredicates.push({ submittedByUserId: userId });
  }

  const [
    deletedCoverageRows,
    deletedSubmittedResponses,
    updatedCoveredResponses,
    deletedSurveyAssignments
  ] = await Promise.all([
    responseMemberDeletePredicates.length > 0
      ? SurveyResponseMember.deleteMany({
          campId,
          $or: responseMemberDeletePredicates
        })
      : Promise.resolve({ deletedCount: 0 }),
    submittedResponseIds.length > 0
      ? SurveyResponse.deleteMany({
          campId,
          _id: { $in: submittedResponseIds }
        })
      : Promise.resolve({ deletedCount: 0 }),
    externallySubmittedCoveredResponseIds.length > 0 && normalizedMemberIds.length > 0
      ? SurveyResponse.updateMany(
          {
            campId,
            _id: { $in: externallySubmittedCoveredResponseIds }
          },
          { $pull: { coveredMemberIds: { $in: normalizedMemberIds } } }
        )
      : Promise.resolve({ modifiedCount: 0 }),
    userId ? SurveyAssignment.deleteMany({ campId, userId }) : Promise.resolve({ deletedCount: 0 })
  ]);

  const emptyCoveredResponses = externallySubmittedCoveredResponseIds.length > 0
    ? await SurveyResponse.find({
        campId,
        _id: { $in: externallySubmittedCoveredResponseIds },
        coveredMemberIds: { $size: 0 }
      })
        .select('_id')
        .lean()
    : [];
  const emptyCoveredResponseIds = emptyCoveredResponses.map((response) => response._id);
  const [deletedEmptyResponses] = await Promise.all([
    emptyCoveredResponseIds.length > 0
      ? SurveyResponse.deleteMany({ campId, _id: { $in: emptyCoveredResponseIds } })
      : Promise.resolve({ deletedCount: 0 }),
    emptyCoveredResponseIds.length > 0
      ? SurveyResponseMember.deleteMany({ campId, responseId: { $in: emptyCoveredResponseIds } })
      : Promise.resolve({ deletedCount: 0 })
  ]);

  let prunedAnswerResponses = 0;
  if (memberIdSet.size > 0) {
    const excludedResponseIds = [...submittedResponseIds, ...emptyCoveredResponseIds];
    const remainingResponses = await SurveyResponse.find({
      campId,
      ...(excludedResponseIds.length > 0 ? { _id: { $nin: excludedResponseIds } } : {})
    }).select('answers');
    for (const response of remainingResponses) {
      let changed = false;
      response.answers = (response.answers || []).map((answer) => {
        if (answer.blockType !== 'people') return answer;
        const nextValue = pruneMembersFromAnswerValue(answer.value, memberIdSet);
        if (nextValue !== answer.value) {
          const plainAnswer = typeof answer.toObject === 'function' ? answer.toObject() : answer;
          changed = true;
          return { ...plainAnswer, value: nextValue };
        }
        return answer;
      });
      if (changed) {
        prunedAnswerResponses += 1;
        response.lastEditedAt = new Date();
        response.markModified('answers');
        await response.save();
      }
    }
  }

  return {
    surveyAssignmentsDeleted: deletedSurveyAssignments.deletedCount || 0,
    surveyResponseMembersDeleted: deletedCoverageRows.deletedCount || 0,
    submittedSurveyResponsesDeleted: deletedSubmittedResponses.deletedCount || 0,
    emptySurveyResponsesDeleted: deletedEmptyResponses.deletedCount || 0,
    surveyResponsesUncovered: updatedCoveredResponses.modifiedCount || 0,
    surveyResponsesPruned: prunedAnswerResponses
  };
}

async function recalculateShiftSignupCount({ eventId, shiftId }) {
  const [signups, event] = await Promise.all([
    ShiftSignup.find({ shiftId }).select('userId').lean(),
    Event.findOne({ _id: eventId, 'shifts._id': shiftId }).select('shifts.$').lean()
  ]);
  const memberIds = new Set();
  signups.forEach((signup) => memberIds.add(asStringId(signup.userId)));
  const shift = event?.shifts?.[0];
  (shift?.memberIds || []).forEach((memberId) => memberIds.add(asStringId(memberId)));

  const updateResult = await Event.updateOne(
    { _id: eventId, 'shifts._id': shiftId },
    { $set: { 'shifts.$.currentSignups': memberIds.size } }
  );
  return updateResult.modifiedCount > 0 ? 1 : 0;
}

async function removeRosterMembersShiftRecords({ campId, memberIds, userId }) {
  const normalizedMemberIds = uniqueIdList(memberIds);
  const idsToPullFromLegacyShifts = uniqueIdList([userId, ...normalizedMemberIds]);
  if (!userId && idsToPullFromLegacyShifts.length === 0) {
    return {
      shiftAssignmentsDeleted: 0,
      shiftSignupsDeleted: 0,
      shiftSignupCountsRecalculated: 0
    };
  }

  const [existingSignups, legacyEvents] = await Promise.all([
    userId
      ? ShiftSignup.find({ campId, userId }).select('eventId shiftId').lean()
      : Promise.resolve([]),
    idsToPullFromLegacyShifts.length > 0
      ? Event.find({ campId, 'shifts.memberIds': { $in: idsToPullFromLegacyShifts } })
          .select('shifts._id shifts.memberIds')
          .lean()
      : Promise.resolve([])
  ]);

  const legacyIdSet = new Set(idsToPullFromLegacyShifts);
  const affectedShiftKeys = new Map();
  for (const signup of existingSignups) {
    affectedShiftKeys.set(`${asStringId(signup.eventId)}:${asStringId(signup.shiftId)}`, {
      eventId: signup.eventId,
      shiftId: signup.shiftId
    });
  }
  for (const event of legacyEvents) {
    for (const shift of event.shifts || []) {
      const hasLegacySignup = (shift.memberIds || []).some((memberRef) => legacyIdSet.has(asStringId(memberRef)));
      if (!hasLegacySignup) continue;
      affectedShiftKeys.set(`${asStringId(event._id)}:${asStringId(shift._id)}`, {
        eventId: event._id,
        shiftId: shift._id
      });
    }
  }

  const [deletedAssignments, deletedSignups] = await Promise.all([
    userId ? ShiftAssignment.deleteMany({ campId, userId }) : Promise.resolve({ deletedCount: 0 }),
    userId ? ShiftSignup.deleteMany({ campId, userId }) : Promise.resolve({ deletedCount: 0 }),
    idsToPullFromLegacyShifts.length > 0
      ? Event.updateMany(
          { campId },
          { $pull: { 'shifts.$[].memberIds': { $in: idsToPullFromLegacyShifts } } }
        )
      : Promise.resolve({ modifiedCount: 0 })
  ]);

  let recalculatedShiftCount = 0;
  for (const { eventId, shiftId } of affectedShiftKeys.values()) {
    recalculatedShiftCount += await recalculateShiftSignupCount({ eventId, shiftId });
  }

  return {
    shiftAssignmentsDeleted: deletedAssignments.deletedCount || 0,
    shiftSignupsDeleted: deletedSignups.deletedCount || 0,
    shiftSignupCountsRecalculated: recalculatedShiftCount
  };
}

async function removeRosterMembersCampRecords({ campId, memberIds, userId }) {
  const cleanup = emptyCampRecordCleanup();
  if (!mongoBackedRecordsAvailable()) return cleanup;

  const [shiftCleanup, surveyCleanup] = await Promise.all([
    removeRosterMembersShiftRecords({ campId, memberIds, userId }),
    removeRosterMembersSurveyRecords({ campId, memberIds, userId })
  ]);

  return {
    ...cleanup,
    ...shiftCleanup,
    ...surveyCleanup
  };
}

module.exports = {
  removeRosterMembersCampRecords,
  emptyCampRecordCleanup
};
