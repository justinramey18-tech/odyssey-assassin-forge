import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Setup portal container (Issue #4 - z-index stacking context fix)
  useEffect(() => {
    // Check if we're in browser environment
    if (typeof document === 'undefined') return;
    
    // Create or get existing portal container
    let container = document.getElementById('onboarding-portal');
    if (!container) {
      container = document.createElement('div');
      container.id = 'onboarding-portal';
      container.setAttribute('data-onboarding-portal', 'true');
      document.body.appendChild(container);
    }
    setPortalContainer(container);

    return () => {
      // Only remove if no onboarding is active and container is empty
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    };
  }, []);

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

  // Render onboarding UI through portal to escape stacking contexts
  const renderOnboardingUI = () => {
    if (!onboarding.isActive && onboarding.step !== 'complete') {
      return null;
    }

    return (
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
    );
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      <div data-onboarding-content>
        {children}
      </div>
      
      {/* Use portal to render outside component hierarchy (Issue #4) */}
      {portalContainer && createPortal(renderOnboardingUI(), portalContainer)}
    </OnboardingContext.Provider>
  );
}
