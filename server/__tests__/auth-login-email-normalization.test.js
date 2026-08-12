const express = require('express');
const http = require('http');

jest.mock('../database/databaseAdapter', () => ({
  findUser: jest.fn(),
  comparePassword: jest.fn(),
  updateUserById: jest.fn()
}));

jest.mock('../services/activityLogger', () => ({
  recordActivity: jest.fn(async () => null)
}));

jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn(async () => null),
  sendPasswordResetEmail: jest.fn(async () => null)
}));

const db = require('../database/databaseAdapter');
const authRoutes = require('../routes/auth');

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
};

const post = (app, path, body) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    }, (response) => {
      let rawBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { rawBody += chunk; });
      response.on('end', () => server.close(() => resolve({
        status: response.statusCode,
        body: rawBody ? JSON.parse(rawBody) : null
      })));
    });

    request.on('error', (error) => server.close(() => reject(error)));
    request.end(JSON.stringify(body));
  });
});

describe('POST /api/auth/login email normalization', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'login-normalization-test-secret';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preserves dots in a Gmail address when looking up the user', async () => {
    const user = {
      _id: 'member-user-1',
      email: 'dotted.member@gmail.com',
      password: 'stored-hash',
      accountType: 'personal',
      role: 'member',
      isActive: true
    };
    db.findUser.mockResolvedValue(user);
    db.comparePassword.mockResolvedValue(true);
    db.updateUserById.mockResolvedValue(user);

    const response = await post(makeApp(), '/api/auth/login', {
      email: '  Dotted.Member@gmail.com  ',
      password: 'new-password'
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login successful');
    expect(db.findUser).toHaveBeenCalledWith({
      email: 'dotted.member@gmail.com'
    });
    expect(db.comparePassword).toHaveBeenCalledWith(user, 'new-password');
  });
});
