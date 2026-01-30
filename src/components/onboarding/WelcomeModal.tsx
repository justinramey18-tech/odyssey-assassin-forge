import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/ui/glass';
import { Sparkles } from 'lucide-react';
import { ONBOARDING_Z_INDEX } from '@/lib/onboarding/constants';

interface Props {
  onBegin: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ onBegin, onSkip }: Props) {
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  
  // Refs to track latest callback values (Issue #7 - memory leak fix)
  const onSkipRef = useRef(onSkip);
  
  // Keep ref updated
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  // Focus management
  useEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  // Keyboard handler with stable reference (Issue #7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkipRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array - no re-adds

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80"
      style={{ zIndex: ONBOARDING_Z_INDEX.MODAL }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Glass
          variant="default"
          className="max-w-md mx-4 p-8 text-center rounded-2xl border-2 border-primary"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Sparkles className="w-12 h-12 mx-auto text-primary mb-6" />
          </motion.div>

          <h1 id="welcome-title" className="font-cinzel font-bold text-2xl mb-4">
            Welcome to the Odyssey, Assassin
          </h1>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Your journey begins now. Let's unlock your first legendary ability
            and forge your path.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              ref={initialFocusRef}
              size="lg"
              onClick={onBegin}
              className="w-full"
              data-testid="onboarding-begin-button"
            >
              Let's Begin
            </Button>

            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1"
            >
              Skip Tutorial
            </button>
          </div>
        </Glass>
      </motion.div>
    </div>
  );
}
