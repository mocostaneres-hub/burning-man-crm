import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui';
import { Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface ShiftEvent {
  _id: string;
  eventName?: string;
  campId?: string;
  shifts?: Array<{
    _id: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    date?: string;
    status?: string;
    memberIds?: string[];
  }>;
}

interface TaskWithEventMeta {
  metadata?: {
    eventId?: string;
  };
  camp?: {
    campName?: string;
    name?: string;
  } | null;
}

interface ProfileShiftRow {
  shiftId: string;
  shiftName: string;
  eventId: string;
  eventName: string;
  campName: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'pending';
}

const MyShiftsList: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [eventCampMap, setEventCampMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!user?._id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [eventsResponse, tasksResponse] = await Promise.all([
          api.get('/shifts/my-events'),
          api.get('/tasks/my-tasks')
        ]);

        if (!isMounted) return;

        const loadedEvents = (eventsResponse?.events || []) as ShiftEvent[];
        const loadedTasks = (tasksResponse || []) as TaskWithEventMeta[];
        const map: Record<string, string> = {};

        loadedTasks.forEach((task) => {
          const eventId = task.metadata?.eventId;
          const campName = task.camp?.campName || task.camp?.name;
          if (eventId && campName && !map[eventId]) {
            map[eventId] = campName;
          }
        });

        setEvents(loadedEvents);
        setEventCampMap(map);
        setError('');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error loading profile shifts:', err);
        setError('Failed to load shifts.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user?._id]);

  const userShifts = useMemo(() => {
    if (!user?._id) return [];
    const rows: ProfileShiftRow[] = [];

    events.forEach((event) => {
      (event.shifts || []).forEach((shift) => {
        const memberIds = shift.memberIds || [];
        const signedUp = memberIds.some((id) => String(id) === String(user._id));
        if (!signedUp) return;

        const startTime = shift.startTime || shift.date || '';
        const endTime = shift.endTime || '';

        rows.push({
          shiftId: shift._id,
          shiftName: shift.title || 'Untitled Shift',
          eventId: event._id,
          eventName: event.eventName || 'Volunteer Shift',
          campName: eventCampMap[event._id] || 'My Camp',
          startTime,
          endTime,
          status: shift.status === 'active' ? 'confirmed' : 'pending'
        });
      });
    });

    return rows.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, eventCampMap, user?._id]);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-lato-bold text-custom-text flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-custom-primary" />
        My Shifts
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-custom-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading shifts...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : userShifts.length === 0 ? (
        <p className="text-sm text-custom-text-secondary">
          You are not signed up for any shifts.
        </p>
      ) : (
        <div className="space-y-2">
          {userShifts.map((shift) => (
            <div key={shift.shiftId} className="border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-custom-text">{shift.shiftName}</p>
                  <p className="text-xs text-custom-text-secondary mt-1">
                    {shift.campName} • {new Date(shift.startTime).toLocaleDateString()} •{' '}
                    {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {shift.endTime
                      ? ` - ${new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
                <Badge variant={shift.status === 'confirmed' ? 'success' : 'warning'}>
                  {shift.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default MyShiftsList;
