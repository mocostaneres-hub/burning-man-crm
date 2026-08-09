import { deduplicateRosterMembers, hasUsableRosterContactIdentity } from '../rosterMemberUtils';

describe('hasUsableRosterContactIdentity', () => {
  it('rejects orphan placeholders with no name or email', () => {
    expect(hasUsableRosterContactIdentity({})).toBe(false);
    expect(hasUsableRosterContactIdentity({ firstName: ' ', email: '' })).toBe(false);
  });

  it('accepts a name or email as a usable roster identity', () => {
    expect(hasUsableRosterContactIdentity({ firstName: 'Sam' })).toBe(true);
    expect(hasUsableRosterContactIdentity({ email: 'sam@example.com' })).toBe(true);
  });
});

describe('deduplicateRosterMembers', () => {
  it('collapses the same user returned with different member ID detail', () => {
    const campMemberResponse = {
      _id: 'user-1',
      memberId: '',
      userId: 'user-1',
      firstName: 'Daniel'
    };
    const activeRosterResponse = {
      _id: 'user-1',
      memberId: 'member-1',
      userId: 'user-1',
      firstName: 'Daniel'
    };

    expect(deduplicateRosterMembers([
      activeRosterResponse,
      campMemberResponse
    ])).toEqual([activeRosterResponse]);
  });

  it('keeps distinct roster members', () => {
    const members = [
      { _id: 'user-1', memberId: 'member-1', userId: 'user-1' },
      { _id: 'member-2', memberId: 'member-2' }
    ];

    expect(deduplicateRosterMembers(members)).toEqual(members);
  });

  it('merges identity groups when a later record links their IDs', () => {
    const memberOnly = { _id: 'member-1', memberId: 'member-1' };
    const userOnly = { _id: 'user-1', userId: 'user-1' };
    const linkedRecord = {
      _id: 'user-1',
      memberId: 'member-1',
      userId: 'user-1'
    };

    expect(deduplicateRosterMembers([
      memberOnly,
      userOnly,
      linkedRecord
    ])).toEqual([memberOnly]);
  });
});
