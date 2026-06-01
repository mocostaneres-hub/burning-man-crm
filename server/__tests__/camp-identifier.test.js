const {
  findCampByIdentifier,
  getCampPublicIdentifier,
  slugifyCampIdentifier
} = require('../utils/campIdentifier');

describe('campIdentifier utilities', () => {
  test('slugifies camp names consistently', () => {
    expect(slugifyCampIdentifier('Mudskippers!! Camp')).toBe('mudskippers-camp');
  });

  test('uses camp id as invite identifier when slug/name fallback is unavailable', () => {
    const camp = { _id: '64ad00000000000000000001' };
    expect(getCampPublicIdentifier(camp)).toBe('64ad00000000000000000001');
  });

  test('does not query _id for non-id slugs and falls back to legacy generated name slug', async () => {
    const calls = [];
    const db = {
      findCamp: jest.fn(async (query) => {
        calls.push(query);
        return null;
      }),
      findCamps: jest.fn(async () => [
        { _id: 'camp-1', name: 'Mudskippers' }
      ])
    };

    const camp = await findCampByIdentifier(db, 'mudskippers');

    expect(camp).toEqual({ _id: 'camp-1', name: 'Mudskippers' });
    expect(calls).not.toContainEqual({ _id: 'mudskippers' });
  });
});
