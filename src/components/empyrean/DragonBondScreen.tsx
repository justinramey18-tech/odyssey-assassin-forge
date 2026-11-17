// The Bond screen for solo Empyrean (DECISIONS D-30): the bond and trust meters, open wounds,
// the Signet Strain limit, what each tier unlocks, and the history of why the meters moved.
// Reads the phone copy for the meters and the server record (dragon-record.ts) for the history.
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Lock, Check, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getBondDescriptor, getMoodDescriptor, getTrustDescriptor } from '@/lib/dragonBondState';
import {
  BOND_TIERS,
  MAX_WOUNDS,
  STRAIN_HARD_CAP,
  TRUST_TIERS,
  UNLOCKS,
  bondStrainBonus,
  bondTier,
  metersOf,
  sourceLabel,
  strainCeiling,
  trustGainMultiplier,
  trustTier,
  unlockState,
  type Meters,
  type Tier,
} from '@/lib/dragon-meters';
import { dragonPortrait } from '@/lib/empyreanArt';
import { connectedDragon, loadDragonHistory, type DragonEvent, type SoloDragonState } from '@/lib/dragon-record';

const tap = { touchAction: 'manipulation' as const };

function Meter({ label, value, tier, tiers, descriptor, barClass }: {
  label: string;
  value: number;
  tier: Tier;
  tiers: Tier[];
  descriptor: string;
  barClass: string;
}) {
  return (
    <div className="rounded-lg border border-border/10 bg-foreground/[0.03] px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-cinzel text-foreground/90">{label}</p>
        <p className="text-sm text-foreground/80"><span className="font-bold">{value}</span><span className="text-foreground/40">/100</span></p>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        {tiers.slice(1).map(t => (
          <span key={t.min} className="absolute top-0 h-full w-px bg-background/50" style={{ left: `${t.min - 1}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-foreground/75"><span className="text-foreground/95 font-semibold">{tier.name}</span> · {descriptor.split('—')[1]?.trim() || descriptor}</p>
    </div>
  );
}

function deltaChips(e: DragonEvent) {
  const chips: Array<{ text: string; good: boolean }> = [];
  if (e.bond_delta) chips.push({ text: `${e.bond_delta > 0 ? '+' : ''}${e.bond_delta} bond`, good: e.bond_delta > 0 });
  if (e.trust_delta) chips.push({ text: `${e.trust_delta > 0 ? '+' : ''}${e.trust_delta} trust`, good: e.trust_delta > 0 });
  if (e.wounds_delta) chips.push({ text: e.wounds_delta > 0 ? 'wound opened' : 'wound healed', good: e.wounds_delta < 0 });
  return chips;
}

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function DragonBondScreen({ open, onClose, dragonName, dragonColor, bondState, questStrainCeiling, isUnbonded }: {
  dragonColor?: string;
  open: boolean;
  onClose: () => void;
  dragonName: string;
  bondState: SoloDragonState;
  /** The Quest Hub's Signet Strain ceiling (8, or 9/10 from Signet rank). */
  questStrainCeiling: number;
  isUnbonded: boolean;
}) {
  const [history, setHistory] = useState<DragonEvent[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || isUnbonded) return;
    let cancelled = false;
    setLoading(true);
    setHistoryError(false);
    loadDragonHistory(60)
      .then(rows => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistoryError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, isUnbonded, bondState.bond, bondState.trust, bondState.wounds]);

  if (!open) return null;

  const meters: Meters = metersOf(bondState);
  const mood = getMoodDescriptor(bondState.mood);
  const bTier = bondTier(meters.bond);
  const tTier = trustTier(meters.trust);
  const limit = strainCeiling(meters.bond, questStrainCeiling);
  const bonus = bondStrainBonus(meters.bond);
  const questBonus = Math.max(0, questStrainCeiling - 8);
  const gainPct = Math.round(trustGainMultiplier(meters.wounds) * 100);
  const online = !!connectedDragon();

  return (
    <div className="fixed inset-0 z-[66] bg-background flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-primary/20 bg-background/95">
        <Button variant="ghost" onClick={onClose} style={tap} aria-label="Close the Bond screen" className="p-2 rounded-lg hover:bg-muted/50 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-primary" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-cinzel font-bold text-primary truncate">🐉 Bond with {dragonName || 'your dragon'}</h2>
          {!isUnbonded && <p className={cn('text-[11px]', mood.color)}>{mood.emoji} {mood.label}</p>}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {!isUnbonded && (
          <div className="relative -mx-3 -mt-3 h-52 overflow-hidden">
            <img src={dragonPortrait(dragonColor)} alt={dragonName || 'Your dragon'} className="w-full h-full object-cover" width={1024} height={768} />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            <p className="absolute bottom-2 left-3 font-cinzel text-lg font-bold text-foreground drop-shadow">{dragonName || 'Your dragon'}</p>
          </div>
        )}
        {isUnbonded ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-4 text-sm text-foreground/75">
            You are unbonded. A new bond begins when a dragon chooses you at the Threshing.
          </div>
        ) : (
          <>
            <Meter label="Bond" value={meters.bond} tier={bTier} tiers={BOND_TIERS} descriptor={getBondDescriptor(meters.bond)} barClass="bg-primary" />
            <Meter label="Trust" value={meters.trust} tier={tTier} tiers={TRUST_TIERS} descriptor={getTrustDescriptor(meters.trust)} barClass="bg-accent" />

            <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-cinzel text-foreground/90">Wounds</p>
                <div className="flex gap-1.5" aria-label={`${meters.wounds} of ${MAX_WOUNDS} wounds open`}>
                  {Array.from({ length: MAX_WOUNDS }, (_, i) => (
                    <span key={i} className={cn('w-3.5 h-3.5 rounded-full border', i < meters.wounds ? 'bg-destructive border-destructive' : 'border-border/20')} />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-foreground/70 leading-relaxed">
                {meters.wounds === 0
                  ? 'No open wounds. A big break of trust (5 or more at once) opens one.'
                  : `${meters.wounds} open: trust grows at ${gainPct}% until they heal.`}
                {' '}Heal one by making amends in the story, or by finishing a Dragon &amp; Bond quest.
              </p>
            </div>

            <div className="rounded-lg border border-accent/20 bg-accent/[0.04] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-cinzel text-foreground/90">Signet Strain limit</p>
                <p className="text-sm font-bold text-accent">{limit}<span className="text-foreground/40 font-normal">/{STRAIN_HARD_CAP}</span></p>
              </div>
              <p className="mt-1 text-xs text-foreground/65">
                8 base{questBonus > 0 ? ` · +${questBonus} Signet rank` : ''}{bonus > 0 ? ` · +${bonus} bond` : ' · the bond adds +1 at Strong (41)'}
              </p>
              <p className="mt-1 text-[11px] text-foreground/45">Pushing strain all the way to the limit costs 2 bond.</p>
            </div>

            {(['bond', 'trust'] as const).map(meter => (
              <div key={meter} className="rounded-lg border border-border/10 bg-foreground/[0.02] px-3 py-3">
                <p className="text-sm font-cinzel text-foreground/90 mb-2">{meter === 'bond' ? 'What the bond unlocks' : 'What trust unlocks'}</p>
                <div className="space-y-1.5">
                  {UNLOCKS.filter(u => u.meter === meter).map(u => {
                    const st = unlockState(u, meters);
                    const tiers = meter === 'bond' ? BOND_TIERS : TRUST_TIERS;
                    return (
                      <div key={u.title} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5', st === 'open' ? 'bg-primary/[0.07]' : st === 'coming' ? 'bg-accent/[0.05]' : 'opacity-55')}>
                        <span className="mt-0.5 shrink-0">
                          {st === 'open' ? <Check className="w-4 h-4 text-primary" /> : st === 'coming' ? <Hourglass className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-foreground/40" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] text-foreground/90 leading-snug">{u.title} <span className="text-[10px] text-foreground/40">· {tiers[u.tier].name} ({tiers[u.tier].min}+)</span></p>
                          <p className="text-[11px] text-foreground/55 leading-snug">{u.detail}{st === 'coming' ? ' Coming in a later update.' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-border/10 bg-foreground/[0.02] px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-cinzel text-foreground/90">Our story so far</p>
                {loading && <Loader2 className="w-4 h-4 text-foreground/40 animate-spin" />}
              </div>
              {!online || historyError ? (
                <p className="text-xs text-foreground/50">The history shows once your bond is saved online. Your meters are safe on this phone meanwhile.</p>
              ) : history && history.length === 0 ? (
                <p className="text-xs text-foreground/50">Nothing yet. Every change to bond or trust will be written here.</p>
              ) : (
                <div className="space-y-2">
                  {(history ?? []).map(e => (
                    <div key={e.id} className="border-l-2 border-primary/30 pl-2.5">
                      <p className="text-[11px] text-foreground/40">{when(e.created_at)} · {sourceLabel(e.source)}</p>
                      {e.reason && <p className="text-[13px] text-foreground/85 leading-snug break-words">{e.reason}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {deltaChips(e).map(c => (
                          <span key={c.text} className={cn('px-1.5 py-0.5 rounded text-[10px]', c.good ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>{c.text}</span>
                        ))}
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-foreground/5 text-foreground/45">bond {e.bond_after} · trust {e.trust_after}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
