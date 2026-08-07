const mockFindCamp = jest.fn();
const mockFindUsers = jest.fn();
const mockSendTemplate = jest.fn();
const originalClientUrl = process.env.CLIENT_URL;

jest.mock('../database/databaseAdapter', () => ({
  findCamp: mockFindCamp,
  findUsers: mockFindUsers
}));

jest.mock('../services/emailService', () => ({
  sendTemplate: mockSendTemplate
}));

const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');
const { DEFAULT_TEMPLATE_DATA } = require('../services/emailTemplateService');
const { sendSurveyAssignmentEmails } = require('../services/surveyAssignmentEmailService');

describe('survey assignment emails', () => {
  beforeEach(() => {
    process.env.CLIENT_URL = 'https://app.example.com/';
    mockFindCamp.mockReset();
    mockFindUsers.mockReset();
    mockSendTemplate.mockReset();
    mockFindCamp.mockResolvedValue({ _id: 'camp-1', name: 'Mudskippers' });
    mockFindUsers.mockResolvedValue([
      { _id: 'user-1', firstName: 'Alex', email: 'alex@example.com' },
      { _id: 'user-2', firstName: 'Sam', email: 'sam@example.com' }
    ]);
    mockSendTemplate.mockResolvedValue({});
  });

  afterAll(() => {
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
    }
  });

  test('the default template links recipients to the assigned survey', () => {
    const template = DEFAULT_TEMPLATE_DATA[EMAIL_TEMPLATE_KEYS.SURVEY_ASSIGNMENT];

    expect(template.subject).toContain('{{survey_title}}');
    expect(template.textContent).toContain('{{survey_link}}');
    expect(template.variables).toEqual(
      expect.arrayContaining(['camp_name', 'user_name', 'survey_title', 'survey_link'])
    );
  });

  test('sends one personalized email per newly assigned user', async () => {
    const result = await sendSurveyAssignmentEmails({
      userIds: ['user-1', 'user-2', 'user-1'],
      campId: 'camp-1',
      survey: { _id: 'survey-1', title: 'Arrival Plans' }
    });

    expect(mockFindUsers).toHaveBeenCalledWith({ _id: { $in: ['user-1', 'user-2'] } });
    expect(mockSendTemplate).toHaveBeenCalledTimes(2);
    expect(mockSendTemplate).toHaveBeenNthCalledWith(
      1,
      EMAIL_TEMPLATE_KEYS.SURVEY_ASSIGNMENT,
      expect.objectContaining({ _id: 'user-1', email: 'alex@example.com' }),
      {
        camp_name: 'Mudskippers',
        survey_title: 'Arrival Plans',
        survey_link: 'https://app.example.com/surveys/survey-1'
      }
    );
    expect(result).toEqual({
      attemptedCount: 2,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0
    });
  });

  test('does not reject the assignment flow when delivery fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFindUsers.mockResolvedValue([
      { _id: 'user-1', firstName: 'Alex', email: 'alex@example.com' }
    ]);
    mockSendTemplate.mockRejectedValue(new Error('Email provider unavailable'));

    await expect(sendSurveyAssignmentEmails({
      userIds: ['user-1'],
      campId: 'camp-1',
      survey: { _id: 'survey-1', title: 'Arrival Plans' }
    })).resolves.toEqual({
      attemptedCount: 1,
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
