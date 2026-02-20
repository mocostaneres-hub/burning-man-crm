import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  startIcon,
  endIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <div className="relative">
        {startIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">{startIcon}</div>
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            input-primary
            ${startIcon ? 'pl-10' : ''}
            ${endIcon ? 'pr-10' : ''}
            ${error ? 'input-error' : ''}
            ${className}
          `}
          {...props}
        />
        {endIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="text-gray-400">{endIcon}</div>
          </div>
        )}
      </div>
      {error && (
        <p className="form-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-gray-500 text-sm font-work mt-1">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
