import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { CharacterContext } from '@/components/oracle/types';
import { getAuthToken } from '@/lib/auth-token';
import type { MapMarker, GridSize } from '@/components/party/battlemap/types';

const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-extract`;
const STORAGE_KEY = 'odyssey-dm-auto-sync';

export interface ExtractionResult {
  hp_changes: { amount: number; type: 'damage' | 'healing'; source: string }[];
  xp_gained: number | null;
  gold_changes: { amount: number; action: 'gained' | 'spent'; source: string }[];
  conditions_added: string[];
  conditions_removed: string[];
  items_acquired: { name: string; quantity: number }[];
  rest_occurred: 'short' | 'long' | null;
  map_entities: MapEntity[];
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
  markers: MapMarker[];
  timestamp: number;
}

interface AutoSyncCallbacks {
  onHPChange: (change: number, type: 'damage' | 'healing') => void;
  onAddXP: (amount: number, source: string) => void;
  onGoldChange: (netChange: number) => void;
  onConditionChange: (toAdd: string[], toRemove: string[]) => void;
  onRestOccurred: (type: 'short' | 'long') => void;
  onMapUpdate: (markersToAdd: MapMarker[], namesToRemove: string[]) => void;
  onCompanionHPChange?: (change: number, type: 'damage' | 'healing') => void;
  onCompanionHPSet?: (hp: number) => void;
  onCompanionConditionChange?: (toAdd: string[], toRemove: string[]) => void;
  onHPSet?: (hp: number) => void;
  // snapshot getters
  getCurrentHP: () => number;
  getCurrentGold: () => number;
  getCurrentMarkers: () => MapMarker[];
  getGridSize: () => GridSize;
}

export function useDmAutoSync(callbacks: AutoSyncCallbacks) {
  // Store callbacks in a ref to avoid re-creating extractAndApply on every render
  const callbacksRef = useRef(callbacks);
  useEffect(() => { callbacksRef.current = callbacks; });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
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

      // Apply HP — absolute takes priority over deltas
      if (typeof result.hp_absolute === 'number' && cb.onHPSet) {
        cb.onHPSet(result.hp_absolute);
      } else if (result.hp_changes.length > 0) {
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
      if (result.xp_gained && result.xp_gained > 0) {
        cb.onAddXP(result.xp_gained, 'AI DM Auto-Sync');
      }

      // Apply gold
      for (const goldChange of result.gold_changes) {
        const net = goldChange.action === 'gained' ? goldChange.amount : -goldChange.amount;
        cb.onGoldChange(net);
      }

      // Apply conditions
      if (result.conditions_added.length > 0 || result.conditions_removed.length > 0) {
        cb.onConditionChange(result.conditions_added, result.conditions_removed);
      }

      // Apply rest
      if (result.rest_occurred) {
        cb.onRestOccurred(result.rest_occurred);
      }

      // Apply map updates
      if ((result.map_entities?.length ?? 0) > 0 || (result.map_entities_removed?.length ?? 0) > 0) {
        const { markersToAdd, namesToRemove } = computeMapUpdates(
          result,
          cb.getCurrentMarkers(),
          cb.getGridSize()
        );
        if (markersToAdd.length > 0 || namesToRemove.length > 0) {
          cb.onMapUpdate(markersToAdd, namesToRemove);
        }
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
    // For now, undo just clears the last extraction display
    // Full state undo would require deeper integration
    setLastExtraction(null);
    snapshotRef.current = null;
    toast.success('Auto-sync changes dismissed');
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
