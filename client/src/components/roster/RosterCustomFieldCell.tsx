import React, { useEffect, useRef, useState } from 'react';

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

const emptyDraftValue = (field: RosterCustomFieldDefinition, value: any) => (
  value ?? (field.type === 'checkbox' ? false : '')
);

const displayValue = (field: RosterCustomFieldDefinition, value: any) => {
  if (field.type === 'checkbox') return value === true ? 'Yes' : '—';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
};

const RosterCustomFieldCell: React.FC<Props> = ({ field, value, canEdit, onSave }) => {
  const [draft, setDraft] = useState<any>(emptyDraftValue(field, value));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(emptyDraftValue(field, value));
  }, [field, isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;
    const editor = field.type === 'dropdown' ? selectRef.current : inputRef.current;
    editor?.focus();
    if (field.type === 'text' || field.type === 'number') inputRef.current?.select();
  }, [field.type, isEditing]);

  const beginEditing = () => {
    if (!canEdit || saving) return;
    setDraft(emptyDraftValue(field, value));
    setSaveError('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(emptyDraftValue(field, value));
    setSaveError('');
    setIsEditing(false);
  };

  const commit = async (nextValue: any) => {
    let normalizedValue = nextValue;
    if (field.type === 'number') {
      normalizedValue = nextValue === '' ? null : Number(nextValue);
      if (normalizedValue !== null && !Number.isFinite(normalizedValue)) {
        setDraft(emptyDraftValue(field, value));
        setSaveError('Enter a valid number');
        setIsEditing(false);
        return;
      }
    }

    setIsEditing(false);
    if (normalizedValue === value || (normalizedValue === null && (value === null || value === undefined || value === ''))) {
      return;
    }

    try {
      setSaving(true);
      setSaveError('');
      await onSave(normalizedValue);
    } catch (error: any) {
      setDraft(emptyDraftValue(field, value));
      setSaveError(error?.response?.data?.message || error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <span className={displayValue(field, value) === '—' ? 'text-gray-400' : ''}>{displayValue(field, value)}</span>;
  }

  if (!isEditing) {
    const shownValue = displayValue(field, value);
    return (
      <button
        type="button"
        onClick={beginEditing}
        disabled={saving}
        className={`group inline-flex min-h-[2rem] min-w-[8rem] items-center rounded px-2 py-1 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-wait disabled:opacity-60 ${saveError ? 'bg-red-50 text-red-700' : 'hover:bg-gray-100'}`}
        aria-label={`Edit ${field.label}`}
        title={saveError || `Click to edit ${field.label}`}
      >
        {saving ? (
          <span className="text-gray-500">Saving…</span>
        ) : saveError ? (
          <span>Could not save — click to retry</span>
        ) : (
          <>
            <span className={shownValue === '—' ? 'text-gray-400' : ''}>{shownValue}</span>
            <span className="ml-2 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              Edit
            </span>
          </>
        )}
      </button>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="flex min-h-[2rem] items-center gap-2" title="Click outside to save">
        <input
          ref={inputRef}
          type="checkbox"
          checked={Boolean(draft)}
          onChange={(event) => setDraft(event.target.checked)}
          onBlur={() => void commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cancelEditing();
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          aria-label={field.label}
        />
        <span className="text-xs text-gray-500">Click outside to save</span>
      </div>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <select
        ref={selectRef}
        value={draft ?? ''}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancelEditing();
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="min-w-[8rem] rounded border border-green-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        aria-label={field.label}
        title="Click outside to save"
      >
        <option value="">—</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={field.type === 'number' ? 'number' : 'text'}
      value={draft ?? ''}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancelEditing();
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="min-w-[8rem] rounded border border-green-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      aria-label={field.label}
      title="Click outside to save"
    />
  );
};

export default RosterCustomFieldCell;
