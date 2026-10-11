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
import { resolveOf, type FighterRow, type FightEventRow, type NpcCombatApi } from '@/hooks/use-npc-combat';
import type { PartyNpc, PartyNpcsApi } from '@/hooks/use-party-npcs';
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
  pendingCast?: { card: ActionCard; key: string } | null;
  onPendingCastDone?: () => void;
  onOpenSpells?: () => void;
}

const SPEED_SECONDS: Record<string, number> = { trivial: 120, easy: 90, medium: 60, hard: 40, deadly: 20 };
const tap = { touchAction: 'manipulation' as const };
const btn = 'min-h-[44px] rounded-lg border text-[13px] px-3 flex items-center justify-center gap-1.5 disabled:opacity-40';
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
      <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
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
const SKILL_EVENT_ICON: Record<string, string> = { intent: '⚠', mend: '✚', shield: '🛡', rally: '📯', pin: '📌', retreat: '🏃' };
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
type PendingSkill = { skill: string; type: string; targets: string[] };
function pendingOf(f: FighterRow): PendingSkill | null {
  const p = (f as unknown as { pending?: unknown }).pending as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object' || typeof p.skill !== 'string') return null;
  const targets = Array.isArray(p.targets) ? p.targets.filter((t): t is string => typeof t === 'string') : [];
  return { skill: p.skill, type: typeof p.type === 'string' ? p.type : '', targets };
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
  | { kind: 'host-add' }
  | { kind: 'card-target'; card: ActionCard; key: string }
  | { kind: 'second-wind-target' }
  | null;

export function NpcCombatOverlay({ combat, roster, members, currentUserId, isHost, onUseConsumableByName, pendingCast, onPendingCastDone, onOpenSpells }: Props) {
  const { fight, fighters, events, fallen, myFighter, iHaveFallen, isActive, isPaused, isEnded, busy, cooldownLeft } = combat;
  const me = members.find(m => m.user_id === currentUserId);
  const qa = useMemo(() => quickActionsOf(me), [me]);
  const [step, setStep] = useState<Step>(null);
  const [weapon, setWeapon] = useState<string | null>(null);
  const [finish, setFinish] = useState<Finish>('knockout');
  const [finishTarget, setFinishTarget] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [hostMenu, setHostMenu] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [flash, setFlash] = useState(false);
  const [npcLine, setNpcLine] = useState<string | null>(null);
  const [hiddenEnd, setHiddenEnd] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const open = !!fight && !isEnded;
  const npcFighters = fighters.filter(f => f.kind === 'npc');
  const playerFighters = fighters.filter(f => f.kind === 'player');
  const npcUp = npcFighters.filter(f => f.status === 'up');

  const attackable = useMemo(
    () => roster.onStage.filter(n => n.combat_stats && !n.combat_state && !n.player_user_id),
    [roster.onStage],
  );

  // Countdown rings tick every 500 ms while a fight is running.
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [isActive]);

  // New events: a hit on me flashes the screen; an NPC attack shows a line for 4 s.
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
  }, [events, currentUserId]);
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
    if (wasCard) onPendingCastDone?.();
  };

  // A spell card posted from Quick Actions during a fight: ask who it lands on (once per card).
  const handledCastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingCast || handledCastRef.current === pendingCast.key) return;
    handledCastRef.current = pendingCast.key;
    if (isActive && myFighter?.status === 'up') {
      setFinish('knockout');
      setStep({ kind: 'card-target', card: pendingCast.card, key: pendingCast.key });
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
          <HpBar hp={f.hp} max={f.max_hp} color={f.kind === 'npc' ? 'bg-red-500' : 'bg-green-500'} thin />
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
    const list = intent === 'heal' ? playerFighters.filter(f => f.status !== 'dead') : npcUp;
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
    const rollLine = isHeal
      ? `Heals ${Number.isFinite(amt) ? amt : 0}`
      : card.d20 != null
        ? `d20 ${card.d20} → ${card.attackTotal ?? '?'} · ${Number.isFinite(dmg) ? dmg : 0} damage`
        : `${Number.isFinite(dmg) ? dmg : 0} damage (they make a saving throw)`;
    const targets = isHeal
      ? playerFighters.filter(f => f.status !== 'dead')
      : (Number.isFinite(dmg) && dmg > 0 ? npcUp : []);
    const pick = async (t: FighterRow, fin?: Finish) => {
      const r = await combat.castFromCard(t.id, card, fin);
      if (r) { showResult(r); close(); }
    };
    const chosenLow = finishTarget && targets.find(t => t.id === finishTarget);
    title = `Target for ${card.action}`;
    body = (
      <div className="space-y-2">
        <p className="text-[13px] text-white/75">{rollLine}</p>
        {waiting && <p className="text-[11px] text-white/60">{busy ? 'Working…' : `Ready in ${cooldownLeft}s`}</p>}
        {chosenLow ? (
          <div className="space-y-3">
            <p className="text-[13px] text-white/85">{chosenLow.name}</p>
            <FinishToggle value={finish} onChange={setFinish} />
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
      <div className="rounded-2xl border border-white/15 bg-black/80 backdrop-blur px-6 py-4 text-center space-y-1">
        {result.lines.map((l, i) => <p key={i} className={cn(i === 0 ? 'text-[13px] text-white/60' : 'font-cinzel text-[20px] text-white')}>{l}</p>)}
      </div>
    </div>
  );

  const flashLayer = flash && <div className="fixed inset-0 z-[58] pointer-events-none" style={{ boxShadow: 'inset 0 0 60px 12px hsl(0 84% 50% / 0.65)' }} />;

  // ---------- D. just ended ----------
  if (fight && isEnded) {
    if (hiddenEnd === fight.id) return <>{sheet}</>;
    const endEv = [...events].reverse().find(e => e.kind === 'end');
    const label = fight.outcome === 'victory' ? 'Victory' : fight.outcome === 'defeat' ? 'Defeat' : 'Fight ended';
    const tone = fight.outcome === 'victory' ? 'border-green-500/40 text-green-200' : fight.outcome === 'defeat' ? 'border-red-500/40 text-red-200' : 'border-white/15 text-white/70';
    return (
      <>
        <div className={cn('fixed left-2 right-2 top-16 z-[56] rounded-xl border bg-black/80 backdrop-blur p-3 space-y-2', tone)}>
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
          <div className="fixed left-3 z-[55] max-w-[calc(100%-24px)] rounded-full border border-white/15 bg-black/75 backdrop-blur px-3 py-2 text-[12px] text-white/75" style={{ bottom: 150 }}>
            💀 {me.character_name} has fallen. The host can revive them.
          </div>
        )}
        {showPill && !iHaveFallen && (
          <button
            style={{ ...tap, bottom: 150 }}
            className="fixed left-3 z-[55] min-h-[44px] px-4 rounded-full border border-red-500/50 bg-red-950/80 backdrop-blur text-[14px] text-red-100 shadow-lg"
            onClick={() => setStep({ kind: 'start-list' })}
          >
            ⚔ Fight
          </button>
        )}
        {iHaveFallen && isHost && fallen.length > 0 && (
          <button
            style={{ ...tap, bottom: 200 }}
            className="fixed left-3 z-[55] min-h-[44px] px-4 rounded-full border border-red-500/50 bg-red-950/80 backdrop-blur text-[14px] text-red-100 shadow-lg"
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
  const pinnedUntil = timeOf((myFighter as unknown as { pinned_until?: unknown })?.pinned_until);
  const pinnedLeft = Number.isFinite(pinnedUntil) ? Math.ceil((pinnedUntil - now) / 1000) : 0;
  const amPinned = pinnedLeft > 0;
  const aimingAtMe = myFighter
    ? npcFighters.map(f => ({ f, p: pendingOf(f) })).find(x => x.f.status === 'up' && x.p?.targets.includes(myFighter.id)) ?? null
    : null;
  const otherDown = playerFighters.some(f => f.status === 'down' && f.user_id !== currentUserId);
  const canAct = isActive && !busy && cooldownLeft <= 0 && !amPinned;
  const myResolve = resolveOf(myFighter, now);
  const recent = [...events].reverse().slice(0, 20);

  return (
    <>
      <div className="fixed left-0 right-0 top-14 z-[56] px-2 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-red-500/30 bg-black/80 backdrop-blur max-h-[45vh] overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className={cn('font-cinzel text-[14px] flex-1', isPaused ? 'text-amber-300' : 'text-red-300')}>{isPaused ? '⏸ PAUSED' : '⚔ COMBAT'}</span>
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
                const strikeProgress = Number.isFinite(strikeLeft) ? Math.max(0, Math.min(1, 1 - strikeLeft / 8000)) : 0;
                const wardAmt = Number((f as unknown as { ward?: unknown }).ward);
                const wardUntil = timeOf((f as unknown as { ward_until?: unknown }).ward_until);
                const warded = Number.isFinite(wardAmt) && wardAmt > 0 && Number.isFinite(wardUntil) && wardUntil > now;
                const pendTargets = pend ? pend.targets.filter(t => t !== f.id).map(t => fighters.find(x => x.id === t)?.name).filter(Boolean) as string[] : [];
                return (
                  <div key={f.id} className={cn('flex items-center gap-2', out && 'opacity-50 grayscale')}>
                    {npc ? <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-8 h-8 text-sm" /> : <span className="w-8 h-8" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-white/90 truncate">{f.name}</span>
                        <span className="text-[11px] text-white/60 shrink-0">
                          {warded && <span className="mr-1 text-sky-200">🛡 {Math.round(wardAmt)}</span>}
                          {f.status === 'ko' ? '💤 Knocked out' : f.status === 'dead' ? '💀 Dead' : f.status === 'fled' ? '🏃 Fled' : `${f.hp}/${f.max_hp}`}
                        </span>
                      </div>
                      <HpBar hp={f.hp} max={f.max_hp} />
                      {pend && (
                        <p className={cn('text-[11px] text-red-300 truncate', Number.isFinite(strikeLeft) && strikeLeft <= 2000 && 'animate-pulse text-red-200 font-semibold')}>
                          → {pendTargets.length ? `${pendTargets.join(', ')}: ${pend.skill}` : pend.skill}
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
          <div className="rounded-xl border border-white/15 bg-black/85 backdrop-blur p-2 space-y-1">
            {aimingAtMe?.p && (
              <p className="rounded-md border border-red-500/50 bg-red-950/70 px-2 py-1 text-[12px] text-center text-red-100 animate-pulse">
                ⚠ {aimingAtMe.f.name} is aiming {aimingAtMe.p.skill} at you!
              </p>
            )}
            {amPinned && <p className="text-[12px] text-center text-amber-200">📌 Pinned: {pinnedLeft}s</p>}
            {cooldownLeft > 0 && <p className="text-[11px] text-center text-white/60">Ready in {cooldownLeft}s</p>}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={myResolve >= 100 ? 'text-amber-200' : 'text-white/70'}>{myResolve >= 100 ? 'Resolve: ready' : 'Resolve'}</span>
                <span className="text-white/70">{Math.round(myResolve)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full bg-amber-400 transition-[width] duration-500', myResolve >= 100 && 'animate-pulse')} style={{ width: `${myResolve}%` }} />
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
            </div>
            <div className={cn('grid gap-2', otherDown ? 'grid-cols-4' : 'grid-cols-3')}>
              <button style={tap} disabled={!canAct || npcUp.length === 0} className={btnRed} onClick={() => {
                setFinish('knockout');
                if (npcUp.length === 1) setStep({ kind: 'attack', target: npcUp[0] });
                else setStep({ kind: 'attack-target' });
              }}>Attack</button>
              <button style={tap} disabled={!canAct} className={btnAmber} onClick={() => { if (onOpenSpells) onOpenSpells(); else setStep({ kind: 'cast-spell' }); }}>Cast</button>
              <button style={tap} disabled={!canAct || myResolve < 100} className={cn(btnPlain, 'flex-col gap-0 leading-tight')} onClick={async () => {
                if (myFighter.perks?.includes('battle_medic')) { setStep({ kind: 'second-wind-target' }); return; }
                const r = await combat.secondWind();
                if (r) { close(); showResult(r); }
              }}>
                <span>Second Wind</span>
                {myFighter.second_wind && <span className="text-[11px] opacity-70">{myFighter.second_wind}</span>}
              </button>
              {otherDown && <button style={tap} disabled={!canAct} className={btnPlain} onClick={() => setStep({ kind: 'stabilize' })}>Stabilize</button>}
            </div>
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
      {resultCard}
      {flashLayer}
      {sheet}
    </>
  );
}
