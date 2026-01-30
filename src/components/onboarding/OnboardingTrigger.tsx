import { ReactElement, cloneElement, useCallback, useRef, useEffect } from 'react';
import { useOnboardingContext } from './OnboardingProvider';
import type { OnboardingStep } from '@/lib/onboarding/types';
import { ONBOARDING_TIMING } from '@/lib/onboarding/constants';

interface OnboardingTriggerProps {
  children: ReactElement;
  step: OnboardingStep;
  id: string;
  onBeforeAdvance?: () => void;
  advanceDelayMs?: number; // Issue #6 - make timing configurable
}

export function OnboardingTrigger({
  children,
  step,
  id,
  onBeforeAdvance,
  advanceDelayMs = ONBOARDING_TIMING.ADVANCE_DELAY_MS,
}: OnboardingTriggerProps) {
  const context = useOnboardingContext();
  
  // Refs for stable callback references
  const onBeforeAdvanceRef = useRef(onBeforeAdvance);
  const childOnClickRef = useRef(children.props.onClick);
  
  useEffect(() => {
    onBeforeAdvanceRef.current = onBeforeAdvance;
    childOnClickRef.current = children.props.onClick;
  }, [onBeforeAdvance, children.props.onClick]);

  // Memoized click handler to prevent unnecessary re-renders
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Call original onClick if exists
    if (typeof childOnClickRef.current === 'function') {
      childOnClickRef.current(e);
    }

    // Call before advance hook
    onBeforeAdvanceRef.current?.();

    // Advance after delay
    setTimeout(() => {
      context?.advance();
    }, advanceDelayMs);
  }, [context, advanceDelayMs]);

  if (!context || context.step !== step) {
    return cloneElement(children, { 
      id,
      'data-testid': `onboarding-trigger-${id}`,
    });
  }

  return cloneElement(children, {
    id,
    'data-testid': `onboarding-trigger-${id}`,
    onClick: handleClick,
  });
}
