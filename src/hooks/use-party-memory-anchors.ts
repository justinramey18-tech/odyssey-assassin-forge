import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MemoryAnchor, MemoryAnchorCategory } from '@/hooks/use-dm-game-state';

const STATE_TYPE = 'party_memory_anchors';
const MAX_ANCHORS = 50;

interface UsePartyMemoryAnchorsOptions {
  partyId: string | null;
}

export function usePartyMemoryAnchors({ partyId }: UsePartyMemoryAnchorsOptions) {
  const [anchors, setAnchors] = useState<MemoryAnchor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from party_shared_state
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase.from('party_shared_state') as any)
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', STATE_TYPE)
        .maybeSingle();

      if (cancelled) return;
      if (data?.state_data?.anchors) {
        setAnchors(data.state_data.anchors as MemoryAnchor[]);
      }
      setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [partyId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!partyId) return;

    const channel = supabase
      .channel(`party-memory-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload: any) => {
          const row = payload.new as { state_type?: string; state_data?: any } | undefined;
          if (row?.state_type === STATE_TYPE && row.state_data?.anchors) {
            setAnchors(row.state_data.anchors as MemoryAnchor[]);
          }
          // Handle deletion
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { state_type?: string } | undefined;
            if (old?.state_type === STATE_TYPE) {
              setAnchors([]);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const persistToCloud = useCallback(async (updated: MemoryAnchor[]) => {
    if (!partyId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await (supabase.from('party_shared_state') as any)
      .upsert({
        party_id: partyId,
        user_id: session.user.id,
        state_type: STATE_TYPE,
        state_data: { anchors: updated },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId]);

  const scheduleSave = useCallback((updated: MemoryAnchor[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => persistToCloud(updated), 500);
  }, [persistToCloud]);

  const addMemoryAnchor = useCallback((anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => {
    setAnchors(prev => {
      // Merge by category+key
      const existing = prev.find(
        a => a.category === anchor.category && a.key.toLowerCase() === anchor.key.toLowerCase()
      );

      let updated: MemoryAnchor[];
      if (existing) {
        updated = prev.map(a =>
          a.id === existing.id ? { ...a, value: anchor.value } : a
        );
      } else {
        if (prev.length >= MAX_ANCHORS) {
          // Drop oldest
          updated = [...prev.slice(1), {
            id: crypto.randomUUID(),
            ...anchor,
            turn: 0,
            created_at: new Date().toISOString(),
          }];
        } else {
          updated = [...prev, {
            id: crypto.randomUUID(),
            ...anchor,
            turn: 0,
            created_at: new Date().toISOString(),
          }];
        }
      }

      scheduleSave(updated);
      return updated;
    });
  }, [scheduleSave]);

  const removeMemoryAnchor = useCallback((anchorId: string) => {
    setAnchors(prev => {
      const updated = prev.filter(a => a.id !== anchorId);
      scheduleSave(updated);
      return updated;
    });
  }, [scheduleSave]);

  const clearAll = useCallback(() => {
    setAnchors([]);
  }, []);

  /** Formatted string for Oracle context injection */
  const formattedForOracle = anchors.length > 0
    ? anchors
        .slice(0, 30) // Cap for prompt size
        .map(a => `[${a.category.toUpperCase()}] ${a.key}: ${a.value}`)
        .join('\n')
    : undefined;

  return {
    anchors,
    loaded,
    addMemoryAnchor,
    removeMemoryAnchor,
    clearAll,
    formattedForOracle,
  };
}
