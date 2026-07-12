jest.mock('mongoose', () => ({
  connection: { readyState: 1 }
}));

jest.mock('../models/ShiftAssignment', () => ({
  deleteMany: jest.fn()
}));

jest.mock('../models/ShiftSignup', () => ({
  find: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../models/Event', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock('../models/SurveyAssignment', () => ({
  deleteMany: jest.fn()
}));

jest.mock('../models/SurveyResponse', () => ({
  find: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn()
}));

jest.mock('../models/SurveyResponseMember', () => ({
  find: jest.fn(),
  deleteMany: jest.fn()
}));

const mongoose = require('mongoose');
const ShiftAssignment = require('../models/ShiftAssignment');
const ShiftSignup = require('../models/ShiftSignup');
const Event = require('../models/Event');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyResponseMember = require('../models/SurveyResponseMember');
const { removeRosterMembersCampRecords } = require('../services/campRecordCleanupService');

const ORIGINAL_MONGODB_URI = process.env.MONGODB_URI;
const ORIGINAL_MONGO_URI = process.env.MONGO_URI;

function leanChain(result) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result)
    })
  };
}

function selectPromiseChain(result) {
  return {
    select: jest.fn().mockResolvedValue(result)
  };
}

function mockEmptySurveyCleanup() {
  SurveyResponse.find
    .mockReturnValueOnce(leanChain([]))
    .mockReturnValueOnce(selectPromiseChain([]));
  SurveyResponseMember.find.mockReturnValueOnce(leanChain([]));
  SurveyResponseMember.deleteMany.mockResolvedValue({ deletedCount: 0 });
  SurveyResponse.deleteMany.mockResolvedValue({ deletedCount: 0 });
  SurveyResponse.updateMany.mockResolvedValue({ modifiedCount: 0 });
  SurveyAssignment.deleteMany.mockResolvedValue({ deletedCount: 0 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.connection.readyState = 1;
  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URI;
});

afterAll(() => {
  if (ORIGINAL_MONGODB_URI === undefined) {
    delete process.env.MONGODB_URI;
  } else {
    process.env.MONGODB_URI = ORIGINAL_MONGODB_URI;
  }
  if (ORIGINAL_MONGO_URI === undefined) {
    delete process.env.MONGO_URI;
  } else {
    process.env.MONGO_URI = ORIGINAL_MONGO_URI;
  }
});

describe('removeRosterMembersCampRecords', () => {
  test('removes linked user survey responses, people answers, and picked shifts', async () => {
    const prunableResponse = {
      answers: [
        {
          blockType: 'people',
          value: [
            { memberId: 'member-1', name: 'Removed' },
            { memberId: 'member-keep', name: 'Keep' }
          ]
        },
        { blockType: 'short_answer', value: 'unchanged' }
      ],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined)
    };

    SurveyResponse.find
      .mockReturnValueOnce(leanChain([{ _id: 'response-submitted' }]))
      .mockReturnValueOnce(leanChain([]))
      .mockReturnValueOnce(selectPromiseChain([prunableResponse]));
    SurveyResponseMember.find.mockReturnValueOnce(leanChain([{ responseId: 'response-covered' }]));
    SurveyResponseMember.deleteMany.mockResolvedValue({ deletedCount: 3 });
    SurveyResponse.deleteMany.mockResolvedValue({ deletedCount: 1 });
    SurveyResponse.updateMany.mockResolvedValue({ modifiedCount: 1 });
    SurveyAssignment.deleteMany.mockResolvedValue({ deletedCount: 1 });

    ShiftSignup.find
      .mockReturnValueOnce(leanChain([{ eventId: 'event-1', shiftId: 'shift-1' }]))
      .mockReturnValueOnce(leanChain([{ userId: 'user-keep' }]));
    Event.find.mockReturnValueOnce(leanChain([
      {
        _id: 'event-1',
        shifts: [
          {
            _id: 'shift-1',
            memberIds: ['user-1', 'member-1', 'member-keep']
          }
        ]
      }
    ]));
    ShiftAssignment.deleteMany.mockResolvedValue({ deletedCount: 1 });
    ShiftSignup.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Event.updateMany.mockResolvedValue({ modifiedCount: 1 });
    Event.findOne.mockReturnValueOnce(leanChain({
      shifts: [{ _id: 'shift-1', memberIds: ['member-keep'] }]
    }));
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const cleanup = await removeRosterMembersCampRecords({
      campId: 'camp-1',
      memberIds: ['member-1'],
      userId: 'user-1'
    });

    expect(SurveyAssignment.deleteMany).toHaveBeenCalledWith({ campId: 'camp-1', userId: 'user-1' });
    expect(SurveyResponse.deleteMany).toHaveBeenCalledWith({
      campId: 'camp-1',
      _id: { $in: ['response-submitted'] }
    });
    expect(SurveyResponse.updateMany).toHaveBeenCalledWith(
      { campId: 'camp-1', _id: { $in: ['response-covered'] } },
      { $pull: { coveredMemberIds: { $in: ['member-1'] } } }
    );
    expect(SurveyResponseMember.deleteMany).toHaveBeenCalledWith({
      campId: 'camp-1',
      $or: [
        { memberId: { $in: ['member-1'] } },
        { submitterMemberId: { $in: ['member-1'] } },
        { responseId: { $in: ['response-submitted'] } },
        { submittedByUserId: 'user-1' }
      ]
    });
    expect(prunableResponse.answers[0].value).toEqual([{ memberId: 'member-keep', name: 'Keep' }]);
    expect(prunableResponse.markModified).toHaveBeenCalledWith('answers');
    expect(prunableResponse.save).toHaveBeenCalledTimes(1);

    expect(ShiftAssignment.deleteMany).toHaveBeenCalledWith({ campId: 'camp-1', userId: 'user-1' });
    expect(ShiftSignup.deleteMany).toHaveBeenCalledWith({ campId: 'camp-1', userId: 'user-1' });
    expect(Event.updateMany).toHaveBeenCalledWith(
      { campId: 'camp-1' },
      { $pull: { 'shifts.$[].memberIds': { $in: ['user-1', 'member-1'] } } }
    );
    expect(Event.updateOne).toHaveBeenCalledWith(
      { _id: 'event-1', 'shifts._id': 'shift-1' },
      { $set: { 'shifts.$.currentSignups': 2 } }
    );
    expect(cleanup).toMatchObject({
      shiftAssignmentsDeleted: 1,
      shiftSignupsDeleted: 1,
      shiftSignupCountsRecalculated: 1,
      surveyAssignmentsDeleted: 1,
      surveyResponseMembersDeleted: 3,
      submittedSurveyResponsesDeleted: 1,
      surveyResponsesUncovered: 1,
      surveyResponsesPruned: 1
    });
  });

  test('removes legacy member-only shift picks without a linked user', async () => {
    mockEmptySurveyCleanup();

    Event.find.mockReturnValueOnce(leanChain([
      {
        _id: 'event-2',
        shifts: [
          {
            _id: 'shift-2',
            memberIds: ['member-1', 'member-keep']
          }
        ]
      }
    ]));
    Event.updateMany.mockResolvedValue({ modifiedCount: 1 });
    ShiftSignup.find.mockReturnValueOnce(leanChain([]));
    Event.findOne.mockReturnValueOnce(leanChain({
      shifts: [{ _id: 'shift-2', memberIds: ['member-keep'] }]
    }));
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const cleanup = await removeRosterMembersCampRecords({
      campId: 'camp-1',
      memberIds: ['member-1'],
      userId: null
    });

    expect(ShiftAssignment.deleteMany).not.toHaveBeenCalled();
    expect(ShiftSignup.deleteMany).not.toHaveBeenCalled();
    expect(Event.updateMany).toHaveBeenCalledWith(
      { campId: 'camp-1' },
      { $pull: { 'shifts.$[].memberIds': { $in: ['member-1'] } } }
    );
    expect(Event.updateOne).toHaveBeenCalledWith(
      { _id: 'event-2', 'shifts._id': 'shift-2' },
      { $set: { 'shifts.$.currentSignups': 1 } }
    );
    expect(cleanup.shiftSignupCountsRecalculated).toBe(1);
  });
});
