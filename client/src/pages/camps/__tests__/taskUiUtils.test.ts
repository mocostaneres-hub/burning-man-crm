import { buildEditTaskState, canShowTaskAssignmentOptions } from '../taskUiUtils';

describe('taskUiUtils', () => {
  it('shows assignment options for camp management users', () => {
    expect(canShowTaskAssignmentOptions({ accountType: 'camp' })).toBe(true);
    expect(canShowTaskAssignmentOptions({ accountType: 'admin', campId: 'camp-1' })).toBe(true);
    expect(canShowTaskAssignmentOptions({ accountType: 'personal', isCampLead: true })).toBe(true);
    expect(canShowTaskAssignmentOptions({ accountType: 'personal' })).toBe(false);
  });

  it('builds edit form state from an existing task', () => {
    const task = {
      _id: 'task-1',
      title: 'Build shade structure',
      description: 'Need crew and tools',
      priority: 'high',
      dueDate: '2026-07-18T08:00:00.000Z',
      status: 'open',
      assignedTo: [{ _id: 'user-1' }, { _id: 'user-2' }],
      watchers: [{ _id: 'user-3' }]
    } as any;

    const state = buildEditTaskState(task);

    expect(state).toEqual({
      title: 'Build shade structure',
      description: 'Need crew and tools',
      priority: 'high',
      dueDate: '2026-07-18',
      status: 'open',
      assignedTo: ['user-1', 'user-2'],
      watchers: ['user-3']
    });
  });
});
