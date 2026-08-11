process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/survey-route-test';

jest.mock('../middleware/auth', () => ({
  authenticateToken: (_req, _res, next) => next()
}));

jest.mock('../utils/permissionHelpers', () => ({
  canManageEventPlanning: jest.fn().mockResolvedValue(true)
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const mongoose = require('mongoose');
const db = require('../database/databaseAdapter');
const Survey = require('../models/Survey');
const SurveyQuestion = require('../models/SurveyQuestion');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyResponseMember = require('../models/SurveyResponseMember');
const surveysRouter = require('../routes/surveys');

const findRouteHandler = (method, path) => {
  const routeLayer = surveysRouter.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods?.[method]
  );
  if (!routeLayer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
};

const queryResult = (value) => {
  const query = {
    select: jest.fn(() => query),
    session: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value)
  };
  return query;
};

describe('PUT survey response people answer', () => {
  const surveyId = '6a0d485867ec85e3a098a3e9';
  const responseId = '6a77d36b6aaf19387f9c9652';
  const questionId = '6a53f70f76a727d10efd6b6e';
  const campId = '68e43f61a8f6ec1271586306';
  const samId = '6a7617eb6aaf19387f9b9918';
  const garryId = '6a76412d6aaf19387f9ba193';
  const chrisId = '6a73dfb4e904356c5ad67476';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const runChrisAddCase = async ({ transactionUnsupported = false } = {}) => {
    const survey = { _id: surveyId, campId, title: '2026 Mudskippers Survey' };
    const response = {
      _id: responseId,
      surveyId,
      submittedByMemberId: samId,
      submittedByUserId: '6a7617eb6aaf19387f9b9900',
      coveredMemberIds: [samId, garryId],
      answers: [
        {
          questionId,
          blockType: 'people',
          value: [
            { memberId: samId, name: 'Sam Ali' },
            { memberId: garryId, name: 'Garry Fitzpatrick' }
          ],
          valueType: 'array'
        }
      ],
      editHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn(function toObject() {
        return { ...this };
      })
    };

    jest.spyOn(Survey, 'findById').mockReturnValue(queryResult(survey));
    jest.spyOn(SurveyQuestion, 'find').mockReturnValue(
      queryResult([{ _id: questionId, blockType: 'people' }])
    );
    jest.spyOn(SurveyResponse, 'findOne').mockResolvedValue(response);
    jest.spyOn(db, 'findActiveRoster').mockResolvedValue({
      members: [
        { status: 'approved', member: { _id: samId, name: 'Sam Ali' } },
        { status: 'approved', member: { _id: garryId, name: 'Garry Fitzpatrick' } },
        { status: 'approved', member: { _id: chrisId, name: 'Chris Brady' } }
      ]
    });
    jest.spyOn(SurveyResponseMember, 'find').mockReturnValue(queryResult([]));
    jest.spyOn(SurveyResponseMember, 'deleteMany').mockReturnValue(queryResult({ deletedCount: 2 }));
    const insertMany = jest.spyOn(SurveyResponseMember, 'insertMany').mockResolvedValue([]);
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (callback) => {
        if (transactionUnsupported) {
          const error = new Error('Transaction numbers are only allowed on a replica set member or mongos');
          error.code = 20;
          throw error;
        }
        return callback();
      },
      endSession: jest.fn().mockResolvedValue(undefined)
    });

    const req = {
      params: { surveyId, responseId },
      body: {
        answers: [
          {
            questionId,
            blockType: 'people',
            value: [
              { memberId: samId, name: 'Sam Ali' },
              { memberId: garryId, name: 'Garry Fitzpatrick' },
              { memberId: chrisId, name: 'Chris Brady (Phantom)' }
            ],
            valueType: 'array'
          }
        ],
        editReason: 'Updated Q2 shelter group'
      },
      user: { _id: '6a0000000000000000000001' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    const handler = findRouteHandler('put', '/:surveyId/responses/:responseId');
    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Survey response updated successfully' })
    );
    expect(response.coveredMemberIds).toEqual([samId, garryId, chrisId]);
    expect(response.answers[0].value.map((person) => person.memberId)).toEqual([
      samId,
      garryId,
      chrisId
    ]);
    expect(response.save).toHaveBeenCalled();
    expect(insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ responseId, memberId: chrisId, submitterMemberId: samId })
      ]),
      expect.objectContaining({ ordered: true })
    );
  };

  test('adds Chris Brady to Sam Ali response and rebuilds completion coverage', async () => {
    await runChrisAddCase();
  });

  test('adds Chris when MongoDB transactions are unavailable', async () => {
    await runChrisAddCase({ transactionUnsupported: true });
  });
});
