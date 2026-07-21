import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui';
import { ClipboardList, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { MyShiftItem, PendingSurveyItem } from '../../types';
import { formatDate, formatShiftDate, formatShiftTime } from '../../utils/dateFormatters';

type TaskStatusFilter = 'open' | 'closed' | 'all';

interface ProfileTask {
  _id: string;
  title: string;
  status: 'open' | 'closed' | string;
  dueDate?: string;
  taskIdCode?: string;
  camp?: {
    campName?: string;
    name?: string;
    slug?: string;
  } | null;
}

interface ProfileTodoItem {
  id: string;
  title: string;
  status: 'open' | 'closed';
  statusLabel: string;
  badgeVariant: 'success' | 'warning' | 'neutral';
  campName: string;
  detail: string;
  path: string;
}

const MyTasksList: React.FC = () => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurveyItem[]>([]);
  const [completedSurveys, setCompletedSurveys] = useState<PendingSurveyItem[]>([]);
  const [pendingShifts, setPendingShifts] = useState<MyShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TaskStatusFilter>('open');

  useEffect(() => {
    let isMounted = true;

    const loadTasks = async () => {
      try {
        setLoading(true);
        const [response, surveysResponse, shiftsResponse] = await Promise.all([
          api.get('/tasks/my-tasks', {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }),
          api.getMyPendingSurveys().catch((surveyError) => {
            console.error('Error loading profile surveys:', surveyError);
            return { pendingSurveys: [], completedSurveys: [] };
          }),
          api.getMyShifts().catch((shiftError) => {
            console.error('Error loading profile shift to-dos:', shiftError);
            return { camps: [], availableShifts: [], signedUpShifts: [] };
          })
        ]);
        if (!isMounted) return;
        setTasks((response || []) as ProfileTask[]);
        setPendingSurveys(surveysResponse.pendingSurveys || []);
        setCompletedSurveys(surveysResponse.completedSurveys || []);
        setPendingShifts(shiftsResponse.availableShifts || []);
        setError('');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error loading profile tasks:', err);
        setError('Failed to load tasks.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  const todoItems = useMemo<ProfileTodoItem[]>(() => {
    const taskItems: ProfileTodoItem[] = tasks.map((task) => {
      const campName = task.camp?.campName || task.camp?.name || 'Unknown Camp';
      const status: 'open' | 'closed' = String(task.status).toLowerCase() === 'closed' ? 'closed' : 'open';

      return {
        id: `task-${task._id}`,
        title: task.title,
        status,
        statusLabel: status,
        badgeVariant: status === 'open' ? 'success' : 'neutral',
        campName,
        detail: task.dueDate ? `Task • Due ${formatDate(task.dueDate)}` : 'Task • No due date',
        path: task.taskIdCode ? `/tasks/${task.taskIdCode}` : '/tasks'
      };
    });

    const pendingSurveyItems: ProfileTodoItem[] = pendingSurveys.map((survey) => ({
      id: `survey-${survey.surveyId}`,
      title: survey.title,
      status: 'open' as const,
      statusLabel: 'pending',
      badgeVariant: 'warning',
      campName: survey.campName,
      detail: survey.assignedAt || survey.sentAt
        ? `Survey • Assigned ${formatDate(survey.assignedAt || survey.sentAt || '')}`
        : 'Survey',
      path: `/surveys/${survey.surveyId}`
    }));

    const pendingShiftItems: ProfileTodoItem[] = pendingShifts.map((shift) => ({
      id: `shift-${shift.shiftId}`,
      title: shift.title,
      status: 'open',
      statusLabel: shift.isFull ? 'full' : 'needs signup',
      badgeVariant: shift.isFull ? 'neutral' : 'warning',
      campName: shift.campName,
      detail: `Shift • ${shift.eventName} • ${formatShiftDate(shift.startTime || shift.date)} at ${formatShiftTime(shift.startTime)} PDT`,
      path: '/my-shifts'
    }));

    const completedSurveyItems: ProfileTodoItem[] = completedSurveys.map((survey) => ({
      id: `survey-${survey.surveyId}`,
      title: survey.title,
      status: 'closed' as const,
      statusLabel: 'completed',
      badgeVariant: 'neutral',
      campName: survey.campName,
      detail: 'Survey',
      path: `/surveys/${survey.surveyId}`
    }));

    return [...pendingShiftItems, ...pendingSurveyItems, ...taskItems, ...completedSurveyItems];
  }, [completedSurveys, pendingShifts, pendingSurveys, tasks]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return todoItems;
    return todoItems.filter((item) => item.status === filter);
  }, [filter, todoItems]);

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-lato-bold text-custom-text flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-custom-primary" />
          To-dos
        </h2>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TaskStatusFilter)}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter my to-dos"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-custom-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading to-dos...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-custom-text-secondary">
          {filter === 'open' ? 'No open to-dos assigned to you.' : 'No to-dos found for this filter.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-custom-text">{item.title}</p>
                  <p className="text-xs text-custom-text-secondary mt-1">
                    Camp: {item.campName} • {item.detail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.badgeVariant}>{item.statusLabel}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.assign(item.path)}
                  >
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default MyTasksList;
