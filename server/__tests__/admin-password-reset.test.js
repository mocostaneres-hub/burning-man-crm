const express = require('express');
const http = require('http');

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      _id: 'admin-1',
      accountType: 'admin',
      isSystemAdmin: true
    };
    next();
  },
  requireAdmin: (req, res, next) => next()
}));

jest.mock('../database/databaseAdapter', () => ({
  updateUserPasswordById: jest.fn()
}));

jest.mock('../services/activityLogger', () => ({
  recordFieldChange: jest.fn(async () => null),
  recordActivity: jest.fn(async () => null)
}));

const db = require('../database/databaseAdapter');
const { recordActivity } = require('../services/activityLogger');
const userRoutes = require('../routes/users');

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  return app;
};

const put = (app, path, body) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        }
      },
      (response) => {
        let rawBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          rawBody += chunk;
        });
        response.on('end', () => {
          server.close(() => resolve({
            status: response.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null
          }));
        });
      }
    );

    request.on('error', (error) => {
      server.close(() => reject(error));
    });
    request.end(JSON.stringify(body));
  });
});

describe('PUT /api/users/:id/password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reports success only after the password update is verified', async () => {
    db.updateUserPasswordById.mockResolvedValue({
      _id: 'member-1',
      email: 'member@example.com'
    });

    const response = await put(makeApp(), '/api/users/member-1/password', {
      newPassword: 'temporary-password'
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Password updated successfully and is effective immediately',
      passwordUpdated: true
    });
    expect(db.updateUserPasswordById).toHaveBeenCalledWith(
      'member-1',
      'temporary-password'
    );
    expect(recordActivity).toHaveBeenCalledWith(
      'MEMBER',
      'member-1',
      'admin-1',
      'PASSWORD_CHANGED',
      expect.objectContaining({ field: 'password' })
    );
  });

  test('does not report success when persistence verification fails', async () => {
    db.updateUserPasswordById.mockRejectedValue(
      new Error('Password update verification failed')
    );

    const response = await put(makeApp(), '/api/users/member-1/password', {
      newPassword: 'temporary-password'
    });

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('could not be verified');
    expect(response.body.passwordUpdated).toBeUndefined();
    expect(recordActivity).not.toHaveBeenCalled();
  });

  test('rejects passwords shorter than six characters', async () => {
    const response = await put(makeApp(), '/api/users/member-1/password', {
      newPassword: 'short'
    });

    expect(response.status).toBe(400);
    expect(db.updateUserPasswordById).not.toHaveBeenCalled();
  });
});
