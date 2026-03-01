import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui';
import { ClipboardList, Loader2 } from 'lucide-react';
import api from '../../services/api';

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

const MyTasksList: React.FC = () => {
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TaskStatusFilter>('open');

  useEffect(() => {
    let isMounted = true;

    const loadTasks = async () => {
      try {
        setLoading(true);
        const response = await api.get('/tasks/my-tasks');
        if (!isMounted) return;
        setTasks((response || []) as ProfileTask[]);
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

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((task) => String(task.status).toLowerCase() === filter);
  }, [filter, tasks]);

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-lato-bold text-custom-text flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-custom-primary" />
          My Tasks
        </h2>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TaskStatusFilter)}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter my tasks"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-custom-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading tasks...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filteredTasks.length === 0 ? (
        <p className="text-sm text-custom-text-secondary">
          {filter === 'open' ? 'No open tasks assigned to you.' : 'No tasks found for this filter.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredTasks.slice(0, 8).map((task) => {
            const status = String(task.status || '').toLowerCase();
            const campName = task.camp?.campName || task.camp?.name || 'Unknown Camp';
            return (
              <div key={task._id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium text-custom-text">{task.title}</p>
                    <p className="text-xs text-custom-text-secondary mt-1">
                      Camp: {campName}
                      {task.dueDate ? ` • Due: ${new Date(task.dueDate).toLocaleDateString()}` : ' • Due: Not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status === 'open' ? 'success' : 'neutral'}>{status || 'unknown'}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.assign(task.taskIdCode ? `/tasks/${task.taskIdCode}` : '/my-tasks')}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default MyTasksList;
