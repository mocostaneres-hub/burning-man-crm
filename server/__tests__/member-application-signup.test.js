const { resolveMemberApplicationSignup } = require('../utils/memberApplicationSignup');

describe('resolveMemberApplicationSignup', () => {
  it('ignores unrelated signup intents', async () => {
    const result = await resolveMemberApplicationSignup({}, undefined, undefined);
    expect(result).toEqual({ isMemberApplicationSignup: false, camp: null, error: null });
  });

  it('accepts public camps that are accepting applications', async () => {
    const camp = {
      _id: '64ad00000000000000000001',
      slug: 'mudskippers',
      isPubliclyVisible: true,
      acceptingApplications: true
    };
    const db = {
      findCamp: jest.fn(async (query) => (query.slug === 'mudskippers' ? camp : null)),
      findCamps: jest.fn(async () => [])
    };

    const result = await resolveMemberApplicationSignup(db, 'member_application', 'mudskippers');

    expect(result).toEqual({ isMemberApplicationSignup: true, camp, error: null });
  });

  it('rejects private camps', async () => {
    const camp = {
      _id: '64ad00000000000000000001',
      slug: 'mudskippers',
      isPubliclyVisible: false,
      acceptingApplications: true
    };
    const db = {
      findCamp: jest.fn(async (query) => (query.slug === 'mudskippers' ? camp : null)),
      findCamps: jest.fn(async () => [])
    };

    const result = await resolveMemberApplicationSignup(db, 'member_application', 'mudskippers');

    expect(result.error).toEqual({
      status: 400,
      message: 'This camp profile is not publicly visible'
    });
  });
});
