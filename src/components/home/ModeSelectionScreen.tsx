import { motion } from 'framer-motion';
import { Sparkles, Sword, BookOpen, Users, Crown, type LucideIcon } from 'lucide-react';
import { AppMode, APP_MODES_ORDERED, APP_MODE_CONFIGS } from '@/lib/app-modes';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: AppMode) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Sword, BookOpen, Users, Crown,
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  amber:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  red:     { border: 'border-red-500/40',     bg: 'bg-red-500/10',     text: 'text-red-400',     glow: 'shadow-red-500/20' },
  violet:  { border: 'border-violet-500/40',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  glow: 'shadow-violet-500/20' },
  blue:    { border: 'border-blue-500/40',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.08, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export function ModeSelectionScreen({ onSelectMode }: ModeSelectionScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="flex flex-col items-center justify-start min-h-screen px-5 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Mode</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Pick how you want to use the app. You can change this anytime in Settings.
          </p>
        </motion.div>

        {/* Mode Cards */}
        <div className="w-full max-w-sm space-y-3">
          {APP_MODES_ORDERED.map((mode, i) => {
            const config = APP_MODE_CONFIGS[mode];
            const Icon = ICON_MAP[config.icon] ?? Sparkles;
            const colors = COLOR_MAP[config.color] ?? COLOR_MAP.amber;
            const tabCount = config.visibleTabs.length;

            return (
              <motion.button
                key={mode}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectMode(mode)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border ${colors.border} ${colors.bg} backdrop-blur-sm text-left transition-shadow hover:shadow-lg ${colors.glow}`}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={`shrink-0 mt-0.5 p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{config.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {tabCount} {tabCount === 1 ? 'tab' : 'tabs'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {config.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-8 text-[11px] text-muted-foreground/60 text-center max-w-xs"
        >
          Your data is never deleted when switching modes — only visibility changes.
        </motion.p>
      </div>
    </div>
  );
}
