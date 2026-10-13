// Party Arena: one shared practice boss kept in arena_rooms, fought through the real NpcCombatOverlay.
// The boss's HP and the scoreboard are shared; each player's practice HP, Resolve, cooldowns, Duel
// and the boss's swings at them stay local to their own phone (useArenaNpcPractice, whose base
// useNpcCombat/usePartyNpcs run with no party and are inert). Never writes campaign tables.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NpcCombatApi, FighterRow } from '@/hooks/use-npc-combat';
import type { PartyNpcsApi } from '@/hooks/use-party-npcs';
import { useArenaNpcPractice } from '@/hooks/use-arena-npc-practice';
import type { ArenaAppendLine } from '@/hooks/use-arena-round-chat';
import type { CharacterContext } from '@/components/oracle/types';
import type { ActionCard } from '@/lib/roundChatActionCard';
import type { Foe } from '@/components/arena/ArenaPractice';
import {
  ARENA_BOSSES, openArenaRoom, fetchArenaRoom, watchArenaRoom, reportArenaHit, resetArenaRoom, closeArenaRoom,
  type ArenaRoom, type ArenaRoomState, type ArenaBoss, type ArenaMemberScore,
} from '@/lib/arena/arenaRoom';

export interface ArenaPartyPracticeOptions {
  enabled: boolean;
  /** The real party: used ONLY to find/open the arena_rooms practice row. */
  partyId: string | null;
  currentUserId: string | null;
  characterName: string;
  ctx: CharacterContext;
  appendLine: (line: ArenaAppendLine) => string;
}

export type ArenaRoomStatus = 'idle' | 'opening' | 'open' | 'closed' | 'error';

export interface ArenaPartyPracticeApi {
  combat: NpcCombatApi;
  roster: PartyNpcsApi;
  room: ArenaRoom | null;
  status: ArenaRoomStatus;
  isHost: boolean;
  scores: Array<ArenaMemberScore & { userId: string }>;
  resetBoss: (boss?: ArenaBoss) => Promise<void>;
  closeRoom: () => Promise<void>;
}

const POLL_MS = 2000;
const roll = (s: number) => 1 + Math.floor(Math.random() * s);
const num = (v: unknown, f: number) => (Number.isFinite(Number(v)) ? Number(v) : f);

/** Plain weapon swing from the real character: best of STR/DEX plus proficiency. */
function weaponCard(ctx: CharacterContext, label: string): ActionCard {
  const a = ctx.abilityScores;
  const mod = Math.max(num(a?.strength?.modifier, 0), num(a?.dexterity?.modifier, 0));
  const level = Math.max(1, num(ctx.level, 1));
  const prof = num(ctx.proficiencies?.bonus, 2 + Math.floor((level - 1) / 4));
  const d20 = roll(20);
  const die = roll(8);
  return { action: label, kind: 'attack', d20, attackBonus: mod + prof, attackTotal: d20 + mod + prof, damageTotal: Math.max(1, die + mod), damageFormula: `1d8${mod >= 0 ? '+' : ''}${mod}`, damageRolls: [die] };
}

export function useArenaPartyPractice({ enabled, partyId, currentUserId, characterName, ctx, appendLine }: ArenaPartyPracticeOptions): ArenaPartyPracticeApi {
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [status, setStatus] = useState<ArenaRoomStatus>('idle');
  const roomRef = useRef(room); roomRef.current = room;
  const seen = useRef<Set<string>>(new Set());
  const mine = useRef<Set<string>>(new Set());
  const appendRef = useRef(appendLine); appendRef.current = appendLine;
  const me = currentUserId || 'arena-player';
  const myName = characterName || ctx.name || 'You';

  // Merge a room state from realtime or polling; ignore older snapshots.
  const accept = useCallback((state: ArenaRoomState, updatedAt?: string) => {
    setRoom((r) => {
      if (!r) return r;
      if (updatedAt && r.updated_at && updatedAt < r.updated_at) return r;
      return { ...r, state, updated_at: updatedAt ?? r.updated_at };
    });
    for (const e of state.events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (mine.current.has(e.id) || e.userId === me) continue; // my own hit was already narrated locally
      appendRef.current({ content: `⚔ ${e.name} hits ${state.boss.name} for ${e.damage}.${e.detail ? ` ${e.detail}` : ''}`, characterName: '⚔ Combat', inCharacter: false });
    }
  }, [me]);

  // Open + watch + poll, only while enabled.
  useEffect(() => {
    if (!enabled || !partyId || !currentUserId) { setStatus('idle'); return; }
    let alive = true;
    let stopWatch: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    setStatus('opening');
    void (async () => {
      const r = await openArenaRoom(partyId, currentUserId);
      if (!alive) return;
      if (!r) { setStatus('error'); return; }
      for (const e of r.state.events) seen.current.add(e.id); // don't replay history
      setRoom(r); setStatus('open');
      const closed = () => { if (alive) { setStatus('closed'); setRoom(null); } };
      stopWatch = watchArenaRoom(r.id, (s, at) => { if (alive) accept(s, at); }, closed);
      poll = setInterval(async () => {
        const got = await fetchArenaRoom(r.id);
        if (!alive || got === null) return;
        if (got === 'closed') { closed(); return; }
        accept(got.state, got.updated_at);
      }, POLL_MS);
    })();
    return () => { alive = false; stopWatch?.(); if (poll) clearInterval(poll); };
  }, [enabled, partyId, currentUserId, accept]);

  const boss = room?.state.boss ?? null;
  const foe = useMemo<(Foe & { persona?: string }) | undefined>(() => (boss ? { name: boss.name, maxHp: boss.maxHp, ac: boss.ac, attackBonus: boss.attackBonus, damageAvg: boss.damageAvg, speed: boss.speed, persona: 'A tireless training construct of the party arena.' } : undefined),
    // Only rebuild when the boss identity changes, not on every HP tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boss?.name, boss?.maxHp, boss?.ac, boss?.attackBonus, boss?.damageAvg, boss?.speed]);

  const practice = useArenaNpcPractice({ ctx, foe, currentUserId, appendLine, aiVoice: false, enabled: enabled && status === 'open' && !!foe });
  const base = practice.combat;

  // Host reset (new boss / resetAt): restart my local fight.
  const resetAt = room?.state.resetAt ?? 0;
  const lastReset = useRef(resetAt);
  const practiceReset = practice.reset;
  useEffect(() => { if (resetAt !== lastReset.current) { lastReset.current = resetAt; practiceReset(); } }, [resetAt, practiceReset]);

  // Every local hit on the boss is reported once to the shared room.
  const reported = useRef<Set<string>>(new Set());
  useEffect(() => {
    const r = roomRef.current;
    if (!r || !boss) return;
    for (const e of base.events) {
      if (reported.current.has(e.id)) continue;
      reported.current.add(e.id);
      const dmg = -num(e.hp_delta, 0);
      if (dmg <= 0 || e.target_user_id || e.target_name !== boss.name || e.actor_name !== (ctx.name || 'You')) continue;
      mine.current.add(e.id);
      void reportArenaHit(r.id, me, myName, dmg, e.id).then((s) => { if (s) accept(s); });
    }
  }, [base.events, boss, ctx.name, me, myName, accept]);

  // Shared boss HP always wins on screen.
  const bossDown = !!boss && boss.hp <= 0;
  const fighters = useMemo<FighterRow[]>(() => base.fighters.map((f) => (f.kind === 'npc' && boss
    ? { ...f, hp: boss.hp, max_hp: boss.maxHp, status: boss.hp <= 0 ? 'down' : 'up', ...(boss.hp <= 0 ? { pending: null, strike_at: null } : {}) }
    : f)), [base.fighters, boss]);
  const fight = useMemo(() => (base.fight && bossDown ? { ...base.fight, status: 'ended', outcome: 'victory' } : base.fight), [base.fight, bossDown]);

  const attack = useCallback<NpcCombatApi['attack']>(async (targetId, opts) => {
    if (bossDown) return null;
    return base.castFromCard(targetId, weaponCard(ctx, opts?.weaponName || 'Attack'), opts?.finish);
  }, [base, ctx, bossDown]);

  const combat = useMemo<NpcCombatApi>(() => ({
    ...base,
    fight: fight as NpcCombatApi['fight'],
    fighters,
    isActive: fight?.status === 'active',
    isEnded: base.isEnded || bossDown,
    attack,
    castFromCard: (async (...args: Parameters<NpcCombatApi['castFromCard']>) => (bossDown ? null : base.castFromCard(...args))) as NpcCombatApi['castFromCard'],
    cast: (async (...args: Parameters<NpcCombatApi['cast']>) => (bossDown ? null : base.cast(...args))) as NpcCombatApi['cast'],
  }), [base, fight, fighters, bossDown, attack]);

  const isHost = !!room && room.host_user_id === currentUserId;
  const scores = useMemo(() => Object.entries(room?.state.members ?? {}).map(([userId, m]) => ({ userId, ...m })).sort((a, b) => b.damage - a.damage), [room]);

  const resetBoss = useCallback(async (next?: ArenaBoss) => {
    const r = roomRef.current;
    if (!r || r.host_user_id !== currentUserId) return;
    const i = ARENA_BOSSES.findIndex((b) => b.name === r.state.boss.name);
    await resetArenaRoom(r.id, next ?? ARENA_BOSSES[(i + 1) % ARENA_BOSSES.length]);
    const got = await fetchArenaRoom(r.id);
    if (got && got !== 'closed') accept(got.state, got.updated_at);
  }, [currentUserId, accept]);

  const closeRoom = useCallback(async () => {
    const r = roomRef.current;
    if (!r || r.host_user_id !== currentUserId) return;
    await closeArenaRoom(r.id);
    setRoom(null); setStatus('closed');
  }, [currentUserId]);

  return { combat, roster: practice.roster, room, status, isHost, scores, resetBoss, closeRoom };
}
