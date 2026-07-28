import { applyShiftAssignmentMode } from '../shiftAssignmentUtils';

const directlyAssignedShift = {
  assignmentMode: 'SELECTED_USERS' as const,
  selectedUserIds: ['user-1', 'user-2'],
  directAssignmentUserIds: ['user-1', 'user-2'],
  title: 'Kitchen'
};

describe('applyShiftAssignmentMode', () => {
  it('keeps confirmed assignees when the remaining spots open to the roster', () => {
    expect(applyShiftAssignmentMode(
      directlyAssignedShift,
      'ALL_ROSTER',
      ['user-1', 'user-2', 'user-3'],
      ['user-3']
    )).toEqual({
      ...directlyAssignedShift,
      assignmentMode: 'ALL_ROSTER',
      selectedUserIds: ['user-1', 'user-2', 'user-3'],
      directAssignmentUserIds: ['user-1', 'user-2']
    });
  });

  it('keeps confirmed assignees when the remaining spots open to leads', () => {
    const result = applyShiftAssignmentMode(
      directlyAssignedShift,
      'LEADS_ONLY',
      ['user-1', 'user-2', 'user-3'],
      ['user-3']
    );

    expect(result.selectedUserIds).toEqual(['user-3']);
    expect(result.directAssignmentUserIds).toEqual(['user-1', 'user-2']);
  });

  it('restores only confirmed assignees when returning to selected people', () => {
    const broadlyInvitedShift = {
      ...directlyAssignedShift,
      assignmentMode: 'ALL_ROSTER' as const,
      selectedUserIds: ['user-1', 'user-2', 'user-3']
    };

    const result = applyShiftAssignmentMode(
      broadlyInvitedShift,
      'SELECTED_USERS',
      ['user-1', 'user-2', 'user-3'],
      ['user-3']
    );

    expect(result.selectedUserIds).toEqual(['user-1', 'user-2']);
    expect(result.directAssignmentUserIds).toEqual(['user-1', 'user-2']);
  });
});
