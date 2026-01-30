import { useState, useCallback, useEffect } from 'react';
import { 
  tutorialSteps, 
  TutorialStep, 
  TUTORIAL_STORAGE_KEY, 
  TUTORIAL_STEP_KEY 
} from '@/lib/tutorialSteps';

interface TutorialContext {
  characterLevel: number;
  isHonestMode: boolean;
  gauntletLocked: boolean;
}

interface UseTutorialReturn {
  // State
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  hasCompletedTutorial: boolean;
  
  // Actions
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
  
  // Context setter
  setContext: (ctx: Partial<TutorialContext>) => void;
}

export function useTutorial(): UseTutorialReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  });
  const [context, setContextState] = useState<TutorialContext>({
    characterLevel: 1,
    isHonestMode: false,
    gauntletLocked: true,
  });

  // Get filtered steps based on context
  const getFilteredSteps = useCallback(() => {
    return tutorialSteps.filter(step => {
      if (!step.skipCondition) return true;
      
      switch (step.skipCondition) {
        case 'notMaxLevel':
          return context.characterLevel >= 20;
        case 'gauntletLocked':
          return !context.gauntletLocked || context.characterLevel >= 20;
        default:
          return true;
      }
    });
  }, [context]);

  const filteredSteps = getFilteredSteps();
  const currentStep = isActive ? filteredSteps[currentStepIndex] ?? null : null;
  const totalSteps = filteredSteps.length;

  // Start tutorial
  const startTutorial = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
    
    // Save progress
    localStorage.setItem(TUTORIAL_STEP_KEY, '0');
  }, []);

  // Next step
  const nextStep = useCallback(() => {
    const newIndex = currentStepIndex + 1;
    
    if (newIndex >= filteredSteps.length) {
      // Tutorial complete
      setIsActive(false);
      setHasCompletedTutorial(true);
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      localStorage.removeItem(TUTORIAL_STEP_KEY);
    } else {
      setCurrentStepIndex(newIndex);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(newIndex));
    }
  }, [currentStepIndex, filteredSteps.length]);

  // Previous step
  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(newIndex));
    }
  }, [currentStepIndex]);

  // Skip tutorial
  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setHasCompletedTutorial(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  // Reset tutorial (for replay)
  const resetTutorial = useCallback(() => {
    setHasCompletedTutorial(false);
    setCurrentStepIndex(0);
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  // Update context
  const setContext = useCallback((ctx: Partial<TutorialContext>) => {
    setContextState(prev => ({ ...prev, ...ctx }));
  }, []);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    hasCompletedTutorial,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    resetTutorial,
    setContext,
  };
}
