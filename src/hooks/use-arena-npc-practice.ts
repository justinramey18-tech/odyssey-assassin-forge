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

export type NpcRosterApi = ReturnType<typeof usePartyNpcs>;
type Finish = 'knockout' | 'kill';

const PARTY = 'arena-practice';
const FIGHT_ID = 'arena-fight';
const NPC_ROW = 'arena-npc';
const PLAYER_ROW = 'arena-player';
const FOE_NPC_ID = 'arena-foe';
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
  foe: Foe & { persona?: string };
  currentUserId: string | null;
  /** From use-arena-round-chat: puts opponent speech and fight results in the Live Table. */
  appendLine: (line: ArenaAppendLine) => string;
  /** Use the opponent's real AI voice (falls back to stock lines). */
  aiVoice?: boolean;
  /** Practice HP changes, for anything on screen that mirrors the sheet. Never the real character. */
  onPracticeHp?: (hp: number, maxHp: number) => void;
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

export function useArenaNpcPractice({ ctx, foe, currentUserId, appendLine, aiVoice = true, onPracticeHp }: ArenaPracticeOptions): ArenaPracticeApi {
  const baseCombat = useNpcCombat({ partyId: null, currentUserId, isHost: true, sheetHp: null });
  const baseRoster = usePartyNpcs(null);
  const me = currentUserId || 'arena-player';
  const maxHp = Math.max(1, num(ctx.maxHP, 30));
  const myAc = num(ctx.defenses?.armorClass, 12);
  const level = Math.max(1, num(ctx.level, 5));
  const atkBonus = 2 + Math.floor((level - 1) / 4) + 3;

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

  // A local clock that always moves, so no countdown can freeze.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const serverTime = useCallback(() => Date.now(), []);

  const say = useCallback((who: 'foe' | 'table', text: string) => {
    history.current = [...history.current.slice(-19), { who, text }];
    if (who === 'foe') {
      appendLine({ content: text, characterName: foe.name, npcId: FOE_NPC_ID, inCharacter: true });
      setLastLineAt((m) => ({ ...m, [FOE_NPC_ID]: Date.now() }));
    } else appendLine({ content: `⚔ ${text}`, characterName: '⚔ Combat', inCharacter: false });
  }, [appendLine, foe.name]);

  const speak = useCallback(async (fallback: string, force = false) => {
    if (!aiVoice) { say('foe', fallback); return; }
    if (speechBusy.current || (!force && Date.now() - lastSpeech.current < 4000)) return;
    speechBusy.current = true; lastSpeech.current = Date.now();
    const rows = rowsRef.current;
    const p = rows.find((r) => r.id === PLAYER_ROW); const n = rows.find((r) => r.id === NPC_ROW);
    const sys = buildSparPrompt({ foeName: foe.name, foePersona: foe.persona, playerName: ctx.name || 'the challenger', foeHp: n?.hp ?? foe.maxHp, foeMax: foe.maxHp, myHp: p?.hp ?? maxHp, myMax: maxHp });
    const text = await sparLine(sys, history.current);
    speechBusy.current = false;
    say('foe', text || fallback);
  }, [aiVoice, say, foe.name, foe.persona, foe.maxHp, ctx.name, maxHp]);

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
    patch(NPC_ROW, () => ({ pending: null, strike_at: null }));
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
    const other = id === PLAYER_ROW ? NPC_ROW : PLAYER_ROW;
    patch(other, (r) => ({ duel_charge: Math.min(DU.DUEL_CHARGE.max, r.duel_charge + gain) }));
    event({ kind, actor_name: by, target_name: row.name, target_user_id: row.user_id, hp_delta: -n, detail, d20: d20 ?? null, total: total ?? null });
    if (id === PLAYER_ROW) onPracticeHp?.(hp, maxHp);
    if (hp === 0) {
      if (id === NPC_ROW) endWith('victory', `${foe.name} is beaten! Victory.`);
      else { void speak('Yield! Dust yourself off and go again.', true); endWith('defeat', `${ctx.name || 'You'} went down. Practice over — nothing lost.`); }
    } else if (id === NPC_ROW && Math.random() < 0.5) void speak(pick(HURT));
  }, [patch, event, endWith, speak, onPracticeHp, maxHp, foe.name, ctx.name]);

  const heal = useCallback((id: string, amount: number, label: string) => {
    const n = Math.round(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return 0;
    const hp = Math.min(row.max_hp, row.hp + n);
    patch(id, () => ({ hp, status: row.status === 'down' && hp > 0 ? 'up' : row.status }));
    event({ kind: 'heal', actor_name: row.name, target_name: row.name, target_user_id: row.user_id, hp_delta: hp - row.hp, detail: label });
    if (id === PLAYER_ROW) onPracticeHp?.(hp, maxHp);
    return hp - row.hp;
  }, [patch, event, onPracticeHp, maxHp]);

  const spendAction = useCallback(() => patch(PLAYER_ROW, () => ({ last_action_at: iso(Date.now()) })), [patch]);
  const live = () => fightRef.current?.status === 'active';

  const openFight = useCallback(async (_npcId: string, _opts?: { weaponName?: string; finish?: Finish }) => {
    const t = Date.now();
    const player = baseRow(t, { id: PLAYER_ROW, kind: 'player', user_id: me, name: ctx.name || 'You', hp: maxHp, max_hp: maxHp, ac: myAc });
    const npc = baseRow(t, { id: NPC_ROW, kind: 'npc', npc_id: FOE_NPC_ID, name: foe.name, hp: foe.maxHp, max_hp: foe.maxHp, ac: foe.ac, act_every_ms: GAP[foe.speed], next_action_at: iso(t + GAP[foe.speed]) });
    rowsRef.current = [player, npc];
    setFighters([player, npc]);
    setEvents([]);
    setFight({ id: FIGHT_ID, party_id: PARTY, status: 'active', outcome: null, started_at: iso(t), started_by: me, ended_at: null, huddles_used: {}, pause_kind: null, paused_at: null, paused_until: null, updated_at: iso(t) });
    say('table', `${foe.name} steps into the ring. Nothing here counts.`);
    void speak(pick(TAUNTS), true);
    return { ok: true };
  }, [me, ctx.name, maxHp, myAc, foe, say, speak]);

  /** One player strike against the practice opponent. */
  const strike = useCallback((label: string, d20: number, total: number, dmg: number) => {
    const npc = rowsRef.current.find((r) => r.id === NPC_ROW);
    if (!npc) return null;
    const crit = d20 === 20;
    const hit = d20 !== 1 && (crit || total >= npc.ac);
    const damage = hit ? Math.max(1, Math.round(crit ? dmg * 2 : dmg)) : 0;
    if (hit) hurt(NPC_ROW, damage, ctx.name || 'You', 'attack', `${label}: ${crit ? 'critical ' : ''}hit for ${damage}.`, d20, total);
    else event({ kind: 'attack', actor_name: ctx.name || 'You', target_name: npc.name, detail: `${label}: ${total} vs AC ${npc.ac}, miss.`, d20, total });
    say('table', hit ? `${label} — ${total} vs AC ${npc.ac}, ${crit ? 'critical! ' : ''}${damage} damage.` : `${label} — ${total} vs AC ${npc.ac}, miss.`);
    return { ok: true, d20, total, hit, crit, damage };
  }, [hurt, event, say, ctx.name]);

  const attack = useCallback(async (_targetId: string, opts?: { weaponName?: string; finish?: Finish }) => {
    if (!live()) return null;
    spendAction();
    const d20 = roll(20);
    return strike(opts?.weaponName || 'Attack', d20, d20 + atkBonus, roll(8) + 3);
  }, [spendAction, strike, atkBonus]);

  const cast = useCallback(async (targetId: string, spell: { name: string; level: number }, intent: 'damage' | 'heal', _finish?: Finish) => {
    if (!live()) return null;
    spendAction();
    const dice = Math.max(1, spell.level + 1);
    let amt = 0; for (let i = 0; i < dice; i++) amt += roll(8);
    if (intent === 'heal') return { ok: true, healed: heal(targetId === NPC_ROW ? NPC_ROW : PLAYER_ROW, amt + 3, `${spell.name}: +${amt + 3} HP`) };
    const d20 = roll(20);
    return strike(spell.name, d20, d20 + atkBonus, amt);
  }, [spendAction, heal, strike, atkBonus]);

  const castFromCard = useCallback(async (targetId: string, card: ActionCard, _finish?: Finish, _extra?: string[]) => {
    if (!live()) return null;
    spendAction();
    const dmg = num(card.damageTotal, 0);
    const amount = num(card.amount, 0);
    if (card.kind === 'heal' || (amount > 0 && !dmg)) return { ok: true, healed: heal(targetId === NPC_ROW ? NPC_ROW : PLAYER_ROW, amount, `${card.action}: +${amount} HP`) };
    if (card.resolve === 'save') {
      const save = roll(20) + 2;
      const dc = num(card.saveDC, 13);
      const d = save >= dc ? Math.floor(dmg / 2) : dmg;
      if (d > 0) hurt(NPC_ROW, d, ctx.name || 'You', 'attack', `${card.action}: ${foe.name} rolls ${save} vs DC ${dc}.`);
      say('table', `${card.action} — ${foe.name} rolls ${save} vs DC ${dc}: ${save >= dc ? 'saves, half' : 'fails'}, ${d} damage.`);
      return { ok: true, hit: d > 0, damage: d, saved: save >= dc ? 1 : 0 };
    }
    const d20 = num(card.d20, roll(20));
    return strike(card.action, d20, num(card.attackTotal, d20 + atkBonus), dmg);
  }, [spendAction, heal, hurt, strike, say, ctx.name, foe.name, atkBonus]);

  const secondWind = useCallback(async (targetId?: string) => {
    if (!live()) return null;
    const p = rowsRef.current.find((r) => r.id === PLAYER_ROW);
    if (!p || p.second_wind) return null;
    const amt = roll(10) + level;
    const healed = heal(targetId && targetId !== PLAYER_ROW ? targetId : PLAYER_ROW, amt, `Second Wind: +${amt} HP`);
    patch(PLAYER_ROW, () => ({ second_wind: 'used' }));
    return { ok: true, healed };
  }, [heal, patch, level]);

  const drinkPotion = useCallback(async (itemName: string) => {
    if (!live()) return null;
    const amt = roll(4) + roll(4) + 2;
    return { ok: true, healed: heal(PLAYER_ROW, amt, `${itemName}: +${amt} HP`), resolve: 0 };
  }, [heal]);

  // Counter Clash: judge one tap against the opponent's chain and store it on my row.
  const clash = useCallback(async (_npcFighterId: string, side: 'left' | 'top' | 'right', tapAt: number) => {
    const npc = rowsRef.current.find((r) => r.id === NPC_ROW);
    const me_ = rowsRef.current.find((r) => r.id === PLAYER_ROW);
    const chain = M.cleanClash(objOf(npc?.pending ?? null).clash);
    const hitAt = npc?.strike_at ? Date.parse(npc.strike_at) : NaN;
    if (!npc || !me_ || !chain || !Number.isFinite(hitAt)) return null;
    const results = M.clashResultsOf(me_.minigame, chain.id);
    const j = M.judgeClash(chain, hitAt, tapAt, side, results);
    if (!j) return null;
    const r = [...results]; r[j.index] = j.q;
    patch(PLAYER_ROW, (row) => ({ minigame: asJson({ ...objOf(row.minigame), clash: { id: chain.id, r } }) }));
    return { ok: true, index: j.index, quality: j.q };
  }, [patch]);

  // Pin: one HEAVE on the rope.
  const heave = useCallback(async (tapAt: number) => {
    const me_ = rowsRef.current.find((r) => r.id === PLAYER_ROW);
    const s = M.cleanStruggle(objOf(me_?.minigame ?? null).struggle);
    if (!me_ || !s) return null;
    const r = M.heave(s, tapAt);
    if (!r) return null;
    patch(PLAYER_ROW, (row) => ({ minigame: asJson({ ...objOf(row.minigame), struggle: r.state }), ...(r.free ? { pinned_until: null } : {}) }));
    if (r.free) {
      const started = me_.pinned_until ? Date.parse(me_.pinned_until) - PIN_MS : tapAt;
      event({ kind: 'pin', actor_name: me_.name, target_name: me_.name, target_user_id: me_.user_id, detail: 'Broke free!' });
      say('table', `You broke free in ${((tapAt - started) / 1000).toFixed(1)}s.`);
    }
    return { ok: true, free: r.free, struggle: r.state };
  }, [patch, event, say]);

  const duelStart = useCallback(async (_npcFighterId: string, opts?: { weaponName?: string; finish?: Finish; feel?: DU.DuelFeel }) => {
    if (!live()) return null;
    const P = DU.deriveDuel({ level, dex: 14, ac: myAc, maxHp, npcAttack: foe.attackBonus, npcDamageAvg: foe.damageAvg, npcSpeed: foe.speed });
    const duel = DU.newDuel({ id: `d${Date.now()}`, npcId: NPC_ROW, npcName: foe.name, startAt: Date.now() + DU.DUEL_LEAD_MS, finish: opts?.finish ?? 'knockout', weapon: opts?.weaponName ?? null }, P, Math.random);
    patch(PLAYER_ROW, (r) => ({ duel_charge: 0, minigame: asJson({ ...objOf(r.minigame), duel }) }));
    patch(NPC_ROW, () => ({ pending: null, strike_at: null }));
    say('table', `🤺 You call ${foe.name} out — Duel!`);
    return { ok: true, duel };
  }, [patch, say, level, myAc, maxHp, foe]);

  const duelEnd = useCallback(async (duelId: string, inputs: DU.DuelInput[]): Promise<DuelVerdict | null> => {
    const me_ = rowsRef.current.find((r) => r.id === PLAYER_ROW);
    const duel = DU.cleanDuel(objOf(me_?.minigame ?? null).duel);
    if (!me_ || !duel || duel.id !== duelId) return null;
    const out = DU.replayDuel(duel, inputs);
    const npc = rowsRef.current.find((r) => r.id === NPC_ROW);
    const won = out.hits <= out.perfect;
    const taken = won ? 0 : Math.round(out.hits * foe.damageAvg * 0.6);
    const dealt = won ? (npc?.hp ?? 0) : 0;
    patch(PLAYER_ROW, (r) => { const m = { ...objOf(r.minigame) }; delete m.duel; return { minigame: asJson(m) }; });
    patch(NPC_ROW, () => ({ next_action_at: iso(Date.now() + GAP[foe.speed]) }));
    if (won) hurt(NPC_ROW, dealt, me_.name, 'attack', 'Won the duel.');
    else hurt(PLAYER_ROW, taken, foe.name, 'attack', 'Lost the duel.');
    return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, dealt, taken, defeated: won, npcName: foe.name };
  }, [patch, hurt, foe]);

  const stabilize = useCallback(async (_targetId: string) => null, []);
  const givePotion = useCallback(async (_targetId: string, _itemName: string) => null, []);
  const huddle = useCallback(async () => {
    const t = Date.now();
    setFight((f) => (f ? { ...f, status: 'paused', pause_kind: 'huddle', paused_at: iso(t), paused_until: iso(t + 20000), huddles_used: { [me]: true } } : f));
    return { ok: true };
  }, [me]);
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
    const f = fight;
    if (!f) return;
    if (f.status === 'paused') {
      if (f.pause_kind === 'huddle' && f.paused_until && now >= Date.parse(f.paused_until)) void resume();
      return;
    }
    if (f.status !== 'active') return;
    const npc = fighters.find((r) => r.id === NPC_ROW);
    const p = fighters.find((r) => r.id === PLAYER_ROW);
    if (!npc || !p || npc.status !== 'up' || p.status !== 'up') return;
    if (DU.cleanDuel(objOf(p.minigame).duel)) return; // a duel holds the opponent
    // Pin expired without escape.
    if (p.pinned_until && now > Date.parse(p.pinned_until)) {
      patch(PLAYER_ROW, () => ({ pinned_until: null }));
      hurt(PLAYER_ROW, foe.damageAvg * 1.5, foe.name, 'npc_attack', 'The pin held.');
      return;
    }
    const pend = objOf(npc.pending);
    const chain = M.cleanClash(pend.clash);
    if (chain && npc.strike_at) {
      const hitAt = Date.parse(npc.strike_at);
      if (now <= hitAt + M.CLASH_HOLD_MS + 300) return;
      const results = M.clashResultsOf(p.minigame, chain.id);
      const perfect = M.chainPerfect(chain, results);
      patch(NPC_ROW, () => ({ pending: null, strike_at: null, turn_no: npc.turn_no + 1, next_action_at: iso(now + GAP[foe.speed]) }));
      if (perfect) {
        const d = M.counterDamage(roll(8) + 3, chain.move);
        hurt(NPC_ROW, d, p.name, 'attack', `Counter Clash! Perfect chain — ${d} damage.`);
      } else if (chain.move === 'pin') {
        const t0 = now;
        patch(PLAYER_ROW, (r) => ({ pinned_until: iso(t0 + PIN_MS), minigame: asJson({ ...objOf(r.minigame), struggle: M.newStruggle(Math.floor(Math.random() * 1e9), t0) }) }));
        event({ kind: 'pin', actor_name: foe.name, target_name: p.name, target_user_id: p.user_id, detail: `${foe.name} pins ${p.name}!` });
        say('table', `${foe.name} grabs you — Pinned! Break free.`);
      } else {
        const scale = M.chainScale(chain, results);
        hurt(PLAYER_ROW, scale * foe.damageAvg * (chain.move === 'signature' ? 2 : 1.3), foe.name, 'npc_attack', `${String(pend.skill || 'Big move')} lands.`);
      }
      return;
    }
    const due = npc.next_action_at ? Date.parse(npc.next_action_at) : NaN;
    if (!Number.isFinite(due) || now < due || p.pinned_until) return;
    const r = Math.random();
    if (r < 0.6) void speak(pick(TAUNTS), true);
    if (r < 0.45 || (r < 0.6 && !p.pinned_until)) {
      const move: M.ClashMove = r < 0.45 ? pick<M.ClashMove>(['heavy', 'signature', 'sweep']) : 'pin';
      const c = M.buildClash(`c${now}`, move, roll);
      const windup = 1200 + Math.max(0, -M.clashStartsAt(c, 0));
      const skill = move === 'pin' ? 'Pin' : move === 'signature' ? 'Signature' : move === 'sweep' ? 'Sweep' : 'Heavy Blow';
      patch(NPC_ROW, () => ({ pending: asJson({ skill, type: move, targets: [PLAYER_ROW], windup_ms: windup, clash: c }), strike_at: iso(now + windup) }));
      event({ kind: 'intent', actor_name: foe.name, target_name: p.name, target_user_id: p.user_id, detail: `${foe.name} winds up ${skill}!` });
      say('table', `⚠ ${foe.name} winds up ${skill} — Counter Clash!`);
      return;
    }
    const d20 = roll(20);
    const atk = d20 + foe.attackBonus;
    patch(NPC_ROW, () => ({ turn_no: npc.turn_no + 1, last_action_at: iso(now), next_action_at: iso(now + GAP[foe.speed]) }));
    if (d20 !== 1 && (d20 === 20 || atk >= p.ac)) {
      const dmg = Math.max(1, Math.round(foe.damageAvg * (0.6 + Math.random() * 0.8)));
      hurt(PLAYER_ROW, dmg, foe.name, 'npc_attack', `${foe.name} hits (${atk} vs AC ${p.ac}).`, d20, atk);
      say('table', `${foe.name} hits — ${atk} vs your AC ${p.ac}, ${dmg} damage.`);
    } else {
      event({ kind: 'npc_attack', actor_name: foe.name, target_name: p.name, target_user_id: p.user_id, detail: `${foe.name} misses (${atk} vs AC ${p.ac}).`, d20, total: atk });
      say('table', `${foe.name} swings — ${atk} vs your AC ${p.ac}, miss.`);
    }
  }, [now, fight, fighters, foe, patch, hurt, event, say, speak, resume]);

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

  const foeNpc = useMemo<PartyNpc>(() => ({
    id: FOE_NPC_ID, party_id: PARTY, name: foe.name, portrait_url: null, model: 'arena', on_stage: true, archived: false, sort_order: 0,
    reacts_to_spells: false, player_user_id: null, mood: 'focused', on_stage_since: null,
    combat_stats: { maxHp: foe.maxHp, ac: foe.ac, attackBonus: foe.attackBonus, damage: `${Math.max(1, Math.round(foe.damageAvg))}d1`, speed: foe.speed, skills: [], designedFor: 1 },
    combat_state: null, created_at: iso(0), updated_at: iso(0),
  }), [foe]);
  const roster: NpcRosterApi = useMemo(() => ({
    ...baseRoster,
    npcs: [foeNpc],
    active: [foeNpc],
    onStage: [foeNpc],
    byId: new Map([[FOE_NPC_ID, foeNpc]]),
    loaded: true,
  }), [baseRoster, foeNpc]);

  return { combat, roster, reset };
}
