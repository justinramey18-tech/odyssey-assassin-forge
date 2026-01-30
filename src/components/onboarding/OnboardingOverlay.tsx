import { useState, useEffect } from 'react';
import { ONBOARDING_Z_INDEX, ONBOARDING_TIMING } from '@/lib/onboarding/constants';
import { trackOnboardingEvent } from '@/lib/onboarding/analytics';

interface Props {
  targetId: string | null;
  onSkip: () => void;
  onTimeout?: () => void;
}

export function OnboardingOverlay({ targetId, onSkip, onTimeout }: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!targetId) {
      setTargetRect(null);
      setHasError(false);
      return;
    }

    const findTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) {
        console.warn(`[Onboarding] Target element not found: ${targetId}`);
        setHasError(true);
        return false;
      }
      setHasError(false);
      setTargetRect(target.getBoundingClientRect());
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    };

    const timer = setTimeout(findTarget, 100);
    
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget, true);
    };
  }, [targetId]);

  // Auto-advance after timeout if element not found
  useEffect(() => {
    if (hasError && onTimeout) {
      const timeout = setTimeout(() => {
        console.warn('[Onboarding] Target element timed out, advancing');
        trackOnboardingEvent('element_timeout');
        onTimeout();
      }, ONBOARDING_TIMING.ELEMENT_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }
  }, [hasError, onTimeout]);

  // Keyboard navigation
  useEffect(() => {
    if (!targetId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
      if (e.key === 'Tab') {
        const target = document.getElementById(targetId);
        if (target && !target.contains(document.activeElement)) {
          e.preventDefault();
          const focusable = target.querySelector<HTMLElement>('button, [href], input, [tabindex]');
          focusable?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetId, onSkip]);

  if (!targetId) return null;

  const padding = 16;

  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: ONBOARDING_Z_INDEX.OVERLAY }}
    >
      <svg 
        className="absolute inset-0 w-full h-full" 
        style={{ 
          willChange: 'opacity',
          backfaceVisibility: 'hidden',
          pointerEvents: 'auto',
          transition: `all ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms ease-in-out`,
        }}
        aria-hidden="true"
      >
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x - padding}
                y={targetRect.y - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={12}
                fill="black"
                style={{
                  transition: `all ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms ease-in-out`,
                }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.85)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {/* Pulsing ring with touch affordance */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl pointer-events-none"
          style={{
            zIndex: ONBOARDING_Z_INDEX.SPOTLIGHT,
            left: targetRect.x - padding,
            top: targetRect.y - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 20px hsl(var(--primary)), 0 0 40px hsl(var(--primary) / 0.5)',
            transform: 'translateZ(0)',
            animation: 'onboarding-pulse 1.5s ease-in-out infinite',
            transition: `left ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms, top ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms`,
          }}
          data-testid="onboarding-spotlight-ring"
        />
      )}
      
      <style>{`
        @keyframes onboarding-pulse {
          0%, 100% { 
            opacity: 1; 
            transform: translateZ(0) scale(1); 
          }
          50% { 
            opacity: 0.7; 
            transform: translateZ(0) scale(1.02); 
          }
        }
      `}</style>
    </div>
  );
}
