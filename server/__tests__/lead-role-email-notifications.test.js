const express = require('express');
const http = require('http');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      _id: 'admin-1',
      campLeadCampId: 'camp-1'
    };
    next();
  }
}));

jest.mock('../database/databaseAdapter', () => ({
  findActiveRoster: jest.fn(),
  findRoster: jest.fn(),
  findMember: jest.fn(),
  findUser: jest.fn(),
  findCamp: jest.fn()
}));

jest.mock('../utils/permissionHelpers', () => ({
  getUserCampId: jest.fn(async () => 'camp-1'),
  canManageCamp: jest.fn(async () => true),
  canViewCampRoster: jest.fn(async () => true),
  isEventsLeadForCamp: jest.fn(async () => false)
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn(async () => ({}))
}));

jest.mock('../services/emailService', () => ({
  sendDuesEmail: jest.fn(async () => ({})),
  sendCampLeadGrantedEmail: jest.fn(async () => ({})),
  sendEventsLeadGrantedEmail: jest.fn(async () => ({}))
}));

jest.mock('../services/shiftService', () => ({
  autoAssignRosterUserToOpenShifts: jest.fn(async () => ({}))
}));

jest.mock('../models/ShiftAssignment', () => ({}));
jest.mock('../models/ShiftSignup', () => ({}));
jest.mock('../models/Event', () => ({}));

const db = require('../database/databaseAdapter');
const emailService = require('../services/emailService');
const rosterRoutes = require('../routes/rosters');

const camp = { _id: 'camp-1', name: 'Dust Camp', slug: 'dust-camp' };
const user = {
  _id: 'user-1',
  firstName: 'Avery',
  lastName: 'Lead',
  email: 'avery@example.com'
};
const member = { _id: 'member-1', user: user._id, camp: camp._id };

function makeRoster(memberState = {}) {
  return {
    _id: 'roster-1',
    camp: camp._id,
    members: [
      {
        member: member._id,
        status: 'approved',
        isCampLead: false,
        isEventsLead: false,
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

function post(app, path, body = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'POST',
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

describe('lead role email notifications', () => {
  let app;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    app = makeApp();
    db.findMember.mockResolvedValue(member);
    db.findUser.mockResolvedValue(user);
    db.findCamp.mockResolvedValue(camp);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('sends the Camp Lead email when access is granted', async () => {
    const roster = makeRoster({ isCampLead: false });
    db.findActiveRoster.mockResolvedValue(roster);
    db.findRoster.mockResolvedValue(roster);

    const response = await post(app, '/api/rosters/member/member-1/grant-camp-lead');

    expect(response.status).toBe(200);
    expect(roster.members[0].isCampLead).toBe(true);
    expect(emailService.sendCampLeadGrantedEmail).toHaveBeenCalledWith(user, camp);
    expect(emailService.sendEventsLeadGrantedEmail).not.toHaveBeenCalled();
  });

  test('does not send a Camp Lead email when access is revoked', async () => {
    const roster = makeRoster({ isCampLead: true });
    db.findActiveRoster.mockResolvedValue(roster);
    db.findRoster.mockResolvedValue(roster);

    const response = await post(app, '/api/rosters/member/member-1/revoke-camp-lead');

    expect(response.status).toBe(200);
    expect(roster.members[0].isCampLead).toBe(false);
    expect(emailService.sendCampLeadGrantedEmail).not.toHaveBeenCalled();
    expect(emailService.sendEventsLeadGrantedEmail).not.toHaveBeenCalled();
  });

  test('sends the Events Lead email when access is granted', async () => {
    const roster = makeRoster({ isEventsLead: false });
    db.findActiveRoster.mockResolvedValue(roster);

    const response = await post(app, '/api/rosters/member/member-1/grant-events-lead');

    expect(response.status).toBe(200);
    expect(roster.members[0].isEventsLead).toBe(true);
    expect(emailService.sendEventsLeadGrantedEmail).toHaveBeenCalledWith(user, camp);
    expect(emailService.sendCampLeadGrantedEmail).not.toHaveBeenCalled();
  });

  test('does not send an Events Lead email when access is revoked', async () => {
    const roster = makeRoster({ isEventsLead: true });
    db.findActiveRoster.mockResolvedValue(roster);

    const response = await post(app, '/api/rosters/member/member-1/revoke-events-lead');

    expect(response.status).toBe(200);
    expect(roster.members[0].isEventsLead).toBe(false);
    expect(emailService.sendEventsLeadGrantedEmail).not.toHaveBeenCalled();
    expect(emailService.sendCampLeadGrantedEmail).not.toHaveBeenCalled();
  });
});
