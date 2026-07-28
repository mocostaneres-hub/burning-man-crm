const express = require('express');
const http = require('http');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      _id: 'camp-owner-1',
      accountType: 'camp',
      campId: 'camp-1'
    };
    next();
  }
}));

jest.mock('../database/databaseAdapter', () => ({
  findCamp: jest.fn(),
  findMember: jest.fn(),
  findMembers: jest.fn(),
  findUser: jest.fn()
}));

const db = require('../database/databaseAdapter');
const roleManagementRoutes = require('../routes/roleManagement');

const objectId = (value) => ({ toString: () => value });

const makeMemberDocument = ({ memberId, userId, reviewedAt, role }) => ({
  _id: objectId(memberId),
  user: objectId(userId),
  reviewedAt,
  role,
  toObject: () => ({
    _id: memberId,
    user: userId,
    reviewedAt,
    role
  })
});

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/role-management', roleManagementRoutes);
  return app;
};

const request = (app, path) => new Promise((resolve, reject) => {
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
          server.close(() => resolve({
            status: res.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null
          }));
        });
      }
    );

    req.on('error', (error) => {
      server.close(() => reject(error));
    });
    req.end();
  });
});

describe('GET /api/role-management/camp/:campId/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.findCamp.mockResolvedValue({
      _id: 'camp-1',
      owner: 'camp-owner-1'
    });
    db.findMember.mockResolvedValue(null);
    db.findUser.mockResolvedValue({
      _id: 'user-1',
      firstName: 'Daniel',
      lastName: 'Mitz',
      email: 'daniel@example.com',
      skills: []
    });
  });

  it('returns one plain member record when duplicate documents share a user ID', async () => {
    db.findMembers.mockResolvedValue([
      makeMemberDocument({
        memberId: 'member-old',
        userId: 'user-1',
        reviewedAt: new Date('2026-01-01T00:00:00.000Z'),
        role: 'member'
      }),
      makeMemberDocument({
        memberId: 'member-new',
        userId: 'user-1',
        reviewedAt: new Date('2026-07-01T00:00:00.000Z'),
        role: 'camp-lead'
      })
    ]);

    const response = await request(
      makeApp(),
      '/api/role-management/camp/camp-1/members'
    );

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(1);
    expect(response.body.members[0]).toMatchObject({
      _id: 'member-new',
      role: 'camp-lead',
      user: {
        _id: 'user-1',
        firstName: 'Daniel',
        lastName: 'Mitz'
      }
    });
    expect(response.body.members[0]._doc).toBeUndefined();
    expect(db.findUser).toHaveBeenCalledTimes(1);
  });
});
