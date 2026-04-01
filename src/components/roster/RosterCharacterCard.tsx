import { motion } from 'framer-motion';
import { Plus, Sparkles, Clock, Shield, Coins, Scroll } from 'lucide-react';
import { CloudSave, CloudSavePreview } from '@/hooks/use-cloud-save';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RosterCharacterCardProps {
  save: CloudSave;
  onSelect: (saveId: string) => void;
  index: number;
}

const classColorMap: Record<string, string> = {
  rogue: 'border-emerald-500/40 shadow-emerald-500/10',
  fighter: 'border-red-500/40 shadow-red-500/10',
  wizard: 'border-blue-500/40 shadow-blue-500/10',
  cleric: 'border-amber-500/40 shadow-amber-500/10',
  ranger: 'border-green-500/40 shadow-green-500/10',
  paladin: 'border-yellow-500/40 shadow-yellow-500/10',
  barbarian: 'border-orange-500/40 shadow-orange-500/10',
  bard: 'border-pink-500/40 shadow-pink-500/10',
  druid: 'border-lime-500/40 shadow-lime-500/10',
  monk: 'border-cyan-500/40 shadow-cyan-500/10',
  sorcerer: 'border-violet-500/40 shadow-violet-500/10',
  warlock: 'border-purple-500/40 shadow-purple-500/10',
};

function getClassAccent(characterName?: string): string {
  // Default accent if no class info available
  return 'border-primary/30 shadow-primary/10';
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function PreviewBadges({ preview }: { preview?: CloudSavePreview }) {
  if (!preview) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {preview.gold !== undefined && preview.gold > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400/80">
          <Coins className="w-2.5 h-2.5" />{preview.gold}
        </span>
      )}
      {preview.spellsKnown !== undefined && preview.spellsKnown > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400/80">
          <Sparkles className="w-2.5 h-2.5" />{preview.spellsKnown}
        </span>
      )}
      {preview.lootItems !== undefined && preview.lootItems > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400/80">
          <Scroll className="w-2.5 h-2.5" />{preview.lootItems}
        </span>
      )}
      {preview.hasInspiration && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary/80">
          ⭐
        </span>
      )}
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export function RosterCharacterCard({ save, onSelect, index }: RosterCharacterCardProps) {
  const accent = getClassAccent(save.character_name);
  const isFallen = save.status === 'fallen';

  const handleClick = () => {
    if (isFallen) {
      toast('This rider has fallen. Their story lives on in memory.', { icon: '💀' });
      return;
    }
    onSelect(save.id);
  };

  return (
    <motion.button
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileTap={{ scale: isFallen ? 1 : 0.97 }}
      onClick={handleClick}
      className={cn(
        'w-full text-left rounded-xl border p-4',
        'bg-card/80 backdrop-blur-sm',
        'hover:bg-card/95 active:bg-card',
        'transition-colors duration-150',
        'shadow-lg',
        accent,
        isFallen && 'grayscale opacity-60',
      )}
    >
      {/* Top row: name + level */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-foreground font-cinzel truncate">
            {isFallen && '💀 '}{save.character_name || save.save_name || 'Unnamed Hero'}
          </h3>
          {isFallen && (
            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-400/80 mt-0.5">
              Fallen
            </span>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Level {save.character_level ?? 1}
            </span>
            <span className="text-xs text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(save.updated_at)}
            </span>
          </div>
        </div>

        {/* Level badge */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-sm font-bold text-primary font-cinzel">{save.character_level ?? 1}</span>
        </div>
      </div>

      {/* Preview badges */}
      <PreviewBadges preview={save.preview} />
    </motion.button>
  );
}

/* ── Create New Character Card ── */

interface CreateNewCardProps {
  onCreateNew: () => void;
  index: number;
}

export function CreateNewCharacterCard({ onCreateNew, index }: CreateNewCardProps) {
  return (
    <motion.button
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileTap={{ scale: 0.97 }}
      onClick={onCreateNew}
      className={cn(
        'w-full text-left rounded-xl border border-dashed p-4',
        'border-primary/30 bg-primary/5',
        'hover:bg-primary/10 active:bg-primary/15',
        'transition-colors duration-150',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-primary font-cinzel">Create New Character</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Start a fresh adventure</p>
        </div>
      </div>
    </motion.button>
  );
}
