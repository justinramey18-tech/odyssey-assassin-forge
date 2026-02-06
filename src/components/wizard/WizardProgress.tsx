// Wizard Progress Indicator Component

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, WIZARD_STEP_LABELS, WizardStep } from './types';

interface WizardProgressProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

export function WizardProgress({ 
  currentStep, 
  completedSteps,
  onStepClick,
}: WizardProgressProps) {
  const totalSteps = WIZARD_STEPS.length;
  
  return (
    <div className="w-full">
      {/* Step Indicator Row */}
      <div className="flex items-center justify-between mb-2">
        {WIZARD_STEPS.map((stepId, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index;
          const isAccessible = isCompleted || index <= Math.max(...completedSteps, -1) + 1;
          
          return (
            <div key={stepId} className="flex items-center">
              {/* Step Circle */}
              <motion.button
                type="button"
                onClick={() => isAccessible && onStepClick?.(index)}
                disabled={!isAccessible}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-display transition-all relative',
                  isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  isCompleted && !isCurrent && 'bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                  isCurrent && !isCompleted && 'bg-primary/20 text-primary border-2 border-primary',
                  isAccessible && !isCurrent && 'cursor-pointer hover:scale-110',
                  !isAccessible && 'cursor-not-allowed opacity-50',
                )}
                whileHover={isAccessible ? { scale: 1.05 } : undefined}
                whileTap={isAccessible ? { scale: 0.95 } : undefined}
                aria-label={`Step ${index + 1}: ${WIZARD_STEP_LABELS[stepId]}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </motion.button>
              
              {/* Connecting Line */}
              {index < totalSteps - 1 && (
                <div 
                  className={cn(
                    'h-0.5 flex-1 mx-1 min-w-[20px]',
                    completedSteps.includes(index) ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Current Step Label */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground font-display uppercase tracking-wider">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <p className="text-lg font-display font-semibold text-foreground mt-1">
          {WIZARD_STEP_LABELS[WIZARD_STEPS[currentStep]]}
        </p>
      </div>
    </div>
  );
}

// Compact version for mobile
export function WizardProgressCompact({
  currentStep,
  completedSteps,
}: Pick<WizardProgressProps, 'currentStep' | 'completedSteps'>) {
  const totalSteps = WIZARD_STEPS.length;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span className="font-display uppercase tracking-wider">
          {WIZARD_STEP_LABELS[WIZARD_STEPS[currentStep]]}
        </span>
        <span className="font-display">
          {currentStep + 1}/{totalSteps}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
