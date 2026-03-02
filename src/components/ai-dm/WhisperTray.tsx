import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown, Dices, Lightbulb, Eye } from 'lucide-react';
import type { Whisper } from '@/components/oracle/types';

interface WhisperTrayProps {
  whispers: Whisper[];
}

const ICON_MAP: Record<Whisper['type'], { icon: typeof Dices; label: string; color: string; border: string; bg: string }> = {
  action:  { icon: Dices,     label: 'Action',  color: 'text-amber-400',   border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  tactics: { icon: Lightbulb, label: 'Tactics', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  whisper: { icon: Eye,       label: 'Whisper', color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5' },
};

export function WhisperTray({ whispers }: WhisperTrayProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!whispers.length) return null;

  const actionCount = whispers.filter(w => w.type === 'action').length;
  const tacticsCount = whispers.filter(w => w.type === 'tactics').length;
  const whisperCount = whispers.filter(w => w.type === 'whisper').length;

  const badgeParts: string[] = [];
  if (actionCount > 0) badgeParts.push(`🎲 ${actionCount}`);
  if (tacticsCount > 0) badgeParts.push(`💡 ${tacticsCount}`);
  if (whisperCount > 0) badgeParts.push(`👁 ${whisperCount}`);

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all",
          "border border-amber-500/20 hover:border-amber-500/40",
          "bg-amber-500/5 hover:bg-amber-500/10",
          "text-amber-300/80 hover:text-amber-300",
          "active:scale-[0.98]"
        )}
      >
        <ChevronDown className={cn(
          "w-3.5 h-3.5 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
        <span className="select-none">{badgeParts.join('  ')}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {whispers.map((whisper, i) => {
                const config = ICON_MAP[whisper.type];
                const Icon = config.icon;

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2 rounded-lg border",
                      config.border,
                      config.bg,
                    )}
                  >
                    <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                    <div className="min-w-0 flex-1">
                      {whisper.target && (
                        <span className="text-[10px] font-mono text-purple-400/70 uppercase tracking-wider block mb-0.5">
                          → {whisper.target}
                        </span>
                      )}
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {whisper.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
