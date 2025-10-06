import React from 'react';
import { Button } from '../ui';
import { Filter, X } from 'lucide-react';

export type FilterType = 'all' | 'dues-paid' | 'dues-unpaid' | 'without-tickets' | 'with-tickets' | 'without-vp' | 'with-vp' | 'early-arrival' | 'late-departure' | 'virgin' | 'veteran' | string; // Allow string for skill names

interface RosterFiltersProps {
  activeFilters: FilterType[];
  onFilterChange: (filters: FilterType[]) => void;
  availableSkills: string[];
}

interface FilterButtonProps {
  label: string;
  filterType: FilterType;
  isActive: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'success';
}

const FilterButton: React.FC<FilterButtonProps> = ({ 
  label, 
  isActive, 
  onClick, 
  variant = 'secondary' 
}) => {
  const getVariantClasses = () => {
    if (isActive) {
      switch (variant) {
        case 'primary':
          return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700';
        case 'warning':
          return 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700';
        case 'success':
          return 'bg-green-600 text-white border-green-600 hover:bg-green-700';
        default:
          return 'bg-red-600 text-white border-red-600 hover:bg-red-700';
      }
    }
    return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={`${getVariantClasses()} transition-colors duration-200 px-2 py-1 text-xs`}
    >
      {label}
      {isActive && <X className="ml-1 w-3 h-3" />}
    </Button>
  );
};

const RosterFilters: React.FC<RosterFiltersProps> = ({ activeFilters, onFilterChange, availableSkills }) => {
  const toggleFilter = (filterType: FilterType) => {
    if (filterType === 'all') {
      onFilterChange([]);
      return;
    }

    const newFilters = activeFilters.includes(filterType)
      ? activeFilters.filter(f => f !== filterType)
      : [...activeFilters, filterType];
    
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange([]);
  };

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Quick Filters
        </h3>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-gray-600 hover:text-gray-800"
          >
            Clear All
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-1 items-center">
        {/* Dues Status Filters */}
        <div className="flex gap-1 mr-2">
          <span className="text-sm font-medium text-gray-600 self-center">Dues:</span>
          <FilterButton
            label="Paid"
            filterType="dues-paid"
            isActive={activeFilters.includes('dues-paid')}
            onClick={() => toggleFilter('dues-paid')}
            variant="success"
          />
          <FilterButton
            label="Unpaid"
            filterType="dues-unpaid"
            isActive={activeFilters.includes('dues-unpaid')}
            onClick={() => toggleFilter('dues-unpaid')}
            variant="warning"
          />
        </div>

        {/* Ticket Status Filters */}
        <div className="flex gap-1 mr-2">
          <span className="text-sm font-medium text-gray-600 self-center">Tickets:</span>
          <FilterButton
            label="No"
            filterType="without-tickets"
            isActive={activeFilters.includes('without-tickets')}
            onClick={() => toggleFilter('without-tickets')}
            variant="secondary"
          />
          <FilterButton
            label="Yes"
            filterType="with-tickets"
            isActive={activeFilters.includes('with-tickets')}
            onClick={() => toggleFilter('with-tickets')}
            variant="success"
          />
        </div>

        {/* VP Status Filters */}
        <div className="flex gap-1 mr-2">
          <span className="text-sm font-medium text-gray-600 self-center">VP:</span>
          <FilterButton
            label="No"
            filterType="without-vp"
            isActive={activeFilters.includes('without-vp')}
            onClick={() => toggleFilter('without-vp')}
            variant="warning"
          />
          <FilterButton
            label="Yes"
            filterType="with-vp"
            isActive={activeFilters.includes('with-vp')}
            onClick={() => toggleFilter('with-vp')}
            variant="success"
          />
        </div>

        {/* Logistics Filters */}
        <div className="flex gap-1 mr-2">
          <span className="text-sm font-medium text-gray-600 self-center">Logistics:</span>
          <FilterButton
            label="EA"
            filterType="early-arrival"
            isActive={activeFilters.includes('early-arrival')}
            onClick={() => toggleFilter('early-arrival')}
            variant="primary"
          />
          <FilterButton
            label="LD"
            filterType="late-departure"
            isActive={activeFilters.includes('late-departure')}
            onClick={() => toggleFilter('late-departure')}
            variant="primary"
          />
        </div>

        {/* Experience Filters */}
        <div className="flex gap-1 mr-2">
          <span className="text-sm font-medium text-gray-600 self-center">Experience:</span>
          <FilterButton
            label="🔥 Virgin"
            filterType="virgin"
            isActive={activeFilters.includes('virgin')}
            onClick={() => toggleFilter('virgin')}
            variant="warning"
          />
          <FilterButton
            label="🔥 Veteran"
            filterType="veteran"
            isActive={activeFilters.includes('veteran')}
            onClick={() => toggleFilter('veteran')}
            variant="primary"
          />
        </div>

        {/* Skills Dropdown Filter */}
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-600">Skills:</span>
          <select 
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value=""
            onChange={(e) => {
              if (e.target.value && !activeFilters.includes(e.target.value)) {
                onFilterChange([...activeFilters, e.target.value]);
              }
            }}
          >
            <option value="">Select a skill...</option>
            {availableSkills.map(skill => (
              <option key={skill} value={skill} disabled={activeFilters.includes(skill)}>
                {skill}
              </option>
            ))}
          </select>
          
          {/* Active Skills Tags */}
          <div className="flex flex-wrap gap-1">
            {activeFilters.filter(filter => availableSkills.includes(filter)).map(skill => (
              <span
                key={skill}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full cursor-pointer hover:bg-blue-200"
                onClick={() => onFilterChange(activeFilters.filter(f => f !== skill))}
              >
                {skill}
                <X className="ml-1 w-3 h-3" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-3 p-2 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>{activeFilters.length}</strong> filter{activeFilters.length > 1 ? 's' : ''} active
          </p>
        </div>
      )}
    </div>
  );
};

export default RosterFilters;
