// The hand-off controls for the Live DM Table: which ticked lines go to the DM,
// in what order, and the button that sends them. Lives on the story screen rather
// than inside the chat drawer, so the drawer is just conversation.

import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Zap, Loader2 } from 'lucide-react';
import { playerColor } from './RoundChatDrawer';
import { parseActionCard } from '@/lib/roundChatActionCard';

interface HandoffMessage {
  id: string;
  user_id: string;
  content: string;
  character_name?: string | null;
  in_character: boolean;
}

interface DMHandoffBarProps {
  isHost: boolean;
  isGenerating: boolean;
  /** How many lines are ticked. */
  tickedCount: number;
  orderedSelected?: HandoffMessage[];
  onReorderSelected?: (ids: string[]) => void;
  onSendToDMNow: () => void;
  oocNames?: Record<string, string>;
}

export function DMHandoffBar({
  isHost,
  isGenerating,
  tickedCount,
  orderedSelected,
  onReorderSelected,
  onSendToDMNow,
  oocNames,
}: DMHandoffBarProps) {
  // Nothing ticked and not mid-generation means nothing to show. The bar must not
  // eat vertical space on the story screen when it has no job.
  if (!isHost) return null;
  if (tickedCount === 0 && !isGenerating) return null;

  const showOrder = !!onReorderSelected && (orderedSelected?.length || 0) > 1;

  return (
    <div className="px-2 pb-2 space-y-1.5">
      {showOrder && (
        <div className="rounded-md border border-emerald-900/30 bg-emerald-950/20 p-1.5">
          <div className="text-[9px] uppercase tracking-wider text-emerald-300/60 mb-1 font-cinzel">
            Send order
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-hide">
            {orderedSelected!.map((m, i) => {
              const ids = orderedSelected!.map(x => x.id);
              const move = (dir: -1 | 1) => {
                const next = [...ids];
                const j = i + dir;
                if (j < 0 || j >= next.length) return;
                [next[i], next[j]] = [next[j], next[i]];
                onReorderSelected!(next);
              };
              return (
                <div key={m.id} className="flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-[9px] text-white/35 text-center">{i + 1}</span>
                  <span className={cn(
                    "text-[10px] font-semibold shrink-0 truncate max-w-[72px] font-cinzel",
                    m.in_character ? playerColor(m.user_id) : 'text-amber-300/80',
                  )}>
                    {m.in_character
                      ? (m.character_name || 'Player')
                      : (oocNames?.[m.user_id] || m.character_name || 'Player')}
                  </span>
                  <span className="text-[10px] text-white/45 truncate min-w-0 flex-1">
                    {parseActionCard(m.content).body || m.content}
                  </span>
                  <button
                    onClick={() => move(-1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                    style={{ touchAction: 'manipulation' }}
                    className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 text-white/60 disabled:opacity-25 flex items-center justify-center"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => move(1)}
                    disabled={i === orderedSelected!.length - 1}
                    aria-label="Move later"
                    style={{ touchAction: 'manipulation' }}
                    className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 text-white/60 disabled:opacity-25 flex items-center justify-center"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onSendToDMNow}
        disabled={isGenerating || tickedCount === 0}
        style={{ touchAction: 'manipulation' }}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/30 bg-emerald-900/25 text-emerald-300 text-[12px] font-cinzel transition-colors active:bg-emerald-900/45 disabled:opacity-35"
      >
        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        {isGenerating ? 'DM is writing…' : `Send to DM · ${tickedCount}`}
      </button>
    </div>
  );
}
