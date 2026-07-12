const surveysRouter = require('../routes/surveys');

const {
  planSurveyQuestionPersistence,
  remapSurveyResponseAnswers
} = surveysRouter.__test;

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
