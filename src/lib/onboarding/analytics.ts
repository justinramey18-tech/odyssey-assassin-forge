import { OnboardingStep } from './types';

export type OnboardingEvent = 
  | 'start' 
  | 'step_advance' 
  | 'step_skip' 
  | 'complete' 
  | 'element_timeout'
  | 'tutorial_abandoned'; // Issue #14 - track abandonment

export interface OnboardingEventMetadata {
  step?: OnboardingStep;
  reason?: string;
  error?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

// Track session start time for duration calculations
let sessionStartTime: number | null = null;

export function trackOnboardingEvent(
  event: OnboardingEvent, 
  step?: OnboardingStep,
  metadata?: OnboardingEventMetadata
): void {
  // Track session timing
  if (event === 'start') {
    sessionStartTime = Date.now();
  }
  
  const eventData: OnboardingEventMetadata = {
    step,
    ...metadata,
  };
  
  // Add duration for completion/abandonment events
  if ((event === 'complete' || event === 'step_skip' || event === 'tutorial_abandoned') && sessionStartTime) {
    eventData.duration_ms = Date.now() - sessionStartTime;
  }
  
  // Analytics placeholder - integrate with Mixpanel, Segment, Amplitude, etc.
  // Example integration:
  // analytics.track('onboarding_' + event, eventData);
  
  console.debug('[Onboarding]', event, eventData);
  
  // Reset session on completion
  if (event === 'complete' || event === 'tutorial_abandoned') {
    sessionStartTime = null;
  }
}

// Helper to track abandonment (Issue #14)
export function trackAbandonmentIfNeeded(currentStep: OnboardingStep): void {
  if (currentStep !== 'inactive' && currentStep !== 'complete') {
    trackOnboardingEvent('tutorial_abandoned', currentStep, {
      reason: 'navigation_away',
    });
  }
}
