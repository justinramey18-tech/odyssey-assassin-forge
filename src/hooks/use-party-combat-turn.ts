// Party-wide turn tracking for host-toggled combat mode.
//
// DELIBERATELY DECOUPLED: this hook does not import DmSessionConfig or the
// Supabase client. It takes the config slice it needs and a writer callback.
// That keeps it unit-testable, lets it compile before the Volume 1 config
// fields land, and means it can be reused by the solo screen unchanged.
//
// Broadcast is free: the caller writes into party_shared_state via the existing
// updateSessionConfig, and the realtime subscription in use-party-dm already
// pushes the new config to every connected player.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  advanceTurn,
  isTurnOf,
  nameForUser,
  normalizeTurnState,
  rewindTurn,
  setActiveTurn,
  startCombat,
  turnPosition,
  turnsUntil,
  type TurnMember,
  type TurnState,
} from '@/lib/combat/turnOrder';
import { useActionEconomy } from '@/hooks/use-action-economy';

/** The three fields Volume 1 adds to DmSessionConfig. */
export interface CombatTurnConfigSlice {
  combatRound?: number;
  combatTurnOrder?: string[];
  combatTurnUserId?: string | null;
}

export interface UsePartyCombatTurnOptions {
  /** Live session config, or null before it loads. */
  config: CombatTurnConfigSlice | null | undefined;
  /** Persists a patch to the shared session config. Host-only in practice. */
  onUpdateConfig: (patch: CombatTurnConfigSlice) => void | Promise<void>;
  members: readonly TurnMember[];
  currentUserId?: string | null;
  isHost: boolean;
  /** False when combat mode is off — the hook goes inert. */
  enabled: boolean;
  /**
   * Reset this player's action economy when their turn begins.
   * Defaults to true. Turn it off for tables that track economy by hand.
   */
  autoBeginTurn?: boolean;
}

export interface UsePartyCombatTurnReturn {
  /** Repaired turn state. Always safe to render. */
  turn: TurnState;
  /** True when it is this device's player's turn. */
  isMyTurn: boolean;
  /** Character name of whoever is acting. */
  activeName: string;
  /** This player's 1-based slot, or null when they are not in the fight. */
  myPosition: number | null;
  /** Combatants that act before this player goes again. 0 means it is their turn. */
  myTurnsAway: number | null;
  /** Order rendered for the UI, newest state, with names resolved. */
  roster: Array<{ userId: string; name: string; isActive: boolean; position: number }>;
  /** True once an order exists and someone is acting. */
  isStarted: boolean;

  // Host controls. No-ops for non-hosts so the UI can call them unconditionally.
  startCombatRound: () => void;
  nextTurn: () => void;
  previousTurn: () => void;
  jumpToUser: (userId: string) => void;
  endCombatRounds: () => void;
}

export function usePartyCombatTurn(opts: UsePartyCombatTurnOptions): UsePartyCombatTurnReturn {
  const {
    config,
    onUpdateConfig,
    members,
    currentUserId,
    isHost,
    enabled,
    autoBeginTurn = true,
  } = opts;

  const { beginTurn } = useActionEconomy();

  // Rebuilt from the raw config every render, so a realtime push repairs itself.
  const turn = useMemo<TurnState>(
    () =>
      normalizeTurnState(
        {
          round: config?.combatRound,
          order: config?.combatTurnOrder,
          activeUserId: config?.combatTurnUserId ?? null,
        },
        members,
      ),
    [config?.combatRound, config?.combatTurnOrder, config?.combatTurnUserId, members],
  );

  const isMyTurn = enabled && isTurnOf(turn, currentUserId);

  // Auto-reset the economy exactly once per turn handover, on the rising edge.
  // A ref is used rather than state so a re-render caused by anything else
  // (a chat message arriving, HP changing) cannot re-trigger the reset.
  const lastBegunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !autoBeginTurn) {
      lastBegunRef.current = null;
      return;
    }
    // Key on round + user so a full cycle back to the same player still fires.
    const key = `${turn.round}:${turn.activeUserId ?? ''}`;
    if (!isMyTurn) return;
    if (lastBegunRef.current === key) return;
    lastBegunRef.current = key;
    beginTurn();
  }, [enabled, autoBeginTurn, isMyTurn, turn.round, turn.activeUserId, beginTurn]);

  // Clear the guard when combat stops, so the next fight starts clean.
  useEffect(() => {
    if (!enabled) lastBegunRef.current = null;
  }, [enabled]);

  const persist = useCallback(
    (next: TurnState) => {
      void onUpdateConfig({
        combatRound: next.round,
        combatTurnOrder: next.order,
        combatTurnUserId: next.activeUserId,
      });
    },
    [onUpdateConfig],
  );

  const startCombatRound = useCallback(() => {
    if (!isHost) return;
    persist(startCombat(members, currentUserId ?? null));
  }, [isHost, persist, members, currentUserId]);

  const nextTurn = useCallback(() => {
    if (!isHost) return;
    persist(turn.order.length === 0 ? startCombat(members, currentUserId ?? null) : advanceTurn(turn));
  }, [isHost, persist, turn, members, currentUserId]);

  const previousTurn = useCallback(() => {
    if (!isHost) return;
    persist(rewindTurn(turn));
  }, [isHost, persist, turn]);

  const jumpToUser = useCallback(
    (userId: string) => {
      if (!isHost) return;
      const next = setActiveTurn(turn, userId);
      if (next === turn) return;
      persist(next);
    },
    [isHost, persist, turn],
  );

  const endCombatRounds = useCallback(() => {
    if (!isHost) return;
    persist({ round: 1, order: [], activeUserId: null });
  }, [isHost, persist]);

  const roster = useMemo(
    () =>
      turn.order.map((userId, index) => ({
        userId,
        name: nameForUser(members, userId),
        isActive: userId === turn.activeUserId,
        position: index + 1,
      })),
    [turn.order, turn.activeUserId, members],
  );

  return {
    turn,
    isMyTurn,
    activeName: nameForUser(members, turn.activeUserId),
    myPosition: turnPosition(turn, currentUserId),
    myTurnsAway: turnsUntil(turn, currentUserId),
    roster,
    isStarted: turn.order.length > 0 && turn.activeUserId !== null,
    startCombatRound,
    nextTurn,
    previousTurn,
    jumpToUser,
    endCombatRounds,
  };
}
