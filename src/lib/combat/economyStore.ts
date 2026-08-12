// Single source of truth for the D&D action economy.
//
// WHY THIS EXISTS: useActionEconomy() used to hold its own useState. Every
// component that called the hook got an independent copy, all writing the same
// localStorage key. Two live instances (Index.tsx and the party combat bar)
// would silently diverge until one of them remounted. This module owns the
// state once, at module scope, and every hook instance subscribes to it.
//
// The store is deliberately framework-free so it can be unit tested without
// React and reused by any future surface (solo sheet, party bar, VTT view).

import type { ActionEconomy, TurnAction } from './combatTypes';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const ECONOMY_KEY = 'odyssey-action-economy';
const TURN_ACTIONS_KEY = 'odyssey-turn-actions';

export const DEFAULT_MAX_MOVEMENT = 30;

/** Hard ceiling so a corrupt save can never render a 900-button movement picker. */
const MAX_MOVEMENT_CEILING = 500;

/** What a single tapped item costs on your turn. 'free' spends nothing. */
export type ActionCost = 'action' | 'bonus' | 'reaction' | 'free';

export const DEFAULT_ECONOMY: Readonly<ActionEconomy> = Object.freeze({
  actionUsed: false,
  bonusActionUsed: false,
  reactionUsed: false,
  movementUsed: 0,
  maxMovement: DEFAULT_MAX_MOVEMENT,
});

export interface EconomySnapshot {
  readonly economy: ActionEconomy;
  readonly turnActions: readonly TurnAction[];
}

type Listener = () => void;

// ─── Sanitisers ───────────────────────────────────────────────────────────────
// localStorage is user-writable and survives app versions. Never trust it.

function clampMovement(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

function clampMaxMovement(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_MOVEMENT;
  return Math.min(Math.floor(n), MAX_MOVEMENT_CEILING);
}

function sanitizeEconomy(raw: unknown): ActionEconomy {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<ActionEconomy>;
  const maxMovement = clampMaxMovement(src.maxMovement);
  return {
    actionUsed: src.actionUsed === true,
    bonusActionUsed: src.bonusActionUsed === true,
    reactionUsed: src.reactionUsed === true,
    movementUsed: clampMovement(src.movementUsed, maxMovement),
    maxMovement,
  };
}

const TURN_ACTION_TYPES: ReadonlyArray<TurnAction['type']> = ['action', 'bonus', 'reaction', 'movement'];

function sanitizeTurnActions(raw: unknown): TurnAction[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnAction[] = [];
  for (const entry of raw.slice(0, 20)) {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Partial<TurnAction>;
    const type = TURN_ACTION_TYPES.includes(item.type as TurnAction['type'])
      ? (item.type as TurnAction['type'])
      : null;
    if (!type) continue;
    out.push({
      type,
      description: String(item.description ?? '').slice(0, 200),
      roll: item.roll ? String(item.roll).slice(0, 80) : undefined,
    });
  }
  return out;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function readPersisted(): EconomySnapshot {
  let economy = sanitizeEconomy(undefined);
  let turnActions: TurnAction[] = [];
  try {
    const storedEconomy = getScopedItem(ECONOMY_KEY);
    if (storedEconomy) economy = sanitizeEconomy(JSON.parse(storedEconomy));
  } catch (e) {
    console.error('[economyStore] failed to read economy:', e);
  }
  try {
    const storedActions = getScopedItem(TURN_ACTIONS_KEY);
    if (storedActions) turnActions = sanitizeTurnActions(JSON.parse(storedActions));
  } catch (e) {
    console.error('[economyStore] failed to read turn actions:', e);
  }
  return { economy, turnActions };
}

function persist(next: EconomySnapshot): void {
  try {
    setScopedItem(ECONOMY_KEY, JSON.stringify(next.economy));
    setScopedItem(TURN_ACTIONS_KEY, JSON.stringify(next.turnActions));
  } catch (e) {
    console.error('[economyStore] failed to persist:', e);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

let snapshot: EconomySnapshot = readPersisted();
const listeners = new Set<Listener>();

function emit(): void {
  // Copy first: a listener may unsubscribe during iteration.
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (e) {
      console.error('[economyStore] listener threw:', e);
    }
  }
}

/**
 * Replace the snapshot and notify subscribers.
 * Bails out when nothing actually changed so useSyncExternalStore never
 * re-renders on a no-op (the classic infinite-loop trap).
 */
function commit(next: EconomySnapshot): void {
  const a = snapshot.economy;
  const b = next.economy;
  const economySame =
    a.actionUsed === b.actionUsed &&
    a.bonusActionUsed === b.bonusActionUsed &&
    a.reactionUsed === b.reactionUsed &&
    a.movementUsed === b.movementUsed &&
    a.maxMovement === b.maxMovement;
  const actionsSame =
    snapshot.turnActions.length === next.turnActions.length &&
    snapshot.turnActions.every((t, i) => {
      const o = next.turnActions[i];
      return t.type === o.type && t.description === o.description && t.roll === o.roll;
    });
  if (economySame && actionsSame) return;

  snapshot = next;
  persist(snapshot);
  emit();
}

/** Referentially stable between commits — required by useSyncExternalStore. */
export function getSnapshot(): EconomySnapshot {
  return snapshot;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-read from storage. Called when the active character changes. */
export function reload(): void {
  commit(readPersisted());
}

function patchEconomy(patch: Partial<ActionEconomy>): void {
  commit({
    economy: sanitizeEconomy({ ...snapshot.economy, ...patch }),
    turnActions: snapshot.turnActions,
  });
}

// ─── Public mutations ─────────────────────────────────────────────────────────

export function setEconomy(next: ActionEconomy): void {
  commit({ economy: sanitizeEconomy(next), turnActions: snapshot.turnActions });
}

export function setUsed(cost: Exclude<ActionCost, 'free'>, used: boolean): void {
  if (cost === 'action') patchEconomy({ actionUsed: used });
  else if (cost === 'bonus') patchEconomy({ bonusActionUsed: used });
  else patchEconomy({ reactionUsed: used });
}

export function isUsed(cost: ActionCost): boolean {
  if (cost === 'action') return snapshot.economy.actionUsed;
  if (cost === 'bonus') return snapshot.economy.bonusActionUsed;
  if (cost === 'reaction') return snapshot.economy.reactionUsed;
  return false;
}

/**
 * Spend one slot and log it.
 * Returns false when the slot was already spent (or the cost is free) so the
 * caller can warn without blocking — house rules exist, we never hard-lock.
 */
export function spend(cost: ActionCost, description?: string): boolean {
  if (cost === 'free') return false;
  if (isUsed(cost)) return false;

  const logType: TurnAction['type'] = cost === 'bonus' ? 'bonus' : cost === 'reaction' ? 'reaction' : 'action';
  const economy: ActionEconomy = {
    ...snapshot.economy,
    actionUsed: cost === 'action' ? true : snapshot.economy.actionUsed,
    bonusActionUsed: cost === 'bonus' ? true : snapshot.economy.bonusActionUsed,
    reactionUsed: cost === 'reaction' ? true : snapshot.economy.reactionUsed,
  };
  const entry: TurnAction = { type: logType, description: String(description ?? '').slice(0, 200) };
  commit({
    economy,
    turnActions: [...snapshot.turnActions.filter(t => t.type !== logType), entry].slice(-20),
  });
  return true;
}

export function updateMovement(used: number): void {
  patchEconomy({ movementUsed: clampMovement(used, snapshot.economy.maxMovement) });
}

export function setMaxMovement(max: number): void {
  const nextMax = clampMaxMovement(max);
  patchEconomy({
    maxMovement: nextMax,
    movementUsed: Math.min(snapshot.economy.movementUsed, nextMax),
  });
}

export function addTurnAction(action: TurnAction): void {
  const economy: ActionEconomy = {
    ...snapshot.economy,
    actionUsed: action.type === 'action' ? true : snapshot.economy.actionUsed,
    bonusActionUsed: action.type === 'bonus' ? true : snapshot.economy.bonusActionUsed,
    reactionUsed: action.type === 'reaction' ? true : snapshot.economy.reactionUsed,
  };
  commit({
    economy,
    turnActions: [...snapshot.turnActions.filter(t => t.type !== action.type), action].slice(-20),
  });
}

export function removeTurnAction(index: number): void {
  const target = snapshot.turnActions[index];
  if (!target) return;
  const economy: ActionEconomy = {
    ...snapshot.economy,
    actionUsed: target.type === 'action' ? false : snapshot.economy.actionUsed,
    bonusActionUsed: target.type === 'bonus' ? false : snapshot.economy.bonusActionUsed,
    reactionUsed: target.type === 'reaction' ? false : snapshot.economy.reactionUsed,
  };
  commit({ economy, turnActions: snapshot.turnActions.filter((_, i) => i !== index) });
}

/**
 * Start of your turn. D&D 5e: you regain your action, bonus action, movement
 * AND your reaction at the START of your turn. Full reset belongs here.
 */
export function beginTurn(): void {
  commit({
    economy: { ...DEFAULT_ECONOMY, maxMovement: snapshot.economy.maxMovement },
    turnActions: [],
  });
}

/**
 * End of your turn. Deliberately does NOT restore the reaction.
 *
 * RULES NOTE: a reaction spent on your turn stays spent until your next turn
 * begins, so you cannot take an opportunity attack you have not earned back.
 * Clearing it here was the bug this function exists to avoid.
 */
export function endTurn(): void {
  commit({
    economy: {
      ...snapshot.economy,
      actionUsed: false,
      bonusActionUsed: false,
      movementUsed: 0,
    },
    turnActions: snapshot.turnActions.filter(t => t.type === 'reaction'),
  });
}

/** Full reset. Alias of beginTurn, kept for existing callers. */
export function resetTurn(): void {
  beginTurn();
}

// ─── Cross-context sync ───────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  // Another tab wrote our keys.
  window.addEventListener('storage', event => {
    if (!event.key) return;
    if (event.key.startsWith(ECONOMY_KEY) || event.key.startsWith(TURN_ACTIONS_KEY)) reload();
  });
  // The active character was switched — scoped keys now point somewhere else.
  window.addEventListener('odyssey-character-loaded', () => reload());
}
