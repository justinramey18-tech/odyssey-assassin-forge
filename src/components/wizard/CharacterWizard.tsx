import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWizardState } from './hooks/use-wizard-state';
import { useWizardValidation, validateStep } from './hooks/use-wizard-validation';
import { WizardProgress, WizardProgressCompact } from './WizardProgress';
import { WizardNavigation, WizardNavigationCompact } from './WizardNavigation';
import { IdentityStep } from './steps/IdentityStep';
import { AbilityScoresStep } from './steps/AbilityScoresStep';
import { GameModeStep } from './steps/GameModeStep';
import { MagicPathStep } from './steps/MagicPathStep';
import { SkillTreePreviewStep } from './steps/SkillTreePreviewStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { SummaryStep } from './steps/SummaryStep';
import { WizardState, QUICK_START_DEFAULTS } from './types';
import { Button } from '@/components/ui/button';
import { Skull, Zap, Settings2, Cloud } from 'lucide-react';
import wizardBackground from '@/assets/wizard-background.jpg';
import { useIsMobile } from '@/hooks/use-mobile';

interface CharacterWizardProps {
  onComplete: (state: WizardState) => void;
  onQuickStart?: (state: WizardState) => void;
  onLoadCloud?: () => void;
}

type WizardMode = 'choice' | 'wizard';

// Total steps: identity(0), abilityScores(1), gameMode(2), magicPath(3), skillTrees(4), equipment(5), summary(6)
const IMPLEMENTED_STEPS = 7;

export function CharacterWizard({ 
  onComplete, 
  onQuickStart, 
  onLoadCloud,
}: CharacterWizardProps) {
  const [mode, setMode] = useState<WizardMode>('choice');
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const isMobile = useIsMobile();
  
  const wizard = useWizardState();
  const { state, hasResumableProgress, restoreProgress, clearProgress, reset } = wizard;
  const { canProceed, validateStep: getValidation } = useWizardValidation(state);

  // Check for resumable progress on initial render
  useState(() => {
    if (hasResumableProgress) {
      setShowResumePrompt(true);
    }
  });

  // Handle quick start - use defaults with just a name prompt
  const handleQuickStart = useCallback(() => {
    wizard.applyQuickStart();
    
    if (onQuickStart) {
      const quickStartState: WizardState = {
        ...state,
        ...QUICK_START_DEFAULTS,
        currentStep: 0,
        completedSteps: [],
      } as WizardState;
      onQuickStart(quickStartState);
    } else {
      setMode('wizard');
    }
  }, [state, onQuickStart, wizard]);

  // Handle resume from saved progress
  const handleResume = useCallback(() => {
    restoreProgress();
    setShowResumePrompt(false);
    setMode('wizard');
  }, [restoreProgress]);

  // Handle start fresh
  const handleStartFresh = useCallback(() => {
    clearProgress();
    reset();
    setShowResumePrompt(false);
    setMode('wizard');
  }, [clearProgress, reset]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    const validation = getValidation(state.currentStep);
    if (validation.isValid) {
      wizard.goNext();
    }
  }, [wizard, getValidation, state.currentStep]);

  const handleBack = useCallback(() => {
    wizard.goBack();
  }, [wizard]);

  const handleGoToStep = useCallback((step: number) => {
    wizard.jumpToStep(step);
  }, [wizard]);

  const handleComplete = useCallback(() => {
    const validation = getValidation(state.currentStep);
    if (validation.isValid) {
      onComplete(state);
    }
  }, [state, onComplete, getValidation]);

  // Step update handlers
  const handleIdentityUpdate = useCallback((updates: Partial<Pick<WizardState, 'name' | 'level' | 'portraitIcon'>>) => {
    wizard.setIdentity(
      updates.name ?? state.name, 
      updates.level ?? state.level, 
      updates.portraitIcon ?? state.portraitIcon,
    );
  }, [wizard, state.name, state.level, state.portraitIcon]);

  const handleAbilityScoresUpdate = useCallback((updates: Partial<Pick<WizardState, 'abilityScores' | 'scoreGenerationMethod'>>) => {
    if (updates.abilityScores) {
      wizard.setAbilityScores(
        updates.abilityScores, 
        updates.scoreGenerationMethod ?? state.scoreGenerationMethod,
      );
    }
  }, [wizard, state.scoreGenerationMethod]);

  const handleGameModeUpdate = useCallback((updates: Partial<Pick<WizardState, 'gameMode' | 'honestModeRules' | 'xpPreset' | 'diceOddsMode'>>) => {
    if (updates.gameMode !== undefined) {
      wizard.setGameMode(updates.gameMode);
    }
    if (updates.honestModeRules !== undefined) {
      wizard.setHonestRules(updates.honestModeRules);
    }
    if (updates.xpPreset !== undefined) {
      wizard.setXPPreset(updates.xpPreset);
    }
    if (updates.diceOddsMode !== undefined) {
      wizard.setDiceOdds(updates.diceOddsMode);
    }
  }, [wizard]);

  // Magic path update handler
  const handleMagicPathUpdate = useCallback((updates: Partial<Pick<WizardState, 'selectedPath'>>) => {
    if (updates.selectedPath !== undefined) {
      wizard.setMagicPath(updates.selectedPath);
    }
  }, [wizard]);

  // Skill tree update handler (placeholder - abilities selected in-app)
  const handleSkillTreeUpdate = useCallback((updates: Partial<Pick<WizardState, 'starterAbilities'>>) => {
    if (updates.starterAbilities !== undefined) {
      wizard.setStarterAbilities(updates.starterAbilities);
    }
  }, [wizard]);

  // Equipment update handler
  const handleEquipmentUpdate = useCallback((updates: Partial<Pick<WizardState, 'equipment' | 'selectedPresetId'>>) => {
    if (updates.equipment !== undefined && updates.selectedPresetId !== undefined) {
      wizard.setEquipment(updates.equipment, updates.selectedPresetId);
    }
  }, [wizard]);

  // Calculate step states
  const isLastStep = state.currentStep === IMPLEMENTED_STEPS - 1;
  const isFirstStep = state.currentStep === 0;
  const currentValidation = getValidation(state.currentStep);

  // Render resume prompt
  if (showResumePrompt && hasResumableProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{ backgroundImage: `url(${wizardBackground})` }}
        />
        <div className="fixed inset-0 bg-background/60 -z-10" />
        
        <div className="w-full max-w-md">
          <div className="parchment-bg rounded-lg border border-border p-6 space-y-6">
            <div className="text-center">
              <Skull className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-display font-bold text-foreground">Resume Character Creation?</h2>
              <p className="text-sm text-muted-foreground mt-2">
                You have an unfinished character. Would you like to continue where you left off?
              </p>
            </div>
            
            <div className="space-y-3">
              <Button onClick={handleResume} className="w-full" size="lg">
                Continue Creating
              </Button>
              <Button onClick={handleStartFresh} variant="outline" className="w-full">
                Start Fresh
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render initial choice modal
  if (mode === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{ backgroundImage: `url(${wizardBackground})` }}
        />
        <div className="fixed inset-0 bg-background/60 -z-10" />
        
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-card border-2 border-primary/50 mb-4 glow-gold">
              <Skull className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-wide">
              ODYSSEY
            </h1>
            <p className="text-lg text-primary font-display tracking-widest mt-1">
              ASSASSIN
            </p>
          </div>

          {/* Choice Card */}
          <div className="parchment-bg rounded-lg border border-border p-6 space-y-4">
            {/* Quick Start */}
            <button
              onClick={handleQuickStart}
              className="w-full p-4 rounded-lg border-2 border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">Quick Start</p>
                  <p className="text-xs text-muted-foreground">Level 1 Assassin with optimal defaults</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pl-13">
                Enter a name and start playing immediately
              </p>
            </button>

            {/* Custom Build */}
            <button
              onClick={() => setMode('wizard')}
              className="w-full p-4 rounded-lg border-2 border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Settings2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">Custom Build</p>
                  <p className="text-xs text-muted-foreground">Configure every detail</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pl-13">
                Full wizard with ability scores, game mode, and more
              </p>
            </button>

            {/* Load from Cloud */}
            {onLoadCloud && (
              <button
                onClick={onLoadCloud}
                className="w-full p-4 rounded-lg border-2 border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Cloud className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground">Load from Cloud</p>
                    <p className="text-xs text-muted-foreground">Continue an existing character</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground pl-13">
                  Sign in and select a saved character
                </p>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render wizard steps
  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        return <IdentityStep state={state} onUpdate={handleIdentityUpdate} />;
      case 1:
        return <AbilityScoresStep state={state} onUpdate={handleAbilityScoresUpdate} />;
      case 2:
        return <GameModeStep state={state} onUpdate={handleGameModeUpdate} />;
      case 3:
        return <MagicPathStep state={state} onUpdate={handleMagicPathUpdate} />;
      case 4:
        return <SkillTreePreviewStep state={state} onUpdate={handleSkillTreeUpdate} />;
      case 5:
        return <EquipmentStep state={state} onUpdate={handleEquipmentUpdate} />;
      case 6:
        return (
          <SummaryStep 
            state={state} 
            onEditStep={handleGoToStep} 
            onComplete={handleComplete} 
          />
        );
      default:
        return <IdentityStep state={state} onUpdate={handleIdentityUpdate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          {isMobile ? (
            <WizardProgressCompact 
              currentStep={state.currentStep} 
              completedSteps={state.completedSteps}
            />
          ) : (
            <WizardProgress 
              currentStep={state.currentStep} 
              completedSteps={state.completedSteps}
              onStepClick={handleGoToStep}
            />
          )}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 pt-16 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Footer (not shown on summary step 6 - it has its own button) */}
      {state.currentStep !== 6 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-lg mx-auto px-4 py-3">
            {isMobile ? (
              <WizardNavigationCompact
                isFirstStep={isFirstStep}
                isLastStep={isLastStep}
                canProceed={currentValidation.isValid}
                canGoBack={!isFirstStep}
                onBack={handleBack}
                onNext={handleNext}
                onComplete={handleComplete}
                validation={currentValidation}
              />
            ) : (
              <WizardNavigation
                isFirstStep={isFirstStep}
                isLastStep={isLastStep}
                canProceed={currentValidation.isValid}
                canGoBack={!isFirstStep}
                onBack={handleBack}
                onNext={handleNext}
                onComplete={handleComplete}
                validation={currentValidation}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
