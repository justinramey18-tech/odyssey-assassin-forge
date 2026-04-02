import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmpyreanDragonTapAreaProps {
  hasConfig: boolean;
  isUnbonded?: boolean;
  onEnterCampaign: () => void;
  onSetupCampaign: () => void;
}

export function EmpyreanDragonTapArea({
  hasConfig,
  isUnbonded,
  onEnterCampaign,
  onSetupCampaign,
}: EmpyreanDragonTapAreaProps) {
  const [hintVisible, setHintVisible] = useState(true);

  // Fade hint after 4 seconds on first view
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleTap = () => {
    if (hasConfig) {
      onEnterCampaign();
    } else {
      onSetupCampaign();
    }
  };

  return (
    <button
      onClick={handleTap}
      className="flex-1 flex flex-col items-center justify-center w-full relative"
      style={{ touchAction: 'manipulation', minHeight: '60vh' }}
      aria-label={hasConfig ? 'Enter Empyrean Campaign' : 'Set Up Empyrean Campaign'}
    >
      {/* Subtle tap hint — fades after 4 seconds */}
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-[11px] font-cinzel uppercase tracking-[0.25em] text-white/25 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {isUnbonded ? 'Tap to prove yourself' : hasConfig ? 'Tap to enter' : 'Tap to begin'}
            </span>
            {/* Subtle downward pulse */}
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active press feedback */}
      <div className="absolute inset-0 active:bg-white/[0.03] transition-colors rounded-lg" />
    </button>
  );
}
