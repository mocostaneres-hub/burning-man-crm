import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';

describe('useErrorHandler', () => {
  test('should initialize with no error', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    expect(result.current.error).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  test('should handle Error objects', () => {
    const { result } = renderHook(() => useErrorHandler());
    const testError = new Error('Test error message');
    
    act(() => {
      result.current.handleError(testError);
    });
    
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Test error message');
    expect(result.current.isError).toBe(true);
  });

  test('should handle string errors', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    act(() => {
      result.current.handleError('String error message');
    });
    
    expect(result.current.error?.message).toBe('String error message');
    expect(result.current.isError).toBe(true);
  });

  test('should handle axios error responses', () => {
    const { result } = renderHook(() => useErrorHandler());
    const axiosError = {
      response: {
        status: 400,
        data: {
          message: 'Bad request'
        }
      }
    };
    
    act(() => {
      result.current.handleError(axiosError);
    });
    
    expect(result.current.error?.message).toBe('Bad request');
    expect(result.current.error?.code).toBe('400');
    expect(result.current.isError).toBe(true);
  });

  test('should clear errors', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    act(() => {
      result.current.handleError('Test error');
    });
    
    expect(result.current.isError).toBe(true);
    
    act(() => {
      result.current.clearError();
    });
    
    expect(result.current.error).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  test('should handle unknown error types', () => {
    const { result } = renderHook(() => useErrorHandler());
    const unknownError = { someProperty: 'value' };
    
    act(() => {
      result.current.handleError(unknownError);
    });
    
    expect(result.current.error?.message).toBe('An unexpected error occurred');
    expect(result.current.error?.details).toEqual(unknownError);
    expect(result.current.isError).toBe(true);
  });
});

