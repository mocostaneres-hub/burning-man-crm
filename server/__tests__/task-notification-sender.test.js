const mockSendEmail = jest.fn();
const mockFindCamp = jest.fn();

jest.mock('../services/emailService', () => ({
  sendEmail: mockSendEmail
}));

jest.mock('../database/databaseAdapter', () => ({
  findCamp: mockFindCamp,
  findUser: jest.fn()
}));

const {
  sendTaskAssignmentEmail,
  sendTaskCommentEmail
} = require('../services/taskNotifications');

const makeTask = (overrides = {}) => ({
  _id: 'task-1',
  taskIdCode: 'ABC123',
  campId: 'camp-1',
  title: 'Build shade',
  description: 'Coordinate the shade structure.',
  assignedTo: [],
  watchers: [],
  ...overrides
});

describe('task notification sender names', () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({});
    mockFindCamp.mockReset();
    mockFindCamp.mockResolvedValue({ _id: 'camp-1', name: 'Mudskippers' });
  });

  test('task assignment emails use the task camp as sender display name', async () => {
    await sendTaskAssignmentEmail(
      makeTask(),
      [{ _id: 'user-1', email: 'member@example.com' }]
    );

    expect(mockFindCamp).toHaveBeenCalledWith({ _id: 'camp-1' });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toEqual(expect.objectContaining({
      to: 'member@example.com',
      fromName: 'Mudskippers',
      subject: 'You have been assigned to task ABC123: Build shade'
    }));
  });

  test('task comment emails can use an already-populated camp name', async () => {
    await sendTaskCommentEmail(
      makeTask({
        campId: { _id: 'camp-1', name: 'Camp Popcorn' },
        assignedTo: [{ _id: 'user-1', email: 'member@example.com' }],
        watchers: []
      }),
      'Looks good.',
      { _id: 'author-1', firstName: 'Mo', lastName: 'Tester', email: 'mo@example.com' }
    );

    expect(mockFindCamp).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toEqual(expect.objectContaining({
      to: 'member@example.com',
      fromName: 'Camp Popcorn',
      subject: 'New Comment on ABC123: Build shade'
    }));
  });
});
