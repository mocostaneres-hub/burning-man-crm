import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui';
import { Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { MyShiftItem, MyShiftsResponse } from '../../types';
import { formatShiftDate, formatShiftTime } from '../../utils/dateFormatters';
import CoworkerList from '../shifts/CoworkerList';

const emptyData: MyShiftsResponse = {
  camps: [],
  availableShifts: [],
  signedUpShifts: []
};

interface ProfileShiftRow extends MyShiftItem {
  signupStatus: 'signed' | 'needs_signup';
}

const MyShiftsList: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MyShiftsResponse>(emptyData);
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
        const response = await api.getMyShifts();

        if (!isMounted) return;
        setData(response || emptyData);
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

  const userShifts = useMemo<ProfileShiftRow[]>(() => {
    const signed = (data.signedUpShifts || []).map((shift) => ({
      ...shift,
      signupStatus: 'signed' as const
    }));
    const needsSignup = (data.availableShifts || []).map((shift) => ({
      ...shift,
      signupStatus: 'needs_signup' as const
    }));

    return [...signed, ...needsSignup].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [data.availableShifts, data.signedUpShifts]);

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
          You have no assigned or signed-up shifts.
        </p>
      ) : (
        <div className="space-y-2">
          {userShifts.map((shift) => (
            <div key={shift.shiftId} className="border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-custom-text">{shift.title || 'Untitled Shift'}</p>
                  <p className="text-xs text-custom-text-secondary mt-1">
                    {shift.campName} • {shift.eventName} • {formatShiftDate(shift.startTime || shift.date)} •{' '}
                    {formatShiftTime(shift.startTime)}
                    {shift.endTime ? ` - ${formatShiftTime(shift.endTime)}` : ''} PDT
                  </p>
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Working with</p>
                    <CoworkerList coworkers={shift.coworkers || []} />
                  </div>
                </div>
                <Badge variant={shift.signupStatus === 'signed' ? 'success' : 'warning'}>
                  {shift.signupStatus === 'signed' ? 'Signed up' : 'Needs signup'}
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
