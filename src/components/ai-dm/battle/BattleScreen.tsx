// Pokémon-style battle screen: the full-screen shell that ties the stage, the battle feed and the
// command box to the live fight. It never writes a table: every move goes through the existing
// useNpcCombat actions or the one-tap tray, exactly as the old fight bar did.
// Plan: claude/POKEMON_BATTLE_PLAN.md.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { duelChargeOf, isAllyRow, isEnemyRow, resolveOf, type FighterRow, type NpcCombatApi } from '@/hooks/use-npc-combat';
import type { PartyNpcsApi } from '@/hooks/use-party-npcs';
import { setDiceRollBypass } from '@/lib/diceRollBus';
import { DUEL_CHARGE } from '@/lib/combatDuel';
import { FEED_STEP_MS, caps, linesForEvent, mergeFeed, pickDefaultTarget, type FeedLine } from '@/lib/battle-feed';
import { BattleStage, type StageFighter, type StageFlash, type StageLine } from './BattleStage';
import { BattleCommandBox, type AidOption, type BattleMove, type BattleTarget, type Finish } from './BattleCommandBox';
import { BattleIntro } from './BattleEndCard';
import type { CombatSelection, TrayEntry } from '../NpcCombatOverlay';
import './battle.css';

type Member = { user_id: string; character_name: string; character_status?: Record<string, unknown> };

export interface BattleScreenProps {
  combat: NpcCombatApi;
  roster: PartyNpcsApi;
  members: Member[];
  currentUserId: string | null;
  isHost: boolean;
  /** The overlay's clock: server time, frozen at the pause while paused. */
  now: number;
  clock: number;
  /** One-tap tray entries (weapons, spells, healing items) from Quick Actions. */
  tray: TrayEntry[];
  onTrayTap?: (id: string, targetIds?: string[]) => void;
  selection: CombatSelection | null;
  onSelect?: (next: CombatSelection | null) => void;
  allyPortraits?: Record<string, string | undefined>;
  /** Fallbacks when the tray hasn't loaded: weapons and healing items from the shared sheet. */
  weapons: { name: string; damage?: string }[];
  healItems: { name: string }[];
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
  /** Opens Quick Actions' spell list (target-first), for spells the tray doesn't list. */
  onOpenSpells?: (pre?: { targetId: string; targetName: string; finish: Finish }) => void;
  /** The overlay's existing confirm sheets. */
  onHuddle: () => void;
  onDuel: () => void;
  onSecondWind: () => void;
  onHostAdd: () => void;
  onEndFight: () => void;
  amPinned: boolean;
}

// ---------- small readers of fighter rows ----------
type Pending = { skill: string; targets: string[] };
function pendingOf(f: FighterRow): Pending | null {
  const p = (f as unknown as { pending?: unknown }).pending as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object' || typeof p.skill !== 'string') return null;
  const targets = Array.isArray(p.targets) ? p.targets.filter((t): t is string => typeof t === 'string') : [];
  return { skill: p.skill, targets };
}
function timeOf(v: unknown): number {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
}
function effectChips(f: FighterRow, now: number): string[] {
  const out: string[] = [];
  const secs = (until: unknown) => { const t = timeOf(until); return Number.isFinite(t) && t > now ? Math.ceil((t - now) / 1000) : 0; };
  const fmt = (s: number) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`);
  const list = Array.isArray(f.combat_effects) ? f.combat_effects as Array<Record<string, unknown>> : [];
  for (const e of list) {
    const left = secs(e?.until);
    const amt = Number(e?.amount);
    if (!left || !Number.isFinite(amt)) continue;
    if (e.kind === 'ac_bonus') out.push(`+${amt} AC ${fmt(left)}`);
    else if (e.kind === 'attack_bonus') out.push(`+${amt} HIT ${fmt(left)}`);
  }
  const thp = Number(f.temp_hp); const thpLeft = secs(f.temp_hp_until);
  if (Number.isFinite(thp) && thp > 0 && thpLeft) out.push(`+${thp} TEMP ${fmt(thpLeft)}`);
  const ward = Number(f.ward); const wardLeft = secs(f.ward_until);
  if (Number.isFinite(ward) && ward > 0 && wardLeft) out.push(`WARD ${Math.round(ward)} ${fmt(wardLeft)}`);
  return out;
}
const PERK_LABELS: Record<string, string> = {
  iron_lungs: 'IRON LUNGS', pain_fuel: 'PAIN FUEL', momentum: 'MOMENTUM',
  deep_breath: 'DEEP BREATH', battle_medic: 'BATTLE MEDIC', last_stand: 'LAST STAND',
};
const LOW_HP = 0.25;
const INTRO_WINDOW_MS = 8000;

export function BattleScreen(p: BattleScreenProps) {
  const { combat, roster, members, currentUserId, isHost, now, clock } = p;
  const { fighters, events, myFighter, isPaused, cooldownLeft } = combat;
  const [tucked, setTucked] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [hostMenu, setHostMenu] = useState(false);

  const enemyRows = fighters.filter(f => isEnemyRow(f));
  const standingEnemies = enemyRows.filter(f => f.status === 'up');
  const allyRows = fighters.filter(f => isAllyRow(f));
  const playerRows = fighters.filter(f => f.kind === 'player');
  const nameOf = (id: string) => fighters.find(x => x.id === id)?.name ?? '';
  const aimingAt = (f: FighterRow) => !!myFighter && f.status === 'up' && !!pendingOf(f)?.targets.includes(myFighter.id);
  const aimer = standingEnemies.find(aimingAt) ?? null;

  // ---------- the 3D dice stay out of the way while the battle screen is up (D2) ----------
  useEffect(() => {
    setDiceRollBypass(() => true);
    return () => setDiceRollBypass(null);
  }, []);

  // ---------- default enemy target ----------
  const selectedEnemy = p.selection?.side === 'enemy' ? p.selection.ids[0] ?? null : null;
  const targetId = pickDefaultTarget(
    enemyRows.map(f => ({ id: f.id, status: f.status, hp: f.hp, max_hp: f.max_hp, aimingAtMe: aimingAt(f) })),
    selectedEnemy,
  );
  const onSelect = p.onSelect;
  useEffect(() => {
    if (targetId && targetId !== selectedEnemy) onSelect?.({ side: 'enemy', ids: [targetId] });
  }, [targetId, selectedEnemy, onSelect]);

  // ---------- battle feed: new events become lines; one line every FEED_STEP_MS; a tap skips ----------
  const myName = myFighter?.name ?? members.find(m => m.user_id === currentUserId)?.character_name ?? null;
  const [queue, setQueue] = useState<FeedLine[]>([]);
  const [line, setLine] = useState<FeedLine | null>(null);
  const [flashes, setFlashes] = useState<StageFlash[]>([]);
  const [intro, setIntro] = useState<string | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(events.map(e => e.id));
      // Intro: a fight that started moments ago, once per fight on this phone.
      const start = events.find(e => e.kind === 'start');
      const startedAt = start ? timeOf(start.created_at) : NaN;
      const key = combat.fight ? `battle-intro:${combat.fight.id}` : '';
      let shown = false;
      try { shown = !!key && sessionStorage.getItem(key) === '1'; } catch { /* storage blocked */ }
      if (start && key && !shown && Number.isFinite(startedAt) && now - startedAt < INTRO_WINDOW_MS) {
        try { sessionStorage.setItem(key, '1'); } catch { /* storage blocked */ }
        setIntro(linesForEvent(start)[0]?.text ?? 'The battle begins!');
      }
      return;
    }
    const fresh = events.filter(e => !seenRef.current!.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach(e => seenRef.current!.add(e.id));
    const lines = fresh.flatMap(e => linesForEvent(e, { myName, myUserId: currentUserId }));
    if (lines.length) setQueue(q => mergeFeed(q, lines));
    if (fresh.some(e => e.kind === 'start')) {
      const key = combat.fight ? `battle-intro:${combat.fight.id}` : '';
      try { if (key && sessionStorage.getItem(key) !== '1') { sessionStorage.setItem(key, '1'); setIntro(linesForEvent(fresh.find(e => e.kind === 'start')!)[0]?.text ?? null); } } catch { /* storage blocked */ }
    }
    // Hits and heals: shake the sprite and pop the number.
    const fl: StageFlash[] = [];
    for (const e of fresh) {
      const d = Number(e.hp_delta) || 0;
      if (!d) continue;
      const who = (e.target_user_id && fighters.find(f => f.kind === 'player' && f.user_id === e.target_user_id))
        || fighters.find(f => f.name === e.target_name);
      if (who) fl.push({ id: who.id, kind: d < 0 ? 'hit' : 'heal', amount: Math.abs(d), key: e.id });
    }
    if (fl.length) {
      setFlashes(prev => [...prev, ...fl].slice(-8));
      const keys = new Set(fl.map(x => x.key));
      setTimeout(() => setFlashes(prev => prev.filter(x => !keys.has(x.key))), 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // NPC fight speech (D3): a new Live Table line from an NPC in this fight joins the feed.
  const speechSeen = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const lines = combat.npcLines ?? {};
    // Lines spoken before the battle screen opened stay in the Live Table only.
    if (speechSeen.current === null) {
      speechSeen.current = Object.fromEntries(Object.entries(lines).map(([id, l]) => [id, l.at]));
      return;
    }
    const inFight = new Map(fighters.filter(f => f.kind === 'npc' && f.npc_id).map(f => [f.npc_id as string, f.name]));
    const fresh: FeedLine[] = [];
    for (const [npcId, l] of Object.entries(lines)) {
      const name = inFight.get(npcId);
      if (!name || (speechSeen.current[npcId] ?? 0) >= l.at) continue;
      speechSeen.current[npcId] = l.at;
      fresh.push({ id: `say:${npcId}:${l.at}`, text: `${caps(name)}: "${l.text}"`, tone: 'neutral', priority: 0 });
    }
    if (fresh.length) setQueue(q => mergeFeed(q, fresh));
  }, [combat.npcLines, fighters]);

  useEffect(() => {
    if (line || queue.length === 0) return;
    setLine(queue[0]);
    setQueue(q => q.slice(1));
  }, [line, queue]);
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setLine(null), FEED_STEP_MS);
    return () => clearTimeout(t);
  }, [line]);
  const skipFeed = useCallback(() => setLine(null), []);

  // ---------- chat mode: the battle tucks away; it comes back on its own when it matters ----------
  const [seenChat, setSeenChat] = useState(combat.chatSeq ?? 0);
  useEffect(() => { if (tucked) setSeenChat(combat.chatSeq ?? 0); }, [tucked, combat.chatSeq]);
  const unread = Math.max(0, (combat.chatSeq ?? 0) - seenChat);
  const aimKey = aimer ? `${aimer.id}:${String((aimer as unknown as { strike_at?: unknown }).strike_at ?? '')}` : '';
  const myStatus = myFighter?.status ?? null;
  useEffect(() => {
    if (aimKey || p.amPinned || (myStatus && myStatus !== 'up')) setTucked(false);
  }, [aimKey, p.amPinned, myStatus]);

  // ---------- stage data ----------
  const strikeLine = (f: FighterRow): StageLine | null => {
    const pend = f.status === 'up' ? pendingOf(f) : null;
    if (pend) {
      const at = timeOf((f as unknown as { strike_at?: unknown }).strike_at);
      const left = Number.isFinite(at) ? at - now : NaN;
      const who = pend.targets.filter(t => t !== f.id).map(nameOf).filter(Boolean).map(caps).join(', ');
      const secs = isPaused || !Number.isFinite(left) ? '' : left > 0 ? ` · ${Math.ceil(left / 1000)}s` : ' · NOW';
      return { text: `▼ ${caps(pend.skill)}${who ? ` at ${who}` : ''}${secs}`, tone: 'warn', blink: aimingAt(f) || (Number.isFinite(left) && left <= 2000) };
    }
    const lastIntent = [...events].reverse().find(e => e.kind === 'intent' && e.actor_name === f.name);
    const intentAt = lastIntent ? timeOf(lastIntent.created_at) : NaN;
    if (Number.isFinite(intentAt) && now - intentAt < 8000 && (combat.lastLineAt[f.npc_id ?? ''] ?? 0) < intentAt) return { text: 'typing…', tone: 'muted', blink: true };
    const next = timeOf(f.next_action_at);
    if (f.status === 'up' && !isPaused && Number.isFinite(next)) return { text: `Acts in ${Math.max(0, Math.ceil((next - now) / 1000))}s`, tone: 'muted' };
    return null;
  };
  const npcStage = (f: FighterRow): StageFighter => {
    const npc = f.npc_id ? roster.byId.get(f.npc_id) : undefined;
    const speed = (npc?.combat_stats as { speed?: string } | null | undefined)?.speed;
    return {
      id: f.id, name: f.name, hp: f.hp, maxHp: f.max_hp, status: f.status,
      portrait: npc?.portrait_url ?? null, tag: speed ? speed.toUpperCase() : null,
      line: strikeLine(f), chips: effectChips(f, now), ally: isAllyRow(f),
    };
  };
  const playerStage = (f: FighterRow): StageFighter => {
    const m = members.find(x => x.user_id === f.user_id);
    const lvl = Number((m?.character_status as { level?: unknown } | undefined)?.level);
    const pinT = timeOf((f as unknown as { pinned_until?: unknown }).pinned_until);
    return {
      id: f.id, name: f.name, hp: f.hp, maxHp: f.max_hp, status: f.status,
      portrait: f.user_id ? p.allyPortraits?.[f.user_id] ?? null : null,
      level: Number.isFinite(lvl) && lvl > 0 ? lvl : null,
      chips: effectChips(f, now), deathOk: f.death_successes, deathBad: f.death_failures,
      pinned: Number.isFinite(pinT) && pinT > clock,
    };
  };
  const meStage: StageFighter | null = myFighter ? {
    ...playerStage(myFighter),
    resolve: Math.round(resolveOf(myFighter, clock)),
    duel: Math.round((duelChargeOf(myFighter) / DUEL_CHARGE.max) * 100),
    perks: (myFighter.perks ?? []).map(k => ({ label: PERK_LABELS[k] ?? k.toUpperCase(), used: k === 'last_stand' && !!myFighter.last_stand_used })),
  } : null;
  const enemiesStage = enemyRows.map(npcStage);
  const partyStage = [...playerRows.filter(f => f.id !== myFighter?.id).map(playerStage), ...allyRows.map(npcStage)];

  // ---------- moves ----------
  const tray = useMemo(() => p.tray ?? [], [p.tray]);
  const moves: BattleMove[] = useMemo(() => {
    const fromTray = tray.map<BattleMove>(t => ({
      id: t.id, name: t.name, row: t.row, side: t.side, sub: t.sub,
      level: t.row === 'spell' ? t.level ?? null : null, school: t.school ?? null, area: !!t.area,
    }));
    const out = [...fromTray];
    if (!fromTray.some(m => m.row === 'attack')) {
      const ws = p.weapons.length ? p.weapons : [{ name: 'Unarmed strike', damage: '' }];
      ws.forEach((w, i) => out.push({ id: `w:${i}:${w.name}`, name: w.name, row: 'attack', side: 'enemy', sub: w.damage || undefined }));
    }
    if (!fromTray.some(m => m.row === 'item')) {
      p.healItems.forEach((it, i) => out.push({ id: `i:${i}:${it.name}`, name: it.name, row: 'item', side: 'ally', sub: 'Healing' }));
    }
    return out;
  }, [tray, p.weapons, p.healItems]);
  const fromTray = (id: string) => tray.some(t => t.id === id);

  const myId = myFighter?.id ?? null;
  const onUse = (move: BattleMove, ids: string[], finish?: Finish) => {
    const first = ids[0];
    if (!first) return;
    if (move.row === 'attack') {
      // Weapons go straight to the referee, so Knock out / Finish is honored.
      const unarmed = move.id.startsWith('w:') && !p.weapons.length;
      void combat.attack(first, { weaponName: unarmed ? undefined : move.name, finish: finish ?? 'knockout' });
      return;
    }
    if (fromTray(move.id) && p.onTrayTap) { p.onTrayTap(move.id, ids); return; }
    if (move.row === 'item') {
      if (first === myId) { p.onUseConsumableByName?.(move.name); return; }
      void combat.givePotion(first, move.name).then(r => { if (r) p.onUseConsumableByName?.(move.name, 1); });
      return;
    }
    p.onOpenSpells?.({ targetId: first, targetName: nameOf(first), finish: finish ?? 'knockout' });
  };

  const potions = p.healItems.filter(i => /heal/i.test(i.name) && /potion|elixir|draught|philter/i.test(i.name));
  const aidFor = (friendId: string): AidOption[] => {
    const f = fighters.find(x => x.id === friendId);
    if (!f || f.status === 'dead') return [];
    const out: AidOption[] = [];
    if (f.kind === 'player' && f.status === 'down' && f.id !== myId) {
      out.push({ key: 'stabilize', label: 'STABILIZE', sub: 'Medicine DC 10', run: () => { void combat.stabilize(f.id); } });
    }
    if (f.kind === 'player' || (isAllyRow(f) && f.status === 'up')) {
      for (const it of potions) {
        out.push({ key: `give:${it.name}`, label: `GIVE ${it.name.toUpperCase()}`, run: () => {
          void combat.givePotion(f.id, it.name).then(r => {
            if (!r) return;
            p.onUseConsumableByName?.(it.name, 1);
          });
        } });
      }
    }
    return out;
  };

  const asTarget = (f: FighterRow, me = false): BattleTarget => ({
    id: f.id, name: f.name, me,
    sub: f.status === 'down' ? 'DOWN' : f.status === 'stable' ? 'STABLE' : `${f.hp}/${f.max_hp}`,
    low: f.max_hp > 0 && f.hp / f.max_hp <= LOW_HP,
  });
  const enemyTargets = standingEnemies.map(f => asTarget(f));
  const friendTargets: BattleTarget[] = [
    ...(myFighter && myFighter.status !== 'dead' ? [asTarget(myFighter, true)] : []),
    ...playerRows.filter(f => f.id !== myId && f.status !== 'dead').map(f => asTarget(f)),
    ...allyRows.filter(f => f.status === 'up').map(f => asTarget(f)),
  ];
  const targetRow = targetId ? fighters.find(f => f.id === targetId) : undefined;

  // ---------- locks, special button, top strip ----------
  const isHuddle = combat.pauseKind === 'huddle';
  const huddleLeft = isHuddle && Number.isFinite(combat.huddleUntilMs) ? Math.max(0, Math.ceil((combat.huddleUntilMs - now) / 1000)) : 0;
  let locked: string | null = null;
  if (isHuddle) locked = `HUDDLE! Plan your move. 0:${String(huddleLeft).padStart(2, '0')}`;
  else if (isPaused) locked = 'The battle is paused.';
  else if (p.amPinned) locked = `${caps(myName)} is pinned! Break free!`;
  else if (myStatus === 'down') locked = `${caps(myName)} is down…`;
  else if (myStatus === 'stable') locked = `${caps(myName)} is stable at 0 HP.`;
  else if (myStatus === 'dead') locked = `${caps(myName)} has fallen. The host can revive them.`;
  const lockedControls = isHost && (isHuddle || isPaused) ? (
    <div className="grid grid-cols-2 gap-1.5">
      {isHuddle && <button type="button" disabled={combat.busy} onClick={() => { void combat.pause(); }} className="min-h-[48px] rounded-lg text-[14px] font-bold disabled:opacity-40" style={{ background: 'var(--b-cream)', border: '3px solid var(--b-edge)' }}>HOLD</button>}
      <button type="button" disabled={combat.busy} onClick={() => { void combat.resume(); }} className={cn('min-h-[48px] rounded-lg text-[14px] font-bold disabled:opacity-40', !isHuddle && 'col-span-2')} style={{ background: 'var(--b-gold)', border: '3px solid var(--b-edge)' }}>{isHuddle ? 'END HUDDLE' : 'RESUME'}</button>
    </div>
  ) : undefined;

  const resolveNow = meStage?.resolve ?? 0;
  const duelReady = (meStage?.duel ?? 0) >= 100;
  const canDuel = combat.isActive && !combat.busy && !p.amPinned && standingEnemies.length > 0;
  const special = !myFighter || myFighter.status !== 'up' ? null : duelReady
    ? { label: 'DUEL!', sub: 'Your Duel bar is full', tone: 'duel' as const, disabled: !canDuel, onPress: p.onDuel }
    : { label: '2ND WIND', sub: resolveNow >= 100 ? (myFighter.second_wind ?? 'Ready') : `RSLV ${resolveNow}/100`, tone: 'wind' as const, disabled: resolveNow < 100, reason: resolveNow < 100 ? 'Needs full Resolve' : undefined, onPress: p.onSecondWind };
  const canHuddle = combat.isActive && !!myFighter && myFighter.status !== 'dead' && !combat.myHuddleUsed;
  const idleText = myFighter || !myName ? `What will ${caps(myName) || 'you'} do?` : `Pick a move to join the fight!`;

  const log = useMemo(() => [...events].reverse().slice(0, 25).flatMap(e => linesForEvent(e, { myName, myUserId: currentUserId })), [events, myName, currentUserId]);

  // ---------- chat mode: only a pill ----------
  if (tucked) {
    const t = targetRow;
    return (
      <button type="button" onClick={() => setTucked(false)}
        className="battle-root fixed right-2 z-[56] min-h-[44px] px-3 rounded-lg flex items-center gap-2 text-[13px] font-bold text-white"
        style={{ top: 'calc(72px + env(safe-area-inset-top))', background: '#a2321f', border: '3px solid var(--b-edge)', boxShadow: '3px 3px 0 #1c1810' }}>
        <span>BACK TO BATTLE</span>
        {t && <span className="font-semibold opacity-90">{caps(t.name)} {t.hp}/{t.max_hp}</span>}
        {cooldownLeft > 0 && <span className="opacity-80">{cooldownLeft}s</span>}
      </button>
    );
  }

  const title = isHuddle ? `HUDDLE 0:${String(huddleLeft).padStart(2, '0')}` : isPaused ? 'PAUSED' : 'BATTLE!';
  return (
    <div className="battle-root fixed inset-0 z-[56] flex flex-col" style={{ background: 'var(--b-night)', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Top strip */}
      <div className="h-11 shrink-0 flex items-center gap-1 pl-3 pr-1" style={{ color: '#f4ecd8' }}>
        <span className={cn('flex-1 text-[15px] font-bold tracking-[0.12em]', (isHuddle || isPaused) && 'battle-blink')} style={{ color: isHuddle || isPaused ? 'var(--b-gold)' : '#ff8a72' }}>{title}</span>
        {combat.connection !== 'live' && <span className="text-[11px] battle-blink" style={{ color: 'var(--b-gold)' }}>RECONNECTING…</span>}
        {canHuddle && <button type="button" onClick={p.onHuddle} className="min-h-[44px] px-2.5 text-[13px] font-semibold" style={{ color: 'var(--b-gold)' }}>HUDDLE</button>}
        <button type="button" onClick={() => setShowLog(v => !v)} aria-pressed={showLog} className="min-h-[44px] px-2.5 text-[13px] font-semibold" style={{ color: '#cfd6ec' }}>LOG</button>
        {isHost && (
          <button type="button" aria-label="Host controls" aria-expanded={hostMenu} onClick={() => setHostMenu(v => !v)} className="w-11 h-11 flex items-center justify-center" style={{ color: '#cfd6ec' }}>
            <MoreVertical className="w-5 h-5" />
          </button>
        )}
      </div>
      {isHost && hostMenu && (
        <div className="shrink-0 grid grid-cols-3 gap-1.5 px-2 pb-2">
          {isPaused
            ? <button type="button" disabled={combat.busy} onClick={() => { setHostMenu(false); void combat.resume(); }} className="min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-40" style={{ background: 'var(--b-gold)', border: '3px solid var(--b-edge)' }}>RESUME</button>
            : <button type="button" disabled={combat.busy} onClick={() => { setHostMenu(false); void combat.pause(); }} className="min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-40" style={{ background: 'var(--b-gold)', border: '3px solid var(--b-edge)' }}>PAUSE</button>}
          <button type="button" disabled={combat.busy} onClick={() => { setHostMenu(false); p.onHostAdd(); }} className="min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-40" style={{ background: 'var(--b-cream)', border: '3px solid var(--b-edge)' }}>ADD NPC</button>
          <button type="button" disabled={combat.busy} onClick={() => { setHostMenu(false); p.onEndFight(); }} className="min-h-[44px] rounded-lg text-[13px] font-bold text-white disabled:opacity-40" style={{ background: '#a2321f', border: '3px solid var(--b-edge)' }}>END FIGHT</button>
        </div>
      )}

      {/* Stage (with the log over it when open) */}
      <div className="relative flex-1 min-h-[300px]">
        <BattleStage
          enemies={enemiesStage}
          party={partyStage}
          me={meStage}
          targetId={targetId}
          onPickEnemy={id => onSelect?.({ side: 'enemy', ids: [id] })}
          flashes={flashes}
        />
        {showLog && (
          <div className="absolute inset-2 battle-text p-3 overflow-y-auto overscroll-contain z-[4]" role="log" aria-label="Fight log">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[15px] font-bold">FIGHT LOG</span>
              <button type="button" onClick={() => setShowLog(false)} className="min-h-[40px] px-3 rounded text-[13px] font-bold text-white" style={{ background: '#4a4160' }}>CLOSE</button>
            </div>
            {log.length === 0 && <p className="text-[13px]">Nothing yet.</p>}
            {log.map(l => <p key={l.id} className="text-[13px] leading-snug">{l.text}</p>)}
          </div>
        )}
        {intro && <BattleIntro text={intro} onDone={() => setIntro(null)} />}
      </div>

      {/* Text box + command menu */}
      <div className="shrink-0 px-2 pt-2" style={{ background: 'var(--b-panel)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
        <BattleCommandBox
          feed={line ? { text: line.text, tone: line.tone } : null}
          onSkipFeed={skipFeed}
          idleText={idleText}
          rolling={combat.rolling}
          locked={locked}
          lockedControls={lockedControls}
          cooldownLeft={cooldownLeft}
          cooldownMax={8}
          moves={moves}
          enemyTarget={targetRow && targetRow.status === 'up' ? asTarget(targetRow) : null}
          enemies={enemyTargets}
          friends={friendTargets}
          onUse={onUse}
          aidFor={aidFor}
          special={special}
          onChat={() => { setShowLog(false); setTucked(true); }}
          unread={unread}
        />
      </div>
    </div>
  );
}
