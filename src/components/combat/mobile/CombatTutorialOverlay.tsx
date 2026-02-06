// Combat Tutorial Overlay - First-time user onboarding for Combat tab

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronRight, 
  Swords, 
  Zap, 
  Shield, 
  Footprints,
  Target,
  Eye,
  Lightbulb,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// localStorage key for tutorial completion
const COMBAT_TUTORIAL_KEY = 'odyssey-combat-tutorial-seen';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  highlight?: 'action-bar' | 'bottom-nav' | 'situation' | 'turn-wizard' | 'weapons';
  position: 'top' | 'center' | 'bottom';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Combat!',
    description: 'This is your tactical command center. Let me show you around.',
    icon: Swords,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/20',
    position: 'center',
  },
  {
    id: 'action-economy',
    title: 'Action Economy',
    description: 'Each turn you have an Action (red), Bonus Action (amber), Reaction (cyan), and Movement (green). Use them wisely!',
    icon: RotateCcw,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/20',
    highlight: 'action-bar',
    position: 'top',
  },
  {
    id: 'situation',
    title: 'Tactical Conditions',
    description: 'Toggle conditions like Hidden, Advantage, or Ally Adjacent to affect your rolls and enable Sneak Attack.',
    icon: Eye,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/20',
    highlight: 'situation',
    position: 'top',
  },
  {
    id: 'weapons',
    title: 'Weapon Attacks',
    description: 'Your equipped weapons appear here. Tap to roll attacks with automatic Sneak Attack when eligible.',
    icon: Target,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/20',
    highlight: 'weapons',
    position: 'center',
  },
  {
    id: 'turn-wizard',
    title: 'Turn Wizard AI',
    description: 'The Turn Wizard suggests optimal actions based on your situation. Look for glowing suggestions!',
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    highlight: 'turn-wizard',
    position: 'top',
  },
  {
    id: 'navigation',
    title: 'Tab Navigation',
    description: 'Swipe or tap the bottom tabs: COMBAT, ACTIONS, MAGIC, ITEMS, and LOG for combat history.',
    icon: Zap,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    highlight: 'bottom-nav',
    position: 'bottom',
  },
  {
    id: 'ai-prompts',
    title: 'AI DM Prompts',
    description: 'Every action generates a rich narrative prompt. Copy them to your AI DM for immersive storytelling!',
    icon: Sparkles,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/20',
    position: 'center',
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description: 'Time to unleash some chaos. Maximum effort!',
    icon: Check,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/20',
    position: 'center',
  },
];

interface CombatTutorialOverlayProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export function CombatTutorialOverlay({ onComplete, onDismiss }: CombatTutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleBack, handleSkip]);

  // Calculate tooltip position based on step
  const getPositionClasses = () => {
    switch (step.position) {
      case 'top':
        return 'top-24';
      case 'bottom':
        return 'bottom-24';
      case 'center':
      default:
        return 'top-1/2 -translate-y-1/2';
    }
  };

  // Get highlight zone styles
  const getHighlightStyles = () => {
    if (!step.highlight) return null;

    switch (step.highlight) {
      case 'action-bar':
        return {
          top: '80px',
          left: '16px',
          right: '16px',
          height: '60px',
        };
      case 'situation':
        return {
          top: '145px',
          left: '16px',
          right: '16px',
          height: '50px',
        };
      case 'weapons':
        return {
          top: '200px',
          left: '16px',
          right: '16px',
          height: '180px',
        };
      case 'turn-wizard':
        return {
          top: '145px',
          left: '16px',
          right: '16px',
          height: '100px',
        };
      case 'bottom-nav':
        return {
          bottom: '0',
          left: '0',
          right: '0',
          height: '56px',
        };
      default:
        return null;
    }
  };

  const highlightStyles = getHighlightStyles();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] pointer-events-auto"
    >
      {/* Dark overlay with cutout */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Highlight zone (if applicable) */}
      <AnimatePresence mode="wait">
        {highlightStyles && (
          <motion.div
            key={step.highlight}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute rounded-lg"
            style={{
              ...highlightStyles,
              boxShadow: '0 0 0 4px hsl(var(--primary)), 0 0 20px hsl(var(--primary) / 0.5)',
              background: 'transparent',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute left-4 right-4 mx-auto max-w-sm",
            getPositionClasses(),
          )}
        >
          <div className="parchment-bg rounded-xl border border-primary/30 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 pb-0">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                  step.iconBg,
                  step.iconColor.replace('text-', 'border-').replace('400', '500/30'),
                )}>
                  <step.icon className={cn("w-6 h-6", step.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-display font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
                {/* Close button */}
                <button
                  onClick={handleSkip}
                  className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label="Skip tutorial"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 py-3">
              {TUTORIAL_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    index === currentStep
                      ? "w-6 bg-primary"
                      : index < currentStep
                        ? "bg-primary/50"
                        : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 pt-0 flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-muted-foreground"
                >
                  Back
                </Button>
              )}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1"
              >
                {isLastStep ? "Let's Go!" : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Step counter */}
      <div className="absolute top-4 left-4 text-sm text-muted-foreground">
        {currentStep + 1} / {TUTORIAL_STEPS.length}
      </div>
    </motion.div>
  );
}

// Hook to manage tutorial visibility
export function useCombatTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check if tutorial has been seen on mount
  useEffect(() => {
    try {
      const seen = localStorage.getItem(COMBAT_TUTORIAL_KEY);
      if (!seen) {
        // Small delay to let the combat screen render first
        const timer = setTimeout(() => {
          setShowTutorial(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error('Failed to check tutorial status:', e);
    }
    setHasChecked(true);
  }, []);

  // Mark tutorial as complete
  const completeTutorial = useCallback(() => {
    try {
      localStorage.setItem(COMBAT_TUTORIAL_KEY, 'true');
    } catch (e) {
      console.error('Failed to save tutorial status:', e);
    }
    setShowTutorial(false);
    setHasChecked(true);
  }, []);

  // Dismiss tutorial without completing
  const dismissTutorial = useCallback(() => {
    try {
      localStorage.setItem(COMBAT_TUTORIAL_KEY, 'true');
    } catch (e) {
      console.error('Failed to save tutorial status:', e);
    }
    setShowTutorial(false);
    setHasChecked(true);
  }, []);

  // Reset tutorial (for testing or settings)
  const resetTutorial = useCallback(() => {
    try {
      localStorage.removeItem(COMBAT_TUTORIAL_KEY);
    } catch (e) {
      console.error('Failed to reset tutorial:', e);
    }
    setHasChecked(false);
  }, []);

  // Manually trigger tutorial
  const triggerTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  return {
    showTutorial,
    hasChecked,
    completeTutorial,
    dismissTutorial,
    resetTutorial,
    triggerTutorial,
  };
}
