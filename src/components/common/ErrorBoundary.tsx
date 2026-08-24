/**
 * Production-Safe React Error Boundary
 * Catches JavaScript errors in child component tree, logs safely,
 * and renders a user-friendly recovery screen without leaking stack traces or secrets.
 *
 * UX remediation: design tokens (F1/F12) so the recovery screen follows the
 * active theme; 44px action targets (F6); readable text sizes (F7).
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error securely without exposing to user UI
    console.error('ErrorBoundary captured error:', error.message, errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-app text-ink flex flex-col items-center justify-center p-6 font-sans">
          <div className="w-full max-w-sm bg-surface border border-line rounded-3xl p-6 shadow-2xl text-center space-y-4 backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-warning-soft border border-warning text-warning-text flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-7 h-7" aria-hidden="true" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-ink">Something went wrong</h2>
              <p className="text-sm text-soft leading-relaxed">
                The application encountered an unexpected error. Your offline data is safe.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="min-h-11 w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-11 w-full py-2.5 px-4 rounded-xl bg-inset hover:bg-inset-strong text-soft text-sm font-semibold transition-all border border-line active:scale-98 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
