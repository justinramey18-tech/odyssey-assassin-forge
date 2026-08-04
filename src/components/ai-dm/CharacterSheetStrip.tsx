import { memo } from 'react';
import { Heart, Sparkles, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CharacterSheetStripProps {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  xpInLevel: number;
  xpNeeded: number;
  totalXP: number;
  nextLevelXP: number;
  isMilestone: boolean;
  pendingItemCount: number;
  portraitIcon?: React.ComponentType<{ className?: string }>;
  onOpen: () => void;
}

export const CharacterSheetStrip = memo(function CharacterSheetStrip({
  name, level, currentHP, maxHP, xpInLevel, xpNeeded, totalXP, nextLevelXP, isMilestone, pendingItemCount, portraitIcon: Portrait = User, onOpen,
}: CharacterSheetStripProps) {
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 0;
  const xpPct = isMilestone || xpNeeded <= 0 ? 0 : Math.max(0, Math.min(100, (xpInLevel / xpNeeded) * 100));

  return (
    <button
      onClick={onOpen}
      aria-label="Open character sheet"
      className="w-full flex items-center gap-3 px-3 py-2 border-b border-amber-900/25 bg-black/35 hover:bg-black/45 transition-colors text-left"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="shrink-0 w-9 h-9 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center">
        <Portrait className="w-4.5 h-4.5 text-amber-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-cinzel text-foreground truncate">{name || 'Adventurer'}</span>
          <span className="text-[10px] text-white/45 shrink-0">Lv {level}</span>
          {pendingItemCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-bold shrink-0">
              {pendingItemCount} new
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <Heart className="w-3 h-3 text-red-400 shrink-0" />
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-white/50 shrink-0 tabular-nums">{currentHP}/{maxHP}</span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500/80 transition-all" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-white/50 shrink-0 tabular-nums leading-tight text-right">
            {isMilestone ? 'Milestone' : (
              <>
                {xpInLevel.toLocaleString()}/{xpNeeded.toLocaleString()}
                <span className="block text-[9px] text-white/35">
                  {nextLevelXP > 0
                    ? `${totalXP.toLocaleString()}/${nextLevelXP.toLocaleString()} total`
                    : `${totalXP.toLocaleString()} total`}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/35 shrink-0" />
    </button>
  );
});
