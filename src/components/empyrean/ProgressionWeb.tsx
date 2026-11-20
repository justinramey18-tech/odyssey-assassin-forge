// Solo Empyrean progression web: the rider spends XP on nodes.
// One big canvas per half (Rider, Dragon) that the player drags around in any direction, like
// the map (the drag is handled here, because a browser's own scrolling locks to one axis).
// Spokes run out from the hub; a spoke with branches fans out from the end of its trunk.
// The server owns the ledger and decides every purchase (empyrean-rules, web.ts); this screen
// only draws what the server sent and asks it to buy. Party and D&D modes never open it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Crosshair, Lock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RulesWeb, RulesWebNode, RulesWebSpoke } from '@/lib/empyrean-rules-client';

type Half = 'rider' | 'dragon';
const HALVES: Array<{ id: Half; label: string }> = [{ id: 'rider', label: 'Rider' }, { id: 'dragon', label: 'Dragon' }];
const TIER_LABEL: Record<RulesWebNode['tier'], string> = { small: 'Minor', big: 'Major', capstone: 'Capstone' };
const TIER_SIZE: Record<RulesWebNode['tier'], number> = { small: 40, big: 48, capstone: 58 };
/** A finger that moves less than this is a tap on a node, not a drag. */
const TAP_SLOP_PX = 8;

// ── layout (pure: the same web always draws the same way) ──
export const WEB_CANVAS = 2000;
const HUB = WEB_CANVAS / 2;
const FIRST = 96;       // hub → first trunk node
const STEP = 66;        // between trunk nodes
const BRANCH_FIRST = 150; // trunk end → first branch node (further out from the hub)
const BRANCH_STEP = 70; // between branch nodes
const FAN = 14;         // degrees between neighbouring branches, seen from the hub

export interface PlacedNode { node: RulesWebNode; spoke: RulesWebSpoke; x: number; y: number; from: { x: number; y: number } }
export interface PlacedLabel { key: string; text: string; sub?: string; x: number; y: number; dim?: boolean; anchor?: 'start' | 'middle' | 'end' }
export interface WebLayout { nodes: PlacedNode[]; labels: PlacedLabel[]; stubs: Array<{ key: string; x: number; y: number }> }

const polar = (from: { x: number; y: number }, degrees: number, r: number) => {
  const a = degrees * (Math.PI / 180);
  return { x: Math.round(from.x + Math.cos(a) * r), y: Math.round(from.y + Math.sin(a) * r) };
};

/** Where everything on one half sits. Spokes are spread evenly round the hub, the first one straight up. */
export function layoutWeb(spokes: RulesWebSpoke[]): WebLayout {
  const out: WebLayout = { nodes: [], labels: [], stubs: [] };
  const hub = { x: HUB, y: HUB };
  spokes.forEach((spoke, i) => {
    const angle = -90 + (360 / Math.max(1, spokes.length)) * i;
    if (spoke.coming || spoke.nodes.length === 0) {
      const p = polar(hub, angle, FIRST + STEP);
      out.stubs.push({ key: spoke.id, ...p });
      out.labels.push({ key: spoke.id, text: spoke.name, sub: 'Coming', dim: true, ...polar(hub, angle, FIRST + STEP + 54) });
      return;
    }
    const branches = spoke.branches ?? [];
    const onBranch = (n: RulesWebNode) => (n.branch && branches.some(b => b.id === n.branch) ? n.branch : null);
    const trunk = spoke.nodes.filter(n => !onBranch(n));
    let prev = hub;
    trunk.forEach((node, k) => {
      const p = polar(hub, angle, FIRST + STEP * k);
      out.nodes.push({ node, spoke, ...p, from: prev });
      prev = p;
    });
    const tip = prev;
    out.labels.push({ key: spoke.id, text: spoke.name, sub: spoke.stat, ...polar(hub, angle + (branches.length ? 20 : 0), FIRST + STEP * (branches.length ? 1.5 : trunk.length) + (branches.length ? 0 : 6)) });
    // Branches run outward from the hub, side by side inside the spoke's own slice of the web, so two
    // neighbouring spokes that both have branches never cross.
    const tipR = FIRST + STEP * Math.max(0, trunk.length - 1);
    branches.forEach((b, j) => {
      const direction = angle + (j - (branches.length - 1) / 2) * FAN;
      let last = tip;
      const nodes = spoke.nodes.filter(n => onBranch(n) === b.id);
      nodes.forEach((node, k) => {
        const p = polar(hub, direction, tipR + BRANCH_FIRST + BRANCH_STEP * k);
        out.nodes.push({ node, spoke, ...p, from: last });
        last = p;
      });
      // A branch that runs sideways gets its label past its last node, reading away from it; one that runs up or down gets it centred beyond.
      const side = Math.cos(direction * (Math.PI / 180));
      const end = tipR + BRANCH_FIRST + BRANCH_STEP * Math.max(0, nodes.length - 1);
      out.labels.push({
        key: `${spoke.id}:${b.id}`, text: b.name, sub: b.aspect, dim: nodes.every(n => n.soon),
        anchor: side > 0.5 ? 'start' : side < -0.5 ? 'end' : 'middle',
        ...polar(hub, direction, end + (Math.abs(side) > 0.5 ? 42 : 56)),
      });
    });
  });
  return out;
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const spokes = useMemo(() => (web?.spokes ?? []).filter(s => s.half === half), [web, half]);
  const layout = useMemo(() => layoutWeb(spokes), [spokes]);
  const selected = layout.nodes.find(p => p.node.id === selectedId) ?? null;
  useEffect(() => { setConfirmId(null); }, [half, selectedId, open]);

  // Open on the hub, in the middle of the screen. A scroller that has no size yet (first paint) is
  // centred again as soon as it has one.
  const centre = (smooth = false) => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return false;
    el.scrollTo({ left: HUB - el.clientWidth / 2, top: HUB - el.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
    return true;
  };
  useLayoutEffect(() => {
    if (!open || !web) return;
    if (centre()) return;
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (centre()) ro.disconnect(); });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, half, !!web]);

  // Dragging: one finger (or the mouse) moves the canvas freely in both directions at once.
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    dragged.current = false;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const d = drag.current;
    if (!el || !d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!dragged.current) {
      if (Math.hypot(dx, dy) < TAP_SLOP_PX) return;
      dragged.current = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    }
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  /** A tap chooses a node; the end of a drag never does. */
  const choose = (id: string) => { if (!dragged.current) setSelectedId(id); };

  if (!open) return null;

  const buy = async (nodeId: string) => {
    if (buying || busy) return;
    setBuying(true);
    try { await onBuy(nodeId); } finally { setBuying(false); setConfirmId(null); }
  };
  const waiting = buying || busy;
  const n = selected?.node ?? null;
  const branchName = n && selected ? (selected.spoke.branches ?? []).find(b => b.id === n.branch)?.name ?? null : null;

  return (
    <div className="fixed inset-0 z-[72] flex flex-col bg-background" role="dialog" aria-label="Progression">
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-amber-500/20 bg-background/95">
        <Sparkles className="w-5 h-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-cinzel font-semibold text-foreground leading-tight">Progression</p>
          {web && (
            <p className="text-xs text-muted-foreground leading-tight">
              <span className="text-amber-300 font-semibold text-base" data-testid="web-balance">{web.xp.balance}</span> XP to spend
            </p>
          )}
        </div>
        {web && HALVES.map(h => (
          <button
            key={h.id}
            onClick={() => { setHalf(h.id); setSelectedId(null); }}
            aria-pressed={half === h.id}
            className={cn(
              'px-3 py-2.5 rounded-lg text-[11px] font-cinzel uppercase tracking-wider border transition-colors min-h-[44px]',
              half === h.id ? 'border-amber-400/60 bg-amber-500/10 text-amber-200' : 'border-border/40 text-muted-foreground',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            {h.label}
          </button>
        ))}
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
        <div className="relative flex-1 min-h-0">
          {/* The canvas: a drag in any direction moves it (touch-action none: the browser leaves the drag to us). */}
          <div
            ref={scrollerRef}
            data-testid="web-canvas"
            className="absolute inset-0 overflow-hidden cursor-grab select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div className="relative" style={{ width: WEB_CANVAS, height: WEB_CANVAS }}>
              <svg width={WEB_CANVAS} height={WEB_CANVAS} className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {[150, 330, 510, 650, 790, 940].map(r => <circle key={r} cx={HUB} cy={HUB} r={r} fill="none" stroke="#27272a" strokeWidth={1} strokeDasharray="2 7" />)}
                {layout.stubs.map(s => (
                  <g key={s.key} opacity={0.5}>
                    <line x1={HUB} y1={HUB} x2={s.x} y2={s.y} stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 6" />
                    <circle cx={s.x} cy={s.y} r={16} fill="#0d0d12" stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 5" />
                  </g>
                ))}
                {layout.nodes.map(p => (
                  <line
                    key={p.node.id} x1={p.from.x} y1={p.from.y} x2={p.x} y2={p.y}
                    stroke={p.node.owned ? '#fbbf24' : p.node.canBuy ? '#a16207' : '#3f3f46'}
                    strokeWidth={p.node.owned ? 3 : 2}
                    strokeDasharray={p.node.soon ? '4 6' : undefined}
                  />
                ))}
                <circle cx={HUB} cy={HUB} r={26} fill="#fbbf24" opacity={0.92} />
                <circle cx={HUB} cy={HUB} r={36} fill="none" stroke="#fbbf24" strokeWidth={1} opacity={0.4} />
                {layout.labels.map(l => (
                  <g key={l.key} opacity={l.dim ? 0.55 : 1}>
                    <text x={l.x} y={l.y} textAnchor={l.anchor ?? 'middle'} fontSize="13" fill="#fde68a" className="font-cinzel">{l.text}</text>
                    {l.sub && <text x={l.x} y={l.y + 14} textAnchor={l.anchor ?? 'middle'} fontSize="10" fill="#a1a1aa">{l.sub}</text>}
                  </g>
                ))}
              </svg>
              {layout.nodes.map(p => {
                const size = TIER_SIZE[p.node.tier];
                const state = p.node.owned ? 'owned' : p.node.canBuy ? 'can unlock' : p.node.soon ? 'coming' : 'locked';
                return (
                  <button
                    key={p.node.id}
                    onClick={() => choose(p.node.id)}
                    aria-label={`${p.node.name}, ${state}`}
                    aria-pressed={selectedId === p.node.id}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center transition-shadow',
                      p.node.owned && 'border-amber-400 bg-amber-400 text-background',
                      !p.node.owned && p.node.canBuy && 'border-amber-300 bg-background text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.55)]',
                      !p.node.owned && !p.node.canBuy && !p.node.soon && 'border-zinc-600 bg-background text-zinc-500',
                      p.node.soon && 'border-dashed border-zinc-700 bg-background text-zinc-600',
                      selectedId === p.node.id && 'ring-2 ring-offset-2 ring-offset-background ring-amber-200',
                    )}
                    style={{ left: p.x, top: p.y, width: size, height: size, minWidth: 44, minHeight: 44, touchAction: 'manipulation' }}
                  >
                    {p.node.owned ? <Check className="w-5 h-5" /> : p.node.canBuy ? <Sparkles className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => centre(true)}
            className="absolute right-3 top-3 w-11 h-11 rounded-full border border-border/50 bg-background/90 flex items-center justify-center text-amber-200"
            aria-label="Back to the centre"
            style={{ touchAction: 'manipulation' }}
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {/* The chosen node, or a hint. Sits over the bottom of the canvas. */}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-[520px] rounded-xl border border-amber-500/25 bg-background/95 px-4 py-3 shadow-lg">
              {!n ? (
                <p className="text-xs text-muted-foreground text-center">Drag to explore. Tap a node to see what it does.</p>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-cinzel font-semibold text-foreground">
                        {n.name} <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{TIER_LABEL[n.tier]}</span>
                      </p>
                      <p className="text-[11px] text-amber-200/80">{selected ? selected.spoke.name : ''}{branchName ? ` · ${branchName}` : ''}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-snug">{n.effect}</p>
                      {!n.owned && !n.canBuy && n.why && <p className="mt-1 text-[11px] text-muted-foreground/80">{n.why}</p>}
                    </div>
                    {n.owned ? (
                      <span className="shrink-0 text-xs text-amber-300 pt-1">Owned</span>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
