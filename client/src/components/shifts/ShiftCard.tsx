import React from 'react';
import { Button } from '../ui';
import { Calendar, Clock, Users } from 'lucide-react';
import { MyShiftItem } from '../../types';
import { formatShiftDate, formatShiftTime } from '../../utils/dateFormatters';
import CoworkerList from './CoworkerList';

interface Props {
  shift: MyShiftItem;
  mode: 'available' | 'signed';
  loading?: boolean;
  isConflict?: boolean;
  onSignUp?: (shiftId: string) => void;
  onCancel?: (shiftId: string) => void;
  onAddCalendar?: (shift: MyShiftItem, target: 'google' | 'ics') => void;
}

const ShiftCard: React.FC<Props> = ({ shift, mode, loading, isConflict = false, onSignUp, onCancel, onAddCalendar }) => {
  const actionDisabled = loading || (mode === 'available' && shift.isFull);
  const startsAt = new Date(shift.startTime).getTime();
  const startsInMs = startsAt - Date.now();
  const startsInLabel = startsInMs > 0
    ? `Starts in ${Math.max(1, Math.round(startsInMs / (60 * 60 * 1000)))}h`
    : 'In progress or started';

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm text-gray-500">{shift.campName} - {shift.eventName}</div>
          <h3 className="font-semibold text-custom-text">{shift.title}</h3>
          {shift.description && <p className="text-sm text-gray-600 mt-1">{shift.description}</p>}
          {mode === 'signed' && (
            <p className="text-xs text-green-700 mt-1">{startsInLabel}</p>
          )}
          {isConflict && (
            <p className="text-xs text-red-700 mt-1 font-medium">Conflict detected with another signed-up shift.</p>
          )}
          {(shift.requiredSkills || []).length > 0 && (
            <p className="text-xs text-blue-700 mt-1">Skills: {(shift.requiredSkills || []).join(', ')}</p>
          )}
          {shift.recommendationReason && mode === 'available' && (
            <p className="text-xs text-indigo-700 mt-1">Why recommended: {shift.recommendationReason}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm text-gray-700">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{formatShiftDate(shift.date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{shift.signedUpCount}/{shift.maxSignUps} ({shift.remainingSpots} spots left)</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Coworkers</div>
            <CoworkerList coworkers={shift.coworkers || []} />
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col gap-2">
          {mode === 'available' ? (
            <Button
              variant="primary"
              size="sm"
              disabled={actionDisabled}
              onClick={() => onSignUp?.(shift.shiftId)}
              className="w-full md:w-auto min-h-[44px]"
            >
              {shift.isFull ? 'Full' : loading ? 'Signing up...' : 'Sign up'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onCancel?.(shift.shiftId)}
              className="w-full md:w-auto min-h-[44px]"
            >
              {loading ? 'Dropping...' : 'Drop shift'}
            </Button>
          )}
          {mode === 'signed' && (
            <div className="flex gap-2">
              <button className="text-xs text-custom-primary hover:underline" onClick={() => onAddCalendar?.(shift, 'google')}>
                Add to Google
              </button>
              <button className="text-xs text-custom-primary hover:underline" onClick={() => onAddCalendar?.(shift, 'ics')}>
                Add ICS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftCard;
