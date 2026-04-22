import { useState, useCallback } from 'react';
import { X, User, MessageCircle, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type CharacterSheetTab = 'character' | 'talk' | 'settings';

interface CharacterSheetProps {
  open: boolean;
  onClose: () => void;
  initialTab?: CharacterSheetTab;
  characterName: string;
}

const TABS: Array<{ id: CharacterSheetTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string; accent: string }> = [
  { id: 'character', label: 'Character',      icon: User,          color: 'text-sky-300',    accent: 'border-sky-400/50 bg-sky-500/10' },
  { id: 'talk',      label: 'Talk to the DM', icon: MessageCircle, color: 'text-amber-300',  accent: 'border-amber-400/50 bg-amber-500/10' },
  { id: 'settings',  label: 'Settings',       icon: SettingsIcon,  color: 'text-slate-300',  accent: 'border-slate-400/50 bg-slate-500/10' },
];

export function CharacterSheet({ open, onClose, initialTab = 'character', characterName }: CharacterSheetProps) {
  const [activeTab, setActiveTab] = useState<CharacterSheetTab>(initialTab);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const activeTabConfig = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <activeTabConfig.icon className={cn('w-5 h-5', activeTabConfig.color)} />
          <span className="text-sm font-cinzel font-semibold text-foreground truncate">
            {characterName || 'Rider'}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Horizontal scrollable tab header */}
      <div className="shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                  isActive
                    ? `${tab.accent} ${tab.color}`
                    : 'border-transparent text-muted-foreground hover:bg-muted/30'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wider whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'character' && <CharacterTabPlaceholder />}
            {activeTab === 'talk' && <TalkTabPlaceholder />}
            {activeTab === 'settings' && <SettingsTabPlaceholder />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Placeholder tab contents ──────────────────────────────────────────────────
// These will be replaced in subsequent prompts.

function CharacterTabPlaceholder() {
  return (
    <div className="px-4 py-6 space-y-3">
      <h2 className="text-xl font-cinzel font-bold text-sky-300">Character</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Rider stats, gear, signet management, and dragon personality will live here.
      </p>
      <p className="text-xs text-muted-foreground/70 italic">— Placeholder. Content coming in next prompts.</p>
    </div>
  );
}

function TalkTabPlaceholder() {
  return (
    <div className="px-4 py-6 space-y-3">
      <h2 className="text-xl font-cinzel font-bold text-amber-300">Talk to the DM</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Conversational interface for directing your AI DM. Tell it what you want changed — tone, pacing, dragon personality, campaign focus — and it will update the DM's behavior going forward.
      </p>
      <p className="text-xs text-muted-foreground/70 italic">— Placeholder. Chat interface coming in later prompts.</p>
    </div>
  );
}

function SettingsTabPlaceholder() {
  return (
    <div className="px-4 py-6 space-y-3">
      <h2 className="text-xl font-cinzel font-bold text-slate-300">Settings</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Campaign saves, dice odds, AI model, chat theme, and other preferences will live here.
      </p>
      <p className="text-xs text-muted-foreground/70 italic">— Placeholder. Content coming in next prompts.</p>
    </div>
  );
}
