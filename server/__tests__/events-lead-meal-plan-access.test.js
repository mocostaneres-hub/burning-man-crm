const express = require('express');
const http = require('http');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      _id: 'events-user-1',
      email: 'kayla.dodd@example.com',
      accountType: 'personal',
      isEventsLead: true,
      eventsLeadCampId: 'camp-1'
    };
    next();
  }
}));

jest.mock('../database/databaseAdapter', () => ({
  findActiveRoster: jest.fn(),
  findRoster: jest.fn(),
  findMember: jest.fn(),
  findUser: jest.fn(),
  findCamp: jest.fn(),
  updateCamp: jest.fn()
}));

jest.mock('../utils/permissionHelpers', () => ({
  getUserCampId: jest.fn(async () => null),
  canManageCamp: jest.fn(async () => false),
  canManageMealPlan: jest.fn(async () => true),
  canViewCampRoster: jest.fn(async () => true),
  isEventsLeadForCamp: jest.fn(async () => true)
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn(async () => ({}))
}));

jest.mock('../services/emailService', () => ({
  sendDuesEmail: jest.fn(async () => ({}))
}));

jest.mock('../services/shiftService', () => ({
  autoAssignRosterUserToOpenShifts: jest.fn(async () => ({}))
}));

jest.mock('../models/ShiftAssignment', () => ({}));
jest.mock('../models/ShiftSignup', () => ({}));
jest.mock('../models/Event', () => ({}));

const db = require('../database/databaseAdapter');
const permissionHelpers = require('../utils/permissionHelpers');
const emailService = require('../services/emailService');
const rosterRoutes = require('../routes/rosters');

const camp = { _id: 'camp-1', name: 'Dust Camp' };
const member = { _id: 'member-1', user: 'member-user-1', camp: camp._id };
const memberUser = {
  _id: 'member-user-1',
  firstName: 'Meal',
  lastName: 'Member',
  email: 'meal@example.com'
};
const senderUser = {
  _id: 'events-user-1',
  firstName: 'Kayla',
  lastName: 'Dodd',
  email: 'kayla.dodd@example.com'
};

function makeRoster(memberState = {}) {
  return {
    _id: 'roster-1',
    camp: camp._id,
    name: 'Main Roster',
    members: [
      {
        member: member._id,
        status: 'approved',
        mealPlanStatus: 'PAID',
        mealPlanPaidAt: new Date('2026-07-01T12:00:00.000Z'),
        mealPlanPaidByUserId: 'admin-1',
        overrides: {},
        ...memberState
      }
    ],
    markModified: jest.fn(),
    save: jest.fn(async function save() {
      return this;
    })
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rosters', rosterRoutes);
  return app;
}

function request(app, method, path, body = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let rawBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            rawBody += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              resolve({
                status: res.statusCode,
                body: rawBody ? JSON.parse(rawBody) : null
              });
            });
          });
        }
      );

      req.on('error', (error) => {
        server.close(() => reject(error));
      });
      req.write(payload);
      req.end();
    });
  });
}

describe('Events Lead meal-plan access', () => {
  let app;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    app = makeApp();
    db.findCamp.mockResolvedValue(camp);
    db.findMember.mockResolvedValue(member);
    db.findUser.mockImplementation(async (query = {}) => {
      if (query._id === member.user) return memberUser;
      if (query._id === senderUser._id) return senderUser;
      return null;
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('allows Events Lead to update meal-plan payment status', async () => {
    const roster = makeRoster();
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/members/member-1/meal-plan',
      { mealPlanStatus: 'UNPAID' }
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Meal plan status updated successfully',
      mealPlanStatus: 'UNPAID',
      memberId: 'member-1'
    });
    expect(permissionHelpers.canManageMealPlan).toHaveBeenCalledWith(expect.any(Object), camp._id);
    expect(roster.members[0].mealPlanStatus).toBe('UNPAID');
    expect(roster.members[0].mealPlanPaidAt).toBeNull();
    expect(roster.members[0].mealPlanPaidByUserId).toBeNull();
    expect(roster.save).toHaveBeenCalled();
  });

  test('returns only dues-paid roster members to Events Lead roster view', async () => {
    db.findActiveRoster.mockResolvedValue({
      _id: 'roster-1',
      camp: camp._id,
      rosterType: 'full_membership',
      members: [
        {
          member: {
            _id: 'member-paid',
            user: {
              _id: 'user-paid',
              firstName: 'Paid',
              lastName: 'Member',
              email: 'paid@example.com',
              phoneCountryCode: '+1',
              phoneNumber: '555-0101'
            }
          },
          duesStatus: 'PAID',
          paid: true,
          duesPaidAt: new Date('2026-07-01T12:00:00.000Z'),
          applicationData: { notes: 'private application data' },
          mealPlanStatus: 'UNPAID'
        },
        {
          member: {
            _id: 'member-unpaid',
            user: {
              _id: 'user-unpaid',
              firstName: 'Unpaid',
              lastName: 'Member',
              email: 'unpaid@example.com',
              phoneCountryCode: '+1',
              phoneNumber: '555-0102'
            }
          },
          duesStatus: 'UNPAID',
          paid: false,
          mealPlanStatus: 'UNPAID'
        }
      ]
    });

    const response = await request(app, 'GET', '/api/rosters/active?campId=camp-1');

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(1);
    expect(response.body.members[0]).toMatchObject({
      duesStatus: 'PAID',
      mealPlanStatus: 'UNPAID',
      member: {
        _id: 'member-paid',
        user: expect.objectContaining({
          email: 'paid@example.com',
          phoneCountryCode: '+1',
          phoneNumber: '555-0101'
        })
      }
    });
    expect(response.body.members[0]).not.toHaveProperty('paid');
    expect(response.body.members[0]).not.toHaveProperty('duesPaidAt');
    expect(response.body.members[0]).not.toHaveProperty('applicationData');
    expect(response.body.members[0].member.user.email).toBe('paid@example.com');
    expect(response.body.members[0].member.user.phoneNumber).toBe('555-0101');
    expect(response.body.members[0].member.user.phoneCountryCode).toBe('+1');
    expect(response.body.members.map((entry) => entry.member._id)).not.toContain('member-unpaid');
  });

  test('does not allow Events Lead to update dues payment status', async () => {
    const roster = makeRoster({ duesStatus: 'PAID' });
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/members/member-1/dues',
      { duesStatus: 'UNPAID' }
    );

    expect(response.status).toBe(403);
    expect(permissionHelpers.canManageCamp).toHaveBeenCalledWith(expect.any(Object), camp._id);
    expect(roster.save).not.toHaveBeenCalled();
  });

  test('allows Events Lead to update food preferences only', async () => {
    const roster = makeRoster();
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/members/member-1/overrides',
      { foodPreferences: ['Vegan'] }
    );

    expect(response.status).toBe(200);
    expect(permissionHelpers.canManageMealPlan).toHaveBeenCalledWith(expect.any(Object), camp._id);
    expect(roster.members[0].overrides.foodPreferences).toEqual(['Vegan']);
    expect(roster.save).toHaveBeenCalled();
  });

  test('does not allow Events Lead to update broader roster overrides', async () => {
    const roster = makeRoster();
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/members/member-1/overrides',
      { foodPreferences: ['Vegan'], playaName: 'Dusty' }
    );

    expect(response.status).toBe(403);
    expect(permissionHelpers.canManageCamp).toHaveBeenCalledWith(expect.any(Object), camp._id);
    expect(roster.save).not.toHaveBeenCalled();
  });

  test('allows Events Lead to update meal-plan communication defaults', async () => {
    const roster = makeRoster();
    db.findRoster.mockResolvedValue(roster);
    db.updateCamp.mockResolvedValue(camp);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/meal-plan/templates',
      {
        instructions: {
          subject: 'Meal plan instructions',
          body: 'Please pay for meals.'
        },
        receipt: {
          subject: 'Meal plan receipt',
          body: 'Meal payment received.'
        }
      }
    );

    expect(response.status).toBe(200);
    expect(permissionHelpers.canManageMealPlan).toHaveBeenCalledWith(expect.any(Object), camp._id);
    expect(db.updateCamp).toHaveBeenCalledWith(
      { _id: camp._id },
      expect.objectContaining({
        mealPlanInstructionsSubject: 'Meal plan instructions',
        mealPlanInstructionsBody: 'Please pay for meals.',
        mealPlanReceiptSubject: 'Meal plan receipt',
        mealPlanReceiptBody: 'Meal payment received.'
      })
    );
  });

  test('uses sender email as reply-to for meal-plan communications', async () => {
    const roster = makeRoster({ mealPlanStatus: 'UNPAID' });
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'POST',
      '/api/rosters/roster-1/members/member-1/meal-plan/send-email',
      {
        actionType: 'receipt',
        subject: 'Meal plan receipt',
        body: 'Meal payment received.'
      }
    );

    expect(response.status).toBe(200);
    expect(emailService.sendDuesEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: memberUser.email,
      subject: 'Meal plan receipt',
      body: 'Meal payment received.',
      camp,
      replyTo: senderUser.email
    }));
  });

  test('uses sender email as reply-to for dues communications when authorized', async () => {
    const roster = makeRoster({ duesStatus: 'UNPAID' });
    db.findRoster.mockResolvedValue(roster);
    permissionHelpers.canManageCamp.mockResolvedValueOnce(true);

    const response = await request(
      app,
      'POST',
      '/api/rosters/roster-1/members/member-1/dues/send-email',
      {
        actionType: 'instructions',
        subject: 'Dues instructions',
        body: 'Please pay dues.'
      }
    );

    expect(response.status).toBe(200);
    expect(emailService.sendDuesEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: memberUser.email,
      subject: 'Dues instructions',
      body: 'Please pay dues.',
      camp,
      replyTo: senderUser.email
    }));
  });

  test('does not allow Events Lead to update dues communication defaults', async () => {
    const roster = makeRoster();
    db.findRoster.mockResolvedValue(roster);

    const response = await request(
      app,
      'PUT',
      '/api/rosters/roster-1/dues/templates',
      {
        instructions: {
          subject: 'Dues instructions',
          body: 'Please pay dues.'
        },
        receipt: {
          subject: 'Dues receipt',
          body: 'Dues received.'
        }
      }
    );

    expect(response.status).toBe(403);
    expect(permissionHelpers.canManageCamp).toHaveBeenCalledWith(expect.any(Object), camp._id);
  });
});
