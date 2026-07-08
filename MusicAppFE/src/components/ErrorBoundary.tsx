import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white p-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center">
            <AlertCircle className="text-red-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold mb-2">Oops! Something went wrong</h2>
            <p className="text-white/60 mb-6 text-sm">
              We've encountered an unexpected error. Don't worry, your data is safe.
            </p>
            {this.state.error && (
              <div className="bg-black/40 p-3 rounded-lg text-left w-full mb-6 overflow-auto max-h-32 text-xs text-red-400 font-mono">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 py-3 rounded-xl font-medium transition-colors"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
