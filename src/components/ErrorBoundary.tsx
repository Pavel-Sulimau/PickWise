import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled UI error in Fortula', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="panel" role="alert" aria-live="assertive">
            <p className="eyebrow">Fortula</p>
            <h1>Something went wrong</h1>
            <p className="muted">
              An unexpected error occurred. Reload the page to continue.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
