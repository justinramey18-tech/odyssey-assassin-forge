import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTutorial } from '@/hooks/use-tutorial';
import { TutorialOverlay } from './TutorialOverlay';
import { TutorialTooltip } from './TutorialTooltip';
import { TutorialStep } from '@/lib/tutorialSteps';

interface TutorialContextValue {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  hasCompletedTutorial: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
  setContext: (ctx: { characterLevel?: number; isHonestMode?: boolean; gauntletLocked?: boolean }) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorialContext() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorialContext must be used within a TutorialProvider');
  }
  return context;
}

interface TutorialProviderProps {
  children: ReactNode;
  characterLevel?: number;
  isHonestMode?: boolean;
  gauntletLocked?: boolean;
  autoStart?: boolean;
}

export function TutorialProvider({
  children,
  characterLevel = 1,
  isHonestMode = false,
  gauntletLocked = true,
  autoStart = false,
}: TutorialProviderProps) {
  const tutorial = useTutorial();

  // Update context when props change
  useEffect(() => {
    tutorial.setContext({
      characterLevel,
      isHonestMode,
      gauntletLocked,
    });
  }, [characterLevel, isHonestMode, gauntletLocked, tutorial.setContext]);

  // Auto-start tutorial for first-time users
  useEffect(() => {
    if (autoStart && !tutorial.hasCompletedTutorial && !tutorial.isActive) {
      // Small delay to let UI settle
      const timer = setTimeout(() => {
        tutorial.startTutorial();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoStart, tutorial.hasCompletedTutorial, tutorial.isActive, tutorial.startTutorial]);

  return (
    <TutorialContext.Provider value={tutorial}>
      {children}
      
      {/* Tutorial UI rendered at root level */}
      <TutorialOverlay 
        step={tutorial.currentStep}
        isActive={tutorial.isActive}
      />
      <TutorialTooltip
        step={tutorial.currentStep}
        isActive={tutorial.isActive}
        currentIndex={tutorial.currentStepIndex}
        totalSteps={tutorial.totalSteps}
        onNext={tutorial.nextStep}
        onPrevious={tutorial.previousStep}
        onSkip={tutorial.skipTutorial}
      />
    </TutorialContext.Provider>
  );
}
