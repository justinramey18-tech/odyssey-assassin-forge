import { Crosshair, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FocusTarget } from '@/hooks/use-party-sync';

interface PartyFocusTargetBannerProps {
  target: FocusTarget;
  onClear?: () => void;
  canClear: boolean;
}

export function PartyFocusTargetBanner({ target, onClear, canClear }: PartyFocusTargetBannerProps) {
  const hpColor = target.hpPercent > 50
    ? 'text-emerald-400'
    : target.hpPercent > 25
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="relative p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 backdrop-blur-sm space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="font-cinzel font-semibold text-sm text-red-300">Focus Target</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">by {target.markedBy}</span>
          {canClear && onClear && (
            <button
              onClick={onClear}
              className="p-0.5 rounded hover:bg-background/50 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">{target.name}</span>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-sky-400" />
          <span className="text-xs font-mono">{target.ac}</span>
        </div>
        <span className={cn("text-xs font-mono", hpColor)}>
          {Math.round(target.hpPercent)}% HP
        </span>
      </div>

      {/* Damage modifiers */}
      <div className="flex flex-wrap gap-1.5">
        {target.resistances?.map(r => (
          <span key={`res-${r}`} className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            🛡️ {r} ½
          </span>
        ))}
        {target.vulnerabilities?.map(v => (
          <span key={`vul-${v}`} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
            ⚡ {v} ×2
          </span>
        ))}
        {target.immunities?.map(i => (
          <span key={`imm-${i}`} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">
            🚫 {i}
          </span>
        ))}
      </div>
    </div>
  );
}
