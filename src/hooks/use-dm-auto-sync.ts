import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { CharacterContext } from '@/components/oracle/types';
import { getAuthToken } from '@/lib/auth-token';


const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-extract`;
const STORAGE_KEY = 'odyssey-dm-auto-sync';

export interface ExtractionResult {
  hp_changes: { amount: number; type: 'damage' | 'healing'; source: string }[];
  xp_gained: number | null;
  gold_changes: { amount: number; action: 'gained' | 'spent'; source: string }[];
  conditions_added: string[];
  conditions_removed: string[];
  items_acquired: { name: string; quantity: number }[];
  items_consumed?: { name: string; quantity: number }[];
  rest_occurred: 'short' | 'long' | null;
  map_entities: any[];
  map_entities_removed: string[];
  companion_hp_changes: { amount: number; type: 'damage' | 'healing'; source: string }[];
  companion_conditions_added: string[];
  companion_conditions_removed: string[];
  hp_absolute: number | null;
  companion_hp_absolute: number | null;
}


interface AutoSyncSnapshot {
  hp: number;
  xp: number;
  gold: number;
  markers: any[];
  timestamp: number;
}

interface AutoSyncCallbacks {
  onHPChange: (change: number, type: 'damage' | 'healing') => void;
  /** Decrement a consumable by name. Returns false if it was not found or the count was too low. */
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
  onAddXP: (amount: number, source: string) => void;
  onGoldChange: (netChange: number) => void;
  onConditionChange: (toAdd: string[], toRemove: string[]) => void;
  onRestOccurred: (type: 'short' | 'long') => void;
  onMapUpdate: (markersToAdd: any[], namesToRemove: string[]) => void;
  onCompanionHPChange?: (change: number, type: 'damage' | 'healing') => void;
  onCompanionHPSet?: (hp: number) => void;
  onCompanionConditionChange?: (toAdd: string[], toRemove: string[]) => void;
  onHPSet?: (hp: number) => void;
  // snapshot getters
  getCurrentHP: () => number;
  getCurrentGold: () => number;
  getCurrentMarkers: () => any[];
  getGridSize: () => any;
}


export function useDmAutoSync(callbacks: AutoSyncCallbacks) {
  // Store callbacks in a ref to avoid re-creating extractAndApply on every render
  const callbacksRef = useRef(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    // Default ON: only an explicit opt-out disables automatic character updates.
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [lastExtraction, setLastExtraction] = useState<ExtractionResult | null>(null);
  const snapshotRef = useRef<AutoSyncSnapshot | null>(null);

  const toggleAutoSync = useCallback((enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const extractAndApply = useCallback(async (
    assistantMessage: string,
    characterContext: CharacterContext
  ) => {
    if (assistantMessage.length < 20) return null;

    const cb = callbacksRef.current;

    // Snapshot for undo
    snapshotRef.current = {
      hp: cb.getCurrentHP(),
      xp: 0, // XP undo not supported (additive only)
      gold: cb.getCurrentGold(),
      markers: [...cb.getCurrentMarkers()],
      timestamp: Date.now(),
    };

    setIsExtracting(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(EXTRACT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: assistantMessage,
          characterContext: {
            name: characterContext.name,
            level: characterContext.level,
            currentHP: characterContext.currentHP,
            maxHP: characterContext.maxHP,
            companionName: characterContext.companion?.name,
            companionHP: characterContext.companion?.currentHP,
            companionMaxHP: characterContext.companion?.maxHP,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error('Auto-sync rate limited, try again shortly.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted for auto-sync.');
        }
        console.warn('Auto-sync extraction failed:', err);
        return null;
      }

      const result: ExtractionResult = await response.json();
      setLastExtraction(result);

      // Apply HP — absolute takes priority over deltas.
      // Number.isFinite rather than typeof, because NaN is also a number.
      if (Number.isFinite(result.hp_absolute as number) && cb.onHPSet) {
        cb.onHPSet(result.hp_absolute as number);
      } else if ((result.hp_changes ?? []).length > 0) {
        let netHP = 0;
        for (const hpChange of result.hp_changes) {
          if (typeof hpChange.amount !== 'number' || hpChange.amount <= 0) continue;
          netHP += hpChange.type === 'damage' ? -hpChange.amount : hpChange.amount;
        }
        if (netHP !== 0) {
          cb.onHPChange(netHP, netHP < 0 ? 'damage' : 'healing');
        }
      }

      // Apply XP
      if (Number.isFinite(result.xp_gained as number) && (result.xp_gained as number) > 0) {
        cb.onAddXP(Math.floor(result.xp_gained as number), 'AI DM Auto-Sync');
      }

      // Apply gold — validated the same way HP is, otherwise a malformed
      // extraction turns the character's gold into NaN permanently.
      for (const goldChange of result.gold_changes ?? []) {
        const amount = Number(goldChange?.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        cb.onGoldChange(goldChange.action === 'gained' ? amount : -amount);
      }

      // Apply consumable use narrated by the DM. Validate the same way HP is,
      // so a malformed extraction cannot remove an unpredictable number of items.
      if (cb.onUseConsumableByName && Array.isArray(result.items_consumed)) {
        const missed: string[] = [];
        for (const used of result.items_consumed) {
          const name = typeof used?.name === 'string' ? used.name.trim() : '';
          if (!name) continue;
          const rawQty = Number(used?.quantity);
          const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.min(10, Math.floor(rawQty)) : 1;
          const applied = cb.onUseConsumableByName(name, qty);
          if (!applied) missed.push(name);
        }
        if (missed.length > 0) {
          // The DM narrated using something the inventory does not have. Tell the
          // player rather than silently ignoring it — the sheet and the story disagree.
          toast.warning(`Not in your inventory: ${missed.join(', ')}`, {
            description: 'The DM described using it, but nothing was deducted.',
          });
        }
      }


      // Apply conditions
      if (result.conditions_added.length > 0 || result.conditions_removed.length > 0) {
        cb.onConditionChange(result.conditions_added, result.conditions_removed);
      }

      // Apply rest
      if (result.rest_occurred) {
        cb.onRestOccurred(result.rest_occurred);
      }


      // Apply companion HP — absolute takes priority over deltas
      if (typeof result.companion_hp_absolute === 'number' && cb.onCompanionHPSet) {
        cb.onCompanionHPSet(result.companion_hp_absolute);
      } else if (cb.onCompanionHPChange && result.companion_hp_changes?.length > 0) {
        let netChange = 0;
        for (const hpChange of result.companion_hp_changes) {
          if (typeof hpChange.amount !== 'number' || hpChange.amount <= 0) continue;
          netChange += hpChange.type === 'damage' ? -hpChange.amount : hpChange.amount;
        }
        if (netChange !== 0) {
          cb.onCompanionHPChange(netChange, netChange < 0 ? 'damage' : 'healing');
        }
      }

      // Apply companion conditions
      if (cb.onCompanionConditionChange && (result.companion_conditions_added?.length > 0 || result.companion_conditions_removed?.length > 0)) {
        cb.onCompanionConditionChange(
          result.companion_conditions_added || [],
          result.companion_conditions_removed || []
        );
      }

      return result;
    } catch (error) {
      console.error('Auto-sync extraction error:', error);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []); // stable — reads from callbacksRef

  const undoLastExtraction = useCallback(() => {
    const snapshot = snapshotRef.current;
    const cb = callbacksRef.current;
    const reverted: string[] = [];

    if (snapshot) {
      // HP: restore the exact value captured before the sync ran.
      if (cb.onHPSet && Number.isFinite(snapshot.hp) && cb.getCurrentHP() !== snapshot.hp) {
        cb.onHPSet(snapshot.hp);
        reverted.push('HP');
      }

      // Gold: onGoldChange is relative, so apply the difference back.
      if (Number.isFinite(snapshot.gold)) {
        const delta = snapshot.gold - cb.getCurrentGold();
        if (delta !== 0) {
          cb.onGoldChange(delta);
          reverted.push('gold');
        }
      }
    }

    setLastExtraction(null);
    snapshotRef.current = null;

    if (reverted.length > 0) {
      toast.success(`Reverted ${reverted.join(' and ')}. XP, conditions and items are not undone.`);
    } else {
      toast.success('Auto-sync changes dismissed');
    }
  }, []);

  return {
    autoSyncEnabled,
    toggleAutoSync,
    isExtracting,
    lastExtraction,
    extractAndApply,
    undoLastExtraction,
  };
}
