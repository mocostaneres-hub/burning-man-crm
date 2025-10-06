import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'error' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  onClick,
}) => {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    info: 'badge-info',
    error: 'badge-error',
    neutral: 'bg-gray-100 text-gray-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
  };

  const classes = `
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    inline-flex items-center rounded-full font-work font-medium
    ${className}
  `;

  return (
    <span className={classes} onClick={onClick}>
      {children}
    </span>
  );
};

export default Badge;
