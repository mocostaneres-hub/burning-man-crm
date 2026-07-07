const mockDB = require('../database/mockDatabase');

describe('mock database member filters', () => {
  let originalCollections;
  let originalLoaded;

  beforeEach(() => {
    originalCollections = mockDB.collections;
    originalLoaded = mockDB.loaded;
    mockDB.loaded = true;
    mockDB.collections = {
      ...originalCollections,
      members: new Map([
        ['member-1', {
          _id: 'member-1',
          camp: 'camp-1',
          user: 'user-1',
          email: 'linked@example.com',
          status: 'active'
        }],
        ['member-2', {
          _id: 'member-2',
          camp: 'camp-2',
          user: 'user-2',
          email: 'other@example.com',
          status: 'active'
        }],
        ['member-3', {
          _id: 'member-3',
          camp: 'camp-1',
          email: 'unlinked@example.com',
          status: 'pending'
        }]
      ])
    };
  });

  afterEach(() => {
    mockDB.collections = originalCollections;
    mockDB.loaded = originalLoaded;
  });

  test('findMembers filters by linked user id', async () => {
    const members = await mockDB.findMembers({ user: 'user-1' });

    expect(members.map((member) => member._id)).toEqual(['member-1']);
  });

  test('findMembers filters email-only roster records case-insensitively', async () => {
    const members = await mockDB.findMembers({ email: 'UNLINKED@example.com' });

    expect(members.map((member) => member._id)).toEqual(['member-3']);
  });

  test('findMembers combines user, camp, and status filters', async () => {
    const members = await mockDB.findMembers({
      camp: 'camp-1',
      user: 'user-1',
      status: 'active'
    });

    expect(members.map((member) => member._id)).toEqual(['member-1']);
  });

  test('findMember skips unlinked records when filtering by user', async () => {
    const member = await mockDB.findMember({ user: 'missing-user' });

    expect(member).toBeNull();
  });
});
