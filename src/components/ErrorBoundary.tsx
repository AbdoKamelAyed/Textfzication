import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('TEXTPRINT ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Laboratory Workspace Recovery
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An unexpected error interrupted rendering. Your stored research data in IndexedDB and connected cloud stores remains intact.
            </p>
            <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-950 text-rose-700 dark:text-rose-400 p-3 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2 text-sm font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
            >
              Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
