import { Component, ReactNode } from 'react';
import { Glass } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { ONBOARDING_Z_INDEX } from '@/lib/onboarding/constants';
import { trackOnboardingEvent } from '@/lib/onboarding/analytics';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OnboardingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Onboarding] Error caught:', error, errorInfo);
    trackOnboardingEvent('step_skip', undefined, { 
      reason: 'error_boundary',
      error: error.message 
    });
  }

  private handleSkip = () => {
    this.props.onError?.(this.state.error || new Error('Unknown onboarding error'));
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Issue #16 - Render fallback instead of null
      return (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80"
          style={{ zIndex: ONBOARDING_Z_INDEX.MODAL }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <Glass
            variant="default"
            className="max-w-sm mx-4 p-6 text-center rounded-xl border-2 border-destructive"
          >
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-4" />
            
            <h2 id="error-title" className="font-cinzel font-bold text-lg mb-2">
              Tutorial Hit a Snag
            </h2>
            
            <p id="error-description" className="text-sm text-muted-foreground mb-6">
              Something went wrong with the tutorial. You can skip it and explore on your own.
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="flex-1"
              >
                Retry
              </Button>
              <Button
                size="sm"
                onClick={this.handleSkip}
                className="flex-1"
              >
                Skip Tutorial
              </Button>
            </div>
          </Glass>
        </div>
      );
    }
    
    return this.props.children;
  }
}
