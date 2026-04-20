import React, { useMemo } from 'react';

interface TimePickerProps {
  value: string; // HH:MM in 24-hour format (internal representation)
  onChange: (value: string) => void; // emits HH:MM in 24-hour format
  className?: string;
  disabled?: boolean;
  minuteStep?: number; // defaults to 15; set to 1 for every minute
}

/**
 * AM/PM time picker that internally stores and emits HH:MM (24-hour) strings,
 * but presents hours 1–12 + AM/PM selectors to the user.
 * Replaces <input type="time"> which shows military time in many browsers.
 */
const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  minuteStep = 15
}) => {
  // Parse incoming HH:MM value
  const { displayHour, minute, period } = useMemo(() => {
    if (!value || !value.includes(':')) {
      return { displayHour: '', minute: '00', period: 'AM' };
    }
    const [hStr, mStr] = value.split(':');
    const h24 = parseInt(hStr, 10);
    if (isNaN(h24)) return { displayHour: '', minute: '00', period: 'AM' };
    const p = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { displayHour: String(h12), minute: mStr || '00', period: p };
  }, [value]);

  const emit = (h12: string, min: string, per: string) => {
    if (!h12) return;
    const h12n = parseInt(h12, 10);
    if (isNaN(h12n)) return;
    let h24 = per === 'AM' ? h12n % 12 : (h12n % 12) + 12;
    onChange(`${String(h24).padStart(2, '0')}:${min}`);
  };

  const handleHour = (e: React.ChangeEvent<HTMLSelectElement>) => {
    emit(e.target.value, minute, period);
  };

  const handleMinute = (e: React.ChangeEvent<HTMLSelectElement>) => {
    emit(displayHour, e.target.value, period);
  };

  const handlePeriod = (e: React.ChangeEvent<HTMLSelectElement>) => {
    emit(displayHour, minute, e.target.value);
  };

  const hours = ['1','2','3','4','5','6','7','8','9','10','11','12'];

  const minutes = useMemo(() => {
    const steps = [];
    for (let m = 0; m < 60; m += minuteStep) {
      steps.push(String(m).padStart(2, '0'));
    }
    return steps;
  }, [minuteStep]);

  const selectClass = `border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-custom-primary focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed ${disabled ? 'opacity-60' : ''}`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select
        value={displayHour}
        onChange={handleHour}
        disabled={disabled}
        className={selectClass}
        aria-label="Hour"
      >
        <option value="">--</option>
        {hours.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="text-gray-500 font-medium select-none">:</span>

      <select
        value={minute}
        onChange={handleMinute}
        disabled={disabled}
        className={selectClass}
        aria-label="Minute"
      >
        {minutes.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select
        value={period}
        onChange={handlePeriod}
        disabled={disabled}
        className={selectClass}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimePicker;
