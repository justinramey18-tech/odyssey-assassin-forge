// Solo Empyrean progression web: the rider spends XP on the rider's half and Kinship on the dragon's half.

// One very large canvas per half (Rider, Dragon) that the player drags around in any direction and

// pinches to zoom, like the map (both are handled here, because a browser's own scrolling locks to

// one axis). Zooming in spreads the nodes apart without making them bigger; zooming out shrinks the

// whole web for an overview.

// Spokes run out from the hub; a spoke with branches fans out from the end of its trunk.

// The server owns the ledger and decides every purchase (empyrean-rules, web.ts); this screen

// only draws what the server sent and asks it to buy. Party and D&D modes never open it.



// The look: the web is carved into a stone wall (a painted backdrop under the canvas) and every node

// wears a painted medallion (src/lib/empyrean-web-art.ts). Each half has its own light, cold silver

// for the rider and ember for the dragon. Sparks run outward along the paths the rider owns, a node

// that can be afforded beckons, and a node that has just been unlocked ignites and sounds.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Check, Crosshair, Lock, Minus, Plus, Sparkles, Volume2, VolumeX, X } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { RulesWeb, RulesWebNode, RulesWebSpoke } from '@/lib/empyrean-rules-client';

import { WEB_BACKDROP_ART, WEB_TOKEN_ART, webArtStyle, webNodeArt } from '@/lib/empyrean-web-art';

import { playWebUnlock, setWebSound, webSoundOn } from '@/lib/empyrean-web-sounds';

type Half = 'rider' | 'dragon';

const HALVES: Array<{ id: Half; label: string }> = [{ id: 'rider', label: 'Rider' }, { id: 'dragon', label: 'Dragon' }];

const TIER_LABEL: Record<RulesWebNode['tier'], string> = { small: 'Minor', big: 'Major', capstone: 'Capstone' };

const TIER_SIZE: Record<RulesWebNode['tier'], number> = { small: 52, big: 62, capstone: 74 };

/** A finger that moves less than this is a tap on a node, not a drag. */

const TAP_SLOP_PX = 8;

/** Each half's own light: cold silver on the rider's, ember on the dragon's. */

const GLOW: Record<Half, { line: string; rgb: string }> = {

  rider: { line: '#a9c8ff', rgb: '150, 190, 255' },

  dragon: { line: '#ffa94d', rgb: '255, 150, 50' },

};

/** The hub's medallion, in pixels across. */

const HUB_SIZE = 104;

/** How long the burst on a freshly unlocked node lasts, and how many owned paths carry a running spark at once. */

const IGNITE_MS = 1100;

const SPARKS_MAX = 48;

/** The moving parts, as plain CSS kept with the screen (no theme file changes). They move with transform and

 *  opacity only, which a phone can do without repainting the canvas. A rider who asked for less motion gets none. */

const WEB_CSS = `

@keyframes web-spark { 0% { transform: translate(0, 0); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)); opacity: 0; } }

@keyframes web-beckon { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

@keyframes web-ignite { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.95; } 100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; } }

.web-spark { animation: web-spark 1.6s linear infinite; will-change: transform, opacity; }

.web-beckon { animation: web-beckon 1.8s ease-in-out infinite; }

.web-ignite { animation: web-ignite 1.1s ease-out forwards; }

@media (prefers-reduced-motion: reduce) { .web-spark, .web-ignite { display: none; } .web-beckon { animation: none; opacity: 1; } }

`;

// ── layout (pure: the same web always draws the same way) ──

export const WEB_CANVAS = 3000;

const HUB = WEB_CANVAS / 2;

const FIRST = 140;      // hub → first trunk node

const STEP = 100;       // between trunk nodes

const BRANCH_FIRST = 220; // trunk end → first branch node (further out from the hub)

const BRANCH_STEP = 104; // between branch nodes

/** How far the web can be pulled together or spread apart, and one press of a zoom button. */

export const ZOOM_MIN = 0.4;

export const ZOOM_MAX = 1.6;

const ZOOM_STEP = 1.25;

/** Node names are printed under the nodes from this zoom up; further out they would run into each other. */

export const NAMES_FROM_ZOOM = 0.8;

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));

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

      out.labels.push({ key: spoke.id, text: spoke.name, sub: 'Coming', dim: true, ...polar(hub, angle, FIRST + STEP + 60) });

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

    out.labels.push({ key: spoke.id, text: spoke.name, sub: spoke.stat, ...polar(hub, angle + (branches.length ? 22 : 0), FIRST + STEP * (branches.length ? 1.5 : trunk.length) + (branches.length ? 0 : 10)) });

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

        ...polar(hub, direction, end + (Math.abs(side) > 0.5 ? 56 : 78)),

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

  /** The half to show each time the screen opens (the hall's wall panel opens the half that was tapped). Absent: the half last looked at. */

  startHalf?: Half;

}

export function ProgressionWeb({ open, onClose, web, busy = false, onBuy, startHalf }: ProgressionWebProps) {

  const [half, setHalf] = useState<Half>(startHalf ?? 'rider');

  const glow = GLOW[half];

  const [sound, setSound] = useState(() => webSoundOn());

  const [burst, setBurst] = useState<{ id: string; key: number } | null>(null);

  useEffect(() => { if (open && startHalf) { setHalf(startHalf); setSelectedId(null); } }, [open, startHalf]);

  // A node that has just been unlocked ignites and sounds. Nodes already owned when the screen opens do not.

  const ownedBefore = useRef<Set<string> | null>(null);

  useEffect(() => {

    const now = new Set(web?.owned ?? []);

    const before = ownedBefore.current;

    ownedBefore.current = open && web ? now : null;

    if (!open || !before) return;

    const fresh = [...now].filter(id => !before.has(id));

    if (fresh.length !== 1) return;

    const found = (web?.spokes ?? []).flatMap(sp => sp.nodes.map(node => ({ node, half: sp.half }))).find(x => x.node.id === fresh[0]);

    if (!found) return;

    setBurst(b => ({ id: found.node.id, key: (b?.key ?? 0) + 1 }));

    playWebUnlock(found.node.tier, found.half);

  }, [web, open]);

  useEffect(() => {

    if (!burst) return;

    const timer = window.setTimeout(() => setBurst(null), IGNITE_MS);

    return () => window.clearTimeout(timer);

  }, [burst]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [buying, setBuying] = useState(false);

  const [zoom, setZoom] = useState(1);

  /** Below full size the nodes shrink with the web; above it they keep their size and only move apart. */

  const shrink = Math.min(1, zoom);

  const zoomRef = useRef(1);

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

    el.scrollTo({ left: HUB * zoomRef.current - el.clientWidth / 2, top: HUB * zoomRef.current - el.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });

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



  // Zooming keeps the spot under the fingers (or the middle of the screen, for the buttons) where it is.

  // `shown` is the zoom the canvas is drawn at right now: several pinch steps can arrive before the

  // next draw, and the scroll position still belongs to the drawn zoom until then.

  const shown = useRef(1);

  const focus = useRef<{ cx: number; cy: number; vx: number; vy: number } | null>(null);

  const zoomTo = (next: number, vx?: number, vy?: number) => {

    const el = scrollerRef.current;

    const z = clampZoom(next);

    if (z === zoomRef.current) return;

    if (el) {

      const x = vx ?? el.clientWidth / 2;

      const y = vy ?? el.clientHeight / 2;

      focus.current = { cx: (el.scrollLeft + x) / shown.current, cy: (el.scrollTop + y) / shown.current, vx: x, vy: y };

    }

    zoomRef.current = z;

    setZoom(z);

  };

  useLayoutEffect(() => {

    const el = scrollerRef.current;

    const f = focus.current;

    focus.current = null;

    shown.current = zoom;

    if (!el || !f) return;

    el.scrollLeft = f.cx * zoom - f.vx;

    el.scrollTop = f.cy * zoom - f.vy;

  }, [zoom]);



  // Dragging: one finger (or the mouse) moves the canvas freely in both directions at once.

  // Two fingers pinch to zoom.

  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);

  const dragged = useRef(false);

  const fingers = useRef(new Map<number, { x: number; y: number }>());

  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const spread = () => {

    const [a, b] = [...fingers.current.values()];

    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {

    const el = scrollerRef.current;

    if (!el) return;

    // A first finger starts a fresh touch, whatever an interrupted one left behind.

    if (e.isPrimary) { fingers.current.clear(); pinch.current = null; drag.current = null; }

    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (fingers.current.size === 2) {

      pinch.current = { distance: Math.max(1, spread().distance), zoom: zoomRef.current };

      drag.current = null;

      dragged.current = true;

      return;

    }

    if (fingers.current.size > 2 || drag.current) return;

    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };

    dragged.current = false;

  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {

    const el = scrollerRef.current;

    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (el && pinch.current && fingers.current.size >= 2) {

      const now = spread();

      const box = el.getBoundingClientRect();

      zoomTo(pinch.current.zoom * (now.distance / pinch.current.distance), now.x - box.left, now.y - box.top);

      return;

    }

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

    fingers.current.delete(e.pointerId);

    if (drag.current?.id === e.pointerId) drag.current = null;

    if (fingers.current.size < 2 && pinch.current) {

      pinch.current = null;

      // The finger still down carries on as a drag from where it is now.

      const el = scrollerRef.current;

      const [rest] = [...fingers.current.entries()];

      if (el && rest) drag.current = { id: rest[0], x: rest[1].x, y: rest[1].y, left: el.scrollLeft, top: el.scrollTop };

    }

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

  /** What the chosen node is paid with: Kinship on the dragon's half, XP on the rider's (and from an older server that does not say). */

  const unit = n?.currency === 'kin' ? 'Kinship' : 'XP';

  const branchName = n && selected ? (selected.spoke.branches ?? []).find(b => b.id === n.branch)?.name ?? null : null;

  const chosenArt = n && selected ? webNodeArt(n, selected.spoke.id) : null;

  // The owned paths that carry a running spark: the outermost first, so the light reaches the tips.

  const sparks = layout.nodes.filter(p => p.node.owned).slice(-SPARKS_MAX);

  const ignited = burst ? layout.nodes.find(p => p.node.id === burst.id) ?? null : null;

  return (

    <div className="fixed inset-0 z-[72] flex flex-col bg-background" role="dialog" aria-label="Progression">

      <style>{WEB_CSS}</style>

      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-amber-500/20 bg-background/95">

        <span aria-hidden="true" data-testid="web-token" className="w-8 h-8 shrink-0 rounded-full" style={webArtStyle(half === 'dragon' ? WEB_TOKEN_ART.kin : WEB_TOKEN_ART.xp, 32)} />

        <div className="min-w-0 flex-1">

          <p className="text-sm font-cinzel font-semibold text-foreground leading-tight">Progression</p>

          {web && (

            <p className="text-xs text-muted-foreground leading-tight">

              <span className="text-amber-300 font-semibold text-base" data-testid="web-balance">{half === 'dragon' ? web.kin?.balance ?? 0 : web.xp.balance}</span> {half === 'dragon' ? 'Kinship to spend' : 'XP to spend'}

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

            <div className="relative" style={{ width: WEB_CANVAS * zoom, height: WEB_CANVAS * zoom }} data-zoom={zoom}>

              {/* The carved stone the web is cut into, with the half's own light spreading from the hub. */}

              <img src={WEB_BACKDROP_ART} alt="" aria-hidden="true" draggable={false} data-testid="web-backdrop" className="absolute inset-0 w-full h-full select-none pointer-events-none" />

              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, rgba(${glow.rgb}, 0.16) 0%, rgba(${glow.rgb}, 0.06) 26%, rgba(0, 0, 0, 0) 58%), rgba(0, 0, 0, 0.55)` }} />

              <svg width={WEB_CANVAS * zoom} height={WEB_CANVAS * zoom} className="absolute inset-0 pointer-events-none" aria-hidden="true">

                {[240, 540, 760, 968, 1176, 1400].map(r => <circle key={r} cx={HUB * zoom} cy={HUB * zoom} r={r * zoom} fill="none" stroke="#27272a" strokeWidth={1} strokeDasharray="2 7" />)}

                {layout.stubs.map(s => (

                  <g key={s.key} opacity={0.5}>

                    <line x1={HUB * zoom} y1={HUB * zoom} x2={s.x * zoom} y2={s.y * zoom} stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 6" />

                    <circle cx={s.x * zoom} cy={s.y * zoom} r={18 * shrink} fill="#0d0d12" stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 5" />

                  </g>

                ))}

                {layout.nodes.map(p => (

                  <line

                    key={p.node.id} x1={p.from.x * zoom} y1={p.from.y * zoom} x2={p.x * zoom} y2={p.y * zoom}

                    stroke={p.node.owned ? glow.line : p.node.canBuy ? '#a16207' : '#3f3f46'}

                    strokeWidth={p.node.owned ? 3 : 2}

                    strokeDasharray={p.node.soon ? '4 6' : undefined}

                  />

                ))}

                <circle cx={HUB * zoom} cy={HUB * zoom} r={(HUB_SIZE / 2 + 9) * shrink} fill="none" stroke={glow.line} strokeWidth={1} opacity={0.45} />

                {layout.labels.map(l => (

                  <g key={l.key} opacity={l.dim ? 0.55 : 1}>

                    <text x={l.x * zoom} y={l.y * zoom} textAnchor={l.anchor ?? 'middle'} fontSize="15" fill="#fde68a" stroke="rgba(0, 0, 0, 0.85)" strokeWidth={3} style={{ paintOrder: 'stroke' }} className="font-cinzel">{l.text}</text>

                    {l.sub && <text x={l.x * zoom} y={l.y * zoom + 16} textAnchor={l.anchor ?? 'middle'} fontSize="11" fill="#d4d4d8" stroke="rgba(0, 0, 0, 0.85)" strokeWidth={3} style={{ paintOrder: 'stroke' }}>{l.sub}</text>}

                  </g>

                ))}

              </svg>

              {/* The hub: the half's own medallion. */}

              <span

                aria-hidden="true"

                data-testid="web-hub"

                className="absolute rounded-full pointer-events-none"

                style={{

                  left: HUB * zoom, top: HUB * zoom, width: HUB_SIZE, height: HUB_SIZE, transform: `translate(-50%, -50%) scale(${shrink})`,

                  boxShadow: `0 0 28px 6px rgba(${glow.rgb}, 0.45)`, ...webArtStyle(half === 'dragon' ? WEB_TOKEN_ART.dragonHub : WEB_TOKEN_ART.riderHub, HUB_SIZE),

                }}

              />

              {/* Light running outward along every path the rider owns. */}

              {sparks.map(p => (

                <span

                  key={`spark:${p.node.id}`}

                  aria-hidden="true"

                  data-testid="web-spark"

                  className="web-spark absolute rounded-full pointer-events-none"

                  style={{

                    left: p.from.x * zoom - 3, top: p.from.y * zoom - 3, width: 6, height: 6, background: '#ffffff',

                    boxShadow: `0 0 8px 3px rgba(${glow.rgb}, 0.9)`,

                    animationDelay: `${((Math.hypot(p.from.x - HUB, p.from.y - HUB) / 260) % 1.6).toFixed(2)}s`,

                    ['--dx' as string]: `${(p.x - p.from.x) * zoom}px`, ['--dy' as string]: `${(p.y - p.from.y) * zoom}px`,

                  }}

                />

              ))}

              {layout.nodes.map(p => {

                const size = TIER_SIZE[p.node.tier];

                const state = p.node.owned ? 'owned' : p.node.canBuy ? 'can unlock' : p.node.soon ? 'coming' : 'locked';

                const art = webNodeArt(p.node, p.spoke.id);

                const chosen = selectedId === p.node.id;

                const where = { left: p.x * zoom, top: p.y * zoom, width: size, height: size, minWidth: 44, minHeight: 44, transform: `translate(-50%, -50%) scale(${shrink})`, touchAction: 'manipulation' } as const;

                // No art painted for this node: the plain node, as before.

                if (!art) {

                  return (

                    <button

                      key={p.node.id}

                      onClick={() => choose(p.node.id)}

                      aria-label={`${p.node.name}, ${state}`}

                      aria-pressed={chosen}

                      className={cn(

                        'absolute rounded-full border-2 flex items-center justify-center transition-shadow',

                        p.node.owned && 'border-amber-400 bg-amber-400 text-background',

                        !p.node.owned && p.node.canBuy && 'border-amber-300 bg-background text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.55)]',

                        !p.node.owned && !p.node.canBuy && !p.node.soon && 'border-zinc-600 bg-background text-zinc-500',

                        p.node.soon && 'border-dashed border-zinc-700 bg-background text-zinc-600',

                        chosen && 'ring-2 ring-offset-2 ring-offset-background ring-amber-200',

                      )}

                      style={where}

                    >

                      {p.node.owned ? <Check className="w-6 h-6" /> : p.node.canBuy ? <Sparkles className="w-5 h-5" /> : <Lock className="w-4 h-4" />}

                    </button>

                  );

                }

                // A medallion. What it is worth to the rider right now is said three ways, never by colour alone:

                // the painting (full colour, or greyed while locked), the ring around it, and the small badge.

                return (

                  <button

                    key={p.node.id}

                    onClick={() => choose(p.node.id)}

                    aria-label={`${p.node.name}, ${state}`}

                    aria-pressed={chosen}

                    data-art={`${art[0]}:${art[1]}`}

                    className={cn('absolute rounded-full bg-black', chosen && 'ring-2 ring-offset-2 ring-offset-background ring-amber-200')}

                    style={{ ...where, boxShadow: p.node.owned ? `0 0 0 2px ${glow.line}, 0 0 14px 3px rgba(${glow.rgb}, 0.55)` : p.node.canBuy ? undefined : '0 0 0 1px #3f3f46' }}

                  >

                    <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ ...webArtStyle(art, size), filter: p.node.owned ? undefined : p.node.canBuy ? 'brightness(0.92)' : 'grayscale(1) brightness(0.42)' }} />

                    {!p.node.owned && p.node.canBuy && (

                      <span aria-hidden="true" className="web-beckon absolute -inset-[3px] rounded-full pointer-events-none" style={{ boxShadow: '0 0 0 2px rgba(253, 224, 71, 0.95), 0 0 18px 6px rgba(251, 191, 36, 0.65)' }} />

                    )}

                    <span

                      aria-hidden="true"

                      className={cn(

                        'absolute -right-1 -bottom-1 w-5 h-5 rounded-full border flex items-center justify-center',

                        p.node.owned ? 'bg-amber-400 border-amber-100 text-black' : p.node.canBuy ? 'bg-black border-amber-300 text-amber-200' : 'bg-black border-zinc-600 text-zinc-400',

                      )}

                    >

                      {p.node.owned ? <Check className="w-3 h-3" /> : p.node.canBuy ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}

                    </span>

                  </button>

                );

              })}

              {/* The burst on a node that has just been unlocked. */}

              {ignited && burst && (

                <span

                  key={burst.key}

                  aria-hidden="true"

                  data-testid="web-ignite"

                  className="web-ignite absolute rounded-full pointer-events-none"

                  style={{

                    left: ignited.x * zoom, top: ignited.y * zoom, width: 72, height: 72, border: `3px solid ${glow.line}`,

                    boxShadow: `0 0 30px 12px rgba(${glow.rgb}, 0.8), inset 0 0 18px rgba(255, 255, 255, 0.7)`,

                  }}

                />

              )}

              {/* Node names, once the web is spread wide enough for them not to run together. */}

              {zoom >= NAMES_FROM_ZOOM && layout.nodes.map(p => (

                <span

                  key={`name:${p.node.id}`}

                  data-testid="web-node-name"

                  className={cn(

                    'absolute -translate-x-1/2 pointer-events-none text-center text-[11px] leading-tight max-w-[96px] px-1 rounded bg-black/70',

                    p.node.owned ? 'text-amber-200' : p.node.canBuy ? 'text-foreground' : 'text-muted-foreground/70',

                  )}

                  style={{ left: p.x * zoom, top: p.y * zoom + TIER_SIZE[p.node.tier] / 2 + 6 }}

                >

                  {p.node.name}

                </span>

              ))}

            </div>

          </div>



          <div className="absolute right-3 top-3 flex flex-col gap-2">

            <button

              onClick={() => centre(true)}

              className="w-11 h-11 rounded-full border border-border/50 bg-background/90 flex items-center justify-center text-amber-200"

              aria-label="Back to the centre"

              style={{ touchAction: 'manipulation' }}

            >

              <Crosshair className="w-5 h-5" />

            </button>

            <button

              onClick={() => zoomTo(zoomRef.current * ZOOM_STEP)}

              disabled={zoom >= ZOOM_MAX}

              className="w-11 h-11 rounded-full border border-border/50 bg-background/90 flex items-center justify-center text-amber-200 disabled:opacity-40"

              aria-label="Spread the web apart"

              style={{ touchAction: 'manipulation' }}

            >

              <Plus className="w-5 h-5" />

            </button>

            <button

              onClick={() => zoomTo(zoomRef.current / ZOOM_STEP)}

              disabled={zoom <= ZOOM_MIN}

              className="w-11 h-11 rounded-full border border-border/50 bg-background/90 flex items-center justify-center text-amber-200 disabled:opacity-40"

              aria-label="Pull the web together"

              style={{ touchAction: 'manipulation' }}

            >

              <Minus className="w-5 h-5" />

            </button>

            <button

              onClick={() => { const next = !sound; setSound(next); setWebSound(next); }}

              aria-pressed={sound}

              className="w-11 h-11 rounded-full border border-border/50 bg-background/90 flex items-center justify-center text-amber-200"

              aria-label={sound ? 'Turn the unlock sounds off' : 'Turn the unlock sounds on'}

              style={{ touchAction: 'manipulation' }}

            >

              {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}

            </button>

          </div>

          {/* The chosen node, or a hint. Sits over the bottom of the canvas. */}

          <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">

            <div className="pointer-events-auto mx-auto max-w-[520px] rounded-xl border border-amber-500/25 bg-background/95 px-4 py-3 shadow-lg">

              {!n ? (

                <p className="text-xs text-muted-foreground text-center">

                  Drag to explore, pinch to zoom. Tap a node to see what it does.

                  {half === 'dragon' && <span className="block mt-1">Kinship comes from time with your dragon: a hunt, a flight, a night's rest, a real fight won side by side.</span>}

                </p>

              ) : (

                <>

                  <div className="flex items-start gap-3">

                    {chosenArt && <span aria-hidden="true" data-testid="web-chosen-art" className="w-14 h-14 shrink-0 rounded-full" style={webArtStyle(chosenArt, 56)} />}

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

                        {n.cost} {unit}

                      </button>

                    )}

                  </div>

                  {confirmId === n.id && !n.owned && (

                    <div className="mt-3 flex items-center gap-2">

                      <p className="flex-1 text-xs text-foreground">Spend {n.cost} {unit} on {n.name}?</p>

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

