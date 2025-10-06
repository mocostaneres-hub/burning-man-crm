import React, { Component, ReactNode } from 'react';
import { Button, Card } from '../ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to monitoring service in production
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
          <Card className="p-8 text-center max-w-lg">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-h2 font-lato-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-body text-custom-text-secondary mb-6">
              We apologize for the inconvenience. An unexpected error has occurred.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 text-left">
                <p className="text-sm text-custom-text-secondary mb-2">
                  Error details (development only):
                </p>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded text-xs font-mono overflow-auto max-h-48">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <pre className="mt-2 text-xs">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="primary"
              onClick={this.handleReload}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
