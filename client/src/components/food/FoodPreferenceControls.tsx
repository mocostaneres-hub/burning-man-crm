import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FOOD_PREFERENCE_OPTIONS,
  FoodPreference,
  getFoodPreferenceTagClass,
  normalizeFoodPreferences,
  toggleFoodPreference
} from '../../constants/foodPreferences';

interface FoodPreferenceTagsProps {
  preferences?: unknown;
  emptyLabel?: string;
  className?: string;
  compact?: boolean;
}

export const FoodPreferenceTags: React.FC<FoodPreferenceTagsProps> = ({
  preferences,
  emptyLabel = 'Not set',
  className = '',
  compact = false
}) => {
  const normalized = normalizeFoodPreferences(preferences);

  if (normalized.length === 0) {
    return <span className="text-gray-400 italic text-xs">{emptyLabel}</span>;
  }

  if (compact) {
    const [firstPreference, ...additionalPreferences] = normalized;

    return (
      <div className={`group relative inline-flex flex-nowrap items-center gap-1 ${className}`}>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getFoodPreferenceTagClass(firstPreference)}`}
        >
          {firstPreference}
        </span>
        {additionalPreferences.length > 0 && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 whitespace-nowrap">
            +{additionalPreferences.length}
          </span>
        )}
        {additionalPreferences.length > 0 && (
          <div className="absolute left-0 top-full z-40 mt-1 hidden min-w-max rounded-md border border-gray-200 bg-white p-2 shadow-lg group-hover:block">
            <div className="flex max-w-xs flex-wrap gap-1">
              {normalized.map((preference) => (
                <span
                  key={preference}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getFoodPreferenceTagClass(preference)}`}
                >
                  {preference}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {normalized.map((preference) => (
        <span
          key={preference}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getFoodPreferenceTagClass(preference)}`}
        >
          {preference}
        </span>
      ))}
    </div>
  );
};

interface FoodPreferenceMultiSelectProps {
  value?: unknown;
  onChange: (preferences: FoodPreference[]) => void;
  onClose?: () => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  defaultOpen?: boolean;
}

export const FoodPreferenceMultiSelect: React.FC<FoodPreferenceMultiSelectProps> = ({
  value,
  onChange,
  onClose,
  label,
  required = false,
  disabled = false,
  buttonClassName = '',
  defaultOpen = false
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalized = normalizeFoodPreferences(value);

  const closeMenu = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [open, closeMenu]);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
        className={`w-full min-w-[11rem] rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {normalized.length > 0 ? `${normalized.length} selected` : 'Select food prefs'}
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          {FOOD_PREFERENCE_OPTIONS.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={normalized.includes(option)}
                onChange={() => onChange(toggleFoodPreference(normalized, option))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
