import { OnboardingStep } from './types';

export type OnboardingEvent = 
  | 'start' 
  | 'step_advance' 
  | 'step_skip' 
  | 'complete' 
  | 'element_timeout';

export function trackOnboardingEvent(
  event: OnboardingEvent, 
  step?: OnboardingStep,
  metadata?: Record<string, unknown>
): void {
  // Analytics placeholder - can integrate with Mixpanel, Segment, etc.
  console.debug('[Onboarding]', event, { step, ...metadata });
}
