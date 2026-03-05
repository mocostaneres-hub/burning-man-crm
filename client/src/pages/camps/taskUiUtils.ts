import { Task as GlobalTask, User as GlobalUser } from '../../types';

export type AssignmentMode = 'creator' | 'roster' | 'individual';
export type EditTaskState = {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  status: 'open' | 'closed';
  assignedTo: string[];
  watchers: string[];
};

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

export const buildTaskUpdatePayload = (
  editTask: EditTaskState,
  options: { canManageAssignments: boolean; canReassignTask: boolean }
) => {
  const { canManageAssignments, canReassignTask } = options;

  if (canManageAssignments) {
    return editTask;
  }

  const basePayload = {
    title: editTask.title,
    description: editTask.description,
    priority: editTask.priority,
    dueDate: editTask.dueDate
  };

  if (canReassignTask) {
    return {
      ...basePayload,
      assignedTo: editTask.assignedTo
    };
  }

  // Non-managers can edit content only when they don't have reassignment rights.
  return basePayload;
};
