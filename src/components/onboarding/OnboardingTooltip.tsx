import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/ui/glass';
import { OnboardingStep } from '@/lib/onboarding/types';
import { ONBOARDING_Z_INDEX } from '@/lib/onboarding/constants';

interface StepContent {
  title: string;
  body: string;
  action: string;
  requiresClick: boolean;
}

const STEP_CONTENT: Partial<Record<OnboardingStep, StepContent>> = {
  'points_intro': {
    title: 'Your First Ability Points',
    body: "You start with 3 points to spend on abilities. Let's put one to good use.",
    action: 'Next',
    requiresClick: false,
  },
  'select_tree': {
    title: 'Choose a Path',
    body: 'The Warrior tree focuses on melee combat and defense. Tap "Warrior" to explore.',
    action: 'Click Warrior',
    requiresClick: true,
  },
  'select_ability': {
    title: 'Select an Ability',
    body: 'Weapon Master gives you +1 to melee attacks - a great foundation. Tap it to see details.',
    action: 'Click the Node',
    requiresClick: true,
  },
  'unlock_ability': {
    title: 'Spend Your Point',
    body: 'This looks good! Click "Unlock Tier I" to spend 1 point and learn Weapon Master.',
    action: 'Click Unlock',
    requiresClick: true,
  },
};

interface Props {
  step: OnboardingStep;
  targetId: string | null;
  onSkip: () => void;
  onAdvance?: () => void;
}

export function OnboardingTooltip({ step, targetId, onSkip, onAdvance }: Props) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const content = STEP_CONTENT[step];
  if (!content) return null;

  const tooltipWidth = typeof window !== 'undefined' 
    ? Math.min(320, window.innerWidth - 32) 
    : 320;

  useEffect(() => {
    if (!targetId) return;

    const updatePosition = () => {
      const target = document.getElementById(targetId);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const offset = 24;

      let top = rect.bottom + offset;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));
      if (top + 200 > window.innerHeight) {
        top = rect.top - 200 - offset;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [targetId, step, tooltipWidth]);

  useEffect(() => {
    if (tooltipRef.current) {
      const firstButton = tooltipRef.current.querySelector<HTMLButtonElement>('button');
      firstButton?.focus();
    }
  }, [step]);

  return (
    <Glass
      ref={tooltipRef}
      variant="default"
      className="fixed p-5 rounded-xl border-2 border-primary"
      style={{
        zIndex: ONBOARDING_Z_INDEX.TOOLTIP,
        top: position.top,
        left: position.left,
        width: tooltipWidth,
        maxWidth: 'calc(100vw - 2rem)',
        boxShadow: '0 0 30px hsl(var(--primary) / 0.4), 0 10px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tooltip-title"
      data-testid={`onboarding-tooltip-${step}`}
    >
      <h3 
        id="onboarding-tooltip-title"
        className="font-cinzel font-bold text-lg text-primary mb-2"
      >
        {content.title}
      </h3>

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {content.body}
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1"
          aria-label="Skip tutorial"
        >
          Skip Tutorial
        </button>

        {content.requiresClick ? (
          <span className="text-xs text-primary animate-pulse" aria-live="polite">
            {content.action} →
          </span>
        ) : (
          <Button size="sm" onClick={onAdvance}>
            {content.action}
          </Button>
        )}
      </div>
    </Glass>
  );
}
