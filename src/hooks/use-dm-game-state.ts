import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryAnchorCategory = 'npc' | 'quest' | 'location' | 'reputation' | 'debt' | 'injury' | 'secret' | 'fact' | 'subtext';

export interface MemoryAnchor {
  id: string;
  category: MemoryAnchorCategory;
  key: string;          // Short label, e.g. "Mira the Innkeeper"
  value: string;        // Description, e.g. "Distrusts you after the tavern incident"
  turn: number;         // Session turn when it was added/last updated
  created_at: string;
}

export interface QuestFlag {
  status: 'active' | 'completed' | 'failed' | 'unknown';
  notes?: string;
  updated_at: string;
}

export interface DMInventoryItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
  acquired_turn: number;
}

export interface DMGameState {
  id?: string;
  campaign_id: string | null;
  current_hp: number;
  max_hp: number;
  gold: number;
  inventory: DMInventoryItem[];
  quest_flags: Record<string, QuestFlag>;
  memory_anchors: MemoryAnchor[];
  session_turn: number;
}

const DEFAULT_STATE: Omit<DMGameState, 'campaign_id'> = {
  current_hp: 0,
  max_hp: 0,
  gold: 0,
  inventory: [],
  quest_flags: {},
  memory_anchors: [],
  session_turn: 0,
};

function getLocalKey(mode?: 'solo' | 'solo-empyrean'): string {
  return mode ? `odyssey-dm-game-state-${mode}` : 'odyssey-dm-game-state';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDMGameState(campaignId: string | null, mode?: 'solo' | 'solo-empyrean') {
  const localKey = getLocalKey(mode);

  const [gameState, setGameState] = useState<DMGameState>(() => {
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return { ...DEFAULT_STATE, campaign_id: campaignId };
      const parsed = JSON.parse(raw);
      // Migrate if campaign changed
      if (parsed.campaign_id !== campaignId) {
        return { ...DEFAULT_STATE, campaign_id: campaignId };
      }
      return parsed;
    } catch {
      return { ...DEFAULT_STATE, campaign_id: campaignId };
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // ── Load from cloud ──────────────────────────────────────────────────────────
  const loadFromCloud = useCallback(async (cid: string | null) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('dm_game_state' as any)
        .select('*')
        .eq('user_id', user.id);

      if (cid) {
        query = query.eq('campaign_id', cid);
      } else {
        query = query.is('campaign_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.warn('[DMGameState] Load error:', error);
        return;
      }

      if (data) {
        const row = data as any;
        const loaded: DMGameState = {
          id: row.id,
          campaign_id: row.campaign_id,
          current_hp: row.current_hp ?? 0,
          max_hp: row.max_hp ?? 0,
          gold: row.gold ?? 0,
          inventory: (row.inventory as DMInventoryItem[]) ?? [],
          quest_flags: (row.quest_flags as Record<string, QuestFlag>) ?? {},
          memory_anchors: (row.memory_anchors as MemoryAnchor[]) ?? [],
          session_turn: row.session_turn ?? 0,
        };
        setGameState(loaded);
        localStorage.setItem(localKey, JSON.stringify(loaded));
      }
    } catch (err) {
      console.warn('[DMGameState] Load exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load when campaignId changes
  const lastLoadedCampaignRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastLoadedCampaignRef.current === campaignId) return;
    lastLoadedCampaignRef.current = campaignId;
    // Reset state for new campaign first
    const fresh = { ...DEFAULT_STATE, campaign_id: campaignId };
    setGameState(fresh);
    loadFromCloud(campaignId);
  }, [campaignId, loadFromCloud]);

  // Reset memory anchors when mode changes
  const lastModeRef = useRef(mode);
  useEffect(() => {
    if (lastModeRef.current !== mode) {
      lastModeRef.current = mode;
      const fresh: DMGameState = { ...DEFAULT_STATE, campaign_id: campaignId };
      setGameState(fresh);
      localStorage.setItem(localKey, JSON.stringify(fresh));
      loadFromCloud(campaignId);
    }
  }, [mode, campaignId, localKey, loadFromCloud]);

  // ── Save to cloud (debounced) ────────────────────────────────────────────────
  const saveToCloud = useCallback(async (state: DMGameState) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setIsSaving(true);
      const payload = {
        user_id: user.id,
        campaign_id: state.campaign_id,
        current_hp: state.current_hp,
        max_hp: state.max_hp,
        gold: state.gold,
        inventory: state.inventory as any,
        quest_flags: state.quest_flags as any,
        memory_anchors: state.memory_anchors as any,
        session_turn: state.session_turn,
        updated_at: new Date().toISOString(),
      };

      if (state.id) {
        // Update existing row by known ID
        await supabase
          .from('dm_game_state' as any)
          .update(payload)
          .eq('id', state.id)
          .eq('user_id', user.id);
      } else {
        // Try to find existing row first, then update or insert
        let query = supabase
          .from('dm_game_state' as any)
          .select('id')
          .eq('user_id', user.id);

        if (state.campaign_id) {
          query = query.eq('campaign_id', state.campaign_id);
        } else {
          query = query.is('campaign_id', null);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          // Update by id
          await supabase
            .from('dm_game_state' as any)
            .update(payload)
            .eq('id', (existing as any).id)
            .eq('user_id', user.id);
          setGameState(prev => ({ ...prev, id: (existing as any).id }));
        } else {
          // Insert new
          const { data: inserted, error } = await supabase
            .from('dm_game_state' as any)
            .insert(payload)
            .select('id')
            .maybeSingle();

          if (!error && inserted) {
            setGameState(prev => ({ ...prev, id: (inserted as any).id }));
          }
        }
      }
    } catch (err) {
      console.warn('[DMGameState] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const scheduleSave = useCallback((state: DMGameState) => {
    // Always persist locally immediately (synchronous — survives page close)
    try {
      localStorage.setItem(localKey, JSON.stringify(state));
    } catch (e) {
      console.warn('[DMGameState] localStorage write failed:', e);
    }

    // Debounce cloud save by 2s
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToCloud(state);
    }, 2000);
  }, [saveToCloud]);

  // ── Mutators ─────────────────────────────────────────────────────────────────

  const updateVitals = useCallback((hp: number, maxHp: number) => {
    setGameState(prev => {
      const next = { ...prev, current_hp: hp, max_hp: maxHp };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const updateGold = useCallback((gold: number) => {
    setGameState(prev => {
      const next = { ...prev, gold };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const addInventoryItem = useCallback((name: string, quantity: number = 1, category: string = 'misc') => {
    setGameState(prev => {
      const existing = prev.inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
      let updatedInventory: DMInventoryItem[];

      if (existing) {
        updatedInventory = prev.inventory.map(i =>
          i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        const newItem: DMInventoryItem = {
          id: crypto.randomUUID(),
          name,
          quantity,
          category,
          acquired_turn: prev.session_turn,
        };
        updatedInventory = [...prev.inventory, newItem];
      }

      const next = { ...prev, inventory: updatedInventory };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const removeInventoryItem = useCallback((itemId: string) => {
    setGameState(prev => {
      const next = { ...prev, inventory: prev.inventory.filter(i => i.id !== itemId) };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setQuestFlag = useCallback((key: string, status: QuestFlag['status'], notes?: string) => {
    setGameState(prev => {
      const next = {
        ...prev,
        quest_flags: {
          ...prev.quest_flags,
          [key]: { status, notes, updated_at: new Date().toISOString() },
        },
      };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const addMemoryAnchor = useCallback((anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => {
    setGameState(prev => {
      // If a same-category + same-key anchor exists, update it instead
      const existing = prev.memory_anchors.find(
        a => a.category === anchor.category && a.key.toLowerCase() === anchor.key.toLowerCase()
      );

      let updatedAnchors: MemoryAnchor[];
      if (existing) {
        updatedAnchors = prev.memory_anchors.map(a =>
          a.id === existing.id
            ? { ...a, value: anchor.value, turn: prev.session_turn }
            : a
        );
      } else {
        updatedAnchors = [
          ...prev.memory_anchors,
          {
            id: crypto.randomUUID(),
            ...anchor,
            turn: prev.session_turn,
            created_at: new Date().toISOString(),
          },
        ];
      }

      const next = { ...prev, memory_anchors: updatedAnchors };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const removeMemoryAnchor = useCallback((anchorId: string) => {
    setGameState(prev => {
      const next = { ...prev, memory_anchors: prev.memory_anchors.filter(a => a.id !== anchorId) };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const incrementTurn = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, session_turn: prev.session_turn + 1 };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const resetForNewCampaign = useCallback((newCampaignId: string | null) => {
    const fresh = { ...DEFAULT_STATE, campaign_id: newCampaignId };
    setGameState(fresh);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh));
  }, []);

  // Flush localStorage on page close (synchronous, guaranteed to run)
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(stateRef.current));
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // On unmount: cancel debounce and trigger an immediate cloud save
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveToCloud(stateRef.current);
    };
  }, [saveToCloud]);

  return {
    gameState,
    isLoading,
    isSaving,
    // Mutators
    updateVitals,
    updateGold,
    addInventoryItem,
    removeInventoryItem,
    setQuestFlag,
    addMemoryAnchor,
    removeMemoryAnchor,
    incrementTurn,
    resetForNewCampaign,
    // Manual save
    saveNow: () => saveToCloud(stateRef.current),
  };
}

// ─── Memory anchor formatting for AI prompt ───────────────────────────────────

export function buildMemoryAnchorsPrompt(state: DMGameState): string {
  const lines: string[] = [];

  if (state.memory_anchors.length > 0) {
    lines.push('\n## PERSISTENT WORLD MEMORY');
    lines.push('These facts are permanently established in this campaign. Never contradict them:');

    const byCategory = state.memory_anchors.reduce<Record<string, MemoryAnchor[]>>((acc, a) => {
      (acc[a.category] = acc[a.category] || []).push(a);
      return acc;
    }, {});

    const categoryLabels: Record<string, string> = {
      npc: '👤 NPCs',
      quest: '📜 Quests',
      location: '🗺️ Locations',
      reputation: '⭐ Reputation',
      debt: '💰 Debts & Obligations',
      injury: '🩸 Injuries & Conditions',
      secret: '🔐 Secrets',
      fact: '📌 World Facts',
      subtext: '🎭 Narrative Tone & Subtext',
    };

    for (const [cat, anchors] of Object.entries(byCategory)) {
      lines.push(`\n${categoryLabels[cat] ?? cat}:`);
      for (const a of anchors) {
        lines.push(`  - **${a.key}**: ${a.value}`);
      }
    }
  }

  const activeQuests = Object.entries(state.quest_flags).filter(([, q]) => q.status === 'active');
  if (activeQuests.length > 0) {
    lines.push('\n## ACTIVE QUESTS');
    for (const [key, q] of activeQuests) {
      lines.push(`  - **${key}**${q.notes ? `: ${q.notes}` : ''}`);
    }
  }

  const completedQuests = Object.entries(state.quest_flags).filter(([, q]) => q.status === 'completed');
  if (completedQuests.length > 0) {
    lines.push(`\n(Completed quests: ${completedQuests.map(([k]) => k).join(', ')})`);
  }

  if (state.inventory.length > 0) {
    lines.push('\n## CAMPAIGN INVENTORY');
    lines.push('Items acquired during this campaign (may not be on character sheet yet):');
    for (const item of state.inventory) {
      lines.push(`  - ${item.name} x${item.quantity}`);
    }
  }

  return lines.join('\n');
}
