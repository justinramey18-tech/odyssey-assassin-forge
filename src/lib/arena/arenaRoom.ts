import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { DuelSpeed } from '@/lib/combatDuel';

/** Shared practice boss. attackBonus/damageAvg/speed drive the boss's local swings on each phone. */
export interface ArenaBoss { name: string; hp: number; maxHp: number; ac: number; attackBonus: number; damageAvg: number; speed: DuelSpeed }
export interface ArenaMemberScore { name: string; damage: number; hits: number }
/** One shared combat announcement; id makes it safe to show once on every phone. */
export interface ArenaRoomEvent { id: string; userId: string; name: string; damage: number; detail: string; at: number }
export interface ArenaRoomState { boss: ArenaBoss; members: Record<string, ArenaMemberScore>; events: ArenaRoomEvent[]; resetAt: number }

export interface ArenaRoom {
  id: string;
  party_id: string;
  host_user_id: string;
  state: ArenaRoomState;
  updated_at: string;
}

export const ARENA_BOSSES: ArenaBoss[] = [
  { name: 'Straw Golem', hp: 200, maxHp: 200, ac: 10, attackBonus: 2, damageAvg: 4, speed: 'easy' },
  { name: 'Training Ogre', hp: 400, maxHp: 400, ac: 12, attackBonus: 5, damageAvg: 9, speed: 'medium' },
  { name: 'Iron Sentinel', hp: 700, maxHp: 700, ac: 15, attackBonus: 7, damageAvg: 12, speed: 'hard' },
];

const SPEEDS: DuelSpeed[] = ['trivial', 'easy', 'medium', 'hard', 'deadly'];
const MAX_EVENTS = 20;
const fin = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export function parseState(raw: unknown, fallbackBoss: ArenaBoss = ARENA_BOSSES[0]): ArenaRoomState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const b = (s.boss && typeof s.boss === 'object' ? s.boss : {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' && b.name ? b.name.slice(0, 60) : fallbackBoss.name;
  // Older rooms lack the training stats: borrow them from the matching (or default) boss.
  const base = ARENA_BOSSES.find((x) => x.name === name) ?? fallbackBoss;
  const hp = fin(b.hp), maxHp = fin(b.maxHp), ac = fin(b.ac), atk = fin(b.attackBonus), avg = fin(b.damageAvg);
  const boss: ArenaBoss = {
    name,
    hp: hp !== null ? Math.max(0, hp) : base.hp,
    maxHp: maxHp !== null && maxHp > 0 ? maxHp : base.maxHp,
    ac: ac !== null ? ac : base.ac,
    attackBonus: atk !== null ? Math.max(-5, Math.min(15, atk)) : base.attackBonus,
    damageAvg: avg !== null && avg > 0 ? Math.min(60, avg) : base.damageAvg,
    speed: SPEEDS.includes(b.speed as DuelSpeed) ? (b.speed as DuelSpeed) : base.speed,
  };
  const members: Record<string, ArenaMemberScore> = {};
  const rawMembers = s.members && typeof s.members === 'object' ? (s.members as Record<string, unknown>) : {};
  for (const [uid, v] of Object.entries(rawMembers)) {
    const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const damage = Number(m.damage), hits = Number(m.hits);
    members[uid] = {
      name: typeof m.name === 'string' && m.name ? m.name.slice(0, 40) : 'Adventurer',
      damage: Number.isFinite(damage) && damage > 0 ? Math.floor(damage) : 0,
      hits: Number.isFinite(hits) && hits > 0 ? Math.floor(hits) : 0,
    };
  }
  const events: ArenaRoomEvent[] = [];
  for (const v of Array.isArray(s.events) ? s.events : []) {
    const e = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const damage = fin(e.damage), at = fin(e.at);
    if (typeof e.id !== 'string' || !e.id || damage === null || damage <= 0) continue;
    events.push({
      id: e.id.slice(0, 80),
      userId: typeof e.userId === 'string' ? e.userId : '',
      name: typeof e.name === 'string' && e.name ? e.name.slice(0, 40) : 'Adventurer',
      damage: Math.floor(damage),
      detail: typeof e.detail === 'string' ? e.detail.slice(0, 200) : '',
      at: at ?? 0,
    });
  }
  const resetAt = fin(s.resetAt) ?? 0;
  return { boss, members, events: events.slice(-MAX_EVENTS), resetAt };
}

type Row = { id: string; party_id: string; host_user_id: string; state: Json; updated_at: string };
const toRoom = (r: Row): ArenaRoom => ({ id: r.id, party_id: r.party_id, host_user_id: r.host_user_id, updated_at: r.updated_at, state: parseState(r.state) });
const freshState = (boss: ArenaBoss = ARENA_BOSSES[0]): ArenaRoomState => ({ boss: { ...boss, hp: boss.maxHp }, members: {}, events: [], resetAt: Date.now() });

/** Open the party's room, creating it as host if none exists. */
export async function openArenaRoom(partyId: string, userId: string): Promise<ArenaRoom | null> {
  const { data: existing } = await supabase.from('arena_rooms').select('*').eq('party_id', partyId).maybeSingle();
  if (existing) return toRoom(existing as Row);
  const { data: created, error } = await supabase
    .from('arena_rooms')
    .insert([{ party_id: partyId, host_user_id: userId, state: freshState() as unknown as Json }])
    .select('*')
    .single();
  if (error || !created) {
    // Someone else created it at the same moment — read it back.
    const { data: retry } = await supabase.from('arena_rooms').select('*').eq('party_id', partyId).maybeSingle();
    return retry ? toRoom(retry as Row) : null;
  }
  return toRoom(created as Row);
}

/** Read one room. 'closed' when the row is gone; null when the read itself failed. */
export async function fetchArenaRoom(roomId: string): Promise<ArenaRoom | 'closed' | null> {
  const { data, error } = await supabase.from('arena_rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) return null;
  return data ? toRoom(data as Row) : 'closed';
}

/**
 * Safe shared update: read state + updated_at, change a copy, and write only if nobody else wrote in between.
 * On a clash, re-read and try again, so a teammate's simultaneous hit is never overwritten.
 */
export async function updateArenaRoom(roomId: string, mutate: (state: ArenaRoomState) => void, attempts = 5): Promise<ArenaRoomState | null> {
  for (let i = 0; i < attempts; i++) {
    const { data: row } = await supabase.from('arena_rooms').select('state, updated_at').eq('id', roomId).maybeSingle();
    if (!row) return null;
    const state = parseState(row.state);
    mutate(state);
    state.events = state.events.slice(-MAX_EVENTS);
    let stamp = new Date().toISOString();
    if (stamp <= row.updated_at) stamp = new Date(Date.parse(row.updated_at) + 1).toISOString();
    const { data: written, error } = await supabase
      .from('arena_rooms')
      .update({ state: state as unknown as Json, updated_at: stamp })
      .eq('id', roomId)
      .eq('updated_at', row.updated_at)
      .select('id');
    if (!error && written && written.length > 0) return state;
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 160));
  }
  return null;
}

/** Record one player's hit against the shared boss. eventId makes a retried report count once. */
export async function reportArenaHit(roomId: string, userId: string, name: string, damage: number, eventId?: string, detail = ''): Promise<ArenaRoomState | null> {
  const dmg = Math.floor(Number(damage));
  if (!Number.isFinite(dmg) || dmg <= 0) return null;
  const id = eventId || crypto.randomUUID();
  return updateArenaRoom(roomId, (s) => {
    if (s.events.some((e) => e.id === id)) return;
    if (s.boss.hp <= 0) return;
    const dealt = Math.min(dmg, s.boss.hp);
    const m = s.members[userId] ?? { name: name.slice(0, 40) || 'Adventurer', damage: 0, hits: 0 };
    m.damage += dealt;
    m.hits += 1;
    s.members[userId] = m;
    s.boss.hp = Math.max(0, s.boss.hp - dealt);
    s.events.push({ id, userId, name: m.name, damage: dealt, detail: detail.slice(0, 200), at: Date.now() });
  });
}

/** Host only: swap in a fresh boss and wipe scores. */
export async function resetArenaRoom(roomId: string, boss: ArenaBoss): Promise<void> {
  await updateArenaRoom(roomId, (s) => {
    const f = freshState(boss);
    s.boss = f.boss; s.members = {}; s.events = []; s.resetAt = f.resetAt;
  });
}

/** Host only: close the room. */
export async function closeArenaRoom(roomId: string): Promise<void> {
  await supabase.from('arena_rooms').delete().eq('id', roomId);
}

/** Live updates for one room (not guaranteed — pair with polling). onClosed fires when the row is deleted. */
export function watchArenaRoom(roomId: string, onState: (state: ArenaRoomState, updatedAt?: string) => void, onClosed?: () => void): () => void {
  const channel = supabase
    .channel(`arena-room-${roomId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_rooms', filter: `id=eq.${roomId}` }, (payload) => {
      if (payload.eventType === 'DELETE') { onClosed?.(); return; }
      const n = payload.new as { state?: unknown; updated_at?: string };
      onState(parseState(n?.state), n?.updated_at);
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
