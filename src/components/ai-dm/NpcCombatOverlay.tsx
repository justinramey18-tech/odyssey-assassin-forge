// Live NPC Combat: the fight on a phone. Start a fight, watch NPC HP and attack timers,
// act (Attack, Cast, Item, Stabilize), and the host's Pause / Resume / End / Add NPC / Revive.
// It never writes to a table: every change goes through the useNpcCombat actions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, MoreVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NpcPortrait } from './NpcPortrait';
import { CombatBurst, CounterClashRing } from './CounterClashRing';
import { TugAndSlip } from './TugAndSlip';
import { DuelWheel, type DuelVerdict } from './DuelWheel';
import * as M from '@/lib/combatMinigames';
import * as DU from '@/lib/combatDuel';
import { preloadCombatArt } from '@/lib/combatArt';
import { duelChargeOf, isAllyRow, isEnemyRow, resolveOf, type FighterRow, type FightEventRow, type NpcCombatApi } from '@/hooks/use-npc-combat';
import { NPC_SKILL_INFO, type NpcSkillType, type PartyNpc, type PartyNpcsApi } from '@/hooks/use-party-npcs';
import type { ActionCard } from '@/lib/roundChatActionCard';

type Member = { user_id: string; character_name: string; character_status?: Record<string, unknown>; updated_at?: string };
type Finish = 'knockout' | 'kill';

interface Props {
  combat: NpcCombatApi;
  roster: PartyNpcsApi;
  members: Member[];
  currentUserId: string | null;
  isHost: boolean;
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
  /** A spell card just cast from Quick Actions. targetId/finish are set when the player picked the target first. */
  pendingCast?: { card: ActionCard; key: string; targetId?: string; finish?: Finish } | null;
  onPendingCastDone?: () => void;
  /** Opens the spell list. Called with the target the player picked first (target-first casting). */
  onOpenSpells?: (pre?: { targetId: string; targetName: string; finish: Finish }) => void;
  /** The target picked before choosing a spell, while it is still waiting for a cast. */
  preTarget?: { targetId: string; targetName: string; at: number } | null;
  onClearPreTarget?: () => void;
  /** Target rails: the picked side and fighters (primary first). Owned by the Party DM screen. */
  selection?: CombatSelection | null;
  onSelect?: (next: CombatSelection | null) => void;
  /** One-tap tray entries for the current selection, built from Quick Actions. */
  tray?: CombatTray;
  /** targetIds: the battle screen picks the move first, then passes its targets with the tap. */
  onTrayTap?: (id: string, targetIds?: string[]) => void;
  /** Player portraits by user id (the in-character chat avatar). */
  allyPortraits?: Record<string, string | undefined>;
}

export type CombatSelection = { side: 'enemy' | 'ally'; ids: string[] };
export type TrayEntry = { id: string; name: string; sub?: string; side: 'enemy' | 'ally'; row: 'attack' | 'spell' | 'item'; level?: number | null; school?: string | null; area?: boolean };
export type CombatTray = TrayEntry[];

/** Live effect chips from server fields only (buffs, temporary HP, ward), with seconds left. */
function effectChips(f: FighterRow, now: number): string[] {
  const out: string[] = [];
  const secs = (until: unknown) => { const t = timeOf(until); return Number.isFinite(t) && t > now ? Math.ceil((t - now) / 1000) : 0; };
  const fmt = (s: number) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`);
  const list = Array.isArray(f.combat_effects) ? f.combat_effects as Array<Record<string, unknown>> : [];
  for (const e of list) {
    const left = secs(e?.until);
    const amt = Number(e?.amount);
    if (!left || !Number.isFinite(amt)) continue;
    if (e.kind === 'ac_bonus') out.push(`🛡+${amt} AC ${fmt(left)}`);
    else if (e.kind === 'attack_bonus') out.push(`⚔+${amt} hit ${fmt(left)}`);
  }
  const thp = Number(f.temp_hp); const thpLeft = secs(f.temp_hp_until);
  if (Number.isFinite(thp) && thp > 0 && thpLeft) out.push(`✦${thp} temp ${fmt(thpLeft)}`);
  const ward = Number(f.ward); const wardLeft = secs(f.ward_until);
  if (Number.isFinite(ward) && ward > 0 && wardLeft) out.push(`🛡${Math.round(ward)} ward ${fmt(wardLeft)}`);
  return out;
}

const SPEED_SECONDS: Record<string, number> = { trivial: 120, easy: 90, medium: 60, hard: 40, deadly: 20 };
const tap = { touchAction: 'manipulation' as const };
const btn = 'min-h-[44px] rounded-lg border text-[13px] px-3 flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.97] transition-transform';
const btnPlain = cn(btn, 'border-white/15 bg-white/[0.04] text-white/85 active:bg-white/10');
const btnAmber = cn(btn, 'border-amber-400/50 bg-amber-500/20 text-amber-100');
const btnRed = cn(btn, 'border-red-500/50 bg-red-500/20 text-red-100');
const chip = (on: boolean) => cn(btn, on ? 'border-amber-300/80 bg-amber-500/25 text-white' : 'border-white/10 bg-black/30 text-white/60');

// ---------- quick actions from the member's shared sheet ----------
interface QWeapon { name: string; damage?: string }
interface QSpell { name: string; level: number }
interface QItem { name: string; effect?: string }

function asList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
}
function quickActionsOf(member: Member | undefined) {
  const qa = (member?.character_status as Record<string, unknown> | undefined)?.quickActions as Record<string, unknown> | undefined;
  const weapons: QWeapon[] = asList(qa?.weapons).filter(w => typeof w.name === 'string' && w.name)
    .map(w => ({ name: String(w.name), damage: typeof w.damage === 'string' ? w.damage : undefined }));
  const spells: QSpell[] = [
    ...asList(qa?.cantrips).filter(s => typeof s.name === 'string' && s.name).map(s => ({ name: String(s.name), level: 0 })),
    ...asList(qa?.spells).filter(s => typeof s.name === 'string' && s.name).map(s => {
      const lvl = Number(s.level);
      return { name: String(s.name), level: Number.isFinite(lvl) && lvl >= 0 ? Math.floor(lvl) : 1 };
    }),
  ];
  const items: QItem[] = asList(qa?.consumables).filter(c => typeof c.name === 'string' && c.name)
    .map(c => ({ name: String(c.name), effect: typeof c.effect === 'string' ? c.effect : '' }))
    .filter(c => /restores|regain|hit points/i.test(c.effect || ''));
  return { weapons, spells, items };
}

// ---------- small pieces ----------
function HpBar({ hp, max, color = 'bg-red-500', thin }: { hp: number; max: number; color?: string; thin?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  return (
    <div className={cn('w-full rounded-full bg-white/10 overflow-hidden', thin ? 'h-1' : 'h-2')}>
      <div className={cn('h-full transition-[width] duration-500 ease-out', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Speed: dice tumbling while the server answers an action, so a tap feels instant. */
function RollingCard() {
  // eslint-disable-next-line no-restricted-syntax -- animation only: the real roll happens on the server
  const [n, setN] = useState(() => 1 + Math.floor(Math.random() * 20));
  useEffect(() => {
    // eslint-disable-next-line no-restricted-syntax -- animation only: the real roll happens on the server
    const t = setInterval(() => setN(1 + Math.floor(Math.random() * 20)), 90);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center pointer-events-none">
      <div className="rounded-2xl border border-white/15 bg-black/90 px-6 py-4 text-center space-y-1">
        <p className="text-[13px] text-white/60">🎲 Rolling…</p>
        <p className="font-cinzel text-[28px] text-white tabular-nums">{n}</p>
      </div>
    </div>
  );
}

function Ring({ progress, urgent }: { progress: number; urgent?: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0" aria-label="Next attack">
      <circle cx="12" cy="12" r={r} fill="none" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="3" />
      <circle
        cx="12" cy="12" r={r} fill="none" stroke={urgent ? 'hsl(0 90% 55%)' : 'hsl(0 84% 60%)'} strokeWidth={urgent ? 4 : 3} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

function Dots({ ok, bad }: { ok: number; bad: number }) {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[0, 1, 2].map(i => <span key={`s${i}`} className={cn('w-1.5 h-1.5 rounded-full', i < ok ? 'bg-green-400' : 'bg-white/15')} />)}
      {[0, 1, 2].map(i => <span key={`f${i}`} className={cn('w-1.5 h-1.5 rounded-full', i < bad ? 'bg-red-400' : 'bg-white/15')} />)}
    </span>
  );
}

function FinishToggle({ value, onChange }: { value: Finish; onChange: (f: Finish) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button style={tap} className={chip(value === 'knockout')} onClick={() => onChange('knockout')}>Knock out</button>
      <button style={tap} className={chip(value === 'kill')} onClick={() => onChange('kill')}>Kill</button>
    </div>
  );
}

const PERK_LABELS: Record<string, string> = {
  iron_lungs: 'Iron Lungs', pain_fuel: 'Pain Fuel', momentum: 'Momentum',
  deep_breath: 'Deep Breath', battle_medic: 'Battle Medic', last_stand: 'Last Stand',
};

// Every event kind (including second_wind, potion and last_stand) shows its detail text.
const SKILL_EVENT_ICON: Record<string, string> = { intent: '⚠', mend: '✚', shield: '🛡', rally: '📯', pin: '📌', retreat: '🏃', huddle: '🤝', scale: '⚔', duel: '🤺' };
function eventLine(e: FightEventRow): string {
  const icon = SKILL_EVENT_ICON[e.kind];
  if (icon) {
    const who = e.target_name && e.target_name !== e.actor_name ? `${e.actor_name || '?'} → ${e.target_name}` : (e.actor_name || '?');
    return `${icon} ${who}${e.detail ? `: ${e.detail}` : ''}`;
  }
  const who = e.target_name ? `${e.actor_name || '?'} → ${e.target_name}` : e.actor_name;
  const roll = e.d20 != null ? ` (d20 ${e.d20}${e.total != null ? ` → ${e.total}` : ''})` : '';
  return [who, roll, e.detail ? `: ${e.detail}` : ''].join('').trim() || e.kind;
}

// NPC Skills: the announced skill on a fighter row (pending), parsed safely.
type PendingSkill = { skill: string; type: string; targets: string[]; windupMs: number };
function pendingOf(f: FighterRow): PendingSkill | null {
  const p = (f as unknown as { pending?: unknown }).pending as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object' || typeof p.skill !== 'string') return null;
  const targets = Array.isArray(p.targets) ? p.targets.filter((t): t is string => typeof t === 'string') : [];
  // Combat v2: the real wind-up length (older fights without it assume 8 s).
  const w = Number(p.windup_ms);
  return { skill: p.skill, type: typeof p.type === 'string' ? p.type : '', targets, windupMs: Number.isFinite(w) && w > 0 ? w : 8000 };
}
/** Combat v2: what the player can do about an attack coming their way. */
function incomingHint(type: string, npcName: string, clash: boolean): string {
  // v6: big moves can be met with a Counter Clash on the ring (free, no action used).
  const ring = clash ? ' Then Counter Clash: tap the lit side of the ring as the circle lands.' : '';
  if (type === 'sweep') return `Hits up to 3 of you. Hit ${npcName} to push it back.${ring}`;
  if (type === 'pin') return `A pin holds you until you break free. Hit ${npcName} to push it back.${ring}`;
  return `Hit ${npcName} to push it back.${ring}`;
}
/** v7 Duel: the duel stored on a player's fighter row (minigame.duel), or null. */
function duelOfRow(f: FighterRow | null | undefined): DU.Duel | null {
  return DU.cleanDuel(((f as unknown as { minigame?: Record<string, unknown> | null } | null | undefined)?.minigame ?? {}).duel);
}
/** Average roll of a damage text like "2d8+4" (0 when it can't be read). */
function diceAverage(text: unknown): number {
  const m = typeof text === 'string' ? /(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i.exec(text) : null;
  if (!m) return 0;
  return (Number(m[1]) * (Number(m[2]) + 1)) / 2 + (m[3] ? Number(m[3].replace(/\s/g, '')) : 0);
}

function timeOf(v: unknown): number {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

type Result = { lines: string[] } | null;
function resultOf(r: Record<string, unknown> | null): Result {
  if (!r) return null;
  const lines: string[] = [];
  if (typeof r.d20 === 'number') lines.push(`d20 ${r.d20}${typeof r.total === 'number' ? ` → ${r.total}` : ''}`);
  if (typeof r.healed === 'number') lines.push(`+${r.healed} HP`);
  else if (r.hit === true) lines.push(`${r.crit ? 'Critical! ' : ''}Hit! ${Number(r.damage) || 0} damage`);
  else if (r.hit === false) lines.push('Miss');
  // Spells: several targets (area) and how many made their save.
  if (typeof r.targets === 'number' && r.targets > 1) lines.push(`${r.targets} targets`);
  if (typeof r.saved === 'number' && r.saved > 0) lines.push(`${r.saved} saved (half damage)`);
  return lines.length ? { lines } : null;
}

// Action sheet steps
type Step =
  | { kind: 'start-list' }
  | { kind: 'start-confirm'; npc: PartyNpc }
  | { kind: 'attack-target' }
  | { kind: 'attack'; target: FighterRow }
  | { kind: 'cast-spell' }
  | { kind: 'cast-intent'; spell: QSpell }
  | { kind: 'cast-target'; spell: QSpell; intent: 'damage' | 'heal' }
  | { kind: 'cast-finish'; spell: QSpell; target: FighterRow }
  | { kind: 'item' }
  | { kind: 'stabilize' }
  | { kind: 'aid' }
  | { kind: 'aid-ally'; target: FighterRow }
  | { kind: 'host-add' }
  | { kind: 'card-target'; card: ActionCard; key: string }
  | { kind: 'second-wind-target' }
  | { kind: 'huddle-confirm' }
  | { kind: 'cast-first' }
  | { kind: 'cast-first-finish'; target: FighterRow }
  | { kind: 'duel-target' }
  | { kind: 'duel-confirm'; target: FighterRow }
  | null;

export function NpcCombatOverlay({ combat, roster, members, currentUserId, isHost, onUseConsumableByName, pendingCast, onPendingCastDone, onOpenSpells, preTarget, onClearPreTarget, selection, onSelect, tray, onTrayTap, allyPortraits }: Props) {
  const { fight, fighters, events, fallen, myFighter, iHaveFallen, isActive, isPaused, isEnded, busy, cooldownLeft } = combat;
  const me = members.find(m => m.user_id === currentUserId);
  const qa = useMemo(() => quickActionsOf(me), [me]);
  const [step, setStep] = useState<Step>(null);
  const [weapon, setWeapon] = useState<string | null>(null);
  const [finish, setFinish] = useState<Finish>('knockout');
  const [finishTarget, setFinishTarget] = useState<string | null>(null);
  // Area spell cards: the targets picked so far (up to 3).
  const [picked, setPicked] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [hostMenu, setHostMenu] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [flash, setFlash] = useState(false);
  const [npcLine, setNpcLine] = useState<string | null>(null);
  const [hiddenEnd, setHiddenEnd] = useState<string | null>(null);
  // v6: COUNTER! / BREAK FREE! across the screen for a moment.
  const [burst, setBurst] = useState<{ kind: 'counter' | 'free'; sub?: string; key: string } | null>(null);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1400);
    return () => clearTimeout(t);
  }, [burst]);
  // v7 Duel: the duel on screen (kept until its result is closed), the last one closed, and the Combat assist pick.
  const [liveDuel, setLiveDuel] = useState<DU.Duel | null>(null);
  const [closedDuel, setClosedDuel] = useState<string | null>(null);
  const [duelFeel, setDuelFeel] = useState<DU.DuelFeel>(() => {
    try {
      const v = localStorage.getItem('duel-feel');
      return DU.isDuelFeel(v) ? v : 'standard';
    } catch { return 'standard'; }
  });
  const pickFeel = (f: DU.DuelFeel) => {
    setDuelFeel(f);
    try { localStorage.setItem('duel-feel', f); } catch { /* storage blocked */ }
  };
  // A duel on my row that this phone didn't start (another tab, or a reload mid-duel) opens too.
  const rowDuel = duelOfRow(myFighter);
  useEffect(() => {
    if (rowDuel && rowDuel.id !== closedDuel && liveDuel?.id !== rowDuel.id && !liveDuel) setLiveDuel(rowDuel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowDuel?.id]);
  // Countdowns run on the server's clock (combat.clockOffset), so they reach zero when the server acts.
  const [now, setNow] = useState(() => Date.now() + combat.clockOffset);

  const open = !!fight && !isEnded;
  // D-24: enemies, the party's NPC allies, and players. "Friends" are everyone on the party's side a heal can reach.
  const npcFighters = fighters.filter(f => isEnemyRow(f));
  const allyFighters = fighters.filter(f => isAllyRow(f));
  const playerFighters = fighters.filter(f => f.kind === 'player');
  const npcUp = npcFighters.filter(f => f.status === 'up');
  const alliesUp = allyFighters.filter(f => f.status === 'up');
  const friendsAlive = [...playerFighters.filter(f => f.status !== 'dead'), ...alliesUp];
  const isFriend = (f: FighterRow) => f.kind === 'player' ? f.status !== 'dead' : isAllyRow(f) && f.status === 'up';

  const attackable = useMemo(
    () => roster.onStage.filter(n => n.combat_stats && !n.combat_state && !n.player_user_id && !n.ally_since),
    [roster.onStage],
  );

  // Countdowns tick every 500 ms while a wind-up or huddle is counting down, otherwise once a second (lighter on the phone).
  const fastTick = combat.pauseKind === 'huddle' || npcUp.some(f => !!pendingOf(f)) || alliesUp.some(f => !!pendingOf(f));
  const offset = combat.clockOffset;
  useEffect(() => {
    if (!isActive && !isPaused) return;
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), fastTick ? 500 : 1000);
    return () => clearInterval(t);
  }, [isActive, isPaused, fastTick, offset]);
  // Speed: one extra redraw at the exact moment the next NPC attack lands, so its countdown hits zero on time.
  const nextStrikeAt = [...npcUp, ...alliesUp].reduce((soonest, f) => {
    const at = pendingOf(f) ? timeOf((f as unknown as { strike_at?: unknown }).strike_at) : NaN;
    return Number.isFinite(at) && !(at >= soonest) ? at : soonest;
  }, NaN);
  useEffect(() => {
    if (!isActive || !Number.isFinite(nextStrikeAt)) return;
    const t = setTimeout(() => setNow(Date.now() + offset), Math.max(0, nextStrikeAt - (Date.now() + offset)));
    return () => clearTimeout(t);
  }, [isActive, nextStrikeAt, offset]);

  // Speed: a short buzz the moment an action starts rolling.
  const rolling = combat.rolling;
  useEffect(() => {
    if (!rolling) return;
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
  }, [rolling]);

  // New events: a hit on me flashes the screen; an NPC attack shows a line for 4 s.
  const myName = myFighter?.name;
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenRef.current === null) { seenRef.current = new Set(events.map(e => e.id)); return; }
    const fresh = events.filter(e => !seenRef.current!.has(e.id));
    fresh.forEach(e => seenRef.current!.add(e.id));
    if (fresh.some(e => e.target_user_id === currentUserId && e.hp_delta < 0)) {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      try { navigator.vibrate?.(150); } catch { /* not supported */ }
    }
    // Combat v2: someone joined and the enemies grew to match.
    const scaled = fresh.find(e => e.kind === 'scale');
    if (scaled) toast(`⚔ The enemy steels itself: ${scaled.actor_name || 'a new fighter'} joins the fight`);
    // v6: my perfect Counter Clash landed its free counter.
    const counter = myName ? fresh.find(e => e.kind === 'attack' && e.actor_name === myName && (e.detail ?? '').startsWith('Counter Clash!')) : undefined;
    if (counter) {
      setBurst({ kind: 'counter', sub: `${/RIPOSTE/.test(counter.detail ?? '') ? 'RIPOSTE! ' : ''}${Math.abs(counter.hp_delta)} damage to ${counter.target_name}`, key: counter.id });
      try { navigator.vibrate?.([30, 40, 30, 40, 80]); } catch { /* not supported */ }
    }
    // v6: I broke free of a pin (the struggle screen may already have shown it).
    const freed = fresh.find(e => e.kind === 'pin' && e.target_user_id === currentUserId && e.detail === 'Broke free!');
    if (freed) setBurst(prev => (prev?.kind === 'free' ? prev : { kind: 'free', key: freed.id }));
  }, [events, currentUserId, myName]);

  // v6: fetch the mini-game art once a fight is on, so the first clash shows it without a delay.
  const fightOn = !!fight && !isEnded;
  useEffect(() => { if (fightOn) preloadCombatArt(); }, [fightOn]);
  const newest = events[events.length - 1];
  useEffect(() => {
    if (!newest || newest.kind !== 'attack' || !npcFighters.some(f => f.name === newest.actor_name)) return;
    setNpcLine(`${newest.actor_name} → ${newest.target_name}: ${newest.detail}`);
    const t = setTimeout(() => setNpcLine(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest?.id]);

  // NPC Skills: buzz once when an NPC starts aiming a skill at me.
  const aimKeyRef = useRef<string | null>(null);
  const aimKey = (() => {
    if (!myFighter) return null;
    const a = fighters.find(f => f.kind === 'npc' && f.status === 'up' && pendingOf(f)?.targets.includes(myFighter.id));
    return a ? `${a.id}:${String((a as unknown as { strike_at?: unknown }).strike_at ?? '')}` : null;
  })();
  useEffect(() => {
    if (aimKey && aimKey !== aimKeyRef.current) {
      try { navigator.vibrate?.(80); } catch { /* not supported */ }
    }
    aimKeyRef.current = aimKey;
  }, [aimKey]);

  const showResult = (r: Record<string, unknown> | null) => {
    const res = resultOf(r);
    if (!res) return;
    setResult(res);
    setTimeout(() => setResult(null), 2000);
  };

  const close = () => {
    const wasCard = step?.kind === 'card-target';
    setStep(null);
    setFinishTarget(null);
    setPicked([]);
    if (wasCard) onPendingCastDone?.();
  };

  // A spell card posted from Quick Actions during a fight: ask who it lands on (once per card).
  const handledCastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingCast || handledCastRef.current === pendingCast.key) return;
    handledCastRef.current = pendingCast.key;
    if (isActive && myFighter?.status === 'up') {
      const card = pendingCast.card;
      const fin = pendingCast.finish ?? 'knockout';
      setFinish(fin);
      // Target-first casting: the player already picked who this lands on, so cast straight at them.
      const pre = pendingCast.targetId ? fighters.find(f => f.id === pendingCast.targetId) : undefined;
      if (pre) {
        const dmg = Number(card.damageTotal);
        const amt = Number(card.amount);
        const heals = card.kind === 'heal' || (Number.isFinite(amt) && amt > 0 && !(Number.isFinite(dmg) && dmg > 0));
        const fits = heals ? isFriend(pre) : isEnemyRow(pre) && pre.status === 'up';
        if (fits && card.area) setPicked([pre.id]);
        if (fits && !card.area && cooldownLeft <= 0 && !busy) {
          void combat.castFromCard(pre.id, card, heals ? undefined : fin).then(r => {
            if (r) showResult(r);
            onPendingCastDone?.();
          });
          return;
        }
        if (fits && !card.area) setFinishTarget(pre.id);
        else toast(`${card.action} can't land on ${pre.name}. Pick a target.`);
      }
      setStep({ kind: 'card-target', card, key: pendingCast.key });
    } else {
      onPendingCastDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCast?.key]);
  const pickWeapon = weapon && qa.weapons.some(w => w.name === weapon) ? weapon : qa.weapons[0]?.name ?? null;

  // ---------- sheet body ----------
  const weaponRow = (
    <div className="space-y-1">
      <span className="block text-[12px] text-white/60">Weapon</span>
      <div className="flex flex-wrap gap-2">
        {qa.weapons.length === 0
          ? <span className={chip(true)}>Unarmed strike</span>
          : qa.weapons.map(w => (
            <button key={w.name} style={tap} className={chip(pickWeapon === w.name)} onClick={() => setWeapon(w.name)}>
              {w.name}{w.damage ? <span className="text-[11px] opacity-70">{w.damage}</span> : null}
            </button>
          ))}
      </div>
    </div>
  );

  const fighterButton = (f: FighterRow, onPick: () => void) => {
    const npc = f.npc_id ? roster.byId.get(f.npc_id) : undefined;
    return (
      <button key={f.id} style={tap} onClick={onPick} className={cn(btnPlain, 'w-full justify-start gap-3 py-2')}>
        {npc && <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-9 h-9 text-sm" />}
        <span className="flex-1 min-w-0 text-left">
          <span className="block truncate">{f.name}</span>
          <HpBar hp={f.hp} max={f.max_hp} color={isEnemyRow(f) ? 'bg-red-500' : isAllyRow(f) ? 'bg-emerald-500' : 'bg-green-500'} thin />
        </span>
        <span className="text-[11px] text-white/60">{f.hp}/{f.max_hp}</span>
      </button>
    );
  };

  let title = '';
  let body: React.ReactNode = null;
  if (step?.kind === 'start-list') {
    title = 'Start a fight';
    body = (
      <div className="space-y-2">
        {attackable.length === 0 && <p className="text-[13px] text-white/50">No NPC on stage can be fought right now.</p>}
        {!iHaveFallen && attackable.map(n => (
          <button key={n.id} style={tap} className={cn(btnPlain, 'w-full justify-start gap-3 py-2')} onClick={() => { setFinish('knockout'); setStep({ kind: 'start-confirm', npc: n }); }}>
            <NpcPortrait url={n.portrait_url} name={n.name} className="w-9 h-9 text-sm" />
            <span className="truncate">{n.name}</span>
          </button>
        ))}
        {isHost && fallen.length > 0 && (
          <div className="pt-2 space-y-2">
            <h4 className="font-cinzel text-[13px] text-red-200">Fallen</h4>
            {fallen.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-white/85 truncate">💀 {f.character_name}</span>
                <button style={tap} disabled={busy} className={btnAmber} onClick={() => { void combat.revivePlayer(f.user_id); }}>Revive</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (step?.kind === 'start-confirm') {
    const n = step.npc;
    title = `Fight ${n.name}?`;
    body = (
      <div className="space-y-3">
        <p className="text-[13px] text-white/75">Start a fight with {n.name}? Once it starts, {n.name} attacks on its own.</p>
        {weaponRow}
        <FinishToggle value={finish} onChange={setFinish} />
        <button style={tap} disabled={busy} className={cn(btnRed, 'w-full')} onClick={async () => {
          const r = await combat.openFight(n.id, { weaponName: qa.weapons.length ? pickWeapon ?? undefined : undefined, finish });
          if (r) { close(); showResult(r); }
        }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}⚔ Attack {n.name}
        </button>
      </div>
    );
  } else if (step?.kind === 'attack-target') {
    title = 'Attack who?';
    body = <div className="space-y-2">{npcUp.map(f => fighterButton(f, () => { setFinish('knockout'); setStep({ kind: 'attack', target: f }); }))}</div>;
  } else if (step?.kind === 'attack') {
    const t = fighters.find(f => f.id === step.target.id) ?? step.target;
    const low = t.hp <= t.max_hp * 0.25;
    title = `Attack ${t.name}`;
    body = (
      <div className="space-y-3">
        {weaponRow}
        {low && <FinishToggle value={finish} onChange={setFinish} />}
        <button style={tap} disabled={busy || cooldownLeft > 0 || isPaused} className={cn(btnRed, 'w-full')} onClick={async () => {
          if (pickWeapon) setWeapon(pickWeapon);
          const r = await combat.attack(t.id, { weaponName: qa.weapons.length ? pickWeapon ?? undefined : undefined, finish: low ? finish : undefined });
          if (r) { close(); showResult(r); }
        }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Attack
        </button>
      </div>
    );
  } else if (step?.kind === 'cast-spell') {
    title = 'Cast a spell';
    body = (
      <div className="space-y-2">
        {qa.spells.length === 0 && <p className="text-[13px] text-white/50">No spells on your sheet.</p>}
        {qa.spells.map(s => (
          <button key={`${s.name}-${s.level}`} style={tap} className={cn(btnPlain, 'w-full justify-between')} onClick={() => setStep({ kind: 'cast-intent', spell: s })}>
            <span className="truncate">{s.name}</span>
            <span className="text-[11px] text-white/50">{s.level === 0 ? 'Cantrip' : `Level ${s.level}`}</span>
          </button>
        ))}
      </div>
    );
  } else if (step?.kind === 'cast-intent') {
    const s = step.spell;
    title = s.name;
    body = (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button style={tap} className={btnRed} onClick={() => setStep({ kind: 'cast-target', spell: s, intent: 'damage' })}>Damage</button>
          <button style={tap} disabled={s.level === 0} className={btnAmber} onClick={() => setStep({ kind: 'cast-target', spell: s, intent: 'heal' })}>Heal</button>
        </div>
        {s.level === 0 && <p className="text-[11px] text-white/45">Cantrips can't heal.</p>}
      </div>
    );
  } else if (step?.kind === 'cast-target') {
    const { spell, intent } = step;
    title = intent === 'heal' ? `Heal who with ${spell.name}?` : `${spell.name} at who?`;
    const list = intent === 'heal' ? friendsAlive : npcUp;
    body = (
      <div className="space-y-2">
        {list.map(f => fighterButton(f, async () => {
          if (intent === 'heal') {
            const r = await combat.cast(f.id, spell, 'heal');
            if (r) { close(); showResult(r); }
          } else if (f.hp <= f.max_hp * 0.25) {
            setFinish('knockout');
            setStep({ kind: 'cast-finish', spell, target: f });
          } else {
            const r = await combat.cast(f.id, spell, 'damage');
            if (r) { close(); showResult(r); }
          }
        }))}
      </div>
    );
  } else if (step?.kind === 'cast-finish') {
    title = `${step.spell.name} at ${step.target.name}`;
    body = (
      <div className="space-y-3">
        <FinishToggle value={finish} onChange={setFinish} />
        <button style={tap} disabled={busy} className={cn(btnRed, 'w-full')} onClick={async () => {
          const r = await combat.cast(step.target.id, step.spell, 'damage', finish);
          if (r) { close(); showResult(r); }
        }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Cast
        </button>
      </div>
    );
  } else if (step?.kind === 'card-target') {
    const card = step.card;
    const dmg = Number(card.damageTotal);
    const amt = Number(card.amount);
    const isHeal = card.kind === 'heal' || (Number.isFinite(amt) && amt > 0 && !(Number.isFinite(dmg) && dmg > 0));
    const waiting = cooldownLeft > 0 || busy;
    const area = card.area === true;
    const dmgText = `${Number.isFinite(dmg) ? dmg : 0} damage`;
    const rollLine = isHeal
      ? `Heals ${Number.isFinite(amt) ? amt : 0}${area ? ' · up to 3 allies' : ''}`
      : card.resolve === 'auto'
        ? `${dmgText} · hits automatically${area ? ' · up to 3 enemies' : ''}`
        : card.resolve === 'save' || card.d20 == null
          ? `${dmgText} · ${card.saveStat ?? 'DEX'} save DC ${card.saveDC ?? '?'}, half on a save${area ? ' · up to 3 enemies' : ''}`
          : `d20 ${card.d20} → ${card.attackTotal ?? '?'} · ${dmgText}${area ? ' · up to 3 enemies' : ''}`;
    const targets = isHeal
      ? friendsAlive
      : (Number.isFinite(dmg) && dmg > 0 ? npcUp : []);
    const pick = async (t: FighterRow, fin?: Finish) => {
      const r = await combat.castFromCard(t.id, card, fin);
      if (r) { showResult(r); close(); }
    };
    const chosenLow = finishTarget && targets.find(t => t.id === finishTarget);
    const pickedLive = picked.filter(id => targets.some(t => t.id === id));
    const toggle = (id: string) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id]));
    title = `Target${area ? 's' : ''} for ${card.action}`;
    body = (
      <div className="space-y-2">
        <p className="text-[13px] text-white/75">{rollLine}</p>
        {waiting && <p className="text-[11px] text-white/60">{busy ? 'Working…' : `Ready in ${cooldownLeft}s`}</p>}
        {area ? (
          <div className="space-y-2">
            <p className="text-[12px] text-white/55">Tap up to 3 {isHeal ? 'allies' : 'enemies'} ({pickedLive.length} picked)</p>
            {targets.map(f => (
              <div key={f.id} className={cn('rounded-lg', pickedLive.includes(f.id) && 'ring-2 ring-amber-400')}>
                {fighterButton(f, () => toggle(f.id))}
              </div>
            ))}
            {!isHeal && pickedLive.length > 0 && <FinishToggle value={finish} onChange={setFinish} />}
            <button style={tap} disabled={waiting || pickedLive.length === 0} className={cn(isHeal ? btnAmber : btnRed, 'w-full')} onClick={async () => {
              const r = await combat.castFromCard(pickedLive[0], card, isHeal ? undefined : finish, pickedLive.slice(1));
              if (r) { showResult(r); close(); }
            }}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Cast{pickedLive.length > 1 ? ` at ${pickedLive.length}` : ''}
            </button>
          </div>
        ) : chosenLow ? (
          <div className="space-y-3">
            <p className="text-[13px] text-white/85">{chosenLow.name}</p>
            {!isHeal && <FinishToggle value={finish} onChange={setFinish} />}
            <button style={tap} disabled={waiting} className={cn(btnRed, 'w-full')} onClick={() => { void pick(chosenLow, finish); }}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}Cast
            </button>
          </div>
        ) : (
          targets.map(f => (
            <div key={f.id} className={cn(waiting && 'opacity-50 pointer-events-none')} aria-disabled={waiting}>
              {fighterButton(f, () => {
                if (waiting) return;
                if (!isHeal && f.hp <= f.max_hp * 0.25) { setFinish('knockout'); setFinishTarget(f.id); }
                else void pick(f);
              })}
            </div>
          ))
        )}
        {targets.length === 0 && <p className="text-[13px] text-white/50">No one to target.</p>}
        <button style={tap} className={cn(btnPlain, 'w-full')} onClick={close}>No target</button>
      </div>
    );
  } else if (step?.kind === 'second-wind-target') {
    title = 'Second Wind: who?';
    const allies = playerFighters.filter(f => f.status !== 'dead' && f.user_id !== currentUserId);
    const go = async (id?: string) => {
      const r = await combat.secondWind(id);
      if (r) { close(); showResult(r); }
    };
    body = (
      <div className="space-y-2">
        <button style={tap} disabled={busy} className={cn(btnAmber, 'w-full')} onClick={() => { void go(); }}>Yourself</button>
        {allies.map(f => fighterButton(f, () => { void go(f.id); }))}
      </div>
    );
  } else if (step?.kind === 'item') {
    title = 'Use an item';
    body = (
      <div className="space-y-2">
        {qa.items.length === 0 && <p className="text-[13px] text-white/50">No healing items on your sheet.</p>}
        {qa.items.map(i => (
          <button key={i.name} style={tap} className={cn(btnPlain, 'w-full justify-start')} onClick={() => {
            const ok = onUseConsumableByName?.(i.name) ?? false;
            if (!ok) toast.error(`Couldn't use ${i.name}.`);
            else close();
          }}>
            <span className="truncate">{i.name}</span>
          </button>
        ))}
      </div>
    );
  } else if (step?.kind === 'stabilize') {
    title = 'Stabilize who?';
    body = (
      <div className="space-y-2">
        {playerFighters.filter(f => f.status === 'down' && f.user_id !== currentUserId).map(f => fighterButton(f, async () => {
          const r = await combat.stabilize(f.id);
          if (r) close();
        }))}
      </div>
    );
  } else if (step?.kind === 'aid') {
    title = 'Aid who?';
    // D-24: NPC allies can take a potion too (not Stabilize: they never make death saves).
    const allies = [...playerFighters.filter(f => f.status !== 'dead' && f.user_id !== currentUserId), ...alliesUp];
    body = (
      <div className="space-y-2">
        {allies.length === 0 && <p className="text-[13px] text-white/50">No allies to aid.</p>}
        {allies.map(f => (
          <div key={f.id} className="space-y-0.5">
            {fighterButton(f, () => setStep({ kind: 'aid-ally', target: f }))}
            {f.status === 'down' && <p className="text-[11px] text-red-300 pl-1">DOWN, making death saves</p>}
            {f.status === 'stable' && <p className="text-[11px] text-sky-300 pl-1">STABLE at 0 HP</p>}
          </div>
        ))}
      </div>
    );
  } else if (step?.kind === 'aid-ally') {
    const live = fighters.find(f => f.id === step.target.id) ?? step.target;
    const potions = qa.items.filter(i => /heal/i.test(i.name) && /potion|elixir|draught|philter/i.test(i.name));
    const waiting = cooldownLeft > 0 || busy;
    title = `Aid ${live.name}`;
    body = (
      <div className="space-y-2">
        {waiting && <p className="text-[11px] text-white/60">{busy ? 'Working…' : `Ready in ${cooldownLeft}s`}</p>}
        {live.status === 'dead' && <p className="text-[13px] text-white/60">{live.name} has fallen. Only the host can revive them.</p>}
        {live.status === 'down' && (
          <button style={tap} disabled={waiting} className={cn(btnPlain, 'w-full')} onClick={async () => {
            const r = await combat.stabilize(live.id);
            if (r) close();
          }}>Stabilize (Medicine, DC 10)</button>
        )}
        {live.status !== 'dead' && potions.map(i => (
          <button key={i.name} style={tap} disabled={waiting} className={cn(btnAmber, 'w-full justify-start')} onClick={async () => {
            const r = await combat.givePotion(live.id, i.name);
            if (!r) return;
            const removed = onUseConsumableByName?.(i.name, 1) ?? false;
            if (!removed) toast.warning(`${i.name} healed ${live.name}, but it couldn't be removed from your inventory.`);
            close();
            showResult(r);
          }}>
            <span className="truncate">Give {i.name}</span>
          </button>
        ))}
        {live.status !== 'dead' && potions.length === 0 && <p className="text-[13px] text-white/50">No healing potions on your sheet.</p>}
        <button style={tap} className={cn(btnPlain, 'w-full')} onClick={() => setStep({ kind: 'aid' })}>Back</button>
      </div>
    );
  } else if (step?.kind === 'cast-first') {
    // Target-first casting: pick who the spell lands on, then pick the spell in Quick Actions.
    title = 'Cast at who?';
    const allies = friendsAlive;
    const begin = (t: FighterRow, fin: Finish) => {
      close();
      onOpenSpells?.({ targetId: t.id, targetName: t.name, finish: fin });
    };
    body = (
      <div className="space-y-2">
        {npcUp.length > 0 && <p className="text-[12px] text-white/55">Enemies (damage spells)</p>}
        {npcUp.map(f => fighterButton(f, () => {
          if (f.hp <= f.max_hp * 0.25) { setFinish('knockout'); setStep({ kind: 'cast-first-finish', target: f }); }
          else begin(f, 'knockout');
        }))}
        {allies.length > 0 && <p className="text-[12px] text-white/55 pt-1">Allies (healing spells)</p>}
        {allies.map(f => fighterButton(f, () => begin(f, 'knockout')))}
        <button style={tap} className={cn(btnPlain, 'w-full')} onClick={() => { close(); onOpenSpells?.(); }}>Pick the spell first</button>
      </div>
    );
  } else if (step?.kind === 'cast-first-finish') {
    title = `Cast at ${step.target.name}`;
    const t = step.target;
    body = (
      <div className="space-y-3">
        <FinishToggle value={finish} onChange={setFinish} />
        <button style={tap} className={cn(btnAmber, 'w-full')} onClick={() => { const fin = finish; close(); onOpenSpells?.({ targetId: t.id, targetName: t.name, finish: fin }); }}>
          Pick a spell
        </button>
      </div>
    );
  } else if (step?.kind === 'huddle-confirm') {
    title = 'Call a huddle?';
    body = (
      <div className="space-y-3">
        <p className="text-[13px] text-white/75">The whole fight freezes for 20 seconds so the party can plan. Nobody can act until it ends. You get one huddle per fight.</p>
        <button style={tap} disabled={busy} className={cn(btnAmber, 'w-full')} onClick={async () => {
          const r = await combat.huddle();
          if (r) close();
        }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}🤝 Call huddle
        </button>
        <button style={tap} className={cn(btnPlain, 'w-full')} onClick={close}>Not now</button>
      </div>
    );
  } else if (step?.kind === 'duel-target') {
    // v7 Duel: pick the NPC to duel (not one already dueling someone else).
    title = 'Duel who?';
    const taken = new Set(playerFighters.filter(f => f.id !== myFighter?.id).map(f => duelOfRow(f)?.npcId).filter(Boolean));
    const free = npcUp.filter(f => !taken.has(f.id));
    body = (
      <div className="space-y-2">
        {free.length === 0 && <p className="text-[13px] text-white/50">Every enemy is already in a duel.</p>}
        {free.map(f => fighterButton(f, () => { setFinish('knockout'); setStep({ kind: 'duel-confirm', target: f }); }))}
      </div>
    );
  } else if (step?.kind === 'duel-confirm') {
    // v7 Duel: what this duel will be like. Both fighters' stats set it; the server works it out again when it starts.
    const t = fighters.find(f => f.id === step.target.id) ?? step.target;
    const npcStats = (t.npc_id ? roster.byId.get(t.npc_id)?.combat_stats : null) as unknown as Record<string, unknown> | null | undefined;
    const sheet = (me?.character_status ?? {}) as { level?: unknown; abilityScores?: Record<string, unknown> | null };
    const preview = DU.deriveDuel({
      level: Number(sheet.level) || 1,
      dex: Number(sheet.abilityScores?.dex) || 10,
      ac: myFighter?.ac ?? 10,
      maxHp: myFighter?.max_hp ?? 10,
      npcAttack: Number(npcStats?.attackBonus) || 0,
      npcDamageAvg: diceAverage(npcStats?.damage) || 4,
      npcSpeed: typeof npcStats?.speed === 'string' ? npcStats.speed : 'medium',
      feel: duelFeel,
    });
    const st = DU.DUEL_STYLES[preview.style];
    title = `Duel ${t.name}?`;
    body = (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-2.5 space-y-1">
          <p className="text-[14px] text-red-100"><b className="font-cinzel">{st.name}</b>: {st.tag}</p>
          <p className="text-[12px] text-white/70">
            About {preview.strikes} strikes. Green window ±{preview.perfect} ms. A plain block still lets {Math.round(preview.block * 100)}% through. Counter window {preview.riposteMs} ms.
          </p>
          <p className="text-[12px] text-white/60">
            Your duel bar empties. {t.name} drops whatever it was winding up. Every counter hits back, and every strike perfect lands a finishing blow. Leave the duel screen and every strike lands.
          </p>
        </div>
        {weaponRow}
        <FinishToggle value={finish} onChange={setFinish} />
        <div className="space-y-1">
          <span className="block text-[12px] text-white/60">Combat assist</span>
          <div className="grid grid-cols-3 gap-2">
            {(['relaxed', 'standard', 'tough'] as const).map(f => (
              <button key={f} style={tap} className={chip(duelFeel === f)} onClick={() => pickFeel(f)}>{DU.DUEL_FEEL[f].name}</button>
            ))}
          </div>
        </div>
        <button style={tap} disabled={busy || !isActive} className={cn(btnRed, 'w-full')} onClick={async () => {
          const r = await combat.duelStart(t.id, { weaponName: qa.weapons.length ? pickWeapon ?? undefined : undefined, finish, feel: duelFeel });
          const d = DU.cleanDuel((r as { duel?: unknown } | null)?.duel);
          if (d) { close(); setLiveDuel(d); }
        }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}🤺 Start the duel
        </button>
      </div>
    );
  } else if (step?.kind === 'host-add') {
    title = 'Add an NPC to the fight';
    const inFight = new Set(npcFighters.map(f => f.npc_id));
    const choices = roster.onStage.filter(n => n.combat_stats && !n.player_user_id && !inFight.has(n.id));
    body = (
      <div className="space-y-2">
        {choices.length === 0 && <p className="text-[13px] text-white/50">Every on-stage NPC that can fight is already in it.</p>}
        {choices.map(n => (
          <button key={n.id} style={tap} disabled={busy} className={cn(btnPlain, 'w-full justify-start gap-3 py-2')} onClick={async () => {
            const r = await combat.addNpc(n.id);
            if (r) close();
          }}>
            <NpcPortrait url={n.portrait_url} name={n.name} className="w-9 h-9 text-sm" />
            <span className="truncate">{n.name}</span>
          </button>
        ))}
      </div>
    );
  }

  const sheet = (
    <Drawer open={!!step} onOpenChange={o => { if (!o) close(); }}>
      <DrawerContent className="bg-background/95 border-white/10 max-h-[80vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-cinzel text-[15px] text-amber-200">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">{body}</div>
      </DrawerContent>
    </Drawer>
  );

  const resultCard = result && (
    <div className="fixed inset-0 z-[58] flex items-center justify-center pointer-events-none">
      <div className="rounded-2xl border border-white/15 bg-black/90 px-6 py-4 text-center space-y-1">
        {result.lines.map((l, i) => <p key={i} className={cn(i === 0 ? 'text-[13px] text-white/60' : 'font-cinzel text-[20px] text-white')}>{l}</p>)}
      </div>
    </div>
  );

  // v7 Duel: the wheel covers the chat window. It stays up through the result, even if the duel ends the fight.
  const duelLayer = liveDuel && (
    <DuelWheel
      key={liveDuel.id}
      duel={liveDuel}
      serverTime={combat.serverTime}
      onFinish={inputs => combat.duelEnd(liveDuel.id, inputs) as Promise<DuelVerdict | null>}
      onClose={() => { setClosedDuel(liveDuel.id); setLiveDuel(null); }}
    />
  );

  const flashLayer = flash && <div className="fixed inset-0 z-[58] pointer-events-none" style={{ boxShadow: 'inset 0 0 60px 12px hsl(0 84% 50% / 0.65)' }} />;

  // ---------- D. just ended ----------
  if (fight && isEnded) {
    if (hiddenEnd === fight.id) return <>{sheet}{duelLayer}</>;
    const endEv = [...events].reverse().find(e => e.kind === 'end');
    const label = fight.outcome === 'victory' ? 'Victory' : fight.outcome === 'defeat' ? 'Defeat' : 'Fight ended';
    const tone = fight.outcome === 'victory' ? 'border-green-500/40 text-green-200' : fight.outcome === 'defeat' ? 'border-red-500/40 text-red-200' : 'border-white/15 text-white/70';
    return (
      <>
        <div className={cn('fixed left-2 right-2 top-16 z-[56] rounded-xl border bg-black/90 p-3 space-y-2', tone)}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-cinzel text-[15px]">{label}</span>
            <button style={tap} aria-label="Hide" className="w-11 h-11 flex items-center justify-center text-white/60" onClick={() => setHiddenEnd(fight.id)}><X className="w-5 h-5" /></button>
          </div>
          {endEv?.detail && <p className="text-[12px] text-white/70">{endEv.detail}</p>}
          {isHost && fallen.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-white/85 truncate">💀 {f.character_name}</span>
              <button style={tap} disabled={busy} className={btnAmber} onClick={() => { void combat.revivePlayer(f.user_id); }}>Revive</button>
            </div>
          ))}
        </div>
        {sheet}
        {duelLayer}
      </>
    );
  }

  // ---------- A. no fight ----------
  if (!open) {
    const canStart = attackable.length > 0 && !!me && !iHaveFallen;
    const showPill = canStart || (isHost && fallen.length > 0);
    return (
      <>
        {iHaveFallen && me && (
          <div className="fixed left-3 z-[55] max-w-[calc(100%-24px)] rounded-full border border-white/15 bg-black/90 px-3 py-2 text-[12px] text-white/75" style={{ bottom: 150 }}>
            💀 {me.character_name} has fallen. The host can revive them.
          </div>
        )}
        {showPill && !iHaveFallen && (
          <button
            style={{ ...tap, bottom: 150 }}
            className="fixed left-3 z-[55] min-h-[44px] px-4 rounded-full border border-red-500/50 bg-red-950/95 text-[14px] text-red-100 shadow-lg"
            onClick={() => setStep({ kind: 'start-list' })}
          >
            ⚔ Fight
          </button>
        )}
        {iHaveFallen && isHost && fallen.length > 0 && (
          <button
            style={{ ...tap, bottom: 200 }}
            className="fixed left-3 z-[55] min-h-[44px] px-4 rounded-full border border-red-500/50 bg-red-950/95 text-[14px] text-red-100 shadow-lg"
            onClick={() => setStep({ kind: 'start-list' })}
          >
            ⚔ Fight
          </button>
        )}
        {sheet}
      </>
    );
  }

  // ---------- B. fight running ----------
  // Combat v2: while paused, every countdown stands still at the moment of the pause.
  const clock = isPaused && Number.isFinite(combat.pausedAtMs) ? combat.pausedAtMs : now;
  const isHuddle = combat.pauseKind === 'huddle';
  const huddleLeft = isHuddle && Number.isFinite(combat.huddleUntilMs) ? Math.max(0, Math.ceil((combat.huddleUntilMs - now) / 1000)) : 0;
  const canHuddle = isActive && !!myFighter && myFighter.status !== 'dead' && !combat.myHuddleUsed;
  const pinnedUntil = timeOf((myFighter as unknown as { pinned_until?: unknown })?.pinned_until);
  const pinnedLeft = Number.isFinite(pinnedUntil) ? Math.ceil((pinnedUntil - clock) / 1000) : 0;
  const amPinned = pinnedLeft > 0;
  const aimingAtMe = myFighter
    ? npcFighters.map(f => ({ f, p: pendingOf(f) })).find(x => x.f.status === 'up' && x.p?.targets.includes(myFighter.id)) ?? null
    : null;
  const hasAllies = playerFighters.some(f => f.status !== 'dead' && f.user_id !== currentUserId) || alliesUp.length > 0;
  const canAct = isActive && !busy && cooldownLeft <= 0 && !amPinned;
  const myResolve = resolveOf(myFighter, clock);
  // v7 Duel bar: full = the Duel button. Free (no action timer), but not while pinned or already dueling.
  const myDuelCharge = duelChargeOf(myFighter);
  const duelReady = myDuelCharge >= DU.DUEL_CHARGE.max;
  const canDuel = isActive && !busy && !amPinned && !liveDuel && !rowDuel && npcUp.length > 0;
  const recent = [...events].reverse().slice(0, 20);

  // ---------- target rails + one-tap tray ----------
  const selIds = selection?.ids ?? [];
  const selPrimary = selIds[0] ? fighters.find(f => f.id === selIds[0]) : undefined;
  const selValid = !!selPrimary && (selection?.side === 'enemy' ? isEnemyRow(selPrimary) && selPrimary.status === 'up' : isFriend(selPrimary));
  const railAllies = friendsAlive;
  const pickEnemy = (f: FighterRow) => onSelect?.({ side: 'enemy', ids: [f.id] });
  const toggleArea = (f: FighterRow) => {
    if (selection?.side !== 'enemy' || !selIds.length) return;
    const has = selIds.includes(f.id);
    const next = has ? selIds.filter(id => id !== f.id) : selIds.length < 3 ? [...selIds, f.id] : selIds;
    onSelect?.({ side: 'enemy', ids: next });
  };
  const trayFor = (row: TrayEntry['row'][]) => (tray ?? []).filter(t => row.includes(t.row) && t.side === selection?.side);
  const trayRow = (entries: TrayEntry[], empty: string) => (
    <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none]">
      {entries.length === 0 && <p className="min-h-[48px] flex items-center text-[11px] text-white/45 px-1">{empty}</p>}
      {entries.map(t => (
        <button key={t.id} style={tap} disabled={!canAct} onClick={() => onTrayTap?.(t.id)}
          className={cn('min-h-[48px] shrink-0 max-w-[150px] rounded-lg border px-3 flex flex-col items-start justify-center text-left disabled:opacity-40 active:scale-[0.97]',
            t.row === 'attack' ? 'border-red-500/50 bg-red-500/15' : t.side === 'ally' ? 'border-emerald-400/50 bg-emerald-500/15' : 'border-violet-400/50 bg-violet-500/15')}>
          <span className="text-[12px] text-white/90 truncate max-w-full">{t.name}</span>
          {t.sub && <span className="text-[10px] text-white/55 truncate max-w-full">{t.sub}</span>}
        </button>
      ))}
    </div>
  );
  const railsBlock = (
    <div className="space-y-1.5 pt-1 border-t border-white/10">
      {selValid && selPrimary && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-amber-100 truncate">🎯 {selPrimary.name}{selIds.length > 1 ? ` +${selIds.length - 1} (area)` : ''}</span>
            <button style={tap} className="min-h-[36px] px-2 text-[11px] text-white/60" onClick={() => onSelect?.(null)}>Clear</button>
          </div>
          {selection?.side === 'enemy'
            ? <>{trayRow(trayFor(['attack']), 'No weapon equipped.')}{trayRow(trayFor(['spell']), 'No attack spells.')}</>
            : <>
                {trayRow(trayFor(['item']), 'No healing items.')}
                {trayRow(selPrimary.status === 'up' ? trayFor(['spell']) : trayFor(['spell']).filter(t => t.sub !== 'Buff'), 'No healing or support spells.')}
                {(selPrimary.status === 'down') && selPrimary.id !== myFighter?.id && (
                  <button style={tap} disabled={!canAct} className={cn(btnPlain, 'w-full')} onClick={async () => { const r = await combat.stabilize(selPrimary.id); if (r) showResult(r); }}>Stabilize (Medicine, DC 10)</button>
                )}
              </>}
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {npcFighters.filter(f => f.status === 'up').length === 0 && <p className="min-h-[48px] flex items-center text-[11px] text-white/45 px-1">No enemies standing.</p>}
        {npcFighters.filter(f => f.status === 'up').map(f => {
          const npc = f.npc_id ? roster.byId.get(f.npc_id) : undefined;
          const on = selection?.side === 'enemy' && selIds.includes(f.id);
          const primary = on && selIds[0] === f.id;
          const pend = pendingOf(f);
          const strikeAt = timeOf(f.strike_at);
          const left = Number.isFinite(strikeAt) ? strikeAt - now : NaN;
          const next = f.next_action_at ? Date.parse(f.next_action_at) : NaN;
          const nextLeft = Number.isFinite(next) ? Math.max(0, Math.ceil((next - now) / 1000)) : null;
          const pendT = pend ? pend.targets.map(t => fighters.find(x => x.id === t)?.name).filter(Boolean).join(', ') : '';
          return (
            <div key={f.id} className={cn('relative w-[132px] shrink-0 rounded-lg border p-1.5 space-y-0.5', primary ? 'border-amber-300 bg-amber-500/15' : on ? 'border-amber-300/50 bg-amber-500/10' : 'border-white/10 bg-white/[0.04]')}>
              <button style={tap} className="w-full text-left space-y-0.5" aria-pressed={on} onClick={() => pickEnemy(f)}>
                <div className="flex items-center gap-1.5">
                  {npc ? <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-8 h-8 text-xs shrink-0" /> : <span className="w-8 h-8 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/90 truncate">{f.name}</p>
                    <p className="text-[11px] text-white/75 tabular-nums">{f.hp}/{f.max_hp}</p>
                  </div>
                </div>
                <HpBar hp={f.hp} max={f.max_hp} />
                {effectChips(f, now).map(c => <p key={c} className="text-[10px] text-sky-200 truncate">{c}</p>)}
                {pend
                  ? <p className="text-[10px] text-red-300 truncate">→ {pendT ? `${pendT}: ` : ''}{pend.skill}{!isPaused && Number.isFinite(left) ? (left > 0 ? ` · ${Math.ceil(left / 1000)}s` : ' · 💥') : ''}</p>
                  : !isPaused && nextLeft !== null && <p className="text-[10px] text-white/55">Acts in {nextLeft}s</p>}
              </button>
              {selection?.side === 'enemy' && selIds.length > 0 && !primary && (
                <button style={tap} className="w-full min-h-[32px] rounded border border-white/15 text-[10px] text-white/70" onClick={() => toggleArea(f)}>{on ? '− Area' : '+ Area'}</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {railAllies.length === 0 && <p className="min-h-[48px] flex items-center text-[11px] text-white/45 px-1">No allies in the fight.</p>}
        {railAllies.map(f => {
          const on = selection?.side === 'ally' && selIds[0] === f.id;
          const url = f.user_id ? allyPortraits?.[f.user_id] : (f.npc_id ? roster.byId.get(f.npc_id)?.portrait_url ?? undefined : undefined);
          return (
            <button key={f.id} style={tap} aria-pressed={on} onClick={() => onSelect?.({ side: 'ally', ids: [f.id] })}
              className={cn('w-[112px] shrink-0 rounded-lg border p-1.5 text-left space-y-0.5', on ? 'border-emerald-300 bg-emerald-500/15' : 'border-white/10 bg-white/[0.04]')}>
              <div className="flex items-center gap-1.5">
                <NpcPortrait url={url ?? null} name={f.name} className="w-7 h-7 text-xs shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-white/90 truncate">{f.id === myFighter?.id ? 'You' : isAllyRow(f) ? `🤝 ${f.name}` : f.name}</p>
                  <p className="text-[10px] tabular-nums text-white/70">{f.status === 'down' ? <span className="text-red-300">DOWN</span> : f.status === 'stable' ? <span className="text-sky-300">STABLE</span> : `${f.hp}/${f.max_hp}`}</p>
                </div>
              </div>
              <HpBar hp={f.hp} max={f.max_hp} color={isAllyRow(f) ? 'bg-emerald-500' : 'bg-green-500'} thin />
              {effectChips(f, now).map(c => <p key={c} className="text-[10px] text-sky-200 truncate">{c}</p>)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-14 z-[56] px-2 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-red-500/30 bg-black/90 max-h-[45vh] overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className={cn('font-cinzel text-[14px] flex-1', isPaused ? 'text-amber-300' : 'text-red-300')}>{isPaused ? (isHuddle ? '🤝 HUDDLE' : '⏸ PAUSED') : '⚔ COMBAT'}</span>
            {combat.connection !== 'live' && <span className="text-[11px] text-amber-300 animate-pulse">📶 Reconnecting…</span>}
            {canHuddle && (
              <button style={tap} className="min-h-[44px] px-2 text-[12px] text-amber-200" onClick={() => setStep({ kind: 'huddle-confirm' })}>🤝 Huddle</button>
            )}
            <button style={tap} className="min-h-[44px] px-2 text-[12px] text-white/60" onClick={() => setShowLog(v => !v)}>Log</button>
            {isHost && (
              <button style={tap} aria-label="Host controls" className="w-11 h-11 flex items-center justify-center text-white/70" onClick={() => setHostMenu(v => !v)}>
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
            <button style={tap} aria-label={collapsed ? 'Expand' : 'Collapse'} className="w-11 h-11 flex items-center justify-center text-white/70" onClick={() => setCollapsed(v => !v)}>
              {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>

          {isHuddle && (
            <div className="mx-3 mb-2 rounded-lg border border-amber-400/50 bg-amber-500/15 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-amber-100">Plan your move. Actions unlock when it ends.</span>
                <span className="font-cinzel text-[18px] text-amber-200 tabular-nums">0:{String(huddleLeft).padStart(2, '0')}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-amber-400 transition-[width] duration-500" style={{ width: `${Math.min(100, (huddleLeft / 20) * 100)}%` }} />
              </div>
              {isHost && (
                <div className="grid grid-cols-2 gap-2">
                  <button style={tap} disabled={busy} className={btnPlain} onClick={() => { void combat.pause(); }}>Hold</button>
                  <button style={tap} disabled={busy} className={btnAmber} onClick={() => { void combat.resume(); }}>End huddle</button>
                </div>
              )}
            </div>
          )}

          {isHost && hostMenu && (
            <div className="grid grid-cols-3 gap-2 px-3 pb-2">
              {isPaused
                ? <button style={tap} disabled={busy} className={btnAmber} onClick={() => { setHostMenu(false); void combat.resume(); }}>Resume</button>
                : <button style={tap} disabled={busy} className={btnAmber} onClick={() => { setHostMenu(false); void combat.pause(); }}>Pause</button>}
              <button style={tap} disabled={busy} className={btnPlain} onClick={() => { setHostMenu(false); setStep({ kind: 'host-add' }); }}>Add NPC</button>
              <button style={tap} disabled={busy} className={btnRed} onClick={() => { setHostMenu(false); setConfirmEnd(true); }}>End Fight</button>
            </div>
          )}

          {!collapsed && (
            <div className="px-3 pb-3 space-y-2">
              {npcFighters.map(f => {
                const npc = f.npc_id ? roster.byId.get(f.npc_id) : undefined;
                const preset = SPEED_SECONDS[npc?.combat_stats?.speed ?? 'medium'] ?? 60;
                const paceMs = Number(f.act_every_ms);
                const secs = (Number.isFinite(paceMs) && paceMs > 0 ? paceMs : preset * 1000) / 1000;
                const next = f.next_action_at ? Date.parse(f.next_action_at) : NaN;
                const progress = Number.isFinite(next) ? Math.max(0, Math.min(1, 1 - (next - now) / (secs * 1000))) : 0;
                const out = f.status === 'ko' || f.status === 'dead' || f.status === 'fled';
                const pend = f.status === 'up' ? pendingOf(f) : null;
                const strikeAt = timeOf((f as unknown as { strike_at?: unknown }).strike_at);
                const strikeLeft = Number.isFinite(strikeAt) ? strikeAt - now : NaN;
                const strikeProgress = Number.isFinite(strikeLeft) && pend ? Math.max(0, Math.min(1, 1 - strikeLeft / pend.windupMs)) : 0;
                const wardAmt = Number((f as unknown as { ward?: unknown }).ward);
                const wardUntil = timeOf((f as unknown as { ward_until?: unknown }).ward_until);
                const warded = Number.isFinite(wardAmt) && wardAmt > 0 && Number.isFinite(wardUntil) && wardUntil > now;
                const pendTargets = pend ? pend.targets.filter(t => t !== f.id).map(t => fighters.find(x => x.id === t)?.name).filter(Boolean) as string[] : [];
                // Speed: "typing…" from the NPC's warning until its line reaches the Live Table (up to 8 s).
                const lastIntent = f.status === 'up' ? [...events].reverse().find(e => e.kind === 'intent' && e.actor_name === f.name) : undefined;
                const intentAt = lastIntent ? timeOf(lastIntent.created_at) : NaN;
                const typing = Number.isFinite(intentAt) && now - intentAt < 8000 && (combat.lastLineAt[f.npc_id ?? ''] ?? 0) < intentAt;
                return (
                  <div key={f.id} className={cn('flex items-center gap-2', out && 'opacity-50 grayscale')}>
                    {npc ? <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-8 h-8 text-sm" /> : <span className="w-8 h-8" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-white/90 truncate">{f.name}{typing && <span className="ml-1.5 text-[11px] text-white/60 animate-pulse">💬 typing…</span>}</span>
                        <span className="text-[11px] text-white/60 shrink-0">
                          {warded && <span className="mr-1 text-sky-200">🛡 {Math.round(wardAmt)}</span>}
                          {f.status === 'ko' ? '💤 Knocked out' : f.status === 'dead' ? '💀 Dead' : f.status === 'fled' ? '🏃 Fled' : `${f.hp}/${f.max_hp}`}
                        </span>
                      </div>
                      <HpBar hp={f.hp} max={f.max_hp} />
                      {pend && (
                        <p className={cn('text-[11px] text-red-300 truncate', Number.isFinite(strikeLeft) && strikeLeft <= 2000 && 'animate-pulse text-red-200 font-semibold')}>
                          → {pendTargets.length ? `${pendTargets.join(', ')}: ${pend.skill}` : pend.skill}
                          {!isPaused && Number.isFinite(strikeLeft) ? (strikeLeft > 0 ? ` · ${Math.ceil(strikeLeft / 1000)}s` : ' · 💥') : ''}
                        </p>
                      )}
                    </div>
                    {f.status === 'up' && (
                      <span className={cn('text-[11px] shrink-0', secs < preset ? 'text-red-300' : secs > preset ? 'text-sky-300' : 'text-white/60')}>
                        {secs < preset ? '⚡ ' : secs > preset ? '🐢 ' : ''}every {Math.round(secs)}s
                      </span>
                    )}
                    {!isPaused && f.status === 'up' && (pend ? <Ring progress={strikeProgress} urgent /> : <Ring progress={progress} />)}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {playerFighters.map(f => { const pinT = timeOf((f as unknown as { pinned_until?: unknown }).pinned_until); return (
                  <div key={f.id} className="min-w-[96px] flex-1 max-w-[50%] rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-white/85 truncate">{Number.isFinite(pinT) && pinT > now ? '📌 ' : ''}{f.name}</span>
                      {f.status === 'down' && <span className="text-[11px] text-red-300 flex items-center">DOWN<Dots ok={f.death_successes} bad={f.death_failures} /></span>}
                      {f.status === 'stable' && <span className="text-[11px] text-sky-300">STABLE</span>}
                      {f.status === 'dead' && <span className="text-[11px]">💀</span>}
                    </div>
                    <HpBar hp={f.hp} max={f.max_hp} color="bg-green-500" thin />
                  </div>
                ); })}
                {/* D-24: the party's NPC allies, with what they are winding up. */}
                {allyFighters.map(f => {
                  const pend = f.status === 'up' ? pendingOf(f) : null;
                  const strikeAt = timeOf((f as unknown as { strike_at?: unknown }).strike_at);
                  const strikeLeft = Number.isFinite(strikeAt) ? strikeAt - now : NaN;
                  const pendTargets = pend ? pend.targets.filter(t => t !== f.id).map(t => fighters.find(x => x.id === t)?.name).filter(Boolean) as string[] : [];
                  return (
                    <div key={f.id} className={cn('min-w-[96px] flex-1 max-w-[50%] rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-2 py-1', f.status !== 'up' && 'opacity-50 grayscale')}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-white/85 truncate">🤝 {f.name}</span>
                        {f.status === 'ko' ? <span className="text-[11px] text-red-300">💤 KO</span> : <span className="text-[11px] text-white/60 tabular-nums">{f.hp}/{f.max_hp}</span>}
                      </div>
                      <HpBar hp={f.hp} max={f.max_hp} color="bg-emerald-500" thin />
                      {pend && (
                        <p className="text-[10px] text-emerald-200 truncate">
                          → {pendTargets.length ? `${pendTargets.join(', ')}: ${pend.skill}` : pend.skill}
                          {!isPaused && Number.isFinite(strikeLeft) ? (strikeLeft > 0 ? ` · ${Math.ceil(strikeLeft / 1000)}s` : ' · 💥') : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {npcLine && <p className="text-[12px] text-red-200">{npcLine}</p>}
            </div>
          )}

          {showLog && (
            <div className="border-t border-white/10 px-3 py-2 space-y-1">
              {recent.length === 0 && <p className="text-[12px] text-white/45">Nothing yet.</p>}
              {recent.map(e => <p key={e.id} className="text-[11px] text-white/70">{eventLine(e)}</p>)}
            </div>
          )}
        </div>
      </div>

      {myFighter?.status === 'up' && (
        <div className="fixed left-0 right-0 z-[56] px-2" style={{ bottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          <div className="rounded-xl border border-white/15 bg-black/95 p-2 space-y-1">
            {aimingAtMe?.p && (() => {
              // Combat v2: the incoming card, with the attack's real countdown and what you can do about it.
              const p = aimingAtMe.p;
              const at = timeOf((aimingAtMe.f as unknown as { strike_at?: unknown }).strike_at);
              const leftMs = Number.isFinite(at) ? Math.max(0, at - clock) : 0;
              const share = Math.max(0, Math.min(1, leftMs / p.windupMs));
              const label = NPC_SKILL_INFO[p.type as NpcSkillType]?.label;
              return (
                <div className={cn('rounded-md border border-red-500/60 bg-red-950/80 px-2 py-1.5 space-y-1', leftMs <= 2000 && !isPaused && 'animate-pulse')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-red-100 truncate">⚠ {aimingAtMe.f.name}: {p.skill}{label && label !== p.skill ? ` (${label})` : ''}</span>
                    <span className="font-cinzel text-[16px] text-red-200 tabular-nums shrink-0">{isPaused ? '⏸' : leftMs <= 0 ? '💥' : `${Math.ceil(leftMs / 1000)}s`}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-red-500 transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-red-200/80">{incomingHint(p.type, aimingAtMe.f.name, !!M.cleanClash((aimingAtMe.f as unknown as { pending?: { clash?: unknown } }).pending?.clash) && !amPinned)}</p>
                </div>
              );
            })()}
            {preTarget && now - offset - preTarget.at < 60_000 && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-2">
                <span className="text-[12px] text-amber-100 truncate">🎯 Casting at {preTarget.targetName}: pick a spell</span>
                <button style={tap} className="min-h-[44px] px-2 text-[12px] text-white/70" onClick={() => onClearPreTarget?.()}>Cancel</button>
              </div>
            )}
            {!amPinned && cooldownLeft > 0 && <p className="text-[11px] text-center text-white/60">Ready in {cooldownLeft}s</p>}
            {!amPinned && <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={myResolve >= 100 ? 'text-amber-200' : 'text-white/70'}>{myResolve >= 100 ? 'Resolve: ready' : 'Resolve'}</span>
                <span className="text-white/70">{Math.round(myResolve)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full bg-amber-400 transition-[width] duration-500', myResolve >= 100 && 'animate-pulse')} style={{ width: `${myResolve}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className={duelReady ? 'text-red-200' : 'text-white/70'}>{duelReady ? 'Duel: ready' : 'Duel'}</span>
                <span className="text-white/70">{Math.round(myDuelCharge)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full bg-red-500 transition-[width] duration-500', duelReady && 'animate-pulse')} style={{ width: `${myDuelCharge}%` }} />
              </div>
              {(myFighter.perks?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {myFighter.perks.map(p => (
                    <span key={p} className={cn('rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100',
                      p === 'last_stand' && myFighter.last_stand_used && 'opacity-40 grayscale')}>
                      {PERK_LABELS[p] ?? p}
                    </span>
                  ))}
                </div>
              )}
            </div>}
            {!amPinned && duelReady && (
              <button style={tap} disabled={!canDuel} className={cn(btnRed, 'w-full font-cinzel tracking-wider animate-pulse disabled:animate-none')} onClick={() => {
                setFinish('knockout');
                if (npcUp.length === 1) setStep({ kind: 'duel-confirm', target: npcUp[0] });
                else setStep({ kind: 'duel-target' });
              }}>🤺 Duel!</button>
            )}
            {!amPinned && <div className={cn('grid gap-2', hasAllies ? 'grid-cols-4' : 'grid-cols-3')}>
              <button style={tap} disabled={!canAct || npcUp.length === 0} className={btnRed} onClick={() => {
                setFinish('knockout');
                if (npcUp.length === 1) setStep({ kind: 'attack', target: npcUp[0] });
                else setStep({ kind: 'attack-target' });
              }}>Attack</button>
              <button style={tap} disabled={!canAct} className={btnAmber} onClick={() => setStep({ kind: onOpenSpells ? 'cast-first' : 'cast-spell' })}>Cast</button>
              <button style={tap} disabled={!canAct || myResolve < 100} className={cn(btnPlain, 'flex-col gap-0 leading-tight')} onClick={async () => {
                if (myFighter.perks?.includes('battle_medic')) { setStep({ kind: 'second-wind-target' }); return; }
                const r = await combat.secondWind();
                if (r) { close(); showResult(r); }
              }}>
                <span>Second Wind</span>
                {myFighter.second_wind && <span className="text-[11px] opacity-70">{myFighter.second_wind}</span>}
              </button>
              {hasAllies && <button style={tap} disabled={!canAct} className={btnPlain} onClick={() => setStep({ kind: 'aid' })}>Aid Ally</button>}
            </div>}
            {!amPinned && onSelect && railsBlock}
          </div>
        </div>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the fight for everyone?</AlertDialogTitle>
            <AlertDialogDescription>NPCs stop attacking and the fight closes on every phone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep fighting</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void combat.endFight(); }}>End Fight</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {aimingAtMe && <div aria-hidden className="fixed inset-0 z-[57] pointer-events-none" style={{ boxShadow: 'inset 0 0 60px 12px hsl(0 84% 50% / 0.55)' }} />}
      {amPinned && myFighter?.status === 'up' && (() => {
        // v6 Tug & Slip: the struggle stage lives at the top level of the fragment so it covers the whole chat window
        // (the dock is its own fixed layer, so anything inside it could never rise above the combat top panel).
        const me = myFighter;
        if (!me) return null;
        const pinEvent = [...events].reverse().find(e => e.kind === 'pin' && e.target_user_id === currentUserId && e.actor_name !== me.name);
        return (
          <TugAndSlip
            npcName={pinEvent?.actor_name || null}
            pinnedUntil={pinnedUntil}
            struggle={M.cleanStruggle(((me as unknown as { minigame?: Record<string, unknown> | null }).minigame ?? {}).struggle)}
            serverTime={combat.serverTime}
            frozenAt={isPaused && Number.isFinite(combat.pausedAtMs) ? combat.pausedAtMs : null}
            onHeave={tapAt => combat.heave(tapAt)}
            onFree={() => setBurst({ kind: 'free', key: `local-${pinnedUntil}` })}
          />
        );
      })()}
      {(() => {
        // v6 Counter Clash: the ring for a big move aimed at me. Floats above any sheet; a pinned player can't clash.
        if (!aimingAtMe?.p || !myFighter || myFighter.status !== 'up' || amPinned || liveDuel || (!isActive && !isPaused)) return null;
        const chain = M.cleanClash((aimingAtMe.f as unknown as { pending?: { clash?: unknown } }).pending?.clash);
        const hitAt = timeOf((aimingAtMe.f as unknown as { strike_at?: unknown }).strike_at);
        if (!chain || !Number.isFinite(hitAt)) return null;
        const npcId = aimingAtMe.f.id;
        return (
          <CounterClashRing
            key={chain.id}
            skillName={aimingAtMe.p.skill}
            npcName={aimingAtMe.f.name}
            clash={chain}
            hitAt={hitAt}
            results={M.clashResultsOf((myFighter as unknown as { minigame?: unknown }).minigame, chain.id)}
            serverTime={combat.serverTime}
            frozenAt={isPaused && Number.isFinite(combat.pausedAtMs) ? combat.pausedAtMs : null}
            onTap={(side, tapAt) => combat.clash(npcId, side, tapAt)}
          />
        );
      })()}
      {duelLayer}
      {burst && <CombatBurst key={burst.key} kind={burst.kind} sub={burst.sub} />}
      {rolling && !result && <RollingCard />}
      {resultCard}
      {flashLayer}
      {sheet}
    </>
  );
}
