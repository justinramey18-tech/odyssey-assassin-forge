import React from 'react';

/**
 * Catches any rendering error anywhere in the app and shows a recovery
 * screen instead of a blank white/black page.
 */
interface ErrorBoundaryState {
  error: Error | null;
  copied: boolean;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  componentStack: string | null = null;
  copyTimer: number | null = null;

  state: ErrorBoundaryState = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.componentStack = info.componentStack ?? null;
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  componentWillUnmount() {
    if (this.copyTimer !== null) window.clearTimeout(this.copyTimer);
  }

  copyDetails = () => {
    const { error } = this.state;
    const componentStack = this.componentStack ?? '';
    const text = `${error?.name ?? 'Error'}: ${error?.message ?? ''}\n${componentStack}`;

    const fallbackCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // Clipboard unavailable — nothing more we can do here.
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }

    this.setState({ copied: true });
    this.copyTimer = window.setTimeout(() => {
      this.setState({ copied: false });
      this.copyTimer = null;
    }, 2000);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const componentStack = this.componentStack ?? '';

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d12] text-zinc-200 p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-cinzel text-xl text-amber-100 text-center">
            Something went wrong
          </h1>

          <p className="text-sm text-zinc-400 text-center">
            Your character progress is kept on this device. Reload to pick up where you left off.
          </p>

          <div className="rounded-md bg-black/50 p-2 max-h-32 overflow-auto break-words text-[11px] font-mono text-zinc-400">
            {error.message}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="h-12 w-full rounded-md bg-amber-500 text-black font-semibold active:scale-[0.98] transition-transform"
            style={{ touchAction: 'manipulation' }}
          >
            Reload
          </button>

          <button
            onClick={this.copyDetails}
            className="h-11 w-full rounded-md border border-amber-500/40 text-amber-300 text-sm active:scale-[0.98] transition-transform"
            style={{ touchAction: 'manipulation' }}
          >
            {this.state.copied ? 'Copied!' : 'Copy error details'}
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
