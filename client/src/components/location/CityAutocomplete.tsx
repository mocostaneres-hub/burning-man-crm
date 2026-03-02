import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { StructuredLocation } from '../../types';

interface CityAutocompleteProps {
  value: StructuredLocation | null;
  onChange: (location: StructuredLocation | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  legacyValue?: string;
}

const formatLocationLabel = (location: StructuredLocation | null | undefined): string => {
  if (!location) return '';
  const segments = [location.city, location.state, location.country].filter(Boolean);
  return segments.join(', ');
};

const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  value,
  onChange,
  label = 'City',
  placeholder = 'Search city...',
  disabled = false,
  legacyValue
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StructuredLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const latestQueryRef = useRef('');
  const listboxId = useRef(`city-autocomplete-${Math.random().toString(36).slice(2, 10)}`);

  const selectedLabel = useMemo(() => formatLocationLabel(value), [value]);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2 || normalizedQuery === selectedLabel) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    latestQueryRef.current = normalizedQuery;
    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.searchCities(normalizedQuery);
        if (latestQueryRef.current === normalizedQuery) {
          setResults(response.cities || []);
        }
      } catch (error) {
        if (latestQueryRef.current === normalizedQuery) {
          setResults([]);
        }
      } finally {
        if (latestQueryRef.current === normalizedQuery) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [open, query, selectedLabel]);

  const commitSelection = (location: StructuredLocation) => {
    onChange(location);
    setOpen(false);
    setResults([]);
    setQuery(formatLocationLabel(location));
    setHighlightedIndex(-1);
  };

  const handleInputChange = (nextValue: string) => {
    setQuery(nextValue);
    setOpen(true);
    setHighlightedIndex(-1);
    if (value && nextValue !== selectedLabel) {
      onChange(null);
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      setOpen(false);
      setResults([]);
      if (!value) {
        setQuery('');
      } else {
        setQuery(selectedLabel);
      }
    }, 120);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!open || results.length === 0) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        commitSelection(results[highlightedIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      {label && <label className="block text-label font-medium text-custom-text mb-2">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="input-primary pr-20"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId.current}
          aria-autocomplete="list"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {!value && legacyValue && (
        <p className="text-xs text-amber-700 mt-1">
          Legacy value detected: "{legacyValue}". Re-select a city to verify and standardize this location.
        </p>
      )}

      {open && (loading || results.length > 0) && (
        <ul
          id={listboxId.current}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>}
          {!loading && results.map((result, index) => {
            const optionLabel = formatLocationLabel(result);
            return (
              <li key={`${result.placeId || optionLabel}-${index}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(result)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    highlightedIndex === index ? 'bg-gray-100' : ''
                  }`}
                >
                  {optionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CityAutocomplete;
