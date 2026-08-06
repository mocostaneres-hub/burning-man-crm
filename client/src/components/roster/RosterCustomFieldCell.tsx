import React, { useEffect, useState } from 'react';

export interface RosterCustomFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'checkbox';
  options?: string[];
}

interface Props {
  field: RosterCustomFieldDefinition;
  value: any;
  canEdit: boolean;
  onSave: (value: any) => Promise<void>;
}

const displayValue = (field: RosterCustomFieldDefinition, value: any) => {
  if (field.type === 'checkbox') return value === true ? 'Yes' : '—';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
};

const RosterCustomFieldCell: React.FC<Props> = ({ field, value, canEdit, onSave }) => {
  const [draft, setDraft] = useState<any>(value ?? (field.type === 'checkbox' ? false : ''));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDraft(value ?? (field.type === 'checkbox' ? false : ''));
  }, [field.type, value]);

  const commit = async (nextValue: any) => {
    const normalizedValue = field.type === 'number' && nextValue === '' ? null : nextValue;
    if (normalizedValue === value || (normalizedValue === null && (value === null || value === undefined || value === ''))) {
      return;
    }

    try {
      setSaving(true);
      setSaveError('');
      await onSave(normalizedValue);
    } catch (error: any) {
      setDraft(value ?? (field.type === 'checkbox' ? false : ''));
      setSaveError(error?.response?.data?.message || error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <span className={displayValue(field, value) === '—' ? 'text-gray-400' : ''}>{displayValue(field, value)}</span>;
  }

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2" title={saveError || undefined}>
        <input
          type="checkbox"
          checked={Boolean(draft)}
          disabled={saving}
          onChange={(event) => {
            const nextValue = event.target.checked;
            setDraft(nextValue);
            void commit(nextValue);
          }}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
          aria-label={field.label}
        />
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
        {saveError && <span className="text-xs text-red-600">Retry</span>}
      </div>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <div title={saveError || undefined}>
        <select
          value={draft ?? ''}
          disabled={saving}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraft(nextValue);
            void commit(nextValue);
          }}
          className={`min-w-[8rem] rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 ${saveError ? 'border-red-400' : 'border-gray-300'}`}
          aria-label={field.label}
        >
          <option value="">—</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div title={saveError || undefined}>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={draft ?? ''}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className={`min-w-[8rem] rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 ${saveError ? 'border-red-400' : 'border-gray-300'}`}
        aria-label={field.label}
      />
    </div>
  );
};

export default RosterCustomFieldCell;
