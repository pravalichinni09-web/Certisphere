/**
 * ErrorBoundary — prevents a single page's runtime error from blanking the
 * whole app. Shows a clean, recoverable message (with the error text) instead
 * of a white screen, and lets the user reload or go back.
 */
import React from 'react';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real cause in the console for debugging.
    // eslint-disable-next-line no-console
    console.error('[CertiSphere] Page error caught by ErrorBoundary:', error, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || 'An unexpected error occurred.';
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, width: '100%', background: '#fff', border: '1px solid #e7ecf3', borderRadius: 16, padding: '28px 26px', boxShadow: '0 18px 44px rgba(15,23,42,.12)', textAlign: 'center' }}>
          <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: '50%', background: '#fef2f2', display: 'grid', placeItems: 'center', fontSize: 26 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f2547' }}>This page hit a snag</h2>
          <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 14, lineHeight: 1.55 }}>
            Something went wrong while rendering this screen. Your data is safe — try again or head back to the dashboard.
          </p>
          <pre style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#b91c1c', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 16px' }}>{msg}</pre>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={this.reset}
              style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Try again
            </button>
            <button type="button" onClick={() => { window.location.href = '/'; }}
              style={{ padding: '10px 20px', borderRadius: 9, border: '1.5px solid #cbd5e1', background: '#fff', color: '#0f2547', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
