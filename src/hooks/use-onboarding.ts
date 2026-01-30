import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  OnboardingStorage,
  OnboardingStep,
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_STORAGE_KEY,
  STEP_ORDER,
  isValidState,
  isStateExpired,
  TARGET_ABILITY,
} from '@/lib/onboarding/types';
import { trackOnboardingEvent, trackAbandonmentIfNeeded } from '@/lib/onboarding/analytics';

function loadOnboardingState(): OnboardingStorage {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidState(parsed)) {
        // Issue #15 - Check for expired state
        if (isStateExpired(parsed)) {
          console.debug('[Onboarding] State expired, resetting');
          localStorage.removeItem(ONBOARDING_STORAGE_KEY);
          return DEFAULT_ONBOARDING_STATE;
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('[Onboarding] Corrupted localStorage state:', error);
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }
  return DEFAULT_ONBOARDING_STATE;
}

export interface UseOnboardingReturn {
  step: OnboardingStep;
  isComplete: boolean;
  isActive: boolean;
  targetAbilityId: string;
  
  start: () => void;
  advance: () => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
  
  highlightedElementId: string | null;
}

export function useOnboarding(totalPointsSpent: number): UseOnboardingReturn {
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<OnboardingStorage>(() => DEFAULT_ONBOARDING_STATE);
  
  // Track previous step for abandonment detection
  const previousStepRef = useRef<OnboardingStep>('inactive');

  // Hydrate from localStorage after mount
  useEffect(() => {
    setIsMounted(true);
    const stored = loadOnboardingState();
    setState(stored);
    previousStepRef.current = stored.currentStep;
  }, []);

  // Persist state changes
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        ...state,
        lastUpdateTimestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[Onboarding] Failed to save state:', error);
    }
  }, [state, isMounted]);

  // Track abandonment on unmount (Issue #14)
  useEffect(() => {
    return () => {
      trackAbandonmentIfNeeded(previousStepRef.current);
    };
  }, []);

  // Auto-start for new characters
  useEffect(() => {
    if (!isMounted) return;
    if (totalPointsSpent === 0 && !state.isComplete && state.currentStep === 'inactive') {
      const startOnboarding = () => {
        trackOnboardingEvent('start');
        setState(prev => ({ ...prev, currentStep: 'welcome' }));
      };
      
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(startOnboarding, { timeout: 1000 });
        return () => cancelIdleCallback(id);
      } else {
        const timer = setTimeout(startOnboarding, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [totalPointsSpent, state.isComplete, state.currentStep, isMounted]);

  const advance = useCallback(() => {
    setState(prev => {
      const currentIdx = STEP_ORDER.indexOf(prev.currentStep);
      const nextStep = STEP_ORDER[currentIdx + 1];
      
      trackOnboardingEvent('step_advance', prev.currentStep);
      previousStepRef.current = nextStep || 'inactive';
      
      if (nextStep === 'complete') {
        trackOnboardingEvent('complete');
        return { ...prev, currentStep: 'inactive', isComplete: true };
      } else if (nextStep) {
        return { ...prev, currentStep: nextStep };
      }
      return prev;
    });
  }, []);

  const skip = useCallback(() => {
    trackOnboardingEvent('step_skip', state.currentStep);
    previousStepRef.current = 'inactive';
    setState(prev => ({ ...prev, currentStep: 'inactive', isComplete: true }));
  }, [state.currentStep]);

  const complete = useCallback(() => {
    trackOnboardingEvent('complete');
    previousStepRef.current = 'inactive';
    setState(prev => ({ ...prev, currentStep: 'inactive', isComplete: true }));
  }, []);

  const start = useCallback(() => {
    trackOnboardingEvent('start');
    previousStepRef.current = 'welcome';
    setState(prev => ({ ...prev, currentStep: 'welcome', isComplete: false }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    previousStepRef.current = 'inactive';
    setState(DEFAULT_ONBOARDING_STATE);
  }, []);

  const highlightedElementId: Record<OnboardingStep, string | null> = {
    'welcome': null,
    'points_intro': 'onboarding-available-points',
    'select_tree': 'onboarding-warrior-tree',
    'select_ability': `onboarding-${TARGET_ABILITY}`,
    'unlock_ability': 'onboarding-unlock-button',
    'complete': null,
    'inactive': null,
  };

  const isActive = state.currentStep !== 'inactive' && !state.isComplete;

  // Update ref when step changes
  useEffect(() => {
    previousStepRef.current = state.currentStep;
  }, [state.currentStep]);

  if (!isMounted) {
    return {
      step: 'inactive',
      isComplete: false,
      isActive: false,
      targetAbilityId: TARGET_ABILITY,
      start: () => {},
      advance: () => {},
      skip: () => {},
      complete: () => {},
      reset: () => {},
      highlightedElementId: null,
    };
  }

  return {
    step: state.currentStep,
    isComplete: state.isComplete,
    isActive,
    targetAbilityId: TARGET_ABILITY,
    start,
    advance,
    skip,
    complete,
    reset,
    highlightedElementId: highlightedElementId[state.currentStep],
  };
}
