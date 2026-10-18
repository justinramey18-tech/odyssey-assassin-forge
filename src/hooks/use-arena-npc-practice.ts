import { DEFAULT_NPC_SOCIAL_STATS, sanitizeNpcSocialStats } from "@/lib/live-npcs";
// Arena practice: a local fight that drives the real NpcCombatOverlay.
// The real useNpcCombat / usePartyNpcs run with no party (inert) and supply the
// exact return types; local fight rows, timers and rules are layered on top.
// Mechanics are the Arena's existing practice rules (cadence, swings, Counter
// Clash, Pin, Duel, AI voice). Nothing here calls the server or writes a row.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNpcCombat, type NpcCombatApi, type FightRow, type FighterRow, type FightEventRow } from '@/hooks/use-npc-combat';
import { usePartyNpcs, type PartyNpc, type NpcBuildDraft, type NpcGuideFields, type NpcMemoryNote, type NpcAttitudeRow, type NpcCombatStats } from '@/hooks/use-party-npcs';
import { supabase } from '@/integrations/supabase/client';
import { readableFunctionError, cleanNpcName } from '@/lib/live-npcs';
import { foeFromNpc } from '@/lib/arena/arenaFoe';
import type { CharacterContext } from '@/components/oracle/types';
import type { ActionCard } from '@/lib/roundChatActionCard';
import type { DuelVerdict } from '@/components/ai-dm/DuelWheel';
import type { Json } from '@/integrations/supabase/types';
import { emptyStats, gauntletFoe, type Foe, type ArenaStats } from '@/components/arena/ArenaPractice';
import * as M from '@/lib/combatMinigames';
import * as DU from '@/lib/combatDuel';
import { buildSparPrompt, sparLine, type SparTurn } from '@/lib/arena/arenaAi';
import type { ArenaAppendLine } from '@/hooks/use-arena-round-chat';
import { cleanPlayer, type SparringNet, type SparringPlayer } from '@/lib/arena/sparringNet';

export type NpcRosterApi = ReturnType<typeof usePartyNpcs>;
type Finish = 'knockout' | 'kill';

const PARTY = 'arena-practice';
const FIGHT_ID = 'arena-fight';
const NPC_PREFIX = 'arena-npc-';
const npcRow = (i: number) => `${NPC_PREFIX}${i}`;
const npcIdOf = (i: number) => `arena-foe-${i}`;
const isNpcRow = (id: string) => id.startsWith(NPC_PREFIX);
const prow = (uid: string) => `arena-player-${uid}`;
const isPlayerRow = (id: string) => id.startsWith('arena-player-');
const ACTION_COOLDOWN_MS = 8000;
const PIN_MS = 30000;
const GAP: Record<DU.DuelSpeed, number> = { trivial: 16000, easy: 14000, medium: 12000, hard: 10000, deadly: 8000 };
const TAUNTS = ['Is that all you have?', 'Again! Faster!', 'Watch my shoulder — no, my feet!', 'You telegraph everything.', 'Good. Now defend.', 'Keep your guard up!'];
const HURT = ['Ngh — a fair hit.', 'Better!', 'That one stung.', 'You are learning.'];

const roll: M.Roller = (s) => 1 + Math.floor(Math.random() * s);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const num = (v: unknown, f: number) => (Number.isFinite(Number(v)) ? Number(v) : f);
const iso = (ms: number) => new Date(ms).toISOString();
const asJson = (v: object): Json => JSON.parse(JSON.stringify(v)) as Json;
const objOf = (v: Json | null | undefined): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** How the practice opponent behaves. */
export type ArenaDrillKind = 'standard' | 'dummy' | 'sparring' | 'clash' | 'pin' | 'duel';

const DRILL_LINES: Partial<Record<ArenaDrillKind, string[]>> = {
  clash: ['Again — watch the swing.', 'Read it. Counter it.', 'Here it comes!'],
  pin: ['Break this hold!', 'Pull! Pull harder!', 'You are caught again.'],
  duel: ['Steel to steel. Again.', 'Ready your blade.', 'Once more.'],
};

export interface ArenaPracticeOptions {
  ctx: CharacterContext;
  /** One opponent (legacy) or several. */
  foe?: Foe & { persona?: string };
  foes?: Array<Foe & { persona?: string }>;
  currentUserId: string | null;
  /** From use-arena-round-chat: puts opponent speech and fight results in the Live Table. */
  appendLine: (line: ArenaAppendLine) => string;
  /** Use the opponent's real AI voice (falls back to stock lines). */
  aiVoice?: boolean;
  /** Practice HP changes, for anything on screen that mirrors the sheet. Never the real character. */
  onPracticeHp?: (hp: number, maxHp: number) => void;
  /** Party Sparring link: host runs the fight, members mirror it and send actions. */
  net?: SparringNet | null;
  /** Off: base hooks still run, but no timers, speech or fights start. Default true. */
  enabled?: boolean;
  /** Drill behavior for the opponent. Default standard. */
  drillKind?: ArenaDrillKind;
  /** Practice scorecard updates. */
  onStatsChange?: (stats: ArenaStats) => void;
  /** single (default): one fight ends at zero HP. gauntlet: endless waves from gauntletFoe. */
  mode?: 'single' | 'gauntlet';
  /** Arena-local scene text for Quick Build's "use the scene" (never campaign history). */
  getPracticeScene?: () => string;
}

export interface ArenaPracticeApi { combat: NpcCombatApi; roster: NpcRosterApi; reset: () => void; stats: ArenaStats; currentFoe: (Foe & { persona?: string }) | null; wave: number }

function baseRow(now: number, over: Partial<FighterRow>): FighterRow {
  return {
    ac: 10, act_every_ms: null, action_seq: 0, cooldowns: {}, created_at: iso(now), death_failures: 0, death_successes: 0,
    duel_charge: 0, fight_id: FIGHT_ID, hp: 1, id: '', kind: 'player', last_action_at: null, last_seen_at: iso(now),
    last_stand_used: false, max_hp: 1, minigame: {}, name: '', next_action_at: null, next_save_at: null, npc_id: null,
    party_id: PARTY, pending: null, perks: [], pinned_until: null, resolve: 0, resolve_at: iso(now), resolve_rate: 1,
    second_wind: null, signature_turn: 0, status: 'up', strike_at: null, threat: {}, turn_no: 0, updated_at: iso(now),
    user_id: null, ward: 0, ward_until: null, ...over,
    ally: over.ally ?? false, combat_effects: over.combat_effects ?? [], temp_hp: over.temp_hp ?? 0,
    temp_hp_source: over.temp_hp_source ?? null, temp_hp_until: over.temp_hp_until ?? null,
  };
}

export function useArenaNpcPractice({ ctx, foe: oneFoe, foes: manyFoes, currentUserId, appendLine, aiVoice = true, onPracticeHp, net = null, enabled = true, drillKind = 'standard', onStatsChange, mode = 'single', getPracticeScene }: ArenaPracticeOptions): ArenaPracticeApi {
  const isMember = net?.role === 'member';
  const [remoteFoes, setRemoteFoes] = useState<Array<Foe & { persona?: string }>>([]);
  const gauntlet = mode === 'gauntlet';
  const [wave, setWave] = useState(1);
  const waveRef = useRef(wave); waveRef.current = wave;
  // Arena-built NPCs live only here; picking one to fight replaces the single opponent.
  const [built, setBuilt] = useState<PartyNpc[]>([]);
  const builtRef = useRef(built); builtRef.current = built;
  const [picked, setPicked] = useState<{ foe: Foe & { persona?: string }; stats: NpcCombatStats } | null>(null);
  const foes = useMemo(() => (gauntlet ? [gauntletFoe(wave) as Foe & { persona?: string }] : isMember ? remoteFoes : picked ? [picked.foe] : manyFoes && manyFoes.length ? manyFoes : oneFoe ? [oneFoe] : []).slice(0, 6), [gauntlet, wave, isMember, remoteFoes, picked, manyFoes, oneFoe]);
  const foeAt = useCallback((rowId: string) => foes[Math.max(0, Number(rowId.slice(NPC_PREFIX.length)) || 0)] ?? foes[0], [foes]);
  const baseCombat = useNpcCombat({ partyId: null, currentUserId, isHost: true, sheetHp: null });
  const baseRoster = usePartyNpcs(null);
  const me = currentUserId || 'arena-player';
  const maxHp = Math.max(1, num(ctx.maxHP, 30));
  const myAc = num(ctx.defenses?.armorClass, 12);
  const level = Math.max(1, num(ctx.level, 5));
  const atkBonus = 2 + Math.floor((level - 1) / 4) + 3;
  // Who is acting right now (the host runs remote players' actions as them).
  const actorRef = useRef(me);
  const statsRef = useRef<Record<string, SparringPlayer>>({});
  statsRef.current[me] = { userId: me, name: ctx.name || 'You', maxHp, ac: myAc, level, atk: atkBonus };
  const st = () => statsRef.current[actorRef.current] ?? statsRef.current[me];
  const PR = () => prow(actorRef.current);
  const netRef = useRef(net); netRef.current = net;
  const playerRow = (uid: string, t: number) => { const s0 = statsRef.current[uid]; return baseRow(t, { id: prow(uid), kind: 'player', user_id: uid, name: s0.name, hp: s0.maxHp, max_hp: s0.maxHp, ac: s0.ac }); };

  const [now, setNow] = useState(() => Date.now());
  const [fight, setFight] = useState<FightRow | null>(null);
  const [fighters, setFighters] = useState<FighterRow[]>([]);
  const [events, setEvents] = useState<FightEventRow[]>([]);
  const [lastLineAt, setLastLineAt] = useState<Record<string, number>>({});
  const fightRef = useRef(fight); fightRef.current = fight;
  const rowsRef = useRef(fighters); rowsRef.current = fighters;
  const speechBusy = useRef(false);
  const lastSpeech = useRef(0);
  const history = useRef<SparTurn[]>([]);
  const pinnerRef = useRef<string | null>(null);

  // A local clock that always moves, so no countdown can freeze.
  useEffect(() => { if (!enabled) return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [enabled]);
  const isDrill = drillKind === 'dummy' || drillKind === 'clash' || drillKind === 'pin' || drillKind === 'duel';
  // Practice scorecard (moved from the old Solo Training screen).
  const [stats, setStats] = useState<ArenaStats>(emptyStats);
  const bumpStats = useCallback((fn: (s: ArenaStats) => Partial<ArenaStats>) => setStats((s) => ({ ...s, ...fn(s) })), []);
  const statsCb = useRef(onStatsChange); statsCb.current = onStatsChange;
  useEffect(() => { statsCb.current?.(stats); }, [stats]);
  const serverTime = useCallback(() => Date.now(), []);

  const say = useCallback((who: 'foe' | 'table', text: string, rowId: string = npcRow(0)) => {
    history.current = [...history.current.slice(-19), { who, text }];
    if (who === 'foe') {
      const i = Math.max(0, Number(rowId.slice(NPC_PREFIX.length)) || 0);
      const l = { content: text, characterName: foeAt(rowId)?.name ?? 'Opponent', npcId: npcIdOf(i), inCharacter: true };
      appendLine(l);
      if (netRef.current?.role === 'host') netRef.current.send('line', l);
      setLastLineAt((m) => ({ ...m, [npcIdOf(i)]: Date.now() }));
    } else {
      const l = { content: `⚔ ${text}`, characterName: '⚔ Combat', inCharacter: false };
      appendLine(l);
      if (netRef.current?.role === 'host') netRef.current.send('line', l);
    }
  }, [appendLine, foeAt]);

  const speak = useCallback(async (fallback: string, force = false, rowId: string = npcRow(0)) => {
    if (!enabled || drillKind === 'dummy') return;
    if (isDrill) { if (force || Date.now() - lastSpeech.current > 4000) { lastSpeech.current = Date.now(); say('foe', pick(DRILL_LINES[drillKind] ?? [fallback]), rowId); } return; }
    if (!aiVoice) { say('foe', fallback, rowId); return; }
    if (speechBusy.current || (!force && Date.now() - lastSpeech.current < 4000)) return;
    speechBusy.current = true; lastSpeech.current = Date.now();
    const rows = rowsRef.current;
    const foe = foeAt(rowId);
    if (!foe) { speechBusy.current = false; return; }
    const p = rows.find((r) => r.id === prow(me)) ?? rows.find((r) => isPlayerRow(r.id)); const n = rows.find((r) => r.id === rowId);
    const sys = buildSparPrompt({ foeName: foe.name, foePersona: foe.persona, playerName: ctx.name || 'the challenger', foeHp: n?.hp ?? foe.maxHp, foeMax: foe.maxHp, myHp: p?.hp ?? maxHp, myMax: p?.max_hp ?? maxHp });
    const text = await sparLine(sys, history.current);
    speechBusy.current = false;
    say('foe', text || fallback, rowId);
  }, [enabled, drillKind, isDrill, aiVoice, say, foeAt, maxHp]);

  const event = useCallback((e: Partial<FightEventRow> & { kind: string; detail: string }) => {
    const row: FightEventRow = { actor_name: '', applied_at: null, created_at: iso(Date.now()), d20: null, fight_id: FIGHT_ID, hp_delta: 0, temp_hp_delta: 0, id: crypto.randomUUID(), party_id: PARTY, target_name: '', target_user_id: null, total: null, ...e };
    setEvents((p) => [...p.slice(-59), row]);
  }, []);

  const patch = useCallback((id: string, fn: (r: FighterRow) => Partial<FighterRow>) => {
    setFighters((rows) => {
      const next = rows.map((r) => (r.id === id ? { ...r, ...fn(r), updated_at: iso(Date.now()) } : r));
      rowsRef.current = next;
      return next;
    });
  }, []);

  const endWith = useCallback((outcome: 'victory' | 'defeat' | 'ended', detail: string) => {
    setFight((f) => (f ? { ...f, status: 'ended', outcome, ended_at: iso(Date.now()) } : f));
    setFighters((rows) => { const next = rows.map((r) => (isNpcRow(r.id) ? { ...r, pending: null, strike_at: null } : r)); rowsRef.current = next; return next; });
    event({ kind: 'end', detail });
    say('table', detail);
  }, [patch, event, say]);

  /** Deal damage to a row; fills both Duel bars and ends the fight at zero. */
  const hurt = useCallback((id: string, amount: number, by: string, kind: string, detail: string, d20?: number, total?: number) => {
    const n = Math.round(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row || row.status !== 'up') return;
    const hp = Math.max(0, row.hp - n);
    const gain = DU.duelChargeGain(n, row.max_hp);
    patch(id, (r) => ({ hp, status: hp === 0 ? 'down' : r.status, duel_charge: Math.min(DU.DUEL_CHARGE.max, r.duel_charge + gain) }));
    if (isNpcRow(id) && isPlayerRow(PR())) patch(PR(), (r) => ({ duel_charge: Math.min(DU.DUEL_CHARGE.max, r.duel_charge + gain) }));
    event({ kind, actor_name: by, target_name: row.name, target_user_id: row.user_id, hp_delta: -n, detail, d20: d20 ?? null, total: total ?? null });
    if (isNpcRow(id) && kind === 'attack') bumpStats((s) => ({ hits: s.hits + 1, damage: s.damage + Math.min(n, row.hp) }));
    if (id === prow(me)) onPracticeHp?.(hp, maxHp);
    if (hp === 0) {
      if (isNpcRow(id)) {
        const standing = rowsRef.current.filter((r) => isNpcRow(r.id) && r.status === 'up');
        if (standing.length === 0 && gauntlet) {
          // Wave cleared: bring in the next challenger, keep the player's practice HP.
          const cleared = waveRef.current;
          const next = gauntletFoe(cleared + 1);
          waveRef.current = cleared + 1;
          setWave(cleared + 1);
          bumpStats((s) => ({ bestWave: Math.max(s.bestWave, cleared) }));
          const t = Date.now();
          setFighters((rows) => {
            const out = rows.map((r) => {
              if (isNpcRow(r.id)) return baseRow(t, { id: npcRow(0), kind: 'npc', npc_id: npcIdOf(0), name: next.name, hp: next.maxHp, max_hp: next.maxHp, ac: next.ac, act_every_ms: GAP[next.speed], next_action_at: iso(t + GAP[next.speed]) });
              const m = { ...objOf(r.minigame) }; delete m.clash; delete m.duel;
              return { ...r, minigame: asJson(m), pinned_until: null, updated_at: iso(t) };
            });
            rowsRef.current = out; return out;
          });
          say('table', `Wave ${cleared} cleared! ${next.name} steps in.`);
          return;
        }
        if (standing.length === 0) endWith('victory', rowsRef.current.filter((r) => isNpcRow(r.id)).length > 1 ? 'Every opponent is beaten! Victory.' : `${row.name} is beaten! Victory.`);
        else say('table', `${row.name} is down! ${standing.length} still standing.`);
      } else {
        const s = rowsRef.current.find((r) => isNpcRow(r.id) && r.status === 'up');
        const standing = rowsRef.current.filter((r) => isPlayerRow(r.id) && r.status === 'up');
        if (standing.length > 0) say('table', `${row.name} is down! ${standing.length} still fighting.`);
        else if (gauntlet) { endWith('defeat', `${row.name} fell on wave ${waveRef.current}. Gauntlet over — nothing lost.`); }
        else { if (s) void speak('Yield! Dust yourself off and go again.', true, s.id); endWith('defeat', standing.length === 0 && rowsRef.current.filter((r) => isPlayerRow(r.id)).length > 1 ? 'The whole party is down. Practice over — nothing lost.' : `${row.name} went down. Practice over — nothing lost.`); }
      }
    } else if (isNpcRow(id) && Math.random() < 0.5) void speak(pick(HURT), false, id);
  }, [patch, event, endWith, speak, say, onPracticeHp, maxHp, gauntlet, bumpStats]);

  const heal = useCallback((id: string, amount: number, label: string) => {
    const n = Math.round(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return 0;
    const hp = Math.min(row.max_hp, row.hp + n);
    patch(id, () => ({ hp, status: row.status === 'down' && hp > 0 ? 'up' : row.status }));
    event({ kind: 'heal', actor_name: row.name, target_name: row.name, target_user_id: row.user_id, hp_delta: hp - row.hp, detail: label });
    if (id === prow(me)) onPracticeHp?.(hp, maxHp);
    return hp - row.hp;
  }, [patch, event, onPracticeHp, maxHp]);

  const spendAction = useCallback(() => patch(PR(), () => ({ last_action_at: iso(Date.now()) })), [patch]);
  const live = () => fightRef.current?.status === 'active';

  const openFight = useCallback(async (npcId: string, _opts?: { weaponName?: string; finish?: Finish }) => {
    if (!enabled) return null;
    const t = Date.now();
    const players = Object.keys(statsRef.current).map((uid) => playerRow(uid, t));
    // An Arena-built NPC becomes the opponent for every combat path.
    let useFoes = foes;
    const b = builtRef.current.find((n) => n.id === npcId);
    if (b && !gauntlet) {
      const f = b.combat_stats ? foeFromNpc(b.name, b.combat_stats) : null;
      if (!f) return { ok: false, error: `${b.name} has no fight stats.` };
      setPicked({ foe: f, stats: b.combat_stats! });
      useFoes = [f];
    }
    pinnerRef.current = null;
    const foesNow = useFoes;
    const npcs = foesNow.map((foe, i) => baseRow(t, { id: npcRow(i), kind: 'npc', npc_id: npcIdOf(i), name: foe.name, hp: foe.maxHp, max_hp: foe.maxHp, ac: foe.ac, act_every_ms: GAP[foe.speed], next_action_at: iso(t + GAP[foe.speed] + i * 1700) }));
    rowsRef.current = [...players, ...npcs];
    setFighters([...players, ...npcs]);
    setEvents([]);
    setFight({ id: FIGHT_ID, party_id: PARTY, status: 'active', outcome: null, started_at: iso(t), started_by: me, ended_at: null, huddles_used: {}, pause_kind: null, paused_at: null, paused_until: null, updated_at: iso(t) });
    say('table', `${foesNow.map((f) => f.name).join(', ')} ${foesNow.length > 1 ? 'step' : 'steps'} into the ring. Nothing here counts.`);
    void speak(pick(TAUNTS), true, npcRow(0));
    return { ok: true };
  }, [enabled, me, foes, gauntlet, say, speak]);

  /** One player strike against the practice opponent. */
  const targetOf = (id?: string) => {
    const ups = rowsRef.current.filter((r) => isNpcRow(r.id) && r.status === 'up');
    return ups.find((r) => r.id === id) ?? ups[0] ?? null;
  };
  const strike = useCallback((targetId: string, label: string, d20: number, total: number, dmg: number) => {
    const npc = targetOf(targetId);
    if (!npc) return null;
    const crit = d20 === 20;
    const hit = d20 !== 1 && (crit || total >= npc.ac);
    const damage = hit ? Math.max(1, Math.round(crit ? dmg * 2 : dmg)) : 0;
    if (hit) hurt(npc.id, damage, st().name, 'attack', `${label}: ${crit ? 'critical ' : ''}hit for ${damage}.`, d20, total);
    else event({ kind: 'attack', actor_name: st().name, target_name: npc.name, detail: `${label}: ${total} vs AC ${npc.ac}, miss.`, d20, total });
    say('table', hit ? `${label} → ${npc.name} — ${total} vs AC ${npc.ac}, ${crit ? 'critical! ' : ''}${damage} damage.` : `${label} — ${total} vs AC ${npc.ac}, miss.`);
    return { ok: true, d20, total, hit, crit, damage };
  }, [hurt, event, say]);

  const attack = useCallback(async (targetId: string, opts?: { weaponName?: string; finish?: Finish }) => {
    if (!live()) return null;
    spendAction();
    const d20 = roll(20);
    return strike(targetId, opts?.weaponName || 'Attack', d20, d20 + st().atk, roll(8) + 3);
  }, [spendAction, strike]);

  const cast = useCallback(async (targetId: string, spell: { name: string; level: number }, intent: 'damage' | 'heal', _finish?: Finish) => {
    if (!live()) return null;
    spendAction();
    const dice = Math.max(1, spell.level + 1);
    let amt = 0; for (let i = 0; i < dice; i++) amt += roll(8);
    if (intent === 'heal') return { ok: true, healed: heal(rowsRef.current.some((r) => r.id === targetId) ? targetId : PR(), amt + 3, `${spell.name}: +${amt + 3} HP`) };
    const d20 = roll(20);
    return strike(targetId, spell.name, d20, d20 + st().atk, amt);
  }, [spendAction, heal, strike]);

  const castFromCard = useCallback(async (targetId: string, card: ActionCard, _finish?: Finish, _extra?: string[]) => {
    if (!live()) return null;
    spendAction();
    const dmg = num(card.damageTotal, 0);
    const amount = num(card.amount, 0);
    if (card.kind === 'heal' || (amount > 0 && !dmg)) return { ok: true, healed: heal(rowsRef.current.some((r) => r.id === targetId) ? targetId : PR(), amount, `${card.action}: +${amount} HP`) };
    if (card.resolve === 'save') {
      const tgt = targetOf(targetId);
      if (!tgt) return null;
      const save = roll(20) + 2;
      const dc = num(card.saveDC, 13);
      const d = save >= dc ? Math.floor(dmg / 2) : dmg;
      if (d > 0) hurt(tgt.id, d, st().name, 'attack', `${card.action}: ${tgt.name} rolls ${save} vs DC ${dc}.`);
      say('table', `${card.action} — ${tgt.name} rolls ${save} vs DC ${dc}: ${save >= dc ? 'saves, half' : 'fails'}, ${d} damage.`);
      return { ok: true, hit: d > 0, damage: d, saved: save >= dc ? 1 : 0 };
    }
    const d20 = num(card.d20, roll(20));
    return strike(targetId, card.action, d20, num(card.attackTotal, d20 + st().atk), dmg);
  }, [spendAction, heal, hurt, strike, say]);

  const secondWind = useCallback(async (targetId?: string) => {
    if (!live()) return null;
    const p = rowsRef.current.find((r) => r.id === PR());
    if (!p || p.second_wind) return null;
    const amt = roll(10) + st().level;
    const healed = heal(targetId && rowsRef.current.some((r) => r.id === targetId) ? targetId : PR(), amt, `Second Wind: +${amt} HP`);
    patch(PR(), () => ({ second_wind: 'used' }));
    return { ok: true, healed };
  }, [heal, patch]);

  const drinkPotion = useCallback(async (itemName: string) => {
    if (!live()) return null;
    const amt = roll(4) + roll(4) + 2;
    return { ok: true, healed: heal(PR(), amt, `${itemName}: +${amt} HP`), resolve: 0 };
  }, [heal]);

  // Counter Clash: judge one tap against the opponent's chain and store it on my row.
  const clash = useCallback(async (npcFighterId: string, side: 'left' | 'top' | 'right', tapAt: number) => {
    const npc = rowsRef.current.find((r) => r.id === npcFighterId) ?? rowsRef.current.find((r) => isNpcRow(r.id) && r.strike_at);
    const me_ = rowsRef.current.find((r) => r.id === PR());
    const chain = M.cleanClash(objOf(npc?.pending ?? null).clash);
    const hitAt = npc?.strike_at ? Date.parse(npc.strike_at) : NaN;
    if (!npc || !me_ || !chain || !Number.isFinite(hitAt)) return null;
    const results = M.clashResultsOf(me_.minigame, chain.id);
    const j = M.judgeClash(chain, hitAt, tapAt, side, results);
    if (!j) return null;
    const r = [...results]; r[j.index] = j.q;
    patch(PR(), (row) => ({ minigame: asJson({ ...objOf(row.minigame), clash: { id: chain.id, r } }) }));
    let run = 0, best = 0; for (const q of r) { run = q === 'perfect' ? run + 1 : 0; best = Math.max(best, run); }
    bumpStats((s) => ({ taps: s.taps + 1, perfects: s.perfects + (j.q === 'perfect' ? 1 : 0), bestChain: Math.max(s.bestChain, best) }));
    return { ok: true, index: j.index, quality: j.q };
  }, [patch, bumpStats]);

  // Pin: one HEAVE on the rope.
  const heave = useCallback(async (tapAt: number) => {
    const me_ = rowsRef.current.find((r) => r.id === PR());
    const s = M.cleanStruggle(objOf(me_?.minigame ?? null).struggle);
    if (!me_ || !s) return null;
    const r = M.heave(s, tapAt);
    if (!r) return null;
    patch(PR(), (row) => ({ minigame: asJson({ ...objOf(row.minigame), struggle: r.state }), ...(r.free ? { pinned_until: null } : {}) }));
    if (r.free) {
      const started = me_.pinned_until ? Date.parse(me_.pinned_until) - PIN_MS : tapAt;
      event({ kind: 'pin', actor_name: me_.name, target_name: me_.name, target_user_id: me_.user_id, detail: 'Broke free!' });
      say('table', `${me_.name} broke free in ${((tapAt - started) / 1000).toFixed(1)}s.`);
      const took = tapAt - started;
      if (Number.isFinite(took) && took >= 0) bumpStats((s) => ({ pinEscapes: s.pinEscapes + 1, bestEscapeMs: s.bestEscapeMs === null ? took : Math.min(s.bestEscapeMs, took) }));
    }
    return { ok: true, free: r.free, struggle: r.state };
  }, [patch, event, say, bumpStats]);

  const duelStart = useCallback(async (npcFighterId: string, opts?: { weaponName?: string; finish?: Finish; feel?: DU.DuelFeel }) => {
    if (!live()) return null;
    const tgt = targetOf(npcFighterId);
    if (!tgt) return null;
    const foe = foeAt(tgt.id);
    const P = DU.deriveDuel({ level: st().level, dex: 14, ac: st().ac, maxHp: st().maxHp, npcAttack: foe.attackBonus, npcDamageAvg: foe.damageAvg, npcSpeed: foe.speed });
    const duel = DU.newDuel({ id: `d${Date.now()}`, npcId: tgt.id, npcName: tgt.name, startAt: Date.now() + DU.DUEL_LEAD_MS, finish: opts?.finish ?? 'knockout', weapon: opts?.weaponName ?? null }, P, Math.random);
    patch(PR(), (r) => ({ duel_charge: 0, minigame: asJson({ ...objOf(r.minigame), duel }) }));
    patch(tgt.id, () => ({ pending: null, strike_at: null }));
    say('table', `🤺 ${st().name} calls ${tgt.name} out — Duel!`);
    return { ok: true, duel };
  }, [patch, say, foeAt]);

  const duelEnd = useCallback(async (duelId: string, inputs: DU.DuelInput[]): Promise<DuelVerdict | null> => {
    const me_ = rowsRef.current.find((r) => r.id === PR());
    const duel = DU.cleanDuel(objOf(me_?.minigame ?? null).duel);
    if (!me_ || !duel || duel.id !== duelId) return null;
    const out = DU.replayDuel(duel, inputs);
    const npc = rowsRef.current.find((r) => r.id === duel.npcId) ?? targetOf();
    if (!npc) return null;
    const foe = foeAt(npc.id);
    const won = out.hits <= out.perfect;
    const taken = won ? 0 : Math.round(out.hits * foe.damageAvg * 0.6);
    const dealt = won ? (npc?.hp ?? 0) : 0;
    patch(PR(), (r) => { const m = { ...objOf(r.minigame) }; delete m.duel; return { minigame: asJson(m) }; });
    patch(npc.id, () => ({ next_action_at: iso(Date.now() + GAP[foe.speed]) }));
    bumpStats((s) => ({ duels: s.duels + 1, duelsWon: s.duelsWon + (won ? 1 : 0) }));
    if (drillKind === 'duel') {
      // Drill: no knockout, no damage — refill so the next duel is ready.
      event({ kind: 'attack', actor_name: me_.name, target_name: npc.name, detail: won ? 'Won the drill duel.' : 'Lost the drill duel.' });
      say('table', won ? `Duel won against ${npc.name}! Go again.` : `${npc.name} took that duel. Go again.`);
      patch(npc.id, (r) => ({ hp: r.max_hp, status: 'up' }));
      patch(PR(), () => ({ duel_charge: DU.DUEL_CHARGE.max }));
      return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, dealt: 0, taken: 0, defeated: false, npcName: npc.name };
    }
    if (won) hurt(npc.id, dealt, me_.name, 'attack', 'Won the duel.');
    else hurt(PR(), taken, npc.name, 'attack', 'Lost the duel.');
    return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, dealt, taken, defeated: won, npcName: npc.name };
  }, [patch, hurt, foeAt, drillKind, bumpStats, event, say]);

  const stabilize = useCallback(async (_targetId: string) => null, []);
  const givePotion = useCallback(async (_targetId: string, _itemName: string) => null, []);
  const huddle = useCallback(async () => {
    const t = Date.now();
    setFight((f) => (f ? { ...f, status: 'paused', pause_kind: 'huddle', paused_at: iso(t), paused_until: iso(t + 20000), huddles_used: { ...objOf(f.huddles_used), [actorRef.current]: true } as Json } : f));
    return { ok: true };
  }, []);
  const pause = useCallback(async () => {
    setFight((f) => (f ? { ...f, status: 'paused', pause_kind: 'host', paused_at: iso(Date.now()), paused_until: null } : f));
    return { ok: true };
  }, []);
  const resume = useCallback(async () => {
    const f = fightRef.current;
    if (!f || f.status !== 'paused') return null;
    const shift = Date.now() - (f.paused_at ? Date.parse(f.paused_at) : Date.now());
    const move = (v: string | null) => (v ? iso(Date.parse(v) + shift) : v);
    setFighters((rows) => rows.map((r) => ({ ...r, next_action_at: move(r.next_action_at), strike_at: move(r.strike_at), pinned_until: move(r.pinned_until), last_action_at: move(r.last_action_at) })));
    setFight({ ...f, status: 'active', pause_kind: null, paused_at: null, paused_until: null });
    return { ok: true };
  }, []);
  const endFight = useCallback(async () => { endWith('ended', 'Practice stopped.'); return { ok: true }; }, [endWith]);
  const addNpc = useCallback(async (_npcId: string) => null, []);
  const reset = useCallback(() => { setFight(null); setFighters([]); setEvents([]); setStats(emptyStats()); waveRef.current = 1; setWave(1); }, []);
  const revivePlayer = useCallback(async (_userId: string) => { reset(); return { ok: true }; }, [reset]);
  const reviveNpc = useCallback(async (_npcId: string) => { reset(); return { ok: true }; }, [reset]);

  // The opponent's turn, a huddle's end and big-move landings, all on the local clock.
  useEffect(() => {
    if (!enabled || isMember) return; // the host's phone runs the opponents
    const f = fight;
    if (!f) return;
    if (f.status === 'paused') {
      if (f.pause_kind === 'huddle' && f.paused_until && now >= Date.parse(f.paused_until)) void resume();
      return;
    }
    if (f.status !== 'active') return;
    const players = fighters.filter((r) => isPlayerRow(r.id) && r.status === 'up');
    const ups = fighters.filter((r) => isNpcRow(r.id) && r.status === 'up');
    if (players.length === 0 || ups.length === 0) return;
    if (players.some((p) => DU.cleanDuel(objOf(p.minigame).duel))) return; // a duel holds every opponent
    const as = (p: FighterRow, fn: () => void) => { const prev = actorRef.current; actorRef.current = p.user_id || me; try { fn(); } finally { actorRef.current = prev; } };
    // A pin that ran out without escape.
    const held = players.find((p) => p.pinned_until && now > Date.parse(p.pinned_until));
    if (held) {
      const pinner = ups.find((r) => r.id === pinnerRef.current) ?? ups[0];
      const pf = foeAt(pinner.id);
      as(held, () => { patch(held.id, () => ({ pinned_until: null })); hurt(held.id, pf.damageAvg * 1.5, pinner.name, 'npc_attack', 'The pin held.'); });
      return;
    }
    // A wind-up in progress holds everyone else until it lands.
    const winding = ups.find((r) => r.strike_at && M.cleanClash(objOf(r.pending).clash));
    if (winding) {
      const npc = winding; const foe = foeAt(npc.id);
      const pend = objOf(npc.pending);
      const chain = M.cleanClash(pend.clash)!;
      const hitAt = Date.parse(npc.strike_at!);
      if (now <= hitAt + M.CLASH_HOLD_MS + 300) return;
      const tid = Array.isArray(pend.targets) ? String(pend.targets[0]) : '';
      const p = players.find((r) => r.id === tid);
      patch(npc.id, () => ({ pending: null, strike_at: null, turn_no: npc.turn_no + 1, next_action_at: iso(now + GAP[foe.speed]) }));
      if (!p) return;
      const results = M.clashResultsOf(p.minigame, chain.id);
      const perfect = M.chainPerfect(chain, results);
      as(p, () => {
        if (perfect) {
          const d = M.counterDamage(roll(8) + 3, chain.move);
          hurt(npc.id, d, p.name, 'attack', `Counter Clash! ${p.name}'s perfect chain — ${d} damage.`);
        } else if (chain.move === 'pin') {
          const t0 = now;
          pinnerRef.current = npc.id;
          patch(p.id, (r) => ({ pinned_until: iso(t0 + PIN_MS), minigame: asJson({ ...objOf(r.minigame), struggle: M.newStruggle(Math.floor(Math.random() * 1e9), t0) }) }));
          event({ kind: 'pin', actor_name: npc.name, target_name: p.name, target_user_id: p.user_id, detail: `${npc.name} pins ${p.name}!` });
          say('table', `${npc.name} grabs ${p.name} — Pinned! Break free.`);
        } else {
          const scale = M.chainScale(chain, results);
          hurt(p.id, scale * foe.damageAvg * (chain.move === 'signature' ? 2 : 1.3), npc.name, 'npc_attack', `${String(pend.skill || 'Big move')} lands on ${p.name}.`);
        }
      });
      return;
    }
    const free = players.filter((r) => !r.pinned_until);
    if (free.length === 0) return;
    const npc = ups.find((r) => { const d = r.next_action_at ? Date.parse(r.next_action_at) : NaN; return Number.isFinite(d) && now >= d; });
    if (!npc) return;
    const foe = foeAt(npc.id);
    if (drillKind === 'dummy' || foe.attackBonus <= -10) { patch(npc.id, () => ({ next_action_at: iso(now + GAP[foe.speed]) })); return; } // a dummy never swings
    const p = pick(free);
    if (drillKind === 'duel') {
      // Drill: keep the Duel ready instead of attacking.
      patch(npc.id, () => ({ next_action_at: iso(now + GAP[foe.speed]) }));
      if (DU.duelChargeNow(p.duel_charge) < DU.DUEL_CHARGE.max) { patch(p.id, () => ({ duel_charge: DU.DUEL_CHARGE.max })); void speak('Ready?', true, npc.id); }
      return;
    }
    if (drillKind === 'pin') {
      // Drill: straight into a real Pin.
      const t0 = now;
      pinnerRef.current = npc.id;
      patch(npc.id, () => ({ turn_no: npc.turn_no + 1, next_action_at: iso(now + GAP[foe.speed]) }));
      patch(p.id, (row) => ({ pinned_until: iso(t0 + PIN_MS), minigame: asJson({ ...objOf(row.minigame), struggle: M.newStruggle(Math.floor(Math.random() * 1e9), t0) }) }));
      event({ kind: 'pin', actor_name: npc.name, target_name: p.name, target_user_id: p.user_id, detail: `${npc.name} pins ${p.name}!` });
      say('table', `${npc.name} grabs ${p.name} — Pinned! Break free.`);
      void speak('Break this hold!', true, npc.id);
      return;
    }
    const r = drillKind === 'clash' ? 0 : Math.random();
    if (r < 0.6) void speak(pick(TAUNTS), true, npc.id);
    if (r < 0.6) {
      const move: M.ClashMove = drillKind === 'clash' ? pick<M.ClashMove>(['heavy', 'signature', 'sweep']) : r < 0.45 ? pick<M.ClashMove>(['heavy', 'signature', 'sweep']) : 'pin';
      const c = M.buildClash(`c${now}`, move, roll);
      const windup = 1200 + Math.max(0, -M.clashStartsAt(c, 0));
      const skill = move === 'pin' ? 'Pin' : move === 'signature' ? 'Signature' : move === 'sweep' ? 'Sweep' : 'Heavy Blow';
      patch(npc.id, () => ({ pending: asJson({ skill, type: move, targets: [p.id], windup_ms: windup, clash: c }), strike_at: iso(now + windup) }));
      event({ kind: 'intent', actor_name: npc.name, target_name: p.name, target_user_id: p.user_id, detail: `${npc.name} winds up ${skill} at ${p.name}!` });
      say('table', `⚠ ${npc.name} winds up ${skill} at ${p.name} — Counter Clash!`);
      return;
    }
    const d20 = roll(20);
    const atk = d20 + foe.attackBonus;
    patch(npc.id, () => ({ turn_no: npc.turn_no + 1, last_action_at: iso(now), next_action_at: iso(now + GAP[foe.speed]) }));
    if (d20 !== 1 && (d20 === 20 || atk >= p.ac)) {
      const dmg = Math.max(1, Math.round(foe.damageAvg * (0.6 + Math.random() * 0.8)));
      as(p, () => hurt(p.id, dmg, npc.name, 'npc_attack', `${npc.name} hits ${p.name} (${atk} vs AC ${p.ac}).`, d20, atk));
      say('table', `${npc.name} hits ${p.name} — ${atk} vs AC ${p.ac}, ${dmg} damage.`);
    } else {
      event({ kind: 'npc_attack', actor_name: npc.name, target_name: p.name, target_user_id: p.user_id, detail: `${npc.name} misses ${p.name} (${atk} vs AC ${p.ac}).`, d20, total: atk });
      say('table', `${npc.name} swings at ${p.name} — ${atk} vs AC ${p.ac}, miss.`);
    }
  }, [enabled, drillKind, isMember, me, now, fight, fighters, foeAt, patch, hurt, event, say, speak, resume]);

  // ---- Party Sparring link ----
  const local = { openFight, attack, cast, castFromCard, secondWind, drinkPotion, clash, heave, duelStart, duelEnd, huddle, pause, resume, endFight, stabilize, givePotion, revivePlayer, reviveNpc };
  type LocalApi = typeof local;
  const localRef = useRef(local); localRef.current = local;
  const pendingRpc = useRef(new Map<string, (v: unknown) => void>());

  // Host: share the fight a few times a second.
  const [shareTick, setShareTick] = useState(0);
  useEffect(() => {
    if (net?.role !== 'host') return;
    const t = setTimeout(() => net.send('state', { fight, fighters, events: events.slice(-20), foes }), 120);
    return () => clearTimeout(t);
  }, [net, fight, fighters, events, foes, shareTick]);

  // Host: members join and send actions.
  useEffect(() => {
    if (net?.role !== 'host') return;
    const offJoin = net.on('join', (p) => {
      const pl = cleanPlayer(p.player);
      if (!pl || pl.userId === me) return;
      const known = !!statsRef.current[pl.userId];
      statsRef.current[pl.userId] = pl;
      const f = fightRef.current;
      if (f && f.status !== 'ended' && !rowsRef.current.some((r) => r.id === prow(pl.userId))) {
        const next = [...rowsRef.current, playerRow(pl.userId, Date.now())];
        rowsRef.current = next; setFighters(next);
      }
      if (!known) say('table', `${pl.name} joins the sparring ring.`);
      setShareTick((n) => n + 1);
    });
    const offAct = net.on('act', (p) => {
      const uid = typeof p.uid === 'string' ? p.uid : '';
      const type = String(p.type) as keyof LocalApi;
      const args = Array.isArray(p.args) ? p.args : [];
      const fn = localRef.current[type] as ((...a: unknown[]) => Promise<unknown>) | undefined;
      if (!uid || !statsRef.current[uid] || !fn) { net.send('res', { reqId: p.reqId, to: uid, result: null }); return; }
      const prev = actorRef.current;
      actorRef.current = uid;
      let out: Promise<unknown>;
      try { out = fn(...args); } finally { actorRef.current = prev; }
      void out.then((result) => net.send('res', { reqId: p.reqId, to: uid, result: result ?? null }), () => net.send('res', { reqId: p.reqId, to: uid, result: null }));
    });
    return () => { offJoin(); offAct(); };
  }, [net, me, say]);

  // Member: mirror the host and keep announcing ourselves.
  useEffect(() => {
    if (net?.role !== 'member') return;
    const offState = net.on('state', (p) => {
      const rows = Array.isArray(p.fighters) ? (p.fighters as FighterRow[]) : [];
      rowsRef.current = rows; setFighters(rows);
      setFight((p.fight as FightRow | null) ?? null);
      setEvents(Array.isArray(p.events) ? (p.events as FightEventRow[]) : []);
      if (Array.isArray(p.foes)) setRemoteFoes((p.foes as Array<Foe & { persona?: string }>).slice(0, 6));
    });
    const offLine = net.on('line', (p) => {
      if (typeof p.content !== 'string') return;
      appendLine({ content: p.content.slice(0, 2000), characterName: String(p.characterName ?? '⚔ Combat').slice(0, 60), inCharacter: p.inCharacter !== false, npcId: typeof p.npcId === 'string' ? p.npcId : null });
      if (typeof p.npcId === 'string') setLastLineAt((m) => ({ ...m, [p.npcId as string]: Date.now() }));
    });
    const offRes = net.on('res', (p) => {
      if (p.to !== me || typeof p.reqId !== 'string') return;
      const done = pendingRpc.current.get(p.reqId);
      if (done) { pendingRpc.current.delete(p.reqId); done(p.result ?? null); }
    });
    const join = () => net.send('join', { player: statsRef.current[me] });
    join();
    const t = setInterval(join, 4000);
    return () => { offState(); offLine(); offRes(); clearInterval(t); };
  }, [net, me, appendLine]);

  const rpc = useCallback((type: keyof LocalApi) => (...args: unknown[]) => new Promise<unknown>((resolve) => {
    const n = netRef.current;
    if (!n) { resolve(null); return; }
    const reqId = crypto.randomUUID();
    pendingRpc.current.set(reqId, resolve);
    n.send('act', { reqId, uid: me, type, args: JSON.parse(JSON.stringify(args)) });
    setTimeout(() => { if (pendingRpc.current.delete(reqId)) resolve(null); }, 6000);
  }), [me]);
  const remote = useMemo(() => {
    if (!isMember) return null;
    const keys = Object.keys(localRef.current) as Array<keyof LocalApi>;
    return Object.fromEntries(keys.map((k) => [k, rpc(k)])) as unknown as LocalApi;
  }, [isMember, rpc]);
  const actions: LocalApi = remote ?? local;

  const myFighter = fighters.find((r) => r.user_id === me) ?? null;
  const isPausedNow = fight?.status === 'paused';
  const pauseKind: NpcCombatApi['pauseKind'] = isPausedNow ? (fight?.pause_kind === 'huddle' ? 'huddle' : 'host') : null;
  const pausedAtMs = isPausedNow && fight?.paused_at ? Date.parse(fight.paused_at) : NaN;
  const huddleUntilMs = pauseKind === 'huddle' && fight?.paused_until ? Date.parse(fight.paused_until) : NaN;
  const fightClock = Number.isFinite(pausedAtMs) ? pausedAtMs : now;
  const readyAt = myFighter?.last_action_at ? Date.parse(myFighter.last_action_at) + ACTION_COOLDOWN_MS : 0;
  const cooldownLeft = readyAt > fightClock ? Math.ceil((readyAt - fightClock) / 1000) : 0;

  const combat: NpcCombatApi = {
    ...baseCombat,
    fight,
    fighters,
    events,
    fallen: [],
    myFighter,
    iHaveFallen: false,
    isActive: fight?.status === 'active',
    isPaused: isPausedNow,
    isEnded: fight?.status === 'ended',
    busy: false,
    rolling: false,
    clockOffset: 0,
    connection: 'live',
    lastLineAt,
    cooldownLeft,
    pauseKind,
    pausedAtMs,
    huddleUntilMs,
    myHuddleUsed: !!objOf(fight?.huddles_used ?? null)[me],
    huddle: actions.huddle,
    openFight: actions.openFight,
    attack: actions.attack,
    cast: actions.cast,
    castFromCard: actions.castFromCard,
    secondWind: actions.secondWind,
    clash: actions.clash,
    heave: actions.heave,
    duelStart: actions.duelStart,
    duelEnd: actions.duelEnd,
    serverTime,
    drinkPotion: actions.drinkPotion,
    stabilize: actions.stabilize,
    givePotion: actions.givePotion,
    pause: actions.pause,
    resume: actions.resume,
    endFight: actions.endFight,
    addNpc,
    revivePlayer: actions.revivePlayer,
    reviveNpc: actions.reviveNpc,
  };

  const foeNpcs = useMemo<PartyNpc[]>(() => foes.map((foe, i) => ({
    id: npcIdOf(i), party_id: PARTY, name: foe.name, portrait_url: null, model: 'arena', on_stage: true, archived: false, sort_order: i,
    reacts_to_spells: false, player_user_id: null, mood: 'focused', on_stage_since: null,
    combat_stats: picked && i === 0 && !gauntlet ? picked.stats : { maxHp: foe.maxHp, ac: foe.ac, attackBonus: foe.attackBonus, damage: `${Math.max(1, Math.round(foe.damageAvg))}d1`, speed: foe.speed, skills: [], designedFor: 1 },
    combat_state: null, social_stats: { ...DEFAULT_NPC_SOCIAL_STATS }, created_at: iso(0), updated_at: iso(0),
  })), [foes, picked, gauntlet]);

  // ---- Local roster: Arena-only NPCs, guides, memories and attitudes (never saved) ----
  const [guides, setGuides] = useState<Record<string, { guide: string; secrets: string } & NpcGuideFields>>({});
  const [memories, setMemories] = useState<NpcMemoryNote[]>([]);
  const [attitudes, setAttitudes] = useState<NpcAttitudeRow[]>([]);
  const editBuilt = useCallback(async (id: string, p: Partial<PartyNpc>): Promise<PartyNpc> => {
    const cur = builtRef.current.find((n) => n.id === id);
    if (!cur) throw new Error('Practice opponents cannot be edited here.');
    const next = { ...cur, ...p, updated_at: iso(Date.now()) };
    builtRef.current = builtRef.current.map((n) => (n.id === id ? next : n));
    setBuilt(builtRef.current);
    return next;
  }, []);
  const saveGuide = useCallback(async (npcId: string, guide: string, secrets: string, extra?: Partial<NpcGuideFields>) => {
    setGuides((g) => ({ ...g, [npcId]: { wants: '', levers: '', hardLines: '', moodRange: '', grudgeStyle: 'normal', ...g[npcId], ...extra, guide, secrets } }));
  }, []);
  const guidesRef = useRef(guides); guidesRef.current = guides;
  const loadGuide = useCallback(async (npcId: string) => guidesRef.current[npcId] ?? { guide: '', secrets: '', wants: '', levers: '', hardLines: '', moodRange: '', grudgeStyle: 'normal' }, []);
  const addLocalNpc = useCallback(async (input: { name: string; model?: string; portraitUrl?: string | null; guide?: string; secrets?: string }) => {
    const t = iso(Date.now());
    const npc: PartyNpc = { id: crypto.randomUUID(), party_id: PARTY, name: cleanNpcName(input.name), portrait_url: input.portraitUrl ?? null, model: input.model || 'arena', on_stage: false, archived: false, sort_order: builtRef.current.length + 10, reacts_to_spells: false, player_user_id: null, mood: 'focused', on_stage_since: null, combat_stats: null, combat_state: null, social_stats: { ...DEFAULT_NPC_SOCIAL_STATS }, created_at: t, updated_at: t };
    builtRef.current = [...builtRef.current, npc];
    setBuilt(builtRef.current);
    if ((input.guide || '').trim() || (input.secrets || '').trim()) await saveGuide(npc.id, input.guide || '', input.secrets || '');
    return npc;
  }, [saveGuide]);
  const buildNpcs = useCallback(async (input: { description: string; useScene: boolean; count: number; role: Parameters<NpcRosterApi['buildNpcs']>[0]['role']; difficulty: Parameters<NpcRosterApi['buildNpcs']>[0]['difficulty']; fight: boolean }): Promise<NpcBuildDraft[]> => {
    const scene = input.useScene ? (getPracticeScene?.() ?? history.current.map((h) => h.text).join('\n')).slice(-5000) : '';
    const { data, error } = await supabase.functions.invoke('npc-build', { body: {
      ...input, practiceMode: true, practiceScene: scene,
      practiceCharacter: { name: ctx.name, level, ac: myAc, maxHP: maxHp },
      practiceTakenNames: [...foes.map((f) => f.name), ...builtRef.current.map((n) => n.name)].slice(0, 60),
    } });
    if (error) { const { message } = await readableFunctionError(error, 'The NPC builder could not answer. Try again.'); throw new Error(message); }
    return Array.isArray(data?.drafts) ? (data.drafts as NpcBuildDraft[]) : [];
  }, [getPracticeScene, ctx.name, level, myAc, maxHp, foes]);
  const createFromDraft = useCallback(async (draft: NpcBuildDraft, opts: { onStage: boolean }): Promise<PartyNpc> => {
    const guide = draft.attack.trim() ? `${draft.guide.trim()}\n\nIn a fight: ${draft.attack.trim()}.` : draft.guide.trim();
    const npc = await addLocalNpc({ name: draft.name });
    await saveGuide(npc.id, guide, draft.secrets, { wants: draft.wants, levers: draft.levers, hardLines: draft.hardLines, moodRange: draft.moodRange, grudgeStyle: draft.grudgeStyle });
    const full: PartyNpc = { ...npc, combat_stats: draft.combatStats, on_stage: opts.onStage };
    builtRef.current = builtRef.current.map((n) => (n.id === npc.id ? full : n));
    setBuilt(builtRef.current);
    return full;
  }, [addLocalNpc, saveGuide]);
  const attitudesRef = useRef(attitudes); attitudesRef.current = attitudes;

  const allNpcs = useMemo(() => [...foeNpcs, ...built], [foeNpcs, built]);
  const roster: NpcRosterApi = useMemo(() => ({
    ...baseRoster,
    partyId: null,
    npcs: allNpcs,
    active: allNpcs.filter((n) => !n.archived),
    onStage: allNpcs.filter((n) => n.on_stage && !n.archived),
    byId: new Map(allNpcs.map((n) => [n.id, n])),
    loaded: true,
    thinking: [],
    reload: async () => {},
    addNpc: addLocalNpc,
    updateNpc: (id, p) => editBuilt(id, p.name !== undefined ? { ...p, name: cleanNpcName(p.name) } : p),
    buildNpcs,
    createFromDraft,
    setOnStage: (id, on) => editBuilt(id, { on_stage: on }),
    archiveNpc: (id) => editBuilt(id, { archived: true, on_stage: false }),
    restoreNpc: (id) => editBuilt(id, { archived: false }),
    loadGuide,
    saveGuide,
    uploadPortrait: async (file: File) => URL.createObjectURL(file),
    askNpc: async () => false,
    askNpcs: async () => {},
    resolveSocialCheck: async () => false,
    setSocialStats: (id, stats) => editBuilt(id, { social_stats: sanitizeNpcSocialStats(stats) }),
    regenerateLine: async () => false,
    attitudes,
    attitudeFor: (npcId, userId) => attitudes.find((a) => a.npc_id === npcId && a.user_id === userId)?.score ?? 0,
    setAttitude: async (npcId, userId, characterName, score) => {
      const row: NpcAttitudeRow = { npc_id: npcId, party_id: PARTY, user_id: userId, character_name: characterName, score: Math.max(-2, Math.min(2, Math.round(score))), reason: 'Set by the host', updated_by: 'host', updated_at: iso(Date.now()) };
      setAttitudes((prev) => [...prev.filter((a) => !(a.npc_id === npcId && a.user_id === userId)), row]);
    },
    reloadAttitudes: async () => {},
    setReactsToSpells: (id, on) => editBuilt(id, { reacts_to_spells: on }),
    setMood: (id, mood) => editBuilt(id, { mood }),
    setCombatStats: (id, stats) => editBuilt(id, { combat_stats: stats }),
    loadSeats: async () => [{ user_id: me, character_name: ctx.name || 'You' }],
    loadMemories: async (npcId) => memories.filter((m) => m.npc_id === npcId),
    addMemory: async (npcId, note, kind = 'event') => {
      const text = note.replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!text) throw new Error('Write the note first.');
      const m: NpcMemoryNote = { id: crypto.randomUUID(), npc_id: npcId, note: text, source: 'host', kind, created_at: iso(Date.now()) };
      setMemories((prev) => [...prev, m]);
      return m;
    },
    updateMemory: async (id, note) => { const text = note.replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) throw new Error('A note cannot be empty. Delete it instead.'); setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, note: text, source: 'host' } : m))); },
    deleteMemory: async (id) => { setMemories((prev) => prev.filter((m) => m.id !== id)); },
    reactToSpell: async () => {},
    runScene: async () => false,
    sceneRunning: false,
    rememberScene: async () => ({ ok: false, message: 'Practice scenes are not remembered.' }),
    addStandIn: async () => { throw new Error('Stand-ins are not available in practice.'); },
    standInFor: () => null,
  }), [baseRoster, allNpcs, addLocalNpc, editBuilt, buildNpcs, createFromDraft, loadGuide, saveGuide, attitudes, memories, me, ctx.name]);

  return { combat, roster, reset, stats, currentFoe: foes[0] ?? null, wave };
}
