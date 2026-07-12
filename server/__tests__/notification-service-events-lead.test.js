const originalMongoUri = process.env.MONGODB_URI;
process.env.MONGODB_URI = 'mongodb://notification-service-events-lead-test';

jest.mock('../models/Notification', () => ({
  create: jest.fn(),
  insertMany: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../models/Member', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Roster', () => ({
  exists: jest.fn(),
  find: jest.fn()
}));

const Notification = require('../models/Notification');
const Member = require('../models/Member');
const Roster = require('../models/Roster');
const {
  clearApplicationSubmittedNotificationsForEventsLeadUsers,
  getUserNotifications
} = require('../services/notificationService');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

function mockLeanQuery(result) {
  return {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result)
  };
}

function mockNotificationFind(notifications) {
  Notification.find.mockReturnValue(mockLeanQuery(notifications));
}

describe('Events Lead application-submitted notification cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.deleteMany.mockResolvedValue({ deletedCount: 0 });
    Notification.countDocuments.mockResolvedValue(0);
    mockNotificationFind([]);
  });

  afterAll(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  test('clears application-submitted notifications before listing notifications for an Events Lead', async () => {
    const remainingNotifications = [
      { _id: 'shift-1', recipient: 'user-events-1', type: NOTIFICATION_TYPES.SHIFT_CREATED }
    ];

    Member.findOne.mockReturnValue(mockLeanQuery({ _id: 'member-events-1' }));
    Roster.exists.mockResolvedValue({ _id: 'roster-1' });
    Notification.deleteMany.mockResolvedValue({ deletedCount: 2 });
    mockNotificationFind(remainingNotifications);
    Notification.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await getUserNotifications('user-events-1');

    expect(Notification.deleteMany).toHaveBeenCalledWith({
      recipient: 'user-events-1',
      type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED
    });
    expect(result.notifications).toEqual(remainingNotifications);
    expect(result.unreadCount).toBe(1);
    expect(result.total).toBe(1);
  });

  test('does not clear application-submitted notifications for non-Events users', async () => {
    Member.findOne.mockReturnValue(mockLeanQuery({ _id: 'member-regular-1' }));
    Roster.exists.mockResolvedValue(null);
    Notification.countDocuments
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3);

    await getUserNotifications('user-regular-1');

    expect(Notification.deleteMany).not.toHaveBeenCalled();
  });

  test('startup cleanup clears application-submitted notifications for all current Events Leads', async () => {
    Roster.find.mockReturnValue(mockLeanQuery([
      {
        members: [
          {
            isEventsLead: true,
            status: 'approved',
            member: { user: 'user-events-1' }
          },
          {
            isEventsLead: false,
            status: 'approved',
            member: { user: 'user-camp-lead-1' }
          }
        ]
      },
      {
        members: [
          {
            isEventsLead: true,
            status: 'pending',
            member: { user: 'user-pending-events-1' }
          },
          {
            isEventsLead: true,
            status: 'approved',
            member: { user: 'user-events-2' }
          }
        ]
      }
    ]));
    Notification.deleteMany.mockResolvedValue({ deletedCount: 4 });

    const result = await clearApplicationSubmittedNotificationsForEventsLeadUsers();

    expect(Notification.deleteMany).toHaveBeenCalledWith({
      recipient: { $in: ['user-events-1', 'user-events-2'] },
      type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED
    });
    expect(result.deletedCount).toBe(4);
    expect(result.eventsLeadUserCount).toBe(2);
  });
});
