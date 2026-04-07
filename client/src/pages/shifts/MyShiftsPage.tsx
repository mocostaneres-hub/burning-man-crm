import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { MyShiftsResponse } from '../../types';
import ShiftCard from '../../components/shifts/ShiftCard';
import { Card } from '../../components/ui';

const emptyData: MyShiftsResponse = {
  camps: [],
  availableShifts: [],
  signedUpShifts: []
};

const MyShiftsPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MyShiftsResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionShiftId, setActionShiftId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMyShifts();
      setData(response || emptyData);
    } catch (err: any) {
      console.error('Failed to load my shifts:', err);
      setError(err?.response?.data?.message || 'Failed to load your shifts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.accountType === 'personal') {
      loadData();
    }
  }, [user?.accountType, loadData]);

  const handleSignUp = async (shiftId: string) => {
    try {
      setActionShiftId(shiftId);
      await apiService.signUpForShift(shiftId);
      setToastMessage('Signed up successfully. You can add this shift to your calendar from My Signed-Up Shifts.');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to sign up for shift.');
    } finally {
      setActionShiftId(null);
    }
  };

  const handleCancel = async (shiftId: string) => {
    const confirmed = window.confirm('Drop this shift? Please only drop if you cannot attend so another member can fill it.');
    if (!confirmed) return;
    try {
      setActionShiftId(shiftId);
      await apiService.cancelShiftSignup(shiftId);
      setToastMessage('Shift dropped successfully.');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel shift signup.');
    } finally {
      setActionShiftId(null);
    }
  };

  const available = useMemo(() => data.availableShifts || [], [data.availableShifts]);
  const signed = useMemo(() => data.signedUpShifts || [], [data.signedUpShifts]);
  const upcomingSigned = useMemo(
    () => signed.filter((shift) => new Date(shift.endTime).getTime() >= Date.now()),
    [signed]
  );

  const conflictShiftIds = useMemo(() => {
    const conflicts = new Set<string>();
    const sorted = [...signed].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const currentStart = new Date(current.startTime).getTime();
      const currentEnd = new Date(current.endTime).getTime();
      for (let compareIndex = index + 1; compareIndex < sorted.length; compareIndex += 1) {
        const candidate = sorted[compareIndex];
        const candidateStart = new Date(candidate.startTime).getTime();
        const candidateEnd = new Date(candidate.endTime).getTime();
        if (candidateStart >= currentEnd) break;
        if (candidateStart < currentEnd && candidateEnd > currentStart) {
          conflicts.add(current.shiftId);
          conflicts.add(candidate.shiftId);
        }
      }
    }
    return conflicts;
  }, [signed]);

  const recommended = useMemo(() => {
    const userSkills = user?.skills || [];
    const minimumCommitment = 4;
    const activeSignedCount = upcomingSigned.length;
    const preferredHours = signed.map((shift) => new Date(shift.startTime).getHours());
    const preferredHour = preferredHours.length > 0
      ? Math.round(preferredHours.reduce((sum, hour) => sum + hour, 0) / preferredHours.length)
      : null;

    return [...available]
      .map((shift) => {
        const requiredSkills = shift.requiredSkills || [];
        const matchedSkills = requiredSkills.filter((skill) => userSkills.includes(skill));
        const skillScore = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0;
        const startHour = new Date(shift.startTime).getHours();
        const timeScore = preferredHour === null ? 0.5 : 1 - Math.min(Math.abs(startHour - preferredHour) / 12, 1);
        const commitmentBoost = activeSignedCount < minimumCommitment ? 0.2 : 0;
        const score = skillScore * 0.6 + timeScore * 0.2 + commitmentBoost;
        const reasonParts = [];
        if (matchedSkills.length > 0) reasonParts.push(`matches your skills (${matchedSkills.join(', ')})`);
        if (preferredHour !== null) reasonParts.push('fits your usual shift time');
        if (activeSignedCount < minimumCommitment) reasonParts.push(`helps reach suggested commitment (${activeSignedCount}/${minimumCommitment})`);
        return { ...shift, score, recommendationReason: reasonParts.join(' • ') || 'good availability fit' };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [available, signed, upcomingSigned.length, user?.skills]);

  const handleAddCalendar = (shift: any, target: 'google' | 'ics') => {
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const title = `${shift.campName} - ${shift.title}`;
    const details = `${shift.eventName}${shift.description ? `: ${shift.description}` : ''}`;
    if (target === 'google') {
      const formatGoogle = (date: Date) =>
        date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${formatGoogle(start)}/${formatGoogle(end)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      `DTSTART:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTEND:${end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${shift.title || 'shift'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (user?.accountType !== 'personal') {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-custom-text">My Shifts</h1>
          <p className="text-sm text-gray-600 mt-2">This page is available for member accounts.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {toastMessage && (
        <div className="p-3 border border-green-200 bg-green-50 text-green-800 rounded-md text-sm flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-green-700 font-medium">Dismiss</button>
        </div>
      )}
      <div>
        <h1 className="text-h1 font-lato-bold text-custom-text">My Shifts</h1>
        <p className="text-sm text-gray-600 mt-1">Upcoming shifts first, with conflict alerts and recommendations tailored to your profile.</p>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 text-red-800 rounded-md text-sm">{error}</div>
      )}

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-custom-text mb-3">Recommended Shifts</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading recommendations...</div>
        ) : recommended.length === 0 ? (
          <div className="text-sm text-gray-500">No recommendations yet. Add skills in your profile to improve matching.</div>
        ) : (
          <div className="space-y-3">
            {recommended.map((shift) => (
              <ShiftCard
                key={`recommended-${shift.shiftId}`}
                shift={shift}
                mode="available"
                loading={actionShiftId === shift.shiftId}
                onSignUp={handleSignUp}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-custom-text mb-3">Shifts Needing Signup</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        ) : available.length === 0 ? (
          <div className="text-sm text-gray-500">No available shifts right now.</div>
        ) : (
          <div className="space-y-3">
            {available.map((shift) => (
              <ShiftCard
                key={shift.shiftId}
                shift={shift}
                mode="available"
                loading={actionShiftId === shift.shiftId}
                onSignUp={handleSignUp}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-custom-text mb-3">My Signed-Up Shifts (Upcoming First)</h2>
        {conflictShiftIds.size > 0 && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            You have {conflictShiftIds.size} shift(s) with time conflicts. Please resolve overlaps.
          </div>
        )}
        {loading ? (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        ) : upcomingSigned.length === 0 ? (
          <div className="text-sm text-gray-500">You have not signed up for shifts yet.</div>
        ) : (
          <div className="space-y-3">
            {upcomingSigned.map((shift) => (
              <ShiftCard
                key={shift.shiftId}
                shift={shift}
                mode="signed"
                loading={actionShiftId === shift.shiftId}
                isConflict={conflictShiftIds.has(shift.shiftId)}
                onCancel={handleCancel}
                onAddCalendar={handleAddCalendar}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyShiftsPage;
