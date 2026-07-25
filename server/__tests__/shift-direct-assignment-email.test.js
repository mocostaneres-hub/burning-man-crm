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
const {
  formatShiftDate,
  formatShiftTime,
  sendDirectAssignmentEmails
} = require('../services/shiftAssignmentEmailService');

describe('direct shift assignment emails', () => {
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

  test('the editable default template contains the requested direct-assignment message', () => {
    const template = DEFAULT_TEMPLATE_DATA[EMAIL_TEMPLATE_KEYS.SHIFT_DIRECT_ASSIGNMENT];

    expect(template.subject).toContain('{{shift_title}}');
    expect(template.textContent).toContain(
      'The camp leads at {{camp_name}} think you would be great for this shift, so they directly assigned it to you.'
    );
    expect(template.subject).not.toContain('please confirm');
    expect(template.textContent).toContain('Your spot is confirmed and no response is required');
    expect(template.textContent).toContain('drop it from My Shifts');
    expect(template.variables).toContain('confirmation_link');
  });

  test('sends one personalized template email per newly assigned user', async () => {
    const result = await sendDirectAssignmentEmails({
      userIds: ['user-1', 'user-2', 'user-1'],
      campId: 'camp-1',
      event: { eventName: 'Burn Week Operations' },
      shift: {
        title: 'Sunrise Kitchen Support',
        date: new Date('2026-08-29T19:00:00.000Z'),
        startTime: new Date('2026-08-29T15:00:00.000Z'),
        endTime: new Date('2026-08-29T19:00:00.000Z')
      }
    });

    expect(mockFindUsers).toHaveBeenCalledWith({ _id: { $in: ['user-1', 'user-2'] } });
    expect(mockSendTemplate).toHaveBeenCalledTimes(2);
    expect(mockSendTemplate).toHaveBeenNthCalledWith(
      1,
      EMAIL_TEMPLATE_KEYS.SHIFT_DIRECT_ASSIGNMENT,
      expect.objectContaining({ _id: 'user-1', email: 'alex@example.com' }),
      {
        camp_name: 'Mudskippers',
        event_name: 'Burn Week Operations',
        shift_title: 'Sunrise Kitchen Support',
        shift_date: 'Saturday, August 29, 2026',
        shift_time: '8:00 AM – 12:00 PM PDT',
        confirmation_link: 'https://app.example.com/my-shifts'
      }
    );
    expect(result).toEqual({
      attemptedCount: 2,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0
    });
  });

  test('skips users without email addresses without blocking other deliveries', async () => {
    mockFindUsers.mockResolvedValue([
      { _id: 'user-1', firstName: 'Alex', email: 'alex@example.com' },
      { _id: 'user-2', firstName: 'Sam', email: '' }
    ]);

    const result = await sendDirectAssignmentEmails({
      userIds: ['user-1', 'user-2'],
      campId: 'camp-1',
      event: { eventName: 'Build Week' },
      shift: { title: 'Kitchen' }
    });

    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      attemptedCount: 1,
      sentCount: 1,
      failedCount: 0,
      skippedCount: 1
    });
  });

  test('reports a delivery failure without rejecting the saved assignment flow', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFindUsers.mockResolvedValue([
      { _id: 'user-1', firstName: 'Alex', email: 'alex@example.com' }
    ]);
    mockSendTemplate.mockRejectedValue(new Error('Email provider unavailable'));

    await expect(sendDirectAssignmentEmails({
      userIds: ['user-1'],
      campId: 'camp-1',
      event: { eventName: 'Build Week' },
      shift: { title: 'Kitchen' }
    })).resolves.toEqual({
      attemptedCount: 1,
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('date and time formatters provide readable fallbacks', () => {
    expect(formatShiftDate(null)).toBe('Date to be confirmed');
    expect(formatShiftTime(null, null)).toBe('Time to be confirmed');
  });
});
