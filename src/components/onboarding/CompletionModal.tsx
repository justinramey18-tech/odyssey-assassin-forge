import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/ui/glass';
import { Award } from 'lucide-react';
import { ONBOARDING_Z_INDEX } from '@/lib/onboarding/constants';

interface Props {
  onFinish: () => void;
  characterName?: string;
}

export function CompletionModal({ onFinish, characterName = 'Assassin' }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Ref for stable callback (Issue #7)
  const onFinishRef = useRef(onFinish);
  
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Keyboard handler with stable reference
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onFinishRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80"
      style={{ zIndex: ONBOARDING_Z_INDEX.MODAL }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Glass
          variant="default"
          className="max-w-md mx-4 p-8 text-center rounded-2xl border-2 border-green-500"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
          >
            <Award className="w-14 h-14 mx-auto text-green-400 mb-6" />
          </motion.div>

          <h1 id="completion-title" className="font-cinzel font-bold text-2xl mb-4 text-green-400">
            Your Legend Begins, {characterName}!
          </h1>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Well done. You're now stronger. You have 2 points left to spend as
            you wish. Explore the trees and forge your own path.
          </p>

          <Button
            ref={buttonRef}
            size="lg"
            onClick={onFinish}
            className="w-full"
            data-testid="onboarding-finish-button"
          >
            Finish Tutorial
          </Button>
        </Glass>
      </motion.div>
    </div>
  );
}
