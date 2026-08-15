const surveysRouter = require('../routes/surveys');

const {
  planSurveyQuestionPersistence,
  remapSurveyResponseAnswers,
  deleteSurveyResponseCascade,
  reconcileCoveredMemberIdsForAnswerEdit
} = surveysRouter.__test;

const SurveyResponse = require('../models/SurveyResponse');
const SurveyResponseMember = require('../models/SurveyResponseMember');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('survey response EAP delivery status', () => {
  const requiredFields = {
    surveyId: '65f000000000000000000101',
    campId: '65f000000000000000000102',
    submittedByUserId: '65f000000000000000000103',
    submittedByMemberId: '65f000000000000000000104'
  };

  test('defaults EAP sent to false for existing and new responses', () => {
    const response = new SurveyResponse(requiredFields);

    expect(response.eapSent).toBe(false);
  });

  test('stores an explicitly checked EAP sent status', () => {
    const response = new SurveyResponse({ ...requiredFields, eapSent: true });

    expect(response.eapSent).toBe(true);
  });
});

describe('survey response question identity handling', () => {
  test('preserves an existing question by incoming _id when saving a survey', () => {
    const existingQuestionId = '64f000000000000000000001';
    const removedQuestionId = '64f000000000000000000002';

    const plan = planSurveyQuestionPersistence(
      [
        {
          _id: existingQuestionId,
          localId: 'question_arrival',
          blockType: 'short_answer',
          prompt: 'Arrival plan'
        },
        {
          localId: 'question_vehicle',
          blockType: 'multiple_choice',
          prompt: 'Vehicle?'
        }
      ],
      [
        {
          _id: existingQuestionId,
          localId: 'question_arrival',
          blockType: 'short_answer',
          order: 0
        },
        {
          _id: removedQuestionId,
          localId: 'question_old',
          blockType: 'paragraph',
          order: 1
        }
      ]
    );

    expect(plan.operations).toHaveLength(2);
    expect(plan.operations[0].existingId).toBe(existingQuestionId);
    expect(plan.operations[0].question.prompt).toBe('Arrival plan');
    expect(plan.operations[1].existingId).toBeNull();
    expect(plan.deleteIds).toEqual([removedQuestionId]);
  });

  test('falls back to localId when the client does not send a question _id', () => {
    const existingQuestionId = '64f000000000000000000003';

    const plan = planSurveyQuestionPersistence(
      [
        {
          localId: 'question_departure',
          blockType: 'date',
          prompt: 'Departure date'
        }
      ],
      [
        {
          _id: existingQuestionId,
          localId: 'question_departure',
          blockType: 'date',
          order: 0
        }
      ]
    );

    expect(plan.operations[0].existingId).toBe(existingQuestionId);
    expect(plan.deleteIds).toEqual([]);
  });

  test('treats duplicate incoming question ids as new questions after the first match', () => {
    const existingQuestionId = '64f000000000000000000004';

    const plan = planSurveyQuestionPersistence(
      [
        {
          _id: existingQuestionId,
          localId: 'question_food',
          blockType: 'short_answer',
          prompt: 'Food'
        },
        {
          _id: existingQuestionId,
          localId: 'question_food_copy',
          blockType: 'short_answer',
          prompt: 'Food copy'
        }
      ],
      [
        {
          _id: existingQuestionId,
          localId: 'question_food',
          blockType: 'short_answer',
          order: 0
        }
      ]
    );

    expect(plan.operations[0].existingId).toBe(existingQuestionId);
    expect(plan.operations[1].existingId).toBeNull();
  });

  test('remaps legacy answer question IDs onto current questions for readback', () => {
    const currentQuestions = [
      {
        _id: '65f000000000000000000001',
        blockType: 'short_answer',
        prompt: 'Arrival plan'
      },
      {
        _id: '65f000000000000000000002',
        blockType: 'checkboxes',
        prompt: 'What are you bringing?'
      }
    ];

    const remapped = remapSurveyResponseAnswers(
      [
        {
          questionId: '64f000000000000000000011',
          blockType: 'short_answer',
          value: 'Tuesday'
        },
        {
          questionId: '64f000000000000000000012',
          blockType: 'checkboxes',
          value: ['Tent']
        }
      ],
      currentQuestions
    );

    expect(remapped).toEqual([
      {
        questionId: currentQuestions[0]._id,
        legacyQuestionId: '64f000000000000000000011',
        blockType: 'short_answer',
        value: 'Tuesday'
      },
      {
        questionId: currentQuestions[1]._id,
        legacyQuestionId: '64f000000000000000000012',
        blockType: 'checkboxes',
        value: ['Tent']
      }
    ]);
  });

  test('does not rewrite answers that already point at current questions', () => {
    const currentQuestionId = '65f000000000000000000003';
    const answer = {
      questionId: currentQuestionId,
      blockType: 'paragraph',
      value: 'Already linked'
    };

    const remapped = remapSurveyResponseAnswers(
      [answer],
      [
        {
          _id: currentQuestionId,
          blockType: 'paragraph',
          prompt: 'Notes'
        }
      ]
    );

    expect(remapped[0]).toBe(answer);
  });
});

describe('survey response deletion reset', () => {
  test('deletes the submitted response and its covered-member rows', async () => {
    const session = { id: 'session-1' };
    const responseMemberSession = jest.fn().mockResolvedValue({ deletedCount: 3 });
    const responseSession = jest.fn().mockResolvedValue({ deletedCount: 1 });

    jest.spyOn(SurveyResponseMember, 'deleteMany').mockReturnValue({
      session: responseMemberSession
    });
    jest.spyOn(SurveyResponse, 'deleteOne').mockReturnValue({
      session: responseSession
    });

    const result = await deleteSurveyResponseCascade(
      {
        _id: 'response-1',
        surveyId: 'survey-1'
      },
      { session }
    );

    expect(SurveyResponseMember.deleteMany).toHaveBeenCalledWith({
      surveyId: 'survey-1',
      responseId: 'response-1'
    });
    expect(responseMemberSession).toHaveBeenCalledWith(session);
    expect(SurveyResponse.deleteOne).toHaveBeenCalledWith({
      _id: 'response-1',
      surveyId: 'survey-1'
    });
    expect(responseSession).toHaveBeenCalledWith(session);
    expect(result).toEqual({
      responses: 1,
      responseMembers: 3
    });
  });
});

describe('survey people-answer coverage edits', () => {
  const peopleQuestionId = '65f000000000000000000010';
  const questionById = new Map([
    [peopleQuestionId, { _id: peopleQuestionId, blockType: 'people' }]
  ]);

  const peopleAnswer = (memberIds) => ({
    questionId: peopleQuestionId,
    blockType: 'people',
    value: memberIds.map((memberId) => ({ memberId }))
  });

  test('adds newly selected people to the response coverage', () => {
    const coveredMemberIds = reconcileCoveredMemberIdsForAnswerEdit({
      submittedByMemberId: 'member-submit',
      currentCoveredMemberIds: ['member-submit', 'member-one'],
      currentAnswers: [peopleAnswer(['member-one'])],
      nextAnswers: [peopleAnswer(['member-one', 'member-two'])],
      questionById
    });

    expect(coveredMemberIds).toEqual(['member-submit', 'member-one', 'member-two']);
  });

  test('removes people deleted from the answer so they can respond again', () => {
    const coveredMemberIds = reconcileCoveredMemberIdsForAnswerEdit({
      submittedByMemberId: 'member-submit',
      currentCoveredMemberIds: ['member-submit', 'member-one', 'member-two'],
      currentAnswers: [peopleAnswer(['member-one', 'member-two'])],
      nextAnswers: [peopleAnswer(['member-one'])],
      questionById
    });

    expect(coveredMemberIds).toEqual(['member-submit', 'member-one']);
  });

  test('preserves members covered independently of the people answer', () => {
    const coveredMemberIds = reconcileCoveredMemberIdsForAnswerEdit({
      submittedByMemberId: 'member-submit',
      currentCoveredMemberIds: ['member-submit', 'member-delegate', 'member-one'],
      currentAnswers: [peopleAnswer(['member-one'])],
      nextAnswers: [peopleAnswer([])],
      questionById
    });

    expect(coveredMemberIds).toEqual(['member-submit', 'member-delegate']);
  });
});
