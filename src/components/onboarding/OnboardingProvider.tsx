import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useOnboarding } from '@/hooks/use-onboarding';
import { OnboardingStep } from '@/lib/onboarding/types';
import { OnboardingOverlay } from './OnboardingOverlay';
import { OnboardingTooltip } from './OnboardingTooltip';
import { WelcomeModal } from './WelcomeModal';
import { CompletionModal } from './CompletionModal';
import { OnboardingErrorBoundary } from './OnboardingErrorBoundary';

interface OnboardingContextValue {
  step: OnboardingStep;
  isActive: boolean;
  advance: () => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
  highlightedElementId: string | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboardingContext() {
  return useContext(OnboardingContext);
}

interface Props {
  children: ReactNode;
  totalPointsSpent: number;
  characterName?: string;
  onForceNavigate?: (tab: string, abilityId?: string) => void;
}

export function OnboardingProvider({ 
  children, 
  totalPointsSpent, 
  characterName = 'Assassin',
  onForceNavigate 
}: Props) {
  const onboarding = useOnboarding(totalPointsSpent);

  // Apply inert attribute
  useEffect(() => {
    if (onboarding.isActive) {
      const mainContent = document.querySelector('[data-onboarding-content]');
      if (mainContent) {
        mainContent.setAttribute('inert', '');
      }
      return () => {
        mainContent?.removeAttribute('inert');
      };
    }
  }, [onboarding.isActive]);

  // Auto-navigate to skills tab
  useEffect(() => {
    if (onboarding.step === 'select_tree' && onForceNavigate) {
      onForceNavigate('skills');
    }
  }, [onboarding.step, onForceNavigate]);

  const contextValue: OnboardingContextValue = {
    step: onboarding.step,
    isActive: onboarding.isActive,
    advance: onboarding.advance,
    skip: onboarding.skip,
    complete: onboarding.complete,
    reset: onboarding.reset,
    highlightedElementId: onboarding.highlightedElementId,
  };

  const spotlightSteps: OnboardingStep[] = [
    'points_intro', 'select_tree', 'select_ability', 'unlock_ability'
  ];

  return (
    <OnboardingContext.Provider value={contextValue}>
      <div data-onboarding-content>
        {children}
      </div>
      
      <OnboardingErrorBoundary onError={() => onboarding.skip()}>
        {onboarding.step === 'welcome' && (
          <WelcomeModal 
            onBegin={onboarding.advance} 
            onSkip={onboarding.skip} 
          />
        )}
        
        {spotlightSteps.includes(onboarding.step) && (
          <>
            <OnboardingOverlay 
              targetId={onboarding.highlightedElementId} 
              onSkip={onboarding.skip}
              onTimeout={onboarding.advance}
            />
            <OnboardingTooltip 
              step={onboarding.step}
              targetId={onboarding.highlightedElementId}
              onSkip={onboarding.skip}
              onAdvance={onboarding.advance}
            />
          </>
        )}
        
        {onboarding.step === 'complete' && (
          <CompletionModal 
            onFinish={onboarding.complete}
            characterName={characterName}
          />
        )}
      </OnboardingErrorBoundary>
    </OnboardingContext.Provider>
  );
}
