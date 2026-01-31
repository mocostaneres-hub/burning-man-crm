import React from 'react';

interface CampLeadBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const CampLeadBadge: React.FC<CampLeadBadgeProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm'
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} rounded font-medium bg-orange-100 text-orange-800 border border-orange-200 ${className}`}
      title="Camp Lead - Delegated admin permissions"
    >
      <span className="text-sm">🎖️</span>
      <span>Lead</span>
    </span>
  );
};

export default CampLeadBadge;
