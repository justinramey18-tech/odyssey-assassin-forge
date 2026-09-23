import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ScrollText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterContext } from '@/components/oracle/types';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';
import { Button } from '@/components/ui/button';
import bagStatsBg from '@/assets/bag-stats/bag-stats-bg.jpg';
import bagTitlePlaque from '@/assets/bag-stats/bag-title-plaque.png';
import bagPanelFrame from '@/assets/bag-stats/bag-panel-frame.png';
import bagGaugeFrame from '@/assets/bag-stats/bag-gauge-frame.png';
import bagIconHeart from '@/assets/bag-stats/bag-icon-heart.png';
import bagIconProgression from '@/assets/bag-stats/bag-icon-progression.png';
import bagIconGold from '@/assets/bag-stats/bag-icon-gold.png';
import bagIconBag from '@/assets/bag-stats/bag-icon-bag.png';
import bagIconPotion from '@/assets/bag-stats/bag-icon-potion.png';

interface BagStatsScreenProps {
  open: boolean;
  onClose: () => void;
  ctx: CharacterContext;
  currentXP: number;
  gold: number;
  /** Use a consumable by name (wired to the same flow as the character sheet). */
  onUseConsumable?: (name: string) => void;
  /** Leave this screen and open the full character sheet. */
  onOpenFullSheet?: () => void;
}

/** Every number shown here comes from storage or a model — never trust it blindly. */
const fmt = (n: unknown): string => {
  const value = typeof n === 'string' ? Number(n) : n;
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '?';
};

function Section({ title, iconSrc, children }: { title: string; iconSrc: string; children: React.ReactNode }) {
  return (
    <div
      className="relative"
      style={{
        borderStyle: 'solid',
        borderWidth: '14px',
        borderImageSource: `url(${bagPanelFrame})`,
        borderImageSlice: '90 fill',
        borderImageWidth: '36px',
        borderImageRepeat: 'stretch',
      }}
    >
      <div className="flex items-center justify-center gap-2 px-2 pt-1.5 pb-2">
        <img src={iconSrc} alt="" className="w-7 h-7 shrink-0" />
        <span className="text-[13px] font-cinzel uppercase tracking-[0.08em] text-amber-50 truncate">{title}</span>
      </div>
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="px-3 pt-2.5 pb-3">{children}</div>
    </div>
  );
}

function Gauge({ pct, fillClassName }: { pct: number; fillClassName: string }) {
  return (
    <div className="relative w-full aspect-[6.19/1]">
      <img src={bagGaugeFrame} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none select-none" />
      <div className="absolute overflow-hidden rounded-full" style={{ top: '31%', bottom: '33%', left: '9%', right: '8.5%' }}>
        <div className={cn('h-full rounded-full transition-all', fillClassName)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

/**
 * Fullscreen Bag & Stats screen opened from the Live DM Table's action menu.
 * Shows the essentials at a glance: HP bar, XP bar, gold, bag, and consumables.
 */
export function BagStatsScreen({
  open, onClose, ctx, currentXP, gold, onUseConsumable, onOpenFullSheet,
}: BagStatsScreenProps) {
  const { multiplier } = useXPProgression();
  const isMilestone = multiplier === 0;
  const xpSnapshot = useXPSnapshot(ctx.level, currentXP);

  const xpInfo = useMemo(() => {
    if (isMilestone) return null;
    return {
      floor: xpSnapshot.levelFloor,
      belowFloor: xpSnapshot.belowFloor,
      inLevel: xpSnapshot.xpIntoLevel,
      needed: xpSnapshot.xpLevelSpan,
      progress: xpSnapshot.progressPct,
      toNext: xpSnapshot.xpRemaining,
    };
  }, [xpSnapshot, isMilestone]);

  const loot = ctx.loot?.items ?? [];
  const consumables = ctx.consumables ?? [];

  const maxHP = typeof ctx.maxHP === 'number' && Number.isFinite(ctx.maxHP) ? ctx.maxHP : 0;
  const currentHP = typeof ctx.currentHP === 'number' && Number.isFinite(ctx.currentHP) ? ctx.currentHP : 0;
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 0;
  const tempHP = ctx.defenses?.tempHP ?? 0;
  const armorClass = ctx.defenses?.armorClass;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-[#0b0b0e] flex flex-col" role="dialog" aria-label="Bag and Stats">
      <img src={bagStatsBg} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/35 via-black/55 to-black/35" />
      {/* Header */}
      <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-3 py-1.5">
        <h2 className="sr-only">Bag &amp; Stats</h2>
        {onOpenFullSheet ? (
          <button
            onClick={onOpenFullSheet}
            className="flex items-center gap-1 px-2.5 rounded-lg border border-amber-900/30 bg-black/30 hover:bg-black/50 min-h-[48px] text-[11px] text-amber-200"
            style={{ touchAction: 'manipulation' }}
          >
            Full sheet <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : <span />}
        <button
          onClick={onClose}
          aria-label="Close Bag and Stats"
          className="p-2 rounded-lg hover:bg-white/10 min-w-[48px] min-h-[48px] flex items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-3 pt-0 pb-24 space-y-3">
        <img src={bagTitlePlaque} alt="Bag & Stats" draggable={false} className="block w-[78%] max-w-[340px] mx-auto" />
        {ctx.name && <p className="text-center text-[11px] font-cinzel uppercase tracking-[0.2em] text-amber-200/60 -mt-1 mb-1">{ctx.name}</p>}
        {/* HP */}
        <Section title="Hit Points" iconSrc={bagIconHeart}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-display font-bold text-foreground">{fmt(currentHP)}</span>
            <span className="text-xs text-white/50">/ {fmt(maxHP)} max</span>
          </div>
          <Gauge
            pct={hpPct}
            fillClassName={hpPct > 50 ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' : hpPct > 25 ? 'bg-gradient-to-b from-amber-400 to-amber-600' : 'bg-gradient-to-b from-red-400 to-red-600'}
          />
          {currentHP <= 0 && (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1.5">
              Downed — unconscious and making death saves.
            </p>
          )}
          {tempHP > 0 && (
            <p className="text-[11px] text-cyan-300 mt-1">+{fmt(tempHP)} temp HP shielding you.</p>
          )}
        </Section>

        {/* XP */}
        <Section title="Progression" iconSrc={bagIconProgression}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Level</p>
              <p className="text-xl font-display font-bold text-foreground">{fmt(ctx.level)}</p>
            </div>
            {typeof armorClass === 'number' && Number.isFinite(armorClass) && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Armor Class</p>
                <p className="text-xl font-display font-bold text-foreground">{armorClass}</p>
              </div>
            )}
          </div>
          {isMilestone ? (
            <p className="text-xs text-white/50">Milestone progression — the story decides when you advance.</p>
          ) : xpInfo && (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/50">Experience</span>
                <span className="font-display">
                  <span className="text-amber-300">{fmt(xpInfo.inLevel)}</span>
                  <span className="text-white/40"> / {fmt(xpInfo.needed)}</span>
                </span>
              </div>
              <Gauge pct={xpInfo.progress} fillClassName="bg-gradient-to-b from-amber-300 to-amber-600" />
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>Total {fmt(currentXP)} XP</span>
                <span>{fmt(xpInfo.toNext)} XP to next</span>
              </div>
              {xpInfo.belowFloor && (
                <p className="mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                  Level set manually — your total XP is below level {fmt(ctx.level)}'s threshold of {fmt(xpInfo.floor)} XP, so this bar stays empty until you catch up.
                </p>
              )}
            </>
          )}
        </Section>

        {/* Gold */}
        <Section title="Gold" iconSrc={bagIconGold}>
          <div className="flex items-center gap-3">
            <img src={bagIconGold} alt="" className="w-12 h-12 shrink-0" />
            <p className="text-2xl font-display font-bold text-amber-300">{fmt(gold)}</p>
          </div>
        </Section>

        {/* Bag */}
        <Section title={`Bag (${loot.length})`} iconSrc={bagIconBag}>
          {loot.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-2">No treasure carried yet.</p>
          ) : (
            <div className="space-y-1.5">
              {loot.map(i => (
                <div key={i.name} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-foreground">{i.name}</span>
                    <span className="text-[10px] text-white/40 capitalize shrink-0">{i.rarity} · {fmt(i.goldValue)}g</span>
                  </div>
                  {i.description && (
                    <p className="text-[10px] text-white/50 mt-1 leading-relaxed">{i.description}</p>
                  )}
                  {i.effect && (
                    <p className="text-[10px] text-amber-300/70 mt-1 flex items-center gap-1">
                      <ScrollText className="w-3 h-3 shrink-0" />
                      {i.effect}{i.dice ? ` (${i.dice})` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Consumables */}
        <Section title="Consumables" iconSrc={bagIconPotion}>
          {consumables.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-2">No consumables carried.</p>
          ) : (
            <div className="space-y-1.5">
              {consumables.map(c => (
                <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-white/40 capitalize">{c.type} · ×{fmt(c.quantity ?? 1)}</p>
                  </div>
                  {onUseConsumable && (
                    <Button size="sm" variant="outline" className="min-h-[48px] min-w-[48px]" onClick={() => onUseConsumable(c.name)} style={{ touchAction: 'manipulation' }}>
                      Use
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>,
    document.body,
  );
}
