import { useRef, useCallback, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-token';
import { toast } from 'sonner';
import type { MemoryAnchor } from '@/hooks/use-dm-game-state';
import type { CharacterContext } from '@/components/oracle/types';

const MEMORY_EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-memory-extract`;

interface ExtractionResponse {
  npcs: Array<{ name: string; relationship: string; notes: string }>;
  locations: Array<{ name: string; type: string; notes: string }>;
  consequences: Array<{ category: 'reputation' | 'debt' | 'injury' | 'secret' | 'fact'; key: string; value: string }>;
  subtext: Array<{ key: string; value: string }>;
}

interface UsePartyMemoryExtractionOptions {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  anchors: MemoryAnchor[];
  addMemoryAnchor: (anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
  characterContext?: CharacterContext;
  enabled: boolean;
}

/**
 * Watches party DM messages for new assistant responses and auto-extracts
 * NPCs, locations, consequences, and subtext into party memory anchors.
 */
export function usePartyMemoryExtraction({
  messages,
  anchors,
  addMemoryAnchor,
  characterContext,
  enabled,
}: UsePartyMemoryExtractionOptions) {
  // Track which message IDs we've already extracted from
  const extractedIdsRef = useRef<Set<string>>(new Set());
  // Prevent extraction during initial load
  const initialLoadRef = useRef(true);
  const addMemoryAnchorRef = useRef(addMemoryAnchor);
  const anchorsRef = useRef(anchors);

  useEffect(() => { addMemoryAnchorRef.current = addMemoryAnchor; }, [addMemoryAnchor]);
  useEffect(() => { anchorsRef.current = anchors; }, [anchors]);

  // Mark all existing messages as "seen" on initial load
  useEffect(() => {
    if (messages.length > 0 && initialLoadRef.current) {
      messages.forEach(m => extractedIdsRef.current.add(m.id));
      initialLoadRef.current = false;
    }
  }, [messages]);

  const extractFromMessage = useCallback(async (content: string) => {
    if (!content || content.trim().length < 50) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(MEMORY_EXTRACT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: content,
          existingAnchors: anchorsRef.current.map(a => ({ category: a.category, key: a.key })),
          characterContext: characterContext
            ? { name: characterContext.name, level: characterContext.level }
            : undefined,
        }),
      });

      if (!response.ok) {
        console.warn('[Party Memory Extract] Failed:', response.status);
        return;
      }

      const data: ExtractionResponse = await response.json();
      let addedCount = 0;

      for (const npc of data.npcs || []) {
        if (!npc.name?.trim()) continue;
        addMemoryAnchorRef.current({
          category: 'npc',
          key: npc.name.trim(),
          value: `${npc.relationship} — ${npc.notes}`.trim(),
        });
        addedCount++;
      }

      for (const loc of data.locations || []) {
        if (!loc.name?.trim()) continue;
        addMemoryAnchorRef.current({
          category: 'location',
          key: loc.name.trim(),
          value: `${loc.type}: ${loc.notes}`.trim(),
        });
        addedCount++;
      }

      for (const con of data.consequences || []) {
        if (!con.key?.trim() || !con.value?.trim()) continue;
        addMemoryAnchorRef.current({
          category: con.category,
          key: con.key.trim(),
          value: con.value.trim(),
        });
        addedCount++;
      }

      for (const sub of data.subtext || []) {
        if (!sub.key?.trim() || !sub.value?.trim()) continue;
        addMemoryAnchorRef.current({
          category: 'subtext',
          key: sub.key.trim(),
          value: sub.value.trim(),
        });
        addedCount++;
      }

      if (addedCount > 0) {
        toast.success(
          `📌 ${addedCount} world ${addedCount === 1 ? 'fact' : 'facts'} remembered`,
          { duration: 2500 }
        );
      }
    } catch (err) {
      console.warn('[Party Memory Extract] Error:', err);
    }
  }, [characterContext]);

  // Watch for new assistant messages
  useEffect(() => {
    if (!enabled || initialLoadRef.current) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (extractedIdsRef.current.has(lastMsg.id)) return;

    extractedIdsRef.current.add(lastMsg.id);
    // Fire and forget — never block the chat
    extractFromMessage(lastMsg.content);
  }, [messages, enabled, extractFromMessage]);
}
