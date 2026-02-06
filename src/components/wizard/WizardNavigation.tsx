// Wizard Navigation Buttons Component

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Rocket, SkipForward, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StepValidation } from './types';

interface WizardNavigationProps {
  // State
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  canGoBack: boolean;
  
  // Actions
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  
  // Labels
  nextLabel?: string;
  backLabel?: string;
  completeLabel?: string;
  
  // Optional skip functionality
  showSkip?: boolean;
  skipLabel?: string;
  
  // Loading state
  isLoading?: boolean;

  // Validation feedback
  validation?: StepValidation;
}

export function WizardNavigation({
  isFirstStep,
  isLastStep,
  canProceed,
  canGoBack,
  onBack,
  onNext,
  onSkip,
  onComplete,
  nextLabel = 'Continue',
  backLabel = 'Back',
  completeLabel = 'Begin Adventure',
  showSkip = false,
  skipLabel = 'Skip',
  isLoading = false,
  validation,
}: WizardNavigationProps) {
  const hasErrors = validation && validation.errors.length > 0;

  return (
    <div className="space-y-2">
      {/* Validation Errors Display */}
      <AnimatePresence mode="wait">
        {hasErrors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validation?.errors[0]}</span>
              {validation && validation.errors.length > 1 && (
                <span className="text-destructive/70">
                  (+{validation.errors.length - 1} more)
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: canGoBack ? 1 : 0.5, x: 0 }}
          className="flex-shrink-0"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={!canGoBack || isLoading}
            className="font-display uppercase tracking-wider"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {backLabel}
          </Button>
        </motion.div>
        
        {/* Skip Button (optional, centered) */}
        {showSkip && onSkip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-shrink-0"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={isLoading}
              className="font-display uppercase tracking-wider text-muted-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              {skipLabel}
            </Button>
          </motion.div>
        )}
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Next / Complete Button */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-shrink-0"
        >
          {isLastStep ? (
            <Button
              type="button"
              onClick={onComplete}
              disabled={!canProceed || isLoading}
              className={cn(
                'font-display uppercase tracking-wider',
                'bg-gradient-to-r from-primary to-primary/80',
                'hover:from-primary/90 hover:to-primary/70',
              )}
              size="lg"
            >
              <Rocket className="w-4 h-4 mr-2" />
              {completeLabel}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onNext}
              disabled={!canProceed || isLoading}
              className="font-display uppercase tracking-wider"
            >
              {nextLabel}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Compact mobile version
export function WizardNavigationCompact({
  isFirstStep,
  isLastStep,
  canProceed,
  canGoBack,
  onBack,
  onNext,
  onComplete,
  isLoading = false,
  validation,
}: Pick<WizardNavigationProps, 
  'isFirstStep' | 'isLastStep' | 'canProceed' | 'canGoBack' | 
  'onBack' | 'onNext' | 'onComplete' | 'isLoading' | 'validation'
>) {
  const hasErrors = validation && validation.errors.length > 0;

  return (
    <div className="space-y-2">
      {/* Validation Errors Display */}
      <AnimatePresence mode="wait">
        {hasErrors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{validation?.errors[0]}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3">
        {canGoBack && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        
        <Button
          type="button"
          onClick={isLastStep ? onComplete : onNext}
          disabled={!canProceed || isLoading}
          className={cn(
            'flex-1 font-display uppercase tracking-wider',
            isLastStep && 'bg-gradient-to-r from-primary to-primary/80',
          )}
        >
          {isLastStep ? (
            <>
              <Rocket className="w-4 h-4 mr-2" />
              Begin Adventure
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
