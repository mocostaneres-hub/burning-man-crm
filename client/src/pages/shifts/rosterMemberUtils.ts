export type RosterMemberIdentity = {
  _id?: string;
  memberId?: string;
  userId?: string;
};

export type RosterMemberContactIdentity = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export const hasUsableRosterContactIdentity = (member: RosterMemberContactIdentity) => (
  [member.firstName, member.lastName, member.email]
    .some((value) => Boolean(String(value || '').trim()))
);

const getIdentityIds = (member: RosterMemberIdentity) => (
  Array.from(new Set(
    [member.userId, member.memberId, member._id]
      .filter(Boolean)
      .map((id) => id!.toString())
  ))
);

/**
 * Collapse records that share any stable member or user ID.
 *
 * The shifts page loads both the active roster and the camp-member endpoint.
 * Those endpoints can describe the same person with different subsets of IDs,
 * so object-reference equality is not sufficient to deduplicate the results.
 */
export const deduplicateRosterMembers = <T extends RosterMemberIdentity>(members: T[]): T[] => {
  const groups: Array<{ member: T; ids: Set<string>; active: boolean }> = [];
  const groupIndexById = new Map<string, number>();

  members.forEach((member) => {
    const ids = getIdentityIds(member);
    const matchingIndexes = Array.from(new Set(
      ids
        .map((id) => groupIndexById.get(id))
        .filter((index): index is number => index !== undefined)
    ))
      .filter((index) => groups[index].active)
      .sort((a, b) => a - b);

    if (matchingIndexes.length === 0) {
      const groupIndex = groups.length;
      groups.push({ member, ids: new Set(ids), active: true });
      ids.forEach((id) => groupIndexById.set(id, groupIndex));
      return;
    }

    const primaryIndex = matchingIndexes[0];
    const primaryGroup = groups[primaryIndex];

    ids.forEach((id) => primaryGroup.ids.add(id));

    matchingIndexes.slice(1).forEach((duplicateIndex) => {
      const duplicateGroup = groups[duplicateIndex];
      duplicateGroup.ids.forEach((id) => primaryGroup.ids.add(id));
      duplicateGroup.active = false;
    });

    primaryGroup.ids.forEach((id) => groupIndexById.set(id, primaryIndex));
  });

  return groups
    .filter((group) => group.active)
    .map((group) => group.member);
};
