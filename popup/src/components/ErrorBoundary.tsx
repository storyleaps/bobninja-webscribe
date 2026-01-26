import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch React rendering errors
 * Logs errors to the service worker for diagnostic reporting
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);

    // Log to service worker for persistent storage
    this.logErrorToServiceWorker(error, errorInfo);
  }

  private async logErrorToServiceWorker(error: Error, errorInfo: ErrorInfo) {
    try {
      // Send error to service worker via postMessage
      if (navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();

        navigator.serviceWorker.controller.postMessage(
          {
            type: 'LOG_ERROR',
            data: {
              source: 'popup',
              message: error.message,
              stack: error.stack,
              context: {
                componentStack: errorInfo.componentStack,
                type: 'react-error-boundary'
              }
            }
          },
          [messageChannel.port2]
        );
      }
    } catch (e) {
      console.error('[ErrorBoundary] Failed to log error to service worker:', e);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-[400px] h-[600px] bg-background text-foreground flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="p-4 rounded-full bg-destructive/10 inline-block">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>

            <h2 className="text-lg font-semibold">Something went wrong</h2>

            <p className="text-sm text-muted-foreground max-w-[300px]">
              An unexpected error occurred. The error has been logged for diagnostic purposes.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-left">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-center mt-6">
              <Button variant="outline" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
