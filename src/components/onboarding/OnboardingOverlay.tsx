import { useState, useEffect, useRef, useId } from 'react';
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
  
  // Use unique ID for SVG mask to prevent collisions (Issue #11)
  const uniqueId = useId();
  const maskId = `onboarding-spotlight-mask-${uniqueId.replace(/:/g, '')}`;
  
  // Refs to track latest callback values (Issue #7)
  const onSkipRef = useRef(onSkip);
  const onTimeoutRef = useRef(onTimeout);
  const targetIdRef = useRef(targetId);
  
  // Keep refs updated
  useEffect(() => {
    onSkipRef.current = onSkip;
    onTimeoutRef.current = onTimeout;
    targetIdRef.current = targetId;
  }, [onSkip, onTimeout, targetId]);

  // Consolidated effect for target finding, resize/scroll handling, keyboard, and timeout (Issues #1, #2, #3)
  useEffect(() => {
    if (!targetId) {
      setTargetRect(null);
      setHasError(false);
      return;
    }

    const abortController = new AbortController();
    let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let elementTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const findTarget = () => {
      if (abortController.signal.aborted) return;
      
      const currentTargetId = targetIdRef.current;
      if (!currentTargetId) return;
      
      const target = document.getElementById(currentTargetId);
      if (!target) {
        console.warn(`[Onboarding] Target element not found: ${currentTargetId}`);
        setHasError(true);
        
        // Auto-advance after timeout if element not found
        if (onTimeoutRef.current && !elementTimeoutId) {
          elementTimeoutId = setTimeout(() => {
            if (abortController.signal.aborted) return;
            console.warn('[Onboarding] Target element timed out, advancing');
            trackOnboardingEvent('element_timeout');
            onTimeoutRef.current?.();
          }, ONBOARDING_TIMING.ELEMENT_TIMEOUT_MS);
        }
        return;
      }
      
      // Clear element timeout if found
      if (elementTimeoutId) {
        clearTimeout(elementTimeoutId);
        elementTimeoutId = null;
      }
      
      setHasError(false);
      setTargetRect(target.getBoundingClientRect());
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Debounced find for scroll/resize events
    const debouncedFindTarget = () => {
      if (abortController.signal.aborted) return;
      
      if (debounceTimeoutId) clearTimeout(debounceTimeoutId);
      
      // Use RAF for smoother updates during scroll
      debounceTimeoutId = setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          findTarget();
        });
      }, 50);
    };

    // Keyboard handler with stable reference
    const handleKeyDown = (e: KeyboardEvent) => {
      if (abortController.signal.aborted) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkipRef.current();
      }
      
      if (e.key === 'Tab') {
        const currentTargetId = targetIdRef.current;
        if (!currentTargetId) return;
        
        const target = document.getElementById(currentTargetId);
        if (target && !target.contains(document.activeElement)) {
          e.preventDefault();
          const focusable = target.querySelector<HTMLElement>('button, [href], input, [tabindex]');
          focusable?.focus();
        }
      }
    };

    // Initial find with small delay for DOM settling
    const initialTimer = setTimeout(findTarget, 100);
    
    window.addEventListener('resize', debouncedFindTarget);
    window.addEventListener('scroll', debouncedFindTarget, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      abortController.abort();
      clearTimeout(initialTimer);
      if (debounceTimeoutId) clearTimeout(debounceTimeoutId);
      if (elementTimeoutId) clearTimeout(elementTimeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', debouncedFindTarget);
      window.removeEventListener('scroll', debouncedFindTarget, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [targetId]); // Only re-run when targetId changes

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
          <mask id={maskId}>
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
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Pulsing ring with touch affordance */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl pointer-events-none animate-onboarding-pulse"
          style={{
            zIndex: ONBOARDING_Z_INDEX.SPOTLIGHT,
            left: targetRect.x - padding,
            top: targetRect.y - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 20px hsl(var(--primary)), 0 0 40px hsl(var(--primary) / 0.5)',
            transform: 'translateZ(0)',
            transition: `left ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms, top ${ONBOARDING_TIMING.SPOTLIGHT_TRANSITION_MS}ms`,
          }}
          data-testid="onboarding-spotlight-ring"
        />
      )}
    </div>
  );
}
