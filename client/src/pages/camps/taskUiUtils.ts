import { Task as GlobalTask, User as GlobalUser } from '../../types';

export type AssignmentMode = 'creator' | 'roster' | 'individual';

export const getUserArray = (field: string[] | GlobalUser[] | undefined): GlobalUser[] => {
  if (!field || field.length === 0) return [];
  if (typeof field[0] === 'string') return [];
  return field as GlobalUser[];
};

export const canShowTaskAssignmentOptions = (user: any): boolean => {
  if (!user) return false;
  return Boolean(
    user.accountType === 'camp' ||
      (user.accountType === 'admin' && user.campId) ||
      user.isCampLead
  );
};

export const buildEditTaskState = (task: GlobalTask) => {
  const assignees = getUserArray(task.assignedTo);
  const taskWatchers = getUserArray(task.watchers);
  const dueDateValue =
    task.dueDate && typeof task.dueDate === 'string' ? task.dueDate.slice(0, 10) : '';

  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: dueDateValue,
    status: task.status,
    assignedTo: assignees.map((u) => u._id.toString()),
    watchers: taskWatchers.map((u) => u._id.toString())
  };
};
