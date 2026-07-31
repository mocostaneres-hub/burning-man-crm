const {
  buildShiftMemberDetailMap,
  getShiftMemberDetails
} = require('../services/shiftReportMembers');

describe('shift report member details', () => {
  test('preserves names for signup users who are absent from the active roster', () => {
    const detailMap = buildShiftMemberDetailMap([
      {
        _id: 'former-member-user',
        firstName: 'Former',
        lastName: 'Camper',
        email: 'former@example.com'
      }
    ]);

    expect(getShiftMemberDetails(['former-member-user', 'legacy-member-id'], detailMap)).toEqual([
      {
        id: 'former-member-user',
        firstName: 'Former',
        lastName: 'Camper',
        email: 'former@example.com'
      }
    ]);
  });
});
