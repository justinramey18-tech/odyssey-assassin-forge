import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TutorialStep, CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/tutorialSteps';
import { ChevronLeft, ChevronRight, X, Pointer, GripHorizontal, Hand } from 'lucide-react';

interface TutorialTooltipProps {
  step: TutorialStep | null;
  isActive: boolean;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function TutorialTooltip({
  step,
  isActive,
  currentIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
}: TutorialTooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  // Calculate tooltip position based on target element
  const calculatePosition = useCallback(() => {
    if (!step) return;

    // Center position for welcome/complete steps
    if (step.position === 'center') {
      setPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
      setIsVisible(true);
      return;
    }

    const target = document.querySelector(`[data-tutorial-id="${step.targetId}"]`);
    if (!target) {
      // Fallback to center if target not found
      setPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
      setIsVisible(true);
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const offset = 20;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + offset;
        break;
    }

    // Keep within viewport bounds
    const margin = 16;
    top = Math.max(margin, Math.min(window.innerHeight - tooltipHeight - margin, top));
    left = Math.max(margin, Math.min(window.innerWidth - tooltipWidth - margin, left));

    setPosition({ top, left });
    setIsVisible(true);
  }, [step]);

  useEffect(() => {
    if (!isActive || !step) {
      setIsVisible(false);
      return;
    }

    // Delay to allow overlay to render
    const timer = setTimeout(calculatePosition, 150);
    
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [isActive, step, calculatePosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onSkip();
          break;
        case 'ArrowRight':
        case 'Enter':
          onNext();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onNext, onPrevious, onSkip]);

  if (!isActive || !step || !isVisible) return null;

  const accentColor = CATEGORY_COLORS[step.category];
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === totalSteps - 1;

  // Action icon
  const ActionIcon = step.action === 'drag' ? GripHorizontal : step.action === 'hold' ? Hand : Pointer;

  return (
    <div
      className={cn(
        "fixed z-[101] w-80 p-4 rounded-xl",
        "bg-card/95 backdrop-blur-xl",
        "border-2 shadow-2xl",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
      style={{
        top: position.top,
        left: position.left,
        borderColor: accentColor,
        boxShadow: `0 0 30px ${accentColor}40, 0 10px 40px rgba(0,0,0,0.5)`,
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          {/* Category Badge */}
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
            }}
          >
            {CATEGORY_LABELS[step.category]}
          </span>
          
          {/* Title */}
          <h3 
            className="font-cinzel font-bold text-lg mt-2"
            style={{ color: accentColor }}
          >
            {step.title}
          </h3>
        </div>
        
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Skip tutorial"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {step.description}
      </p>

      {/* Action hint */}
      {step.action && (
        <div 
          className="flex items-center gap-2 text-xs mb-4 px-2 py-1.5 rounded-lg"
          style={{ backgroundColor: `${accentColor}10` }}
        >
          <ActionIcon className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-muted-foreground">
            {step.action === 'tap' && 'Tap to interact'}
            {step.action === 'drag' && 'Drag to reposition'}
            {step.action === 'hold' && 'Hold to activate'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx < currentIndex && "bg-primary",
                idx === currentIndex && "bg-primary scale-125",
                idx > currentIndex && "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          
          <Button
            size="sm"
            onClick={onNext}
            className="gap-1"
            style={{
              backgroundColor: accentColor,
              color: 'hsl(var(--background))',
            }}
          >
            {isLastStep ? 'Done!' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Step counter */}
      <div className="text-center text-[10px] text-muted-foreground mt-3">
        {currentIndex + 1} of {totalSteps}
      </div>
    </div>
  );
}
