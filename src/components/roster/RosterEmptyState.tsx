import { motion } from 'framer-motion';
import { Scroll } from 'lucide-react';

interface RosterEmptyStateProps {
  onCreateNew: () => void;
}

export function RosterEmptyState({ onCreateNew }: RosterEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center px-6 py-16"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <Scroll className="w-8 h-8 text-primary/60" />
      </div>
      <h2 className="text-xl font-bold text-foreground font-cinzel mb-2">No Characters Yet</h2>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Your adventure awaits. Create your first character to begin.
      </p>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onCreateNew}
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold font-cinzel text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
      >
        Create Your First Hero
      </motion.button>
    </motion.div>
  );
}
