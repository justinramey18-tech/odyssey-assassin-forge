import { ReactElement, cloneElement } from 'react';
import { useOnboardingContext } from './OnboardingProvider';
import type { OnboardingStep } from '@/lib/onboarding/types';
import { ONBOARDING_TIMING } from '@/lib/onboarding/constants';

interface OnboardingTriggerProps {
  children: ReactElement;
  step: OnboardingStep;
  id: string;
  onBeforeAdvance?: () => void;
}

export function OnboardingTrigger({
  children,
  step,
  id,
  onBeforeAdvance,
}: OnboardingTriggerProps) {
  const context = useOnboardingContext();

  if (!context || context.step !== step) {
    return cloneElement(children, { 
      id,
      'data-testid': `onboarding-trigger-${id}`,
    });
  }

  return cloneElement(children, {
    id,
    'data-testid': `onboarding-trigger-${id}`,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (typeof children.props.onClick === 'function') {
        children.props.onClick(e);
      }

      onBeforeAdvance?.();

      setTimeout(() => {
        context.advance();
      }, ONBOARDING_TIMING.ADVANCE_DELAY_MS);
    },
  });
}
