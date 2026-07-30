describe('DatabaseAdapter.updateUserPasswordById', () => {
  const originalMongoUri = process.env.MONGODB_URI;

  afterAll(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  test('saves through the User model and verifies the reloaded credential', async () => {
    process.env.MONGODB_URI = 'mongodb://password-test';
    jest.resetModules();

    const savedUser = {
      _id: 'member-1',
      password: 'old-hash',
      authProviders: ['google'],
      save: jest.fn(async function save() {
        this.password = 'new-hash';
        return this;
      })
    };
    const persistedUser = {
      _id: 'member-1',
      password: 'new-hash',
      authProviders: ['google', 'password'],
      comparePassword: jest.fn().mockResolvedValue(true)
    };
    const findById = jest.fn()
      .mockResolvedValueOnce(savedUser)
      .mockResolvedValueOnce(persistedUser);

    jest.doMock('../models/User', () => ({ findById }));

    const db = require('../database/databaseAdapter');
    const result = await db.updateUserPasswordById('member-1', 'temporary-password');

    expect(savedUser.password).toBe('new-hash');
    expect(savedUser.authProviders).toEqual(['google', 'password']);
    expect(savedUser.save).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledTimes(2);
    expect(persistedUser.comparePassword).toHaveBeenCalledWith('temporary-password');
    expect(result).toBe(persistedUser);
  });

  test('throws instead of reporting success when the reloaded credential fails', async () => {
    process.env.MONGODB_URI = 'mongodb://password-test';
    jest.resetModules();

    const savedUser = {
      _id: 'member-1',
      password: 'old-hash',
      authProviders: ['password'],
      save: jest.fn().mockResolvedValue(undefined)
    };
    const persistedUser = {
      _id: 'member-1',
      password: 'unchanged-hash',
      authProviders: ['password'],
      comparePassword: jest.fn().mockResolvedValue(false)
    };
    const findById = jest.fn()
      .mockResolvedValueOnce(savedUser)
      .mockResolvedValueOnce(persistedUser);

    jest.doMock('../models/User', () => ({ findById }));

    const db = require('../database/databaseAdapter');

    await expect(
      db.updateUserPasswordById('member-1', 'temporary-password')
    ).rejects.toMatchObject({
      code: 'PASSWORD_UPDATE_VERIFICATION_FAILED'
    });
  });
});
