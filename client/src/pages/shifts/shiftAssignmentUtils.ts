export type ShiftAssignmentMode = 'ALL_ROSTER' | 'LEADS_ONLY' | 'SELECTED_USERS';

type ShiftAssignmentDraft = {
  assignmentMode: ShiftAssignmentMode;
  selectedUserIds: string[];
  directAssignmentUserIds: string[];
};

const uniqueIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

/**
 * Change who may claim the remaining spots without discarding people whose
 * spots have already been confirmed through direct assignment.
 */
export const applyShiftAssignmentMode = <T extends ShiftAssignmentDraft>(
  shift: T,
  mode: ShiftAssignmentMode,
  allRosterIds: string[],
  leadRosterIds: string[]
): T => {
  const directAssignmentUserIds = uniqueIds(shift.directAssignmentUserIds || []);

  if (mode === 'ALL_ROSTER') {
    return {
      ...shift,
      assignmentMode: mode,
      selectedUserIds: uniqueIds(allRosterIds),
      directAssignmentUserIds
    };
  }

  if (mode === 'LEADS_ONLY') {
    return {
      ...shift,
      assignmentMode: mode,
      selectedUserIds: uniqueIds(leadRosterIds),
      directAssignmentUserIds
    };
  }

  return {
    ...shift,
    assignmentMode: mode,
    selectedUserIds: directAssignmentUserIds,
    directAssignmentUserIds
  };
};
