import { motion, AnimatePresence } from 'framer-motion';
import { X, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExtractionResult } from '@/hooks/use-dm-auto-sync';

interface AutoSyncBannerProps {
  extraction: ExtractionResult | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function AutoSyncBanner({ extraction, onUndo, onDismiss }: AutoSyncBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!extraction) {
      setVisible(false);
      return;
    }
    // Check if there's anything to show
    const hasChanges =
      extraction.hp_changes.length > 0 ||
      (extraction.xp_gained ?? 0) > 0 ||
      extraction.gold_changes.length > 0 ||
      extraction.conditions_added.length > 0 ||
      extraction.conditions_removed.length > 0 ||
      extraction.items_acquired.length > 0 ||
      extraction.rest_occurred !== null ||
      (extraction.map_entities?.length ?? 0) > 0 ||
      (extraction.map_entities_removed?.length ?? 0) > 0;

    if (hasChanges) {
      setVisible(true);
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [extraction, onDismiss]);

  if (!extraction || !visible) return null;

  const parts: string[] = [];

  // HP
  const totalDamage = extraction.hp_changes
    .filter(h => h.type === 'damage')
    .reduce((s, h) => s + h.amount, 0);
  const totalHealing = extraction.hp_changes
    .filter(h => h.type === 'healing')
    .reduce((s, h) => s + h.amount, 0);
  if (totalDamage > 0) parts.push(`💔 -${totalDamage} HP`);
  if (totalHealing > 0) parts.push(`💚 +${totalHealing} HP`);

  // XP
  if (extraction.xp_gained && extraction.xp_gained > 0) {
    parts.push(`⭐ +${extraction.xp_gained} XP`);
  }

  // Gold
  const goldGained = extraction.gold_changes
    .filter(g => g.action === 'gained')
    .reduce((s, g) => s + g.amount, 0);
  const goldSpent = extraction.gold_changes
    .filter(g => g.action === 'spent')
    .reduce((s, g) => s + g.amount, 0);
  if (goldGained > 0) parts.push(`💰 +${goldGained} GP`);
  if (goldSpent > 0) parts.push(`💰 -${goldSpent} GP`);

  // Conditions
  for (const c of extraction.conditions_added) {
    parts.push(`⚡ ${c}`);
  }
  for (const c of extraction.conditions_removed) {
    parts.push(`✅ -${c}`);
  }

  // Rest
  if (extraction.rest_occurred) {
    parts.push(extraction.rest_occurred === 'long' ? '🌙 Long Rest' : '☀️ Short Rest');
  }

  // Map entities
  for (const entity of extraction.map_entities ?? []) {
    parts.push(`👹 +${entity.count} ${entity.name}`);
  }
  for (const name of extraction.map_entities_removed ?? []) {
    parts.push(`💀 ${name}`);
  }

  if (parts.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-3 mb-1 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center gap-2 text-xs"
        >
          <span className="text-amber-300 font-mono shrink-0">⚡ Sync</span>
          <span className="flex-1 text-white/80 truncate">{parts.join('  •  ')}</span>
          <button
            onClick={onUndo}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setVisible(false); onDismiss(); }}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
