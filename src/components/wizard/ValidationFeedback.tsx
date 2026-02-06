// Wizard Validation Feedback Component
// Displays inline errors and warnings for wizard steps

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepValidation } from './types';

interface ValidationFeedbackProps {
  validation: StepValidation;
  showSuccess?: boolean;
  className?: string;
  compact?: boolean;
}

export function ValidationFeedback({ 
  validation, 
  showSuccess = false,
  className,
  compact = false,
}: ValidationFeedbackProps) {
  const { errors, warnings, isValid } = validation;
  const hasContent = errors.length > 0 || warnings.length > 0 || (showSuccess && isValid);

  if (!hasContent) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("space-y-2", className)}
      >
        {/* Errors */}
        {errors.map((error, index) => (
          <motion.div
            key={`error-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-start gap-2 rounded-md border",
              compact 
                ? "p-2 text-xs" 
                : "p-3 text-sm",
              "bg-destructive/10 border-destructive/30 text-destructive"
            )}
          >
            <AlertCircle className={cn("shrink-0", compact ? "w-3.5 h-3.5 mt-0.5" : "w-4 h-4 mt-0.5")} />
            <span className="flex-1">{error}</span>
          </motion.div>
        ))}

        {/* Warnings */}
        {warnings.map((warning, index) => (
          <motion.div
            key={`warning-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (errors.length + index) * 0.05 }}
            className={cn(
              "flex items-start gap-2 rounded-md border",
              compact 
                ? "p-2 text-xs" 
                : "p-3 text-sm",
              "bg-amber-500/10 border-amber-500/30 text-amber-500"
            )}
          >
            <AlertTriangle className={cn("shrink-0", compact ? "w-3.5 h-3.5 mt-0.5" : "w-4 h-4 mt-0.5")} />
            <span className="flex-1">{warning}</span>
          </motion.div>
        ))}

        {/* Success (only shown when explicitly requested and valid with no warnings) */}
        {showSuccess && isValid && errors.length === 0 && warnings.length === 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center gap-2 rounded-md border",
              compact 
                ? "p-2 text-xs" 
                : "p-3 text-sm",
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            )}
          >
            <CheckCircle2 className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
            <span>All requirements met</span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Inline field-level error for single fields
interface FieldErrorProps {
  error?: string | null;
  className?: string;
}

export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  return (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={cn("text-xs text-destructive flex items-center gap-1 mt-1", className)}
    >
      <AlertCircle className="w-3 h-3" />
      {error}
    </motion.p>
  );
}

// Compact inline validation indicator
interface ValidationIndicatorProps {
  isValid: boolean;
  hasWarnings?: boolean;
}

export function ValidationIndicator({ isValid, hasWarnings }: ValidationIndicatorProps) {
  if (isValid && !hasWarnings) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (isValid && hasWarnings) {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }
  return <AlertCircle className="w-4 h-4 text-destructive" />;
}
