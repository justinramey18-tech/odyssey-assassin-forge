import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TutorialStep, CATEGORY_COLORS } from '@/lib/tutorialSteps';

interface TutorialOverlayProps {
  step: TutorialStep | null;
  isActive: boolean;
}

export function TutorialOverlay({ step, isActive }: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Find and track target element
  useEffect(() => {
    if (!step || !isActive) {
      setTargetRect(null);
      return;
    }

    // For center-positioned steps (welcome/complete), no target needed
    if (step.position === 'center') {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(`[data-tutorial-id="${step.targetId}"]`);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
        
        // Scroll into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Observe size changes
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        observerRef.current = new ResizeObserver(() => {
          setTargetRect(target.getBoundingClientRect());
        });
        observerRef.current.observe(target);
      } else {
        // Target not found, skip this step visually
        setTargetRect(null);
      }
    };

    // Small delay to allow DOM to settle
    const timer = setTimeout(findTarget, 100);
    
    // Also update on scroll/resize
    const handleUpdate = () => {
      const target = document.querySelector(`[data-tutorial-id="${step.targetId}"]`);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [step, isActive]);

  if (!isActive || !step) return null;

  const accentColor = CATEGORY_COLORS[step.category];
  const padding = 12;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with cutout */}
      <svg 
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'auto' }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x - padding}
                y={targetRect.y - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.85)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Pulsing ring around target */}
      {targetRect && (
        <div
          className="absolute border-2 rounded-xl animate-pulse pointer-events-none"
          style={{
            left: targetRect.x - padding,
            top: targetRect.y - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderColor: accentColor,
            boxShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}50`,
          }}
        />
      )}
    </div>
  );
}
