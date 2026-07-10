process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'noreply@g8road.com';
delete process.env.RESEND_FROM_NAME;

const mockSend = jest.fn();
const mockFindUser = jest.fn();
const mockGetTemplateByKey = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: mockSend
    }
  }))
}));

jest.mock('../database/databaseAdapter', () => ({
  findUser: mockFindUser
}));

jest.mock('../services/emailTemplateService', () => ({
  getTemplateByKey: mockGetTemplateByKey,
  renderTemplateString: (input, data = {}) => {
    if (!input) return '';
    return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variable) => {
      const value = data[variable];
      return value === undefined || value === null ? '' : String(value);
    });
  }
}));

const { sendEmail, sendTemplate } = require('../services/emailService');

describe('email template sender names', () => {
  beforeEach(() => {
    delete process.env.RESEND_FROM_NAME;
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email_123' } });
    mockFindUser.mockReset();
    mockGetTemplateByKey.mockReset();
  });

  test('uses the camp name as the sender display name for camp templates', async () => {
    mockGetTemplateByKey.mockResolvedValue({
      subject: 'Finish your {{camp_name}} application',
      htmlContent: '<p>Apply to {{camp_name}}</p>',
      textContent: 'Apply to {{camp_name}}'
    });

    await sendTemplate(
      'MEMBER_REMINDER_24H',
      { email: 'mo@sambastudio.com', firstName: 'Mo' },
      {
        camp_name: 'Mudskippers',
        invite_link: 'https://www.g8road.com/apply?invite_token=abc123'
      }
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual(expect.objectContaining({
      from: 'Mudskippers <noreply@g8road.com>',
      to: ['mo@sambastudio.com'],
      subject: 'Finish your Mudskippers application',
      html: '<p>Apply to Mudskippers</p>',
      text: 'Apply to Mudskippers'
    }));
  });

  test('keeps the configured app sender when template data has no camp name', async () => {
    process.env.RESEND_FROM_NAME = 'G8Road Burning Man CRM';
    mockGetTemplateByKey.mockResolvedValue({
      subject: 'Account notice',
      htmlContent: '<p>Hello {{user_name}}</p>',
      textContent: 'Hello {{user_name}}'
    });

    await sendTemplate(
      'ACCOUNT_NOTICE',
      { email: 'mo@sambastudio.com', firstName: 'Mo' },
      {}
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual(expect.objectContaining({
      from: 'G8Road Burning Man CRM <noreply@g8road.com>',
      subject: 'Account notice'
    }));
  });

  test('passes reply-to through to Resend when provided', async () => {
    await sendEmail({
      to: 'member@example.com',
      subject: 'Payment received',
      text: 'Thanks for paying.',
      replyTo: 'kayla.dodd@example.com'
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual(expect.objectContaining({
      to: ['member@example.com'],
      subject: 'Payment received',
      replyTo: 'kayla.dodd@example.com'
    }));
  });
});
