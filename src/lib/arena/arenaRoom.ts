import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ArenaBoss { name: string; hp: number; maxHp: number; ac: number }
export interface ArenaMemberScore { name: string; damage: number; hits: number }
export interface ArenaRoomState { boss: ArenaBoss; members: Record<string, ArenaMemberScore> }

export interface ArenaRoom {
  id: string;
  party_id: string;
  host_user_id: string;
  state: ArenaRoomState;
}

export const ARENA_BOSSES: ArenaBoss[] = [
  { name: 'Straw Golem', hp: 200, maxHp: 200, ac: 10 },
  { name: 'Training Ogre', hp: 400, maxHp: 400, ac: 12 },
  { name: 'Iron Sentinel', hp: 700, maxHp: 700, ac: 15 },
];

function parseState(raw: unknown, fallbackBoss: ArenaBoss): ArenaRoomState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const b = (s.boss && typeof s.boss === 'object' ? s.boss : {}) as Record<string, unknown>;
  const hp = Number(b.hp), maxHp = Number(b.maxHp), ac = Number(b.ac);
  const boss: ArenaBoss = {
    name: typeof b.name === 'string' && b.name ? b.name.slice(0, 60) : fallbackBoss.name,
    hp: Number.isFinite(hp) ? Math.max(0, hp) : fallbackBoss.hp,
    maxHp: Number.isFinite(maxHp) && maxHp > 0 ? maxHp : fallbackBoss.maxHp,
    ac: Number.isFinite(ac) ? ac : fallbackBoss.ac,
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
  return { boss, members };
}

/** Open the party's room, creating it as host if none exists. */
export async function openArenaRoom(partyId: string, userId: string): Promise<ArenaRoom | null> {
  const { data: existing } = await supabase.from('arena_rooms').select('*').eq('party_id', partyId).maybeSingle();
  if (existing) return { ...existing, state: parseState(existing.state, ARENA_BOSSES[0]) } as ArenaRoom;
  const { data: created, error } = await supabase
    .from('arena_rooms')
    .insert([{ party_id: partyId, host_user_id: userId, state: { boss: ARENA_BOSSES[0], members: {} } as unknown as Json }])
    .select('*')
    .single();
  if (error || !created) {
    // Someone else created it at the same moment — read it back.
    const { data: retry } = await supabase.from('arena_rooms').select('*').eq('party_id', partyId).maybeSingle();
    return retry ? ({ ...retry, state: parseState(retry.state, ARENA_BOSSES[0]) } as ArenaRoom) : null;
  }
  return { ...created, state: parseState(created.state, ARENA_BOSSES[0]) } as ArenaRoom;
}

/** Fetch-then-update: apply a change to the latest server state so simultaneous hits don't clobber each other. */
export async function updateArenaRoom(roomId: string, mutate: (state: ArenaRoomState) => void): Promise<ArenaRoomState | null> {
  const { data: row } = await supabase.from('arena_rooms').select('state').eq('id', roomId).single();
  if (!row) return null;
  const state = parseState(row.state, ARENA_BOSSES[0]);
  mutate(state);
  const { error } = await supabase.from('arena_rooms').update({ state: state as unknown as Json, updated_at: new Date().toISOString() }).eq('id', roomId);
  return error ? null : state;
}

/** Record one player's hit against the shared boss. */
export async function reportArenaHit(roomId: string, userId: string, name: string, damage: number): Promise<void> {
  const dmg = Math.floor(Number(damage));
  if (!Number.isFinite(dmg) || dmg <= 0) return;
  await updateArenaRoom(roomId, (s) => {
    const m = s.members[userId] ?? { name: name.slice(0, 40) || 'Adventurer', damage: 0, hits: 0 };
    m.damage += dmg;
    m.hits += 1;
    s.members[userId] = m;
    s.boss.hp = Math.max(0, s.boss.hp - dmg);
  });
}

/** Host only: swap in a fresh boss and wipe scores. */
export async function resetArenaRoom(roomId: string, boss: ArenaBoss): Promise<void> {
  await updateArenaRoom(roomId, (s) => {
    s.boss = { ...boss };
    s.members = {};
  });
}

/** Host only: close the room. */
export async function closeArenaRoom(roomId: string): Promise<void> {
  await supabase.from('arena_rooms').delete().eq('id', roomId);
}

/** Live updates for one room. Returns an unsubscribe function. */
export function watchArenaRoom(roomId: string, onState: (state: ArenaRoomState) => void): () => void {
  const channel = supabase
    .channel(`arena-room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_rooms', filter: `id=eq.${roomId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      onState(parseState((payload.new as { state?: unknown })?.state, ARENA_BOSSES[0]));
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
