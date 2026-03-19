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
  onSignUp?: (shiftId: string) => void;
  onCancel?: (shiftId: string) => void;
}

const ShiftCard: React.FC<Props> = ({ shift, mode, loading, onSignUp, onCancel }) => {
  const actionDisabled = loading || (mode === 'available' && shift.isFull);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm text-gray-500">{shift.campName} - {shift.eventName}</div>
          <h3 className="font-semibold text-custom-text">{shift.title}</h3>
          {shift.description && <p className="text-sm text-gray-600 mt-1">{shift.description}</p>}

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

        {mode === 'available' ? (
          <Button
            variant="primary"
            size="sm"
            disabled={actionDisabled}
            onClick={() => onSignUp?.(shift.shiftId)}
          >
            {shift.isFull ? 'Full' : loading ? 'Signing up...' : 'Sign up'}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => onCancel?.(shift.shiftId)}
          >
            {loading ? 'Cancelling...' : 'Cancel signup'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ShiftCard;
