const express = require('express');
const http = require('http');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  }
}));

jest.mock('../database/databaseAdapter', () => ({
  findUser: jest.fn(),
  findInvite: jest.fn(),
  findCamp: jest.fn(),
  createUser: jest.fn(),
  updateUserById: jest.fn(),
  updateInviteById: jest.fn()
}));

jest.mock('../models/Admin', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Member', () => ({
  find: jest.fn(),
  findOne: jest.fn()
}));

jest.mock('../models/Roster', () => ({
  find: jest.fn()
}));

jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn(async () => ({})),
  sendPasswordResetEmail: jest.fn(async () => ({}))
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn(async () => ({}))
}));

const Admin = require('../models/Admin');
const Member = require('../models/Member');
const Roster = require('../models/Roster');
const authRoutes = require('../routes/auth');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET'
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
      req.end();
    });
  });
}

function mockMemberFind(members) {
  Member.find.mockReturnValue({
    select: jest.fn().mockResolvedValue(members)
  });
}

function mockRosterFind(rosters) {
  Roster.find.mockReturnValue({
    select: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(rosters)
    })
  });
}

function makeUser(overrides = {}) {
  const user = {
    _id: 'user-1',
    email: 'plain.member@example.com',
    accountType: 'personal',
    role: 'member',
    isSystemAdmin: false,
    ...overrides
  };
  user.toObject = () => ({
    _id: user._id,
    email: user.email,
    accountType: user.accountType,
    role: user.role,
    isSystemAdmin: user.isSystemAdmin
  });
  return user;
}

function makeRosterEntry(overrides = {}) {
  return {
    member: 'member-1',
    status: 'approved',
    role: 'member',
    isCampLead: false,
    isEventsLead: false,
    ...overrides
  };
}

describe('GET /api/auth/me roster membership flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = makeUser();
    Admin.findOne.mockResolvedValue(null);
    Member.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });
  });

  test('marks approved non-lead roster members for To-Dos landing', async () => {
    mockMemberFind([
      { _id: 'member-1', role: 'member', status: 'active', isShiftsOnly: false }
    ]);
    mockRosterFind([
      {
        _id: 'roster-1',
        camp: { _id: 'camp-1', name: 'Dust Camp', slug: 'dust-camp' },
        members: [makeRosterEntry()]
      }
    ]);

    const response = await get(makeApp(), '/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user.isRosterMember).toBe(true);
    expect(response.body.user.isCampLead).toBeUndefined();
    expect(response.body.user.isEventsLead).toBeUndefined();
  });

  test('does not mark delegated leads as plain roster members', async () => {
    mockMemberFind([
      { _id: 'member-1', role: 'member', status: 'active', isShiftsOnly: false }
    ]);
    mockRosterFind([
      {
        _id: 'roster-1',
        camp: { _id: 'camp-1', name: 'Dust Camp', slug: 'dust-camp' },
        members: [makeRosterEntry({ isEventsLead: true })]
      }
    ]);

    const response = await get(makeApp(), '/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user.isRosterMember).toBe(false);
    expect(response.body.user.isEventsLead).toBe(true);
    expect(response.body.user.eventsLeadCampId).toBe('camp-1');
  });
});
