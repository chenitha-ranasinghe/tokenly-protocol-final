'use client';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label for logging which section crashed */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Production-grade React Error Boundary.
 * Catches render errors in child components and displays
 * a graceful fallback instead of crashing the entire page.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}]`, error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '32px',
          border: '1px solid rgba(207, 79, 79, 0.2)',
          background: 'rgba(207, 79, 79, 0.03)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '0.6rem',
            fontFamily: 'var(--font-mono)',
            color: 'rgba(207, 79, 79, 0.8)',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            [ MODULE FAULT DETECTED ]
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '16px',
          }}>
            {this.props.section ? `Section: ${this.props.section}` : 'A component encountered an error.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 24px',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontWeight: 700,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
