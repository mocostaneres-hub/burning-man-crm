import { getSelectableSurveyRecipients } from '../surveyRecipientUtils';

describe('survey recipient availability', () => {
  const rosterUsers = [
    { userId: 'sam', name: 'Sam Ali' },
    { userId: 'chris', name: 'Chris Brady' },
    { userId: 'garry', name: 'Garry Fitzpatrick' }
  ];

  test('makes an assigned person selectable again after response coverage is removed', () => {
    const selectable = getSelectableSurveyRecipients('sent', rosterUsers, ['sam', 'garry']);

    expect(selectable.map((user) => user.userId)).toEqual(['chris']);
  });

  test('keeps members with current response coverage out of the recipient list', () => {
    const selectable = getSelectableSurveyRecipients('sent', rosterUsers, ['sam', 'chris']);

    expect(selectable.map((user) => user.userId)).toEqual(['garry']);
  });

  test('does not restrict draft targeting before any responses exist', () => {
    expect(getSelectableSurveyRecipients('draft', rosterUsers, ['chris'])).toEqual(rosterUsers);
  });
});
