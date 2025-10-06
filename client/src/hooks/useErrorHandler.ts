import { useState, useCallback } from 'react';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
}

export interface ErrorHandlerState {
  error: AppError | null;
  isError: boolean;
  clearError: () => void;
  handleError: (error: any) => void;
}

/**
 * Hook for centralized error handling
 */
export const useErrorHandler = (): ErrorHandlerState => {
  const [error, setError] = useState<AppError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: any) => {
    let appError: AppError;

    if (error instanceof Error) {
      appError = {
        message: error.message,
        details: error.stack,
        timestamp: new Date()
      };
    } else if (error?.response?.data) {
      // Axios error response
      appError = {
        message: error.response.data.message || 'An error occurred',
        code: error.response.status?.toString(),
        details: error.response.data,
        timestamp: new Date()
      };
    } else if (typeof error === 'string') {
      appError = {
        message: error,
        timestamp: new Date()
      };
    } else {
      appError = {
        message: 'An unexpected error occurred',
        details: error,
        timestamp: new Date()
      };
    }

    setError(appError);

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by useErrorHandler:', appError);
    }

    // In production, you would send this to your error tracking service
    // Example: Sentry.captureException(appError);
  }, []);

  return {
    error,
    isError: error !== null,
    clearError,
    handleError
  };
};
