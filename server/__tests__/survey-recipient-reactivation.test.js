process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/survey-recipient-test';

const mockResolveAssignmentCandidates = jest.fn();
const mockCreateBulkNotifications = jest.fn();

jest.mock('../middleware/auth', () => ({
  authenticateToken: (_req, _res, next) => next()
}));

jest.mock('../utils/permissionHelpers', () => ({
  canManageEventPlanning: jest.fn().mockResolvedValue(true)
}));

jest.mock('../services/shiftService', () => ({
  resolveAssignmentCandidates: mockResolveAssignmentCandidates
}));

jest.mock('../services/notificationService', () => ({
  createBulkNotifications: mockCreateBulkNotifications
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const Survey = require('../models/Survey');
const SurveyQuestion = require('../models/SurveyQuestion');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponseMember = require('../models/SurveyResponseMember');
const Member = require('../models/Member');
const surveysRouter = require('../routes/surveys');

const queryResult = (value) => {
  const query = {
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value)
  };
  return query;
};

const findRouteHandler = (method, path) => {
  const routeLayer = surveysRouter.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods?.[method]
  );
  if (!routeLayer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
};

describe('survey recipient reactivation after delegated-response removal', () => {
  const surveyId = '6a0d485867ec85e3a098a3e9';
  const campId = '68e43f61a8f6ec1271586306';
  const userId = '6a73c69de904356c5ad66eb0';
  const memberId = '6a73dfb4e904356c5ad67476';

  beforeEach(() => {
    jest.restoreAllMocks();
    mockResolveAssignmentCandidates.mockReset().mockResolvedValue([userId]);
    mockCreateBulkNotifications.mockReset().mockResolvedValue([{ _id: 'notification-1' }]);
  });

  const runSend = async ({ completed }) => {
    const survey = {
      _id: surveyId,
      campId,
      title: '2026 Mudskippers Travel Survey',
      status: 'sent',
      targeting: {
        assignmentMode: 'SELECTED_USERS',
        selectedUserIds: [userId],
        snapshotAssignmentUserIds: [userId]
      },
      save: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(Survey, 'findById').mockResolvedValue(survey);
    jest.spyOn(SurveyQuestion, 'countDocuments').mockResolvedValue(2);
    jest.spyOn(Member, 'find').mockReturnValue(
      queryResult([{ _id: memberId, user: userId, camp: campId, status: 'approved' }])
    );
    jest.spyOn(SurveyResponseMember, 'find').mockReturnValue(
      queryResult(completed ? [{ memberId }] : [])
    );

    const assignmentFind = jest.spyOn(SurveyAssignment, 'find');
    assignmentFind
      .mockReturnValueOnce(queryResult([{ userId }]))
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([{ userId }]));
    const insertMany = jest.spyOn(SurveyAssignment, 'insertMany').mockResolvedValue([]);

    const req = {
      params: { surveyId },
      body: { assignmentMode: 'SELECTED_USERS', selectedUserIds: [userId] },
      user: { _id: '6a0000000000000000000001' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    const handler = findRouteHandler('post', '/:surveyId/send');
    await handler(req, res);
    return { insertMany, res };
  };

  test('re-sends to an assigned member after their completion coverage was removed', async () => {
    const { insertMany, res } = await runSend({ completed: false });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedCount: 1,
        newAssignmentCount: 0,
        reactivatedCount: 1,
        skippedExistingCount: 0
      })
    );
    expect(insertMany).toHaveBeenCalledWith([], { ordered: false });
    expect(mockCreateBulkNotifications).toHaveBeenCalledWith(
      [userId],
      expect.objectContaining({ metadata: { surveyId } })
    );
  });

  test('does not re-send to a member who is still covered by a response', async () => {
    const { res } = await runSend({ completed: true });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Everyone matched by that targeting choice has already completed this survey',
        assignedCount: 0
      })
    );
    expect(mockCreateBulkNotifications).not.toHaveBeenCalled();
  });

  test('reports assigned-but-removed members separately from completed members', async () => {
    const samMemberId = '6a7617eb6aaf19387f9b9918';
    const samUserId = '6a74fa886aaf19387f99dda8';
    const assignmentFind = jest.spyOn(SurveyAssignment, 'find');
    assignmentFind.mockReturnValue(
      queryResult([{ userId: samUserId }, { userId }])
    );
    jest.spyOn(SurveyResponseMember, 'find').mockReturnValue(
      queryResult([{ memberId: samMemberId }])
    );

    const stats = await surveysRouter.__test.buildCompletionStats({
      survey: { _id: surveyId },
      memberIds: [samMemberId, memberId],
      memberMap: new Map([
        [samMemberId, { _id: samMemberId, user: samUserId }],
        [memberId, { _id: memberId, user: userId }]
      ])
    });

    expect(stats.assignedUserIds).toEqual([samUserId, userId]);
    expect(stats.completedMemberIds).toEqual([samMemberId]);
    expect(stats.completedUserIds).toEqual([samUserId]);
    expect(stats.completedMembers).toBe(1);
  });
});
