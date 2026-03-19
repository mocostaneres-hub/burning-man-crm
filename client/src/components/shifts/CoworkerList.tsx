import React from 'react';
import { MyShiftCoworker } from '../../types';

interface Props {
  coworkers: MyShiftCoworker[];
}

const CoworkerList: React.FC<Props> = ({ coworkers }) => {
  if (!coworkers || coworkers.length === 0) {
    return <div className="text-xs text-gray-500">No coworkers signed up yet.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {coworkers.map((coworker) => {
        const label =
          coworker.playaName ||
          `${coworker.firstName || ''} ${coworker.lastName || ''}`.trim() ||
          coworker.email ||
          'Member';
        return (
          <span key={coworker._id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
            {label}
          </span>
        );
      })}
    </div>
  );
};

export default CoworkerList;
