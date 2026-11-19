// Solo Empyrean progression web: the rider spends XP on nodes, spoke by spoke.
// The server owns the ledger and decides every purchase (empyrean-rules, web.ts); this screen
// only shows what the server sent and asks it to buy. Party and D&D modes never open it.

import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RulesWeb, RulesWebNode, RulesWebSpoke } from '@/lib/empyrean-rules-client';

type Half = 'rider' | 'dragon';
const HALVES: Array<{ id: Half; label: string }> = [{ id: 'rider', label: 'Rider' }, { id: 'dragon', label: 'Dragon' }];
const TIER_LABEL: Record<RulesWebNode['tier'], string> = { small: 'Minor', big: 'Major', capstone: 'Capstone' };
const CX = 180, CY = 170, FIRST_R = 30, STEP_R = 17, LABEL_R = 130, DOTS = 6;
const point = (index: number, count: number, r: number) => {
  const a = (-90 + (360 / count) * index) * (Math.PI / 180);
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
};

interface ProgressionWebProps {
  open: boolean;
  onClose: () => void;
  /** The web as the server keeps it; null while the game server is off or older. */
  web: RulesWeb | null;
  busy?: boolean;
  /** Ask the server to buy a node. Resolves true when it was bought. */
  onBuy: (nodeId: string) => Promise<boolean>;
}

export function ProgressionWeb({ open, onClose, web, busy = false, onBuy }: ProgressionWebProps) {
  const [half, setHalf] = useState<Half>('rider');
  const [spokeId, setSpokeId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const spokes = useMemo(() => (web?.spokes ?? []).filter(s => s.half === half), [web, half]);
  // Open on the first spoke that can be bought from, so the screen never starts on a "coming" one.
  const selected: RulesWebSpoke | null = spokes.find(s => s.id === spokeId) ?? spokes.find(s => !s.coming) ?? spokes[0] ?? null;
  useEffect(() => { setConfirmId(null); }, [half, spokeId, open]);

  if (!open) return null;

  const buy = async (nodeId: string) => {
    if (buying || busy) return;
    setBuying(true);
    try { await onBuy(nodeId); } finally { setBuying(false); setConfirmId(null); }
  };
  const waiting = buying || busy;

  return (
    <div className="fixed inset-0 z-[72] flex flex-col bg-background" role="dialog" aria-label="Progression">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-background/95">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-foreground">Progression</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!web ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-sm text-muted-foreground">The progression web needs the game server. Sign in and open a saved campaign, then come back.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-10">
          <div className="pt-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">XP to spend</p>
            <p className="text-4xl font-cinzel font-bold text-amber-300 leading-tight" data-testid="web-balance">{web.xp.balance}</p>
            <p className="text-[11px] text-muted-foreground">{web.xp.earned} earned · {web.xp.spent} spent</p>
          </div>

          <div className="mt-3 flex justify-center gap-2">
            {HALVES.map(h => (
              <button
                key={h.id}
                onClick={() => { setHalf(h.id); setSpokeId(null); }}
                aria-pressed={half === h.id}
                className={cn(
                  'px-5 py-2.5 rounded-lg text-xs font-cinzel uppercase tracking-wider border transition-colors min-h-[44px]',
                  half === h.id ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-border/40 text-muted-foreground',
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {h.label}
              </button>
            ))}
          </div>

          <svg viewBox="-30 0 420 340" className="mx-auto mt-2 w-full max-w-[420px]" role="img" aria-label={`${half === 'rider' ? 'Rider' : 'Dragon'} web`}>
            {spokes.map((s, i) => {
              const end = point(i, spokes.length, FIRST_R + STEP_R * (DOTS - 1));
              const label = point(i, spokes.length, LABEL_R);
              const active = selected?.id === s.id;
              // Side labels start at the spoke's tip and run outward, so they never sit on a node.
              const anchor = label.x > CX + 40 ? 'start' : label.x < CX - 40 ? 'end' : 'middle';
              return (
                <g key={s.id} onClick={() => setSpokeId(s.id)} style={{ cursor: 'pointer', touchAction: 'manipulation' }} opacity={s.coming ? 0.45 : 1}>
                  <line x1={CX} y1={CY} x2={end.x} y2={end.y} stroke={active ? '#fbbf24' : '#52525b'} strokeWidth={active ? 2 : 1} strokeDasharray={s.coming ? '3 4' : undefined} />
                  {Array.from({ length: DOTS }, (_, n) => {
                    const p = point(i, spokes.length, FIRST_R + STEP_R * n);
                    const node = s.nodes[n];
                    const big = n === DOTS - 1 ? 7 : n >= 3 ? 5.5 : 4.5;
                    return (
                      <circle
                        key={n} cx={p.x} cy={p.y} r={big}
                        fill={node?.owned ? '#fbbf24' : '#0d0d12'}
                        stroke={node?.owned ? '#fbbf24' : node?.canBuy ? '#fde68a' : '#71717a'}
                        strokeWidth={node?.canBuy ? 2 : 1}
                      />
                    );
                  })}
                  <circle cx={label.x} cy={label.y} r={24} fill="transparent" />
                  <text x={label.x} y={label.y + (label.y < CY - 100 ? -4 : label.y > CY + 60 ? 14 : 4)} textAnchor={anchor} fontSize="11" fill={active ? '#fde68a' : '#a1a1aa'} className="font-cinzel">{s.name}</text>
                </g>
              );
            })}
            <circle cx={CX} cy={CY} r={9} fill="#fbbf24" opacity={0.9} />
          </svg>

          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {spokes.map(s => (
              <button
                key={s.id}
                onClick={() => setSpokeId(s.id)}
                aria-pressed={selected?.id === s.id}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-xs border transition-colors min-h-[44px]',
                  selected?.id === s.id ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-border/40 text-muted-foreground',
                  s.coming && 'opacity-60',
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {s.name}{s.coming ? '' : ` ${s.owned}/${s.nodes.length}`}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-4 rounded-xl border border-border/40 bg-muted/10">
              <div className="px-4 py-3 border-b border-border/30">
                <p className="text-base font-cinzel font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-amber-200/80">{selected.stat}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{selected.blurb}</p>
              </div>
              {selected.coming ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Coming in a later update.</p>
              ) : (
                <ul>
                  {selected.nodes.map(n => (
                    <li key={n.id} className="px-4 py-3 border-b border-border/20 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0">
                          {n.owned ? <Check className="w-4 h-4 text-amber-300" /> : n.canBuy ? <Sparkles className="w-4 h-4 text-amber-200" /> : <Lock className="w-4 h-4 text-muted-foreground/60" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-cinzel text-foreground">{n.name} <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{TIER_LABEL[n.tier]}</span></p>
                          <p className="text-xs text-muted-foreground leading-snug">{n.effect}</p>
                          {!n.owned && !n.canBuy && n.why && <p className="mt-1 text-[11px] text-muted-foreground/80">{n.why}</p>}
                        </div>
                        {n.owned ? (
                          <span className="shrink-0 text-xs text-amber-300">Owned</span>
                        ) : confirmId !== n.id && (
                          <button
                            onClick={() => setConfirmId(n.id)}
                            disabled={!n.canBuy || waiting}
                            className={cn(
                              'shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold border min-h-[44px]',
                              n.canBuy ? 'border-amber-400/60 bg-amber-500/15 text-amber-200' : 'border-border/30 text-muted-foreground/60',
                            )}
                            style={{ touchAction: 'manipulation' }}
                          >
                            {n.cost} XP
                          </button>
                        )}
                      </div>
                      {confirmId === n.id && !n.owned && (
                        <div className="mt-3 flex items-center gap-2">
                          <p className="flex-1 text-xs text-foreground">Spend {n.cost} XP on {n.name}?</p>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={waiting}
                            className="px-3 py-2.5 rounded-lg text-xs border border-border/40 text-muted-foreground min-h-[44px]"
                            style={{ touchAction: 'manipulation' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void buy(n.id)}
                            disabled={waiting}
                            className="px-4 py-2.5 rounded-lg text-xs font-semibold border border-amber-400/70 bg-amber-500/25 text-amber-100 min-h-[44px]"
                            style={{ touchAction: 'manipulation' }}
                          >
                            {waiting ? 'Unlocking…' : 'Unlock'}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
