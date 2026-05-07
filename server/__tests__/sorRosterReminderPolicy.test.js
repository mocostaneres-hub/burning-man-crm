const { sorMemberHasSignedUp } = require('../utils/sorRosterReminderPolicy');

describe('sorRosterReminderPolicy — sorMemberHasSignedUp', () => {
  test('true when user ObjectId string is set', () => {
    expect(sorMemberHasSignedUp({ user: '507f1f77bcf86cd799439011' })).toBe(true);
  });

  test('true when user subdoc has _id', () => {
    expect(sorMemberHasSignedUp({ user: { _id: 'u1' } })).toBe(true);
  });

  test('false when user is null', () => {
    expect(sorMemberHasSignedUp({ user: null })).toBe(false);
  });

  test('false when user is undefined', () => {
    expect(sorMemberHasSignedUp({})).toBe(false);
  });
});
