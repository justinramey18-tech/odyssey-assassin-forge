import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { PersonaResult } from '@/lib/personality-test/types';
import { getPersonaKey } from '@/lib/personality-test/scoring';
import { PAIRING_REASONS } from '@/lib/personality-test/personas';
import { cn } from '@/lib/utils';

interface PersonalityResultsScreenProps {
  persona: PersonaResult;
  onBegin: () => void;
}

export function PersonalityResultsScreen({ persona, onBegin }: PersonalityResultsScreenProps) {
  const personaKey = getPersonaKey(persona);
  const reasons = PAIRING_REASONS[personaKey] ?? [];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl overflow-y-auto px-6 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center"
        >
          <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <h1 className="text-xl font-cinzel text-amber-300 tracking-wide">
            Your Adventuring Spirit
          </h1>
        </motion.div>

        {/* Player archetype card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full rounded-xl border border-amber-500/30 bg-amber-900/15 p-5"
        >
          <h2 className="text-lg font-cinzel text-amber-200 mb-2">
            {persona.playerArchetype}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            {persona.archetypeDescription}
          </p>
        </motion.div>

        {/* Meets divider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="flex items-center gap-3 text-white/30"
        >
          <div className="w-8 h-px bg-amber-500/30" />
          <span className="text-xs font-cinzel uppercase tracking-widest text-amber-500/50">
            meets
          </span>
          <div className="w-8 h-px bg-amber-500/30" />
        </motion.div>

        {/* DM persona card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="w-full rounded-xl border border-purple-500/30 bg-purple-900/15 p-5"
        >
          <h2 className="text-lg font-cinzel text-purple-200 mb-2">
            {persona.dmPersonaName}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            {persona.dmPersonaDescription}
          </p>
        </motion.div>

        {/* Pairing reasons */}
        {reasons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="w-full"
          >
            <h3 className="text-xs font-cinzel uppercase tracking-widest text-white/30 mb-3">
              Why You're Paired
            </h3>
            <ul className="space-y-2">
              {reasons.map((reason, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.3 + i * 0.15, duration: 0.3 }}
                  className="flex items-start gap-2 text-sm text-white/60"
                >
                  <span className="text-amber-400 mt-0.5">•</span>
                  {reason}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.4 }}
          onClick={onBegin}
          className={cn(
            'w-full py-4 rounded-xl font-cinzel text-base tracking-wide',
            'bg-gradient-to-r from-amber-600 to-amber-500 text-black',
            'hover:from-amber-500 hover:to-amber-400 active:scale-[0.98]',
            'transition-all duration-200 flex items-center justify-center gap-2',
          )}
        >
          Begin Adventure
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
