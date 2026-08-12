// Party turn order for host-toggled combat mode.
//
// Pure functions only — no React, no Supabase. The shape below is what gets
// stored inside the existing DmSessionConfig blob and broadcast to every player
// by the party_shared_state realtime channel that already exists.
//
// The hard part is not advancing a pointer. It is staying correct when a player
// disconnects mid-combat, when two hosts race, or when a save is loaded from a
// session where the party had different members. normalizeTurnState handles all
// three and is the only function the UI should trust.

export interface TurnState {
  /** 1-based. Increments when the pointer wraps past the last combatant. */
  round: number;
  /** user_ids in initiative order. */
  order: string[];
  /** Whose turn it is, or null when combat has not started. */
  activeUserId: string | null;
}

export const EMPTY_TURN_STATE: Readonly<TurnState> = Object.freeze({
  round: 1,
  order: Object.freeze([]) as unknown as string[],
  activeUserId: null,
});

export interface TurnMember {
  user_id: string;
  character_name?: string;
}

function clampRound(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 9999);
}

/**
 * Build a starting order from the current roster.
 * Host goes first by default — they are the one who called for initiative and
 * it gives them a deterministic anchor to advance from. Everyone else keeps
 * roster order, which is stable across clients (no random, no local sort).
 */
export function buildTurnOrder(members: readonly TurnMember[], hostUserId?: string | null): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const m of members ?? []) {
    const id = typeof m?.user_id === 'string' ? m.user_id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (hostUserId && seen.has(hostUserId)) {
    return [hostUserId, ...ids.filter(id => id !== hostUserId)];
  }
  return ids;
}

/**
 * Repair a stored turn state against the live roster.
 *
 * - Drops user_ids that are no longer in the party (someone left mid-fight).
 * - Appends members who joined mid-fight, at the end, so nobody is skipped
 *   forever and the current turn is not disturbed.
 * - Re-points activeUserId if it referred to someone who is now gone.
 * - Never returns an order containing duplicates.
 */
export function normalizeTurnState(raw: unknown, members: readonly TurnMember[]): TurnState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<TurnState>;
  const liveIds = buildTurnOrder(members);
  const liveSet = new Set(liveIds);

  const storedOrder = Array.isArray(src.order) ? src.order : [];
  const seen = new Set<string>();
  const order: string[] = [];

  for (const id of storedOrder) {
    if (typeof id !== 'string') continue;
    if (!liveSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }

  for (const id of liveIds) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  const storedActive = typeof src.activeUserId === 'string' ? src.activeUserId : null;
  let activeUserId: string | null = null;
  if (storedActive && order.includes(storedActive)) {
    activeUserId = storedActive;
  } else if (storedActive && order.length > 0) {
    // The active player vanished. Hand the turn to whoever now occupies their
    // slot rather than silently stalling combat.
    const fallbackIndex = Math.min(storedOrder.indexOf(storedActive), order.length - 1);
    activeUserId = order[fallbackIndex >= 0 ? fallbackIndex : 0];
  }

  return { round: clampRound(src.round), order, activeUserId };
}

/** Begin combat: everyone in order, pointer on the first combatant, round 1. */
export function startCombat(members: readonly TurnMember[], hostUserId?: string | null): TurnState {
  const order = buildTurnOrder(members, hostUserId);
  return { round: 1, order, activeUserId: order[0] ?? null };
}

/**
 * Advance to the next combatant. Wrapping past the last one starts a new round.
 * Safe on empty or unstarted state — returns something usable, never throws.
 */
export function advanceTurn(state: TurnState): TurnState {
  const { order } = state;
  if (order.length === 0) return { ...state, activeUserId: null };
  if (!state.activeUserId) return { ...state, activeUserId: order[0] };

  const index = order.indexOf(state.activeUserId);
  if (index === -1) return { ...state, activeUserId: order[0] };

  const nextIndex = index + 1;
  if (nextIndex >= order.length) {
    return { round: clampRound(state.round + 1), order, activeUserId: order[0] };
  }
  return { round: state.round, order, activeUserId: order[nextIndex] };
}

/** Step backwards. Used by the host when they advance by mistake. */
export function rewindTurn(state: TurnState): TurnState {
  const { order } = state;
  if (order.length === 0) return { ...state, activeUserId: null };
  const index = state.activeUserId ? order.indexOf(state.activeUserId) : 0;
  if (index <= 0) {
    if (state.round <= 1) return { ...state, activeUserId: order[0] };
    return { round: state.round - 1, order, activeUserId: order[order.length - 1] };
  }
  return { round: state.round, order, activeUserId: order[index - 1] };
}

/** Jump straight to a specific combatant without changing the round. */
export function setActiveTurn(state: TurnState, userId: string): TurnState {
  if (!state.order.includes(userId)) return state;
  return { ...state, activeUserId: userId };
}

export function isTurnOf(state: TurnState, userId: string | null | undefined): boolean {
  if (!userId || !state.activeUserId) return false;
  return state.activeUserId === userId;
}

/** 1-based position for display, or null when the user is not in the fight. */
export function turnPosition(state: TurnState, userId: string | null | undefined): number | null {
  if (!userId) return null;
  const index = state.order.indexOf(userId);
  return index === -1 ? null : index + 1;
}

/** How many combatants act before this player gets to go again. */
export function turnsUntil(state: TurnState, userId: string | null | undefined): number | null {
  if (!userId || state.order.length === 0) return null;
  const target = state.order.indexOf(userId);
  if (target === -1) return null;
  const current = state.activeUserId ? state.order.indexOf(state.activeUserId) : 0;
  if (current === -1) return null;
  if (target === current) return 0;
  return (target - current + state.order.length) % state.order.length;
}

/** Display name lookup that never returns an empty string. */
export function nameForUser(members: readonly TurnMember[], userId: string | null | undefined): string {
  if (!userId) return 'Nobody';
  const hit = (members ?? []).find(m => m?.user_id === userId);
  const name = hit?.character_name?.trim();
  return name && name.length > 0 ? name : 'Unknown';
}
