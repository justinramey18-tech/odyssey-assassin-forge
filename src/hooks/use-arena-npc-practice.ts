// Arena practice: a local fight that drives the real NpcCombatOverlay.
// The real useNpcCombat / usePartyNpcs run with no party (inert) and supply the
// exact return types; local fight rows, timers and rules are layered on top.
// Mechanics are the Arena's existing practice rules (cadence, swings, Counter
// Clash, Pin, Duel, AI voice). Nothing here calls the server or writes a row.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNpcCombat, type NpcCombatApi, type FightRow, type FighterRow, type FightEventRow } from '@/hooks/use-npc-combat';
import { usePartyNpcs, type PartyNpc } from '@/hooks/use-party-npcs';
import type { CharacterContext } from '@/components/oracle/types';
import type { ActionCard } from '@/lib/roundChatActionCard';
import type { DuelVerdict } from '@/components/ai-dm/DuelWheel';
import type { Json } from '@/integrations/supabase/types';
import type { Foe } from '@/components/arena/ArenaPractice';
import * as M from '@/lib/combatMinigames';
import * as DU from '@/lib/combatDuel';
import { buildSparPrompt, sparLine, type SparTurn } from '@/lib/arena/arenaAi';
import type { ArenaAppendLine } from '@/hooks/use-arena-round-chat';
import type { SparringNet, SparringPlayer } from '@/lib/arena/sparringNet';

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
}

export interface ArenaPracticeApi { combat: NpcCombatApi; roster: NpcRosterApi; reset: () => void }

function baseRow(now: number, over: Partial<FighterRow>): FighterRow {
  return {
    ac: 10, act_every_ms: null, action_seq: 0, cooldowns: {}, created_at: iso(now), death_failures: 0, death_successes: 0,
    duel_charge: 0, fight_id: FIGHT_ID, hp: 1, id: '', kind: 'player', last_action_at: null, last_seen_at: iso(now),
    last_stand_used: false, max_hp: 1, minigame: {}, name: '', next_action_at: null, next_save_at: null, npc_id: null,
    party_id: PARTY, pending: null, perks: [], pinned_until: null, resolve: 0, resolve_at: iso(now), resolve_rate: 1,
    second_wind: null, signature_turn: 0, status: 'up', strike_at: null, threat: {}, turn_no: 0, updated_at: iso(now),
    user_id: null, ward: 0, ward_until: null, ...over,
  };
}

export function useArenaNpcPractice({ ctx, foe: oneFoe, foes: manyFoes, currentUserId, appendLine, aiVoice = true, onPracticeHp, net = null }: ArenaPracticeOptions): ArenaPracticeApi {
  const isMember = net?.role === 'member';
  const [remoteFoes, setRemoteFoes] = useState<Array<Foe & { persona?: string }>>([]);
  const foes = useMemo(() => (isMember ? remoteFoes : manyFoes && manyFoes.length ? manyFoes : oneFoe ? [oneFoe] : []).slice(0, 6), [isMember, remoteFoes, manyFoes, oneFoe]);
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
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const serverTime = useCallback(() => Date.now(), []);

  const say = useCallback((who: 'foe' | 'table', text: string, rowId: string = npcRow(0)) => {
    history.current = [...history.current.slice(-19), { who, text }];
    if (who === 'foe') {
      const i = Math.max(0, Number(rowId.slice(NPC_PREFIX.length)) || 0);
      appendLine({ content: text, characterName: foeAt(rowId)?.name ?? 'Opponent', npcId: npcIdOf(i), inCharacter: true });
      setLastLineAt((m) => ({ ...m, [npcIdOf(i)]: Date.now() }));
    } else appendLine({ content: `⚔ ${text}`, characterName: '⚔ Combat', inCharacter: false });
  }, [appendLine, foeAt]);

  const speak = useCallback(async (fallback: string, force = false, rowId: string = npcRow(0)) => {
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
  }, [aiVoice, say, foeAt, ctx.name, maxHp]);

  const event = useCallback((e: Partial<FightEventRow> & { kind: string; detail: string }) => {
    const row: FightEventRow = { actor_name: '', applied_at: null, created_at: iso(Date.now()), d20: null, fight_id: FIGHT_ID, hp_delta: 0, id: crypto.randomUUID(), party_id: PARTY, target_name: '', target_user_id: null, total: null, ...e };
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
    if (id === prow(me)) onPracticeHp?.(hp, maxHp);
    if (hp === 0) {
      if (isNpcRow(id)) {
        const standing = rowsRef.current.filter((r) => isNpcRow(r.id) && r.status === 'up');
        if (standing.length === 0) endWith('victory', rowsRef.current.filter((r) => isNpcRow(r.id)).length > 1 ? 'Every opponent is beaten! Victory.' : `${row.name} is beaten! Victory.`);
        else say('table', `${row.name} is down! ${standing.length} still standing.`);
      } else {
        const s = rowsRef.current.find((r) => isNpcRow(r.id) && r.status === 'up');
        const standing = rowsRef.current.filter((r) => isPlayerRow(r.id) && r.status === 'up');
        if (standing.length > 0) say('table', `${row.name} is down! ${standing.length} still fighting.`);
        else { if (s) void speak('Yield! Dust yourself off and go again.', true, s.id); endWith('defeat', standing.length === 0 && rowsRef.current.filter((r) => isPlayerRow(r.id)).length > 1 ? 'The whole party is down. Practice over — nothing lost.' : `${row.name} went down. Practice over — nothing lost.`); }
      }
    } else if (isNpcRow(id) && Math.random() < 0.5) void speak(pick(HURT), false, id);
  }, [patch, event, endWith, speak, say, onPracticeHp, maxHp, ctx.name]);

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

  const openFight = useCallback(async (_npcId: string, _opts?: { weaponName?: string; finish?: Finish }) => {
    const t = Date.now();
    const players = Object.keys(statsRef.current).map((uid) => playerRow(uid, t));
    const npcs = foes.map((foe, i) => baseRow(t, { id: npcRow(i), kind: 'npc', npc_id: npcIdOf(i), name: foe.name, hp: foe.maxHp, max_hp: foe.maxHp, ac: foe.ac, act_every_ms: GAP[foe.speed], next_action_at: iso(t + GAP[foe.speed] + i * 1700) }));
    rowsRef.current = [...players, ...npcs];
    setFighters([...players, ...npcs]);
    setEvents([]);
    setFight({ id: FIGHT_ID, party_id: PARTY, status: 'active', outcome: null, started_at: iso(t), started_by: me, ended_at: null, huddles_used: {}, pause_kind: null, paused_at: null, paused_until: null, updated_at: iso(t) });
    say('table', `${foes.map((f) => f.name).join(', ')} ${foes.length > 1 ? 'step' : 'steps'} into the ring. Nothing here counts.`);
    void speak(pick(TAUNTS), true, npcRow(0));
    return { ok: true };
  }, [me, foes, say, speak]);

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
    return { ok: true, index: j.index, quality: j.q };
  }, [patch]);

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
    }
    return { ok: true, free: r.free, struggle: r.state };
  }, [patch, event, say]);

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
    if (won) hurt(npc.id, dealt, me_.name, 'attack', 'Won the duel.');
    else hurt(PR(), taken, npc.name, 'attack', 'Lost the duel.');
    return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, dealt, taken, defeated: won, npcName: npc.name };
  }, [patch, hurt, foeAt]);

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
  const reset = useCallback(() => { setFight(null); setFighters([]); setEvents([]); }, []);
  const revivePlayer = useCallback(async (_userId: string) => { reset(); return { ok: true }; }, [reset]);
  const reviveNpc = useCallback(async (_npcId: string) => { reset(); return { ok: true }; }, [reset]);

  // The opponent's turn, a huddle's end and big-move landings, all on the local clock.
  useEffect(() => {
    if (isMember) return; // the host's phone runs the opponents
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
    if (foe.attackBonus <= -10) { patch(npc.id, () => ({ next_action_at: iso(now + GAP[foe.speed]) })); return; } // a dummy never swings
    const p = pick(free);
    const r = Math.random();
    if (r < 0.6) void speak(pick(TAUNTS), true, npc.id);
    if (r < 0.6) {
      const move: M.ClashMove = r < 0.45 ? pick<M.ClashMove>(['heavy', 'signature', 'sweep']) : 'pin';
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
  }, [isMember, me, now, fight, fighters, foeAt, patch, hurt, event, say, speak, resume]);

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
    huddle,
    openFight,
    attack,
    cast,
    castFromCard,
    secondWind,
    clash,
    heave,
    duelStart,
    duelEnd,
    serverTime,
    drinkPotion,
    stabilize,
    givePotion,
    pause,
    resume,
    endFight,
    addNpc,
    revivePlayer,
    reviveNpc,
  };

  const foeNpcs = useMemo<PartyNpc[]>(() => foes.map((foe, i) => ({
    id: npcIdOf(i), party_id: PARTY, name: foe.name, portrait_url: null, model: 'arena', on_stage: true, archived: false, sort_order: i,
    reacts_to_spells: false, player_user_id: null, mood: 'focused', on_stage_since: null,
    combat_stats: { maxHp: foe.maxHp, ac: foe.ac, attackBonus: foe.attackBonus, damage: `${Math.max(1, Math.round(foe.damageAvg))}d1`, speed: foe.speed, skills: [], designedFor: 1 },
    combat_state: null, created_at: iso(0), updated_at: iso(0),
  })), [foes]);
  const roster: NpcRosterApi = useMemo(() => ({
    ...baseRoster,
    npcs: foeNpcs,
    active: foeNpcs,
    onStage: foeNpcs,
    byId: new Map(foeNpcs.map((n) => [n.id, n])),
    loaded: true,
  }), [baseRoster, foeNpcs]);

  return { combat, roster, reset };
}
