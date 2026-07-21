import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth-token';
import { isSupportingLocalOnlyEnabled } from '@/lib/api-keys';
import type { MemoryAnchor } from '@/hooks/use-dm-game-state';
import type { CharacterContext } from '@/components/oracle/types';

const MEMORY_EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm-memory-extract`;

interface ExtractedNPC {
  name: string;
  relationship: string;
  notes: string;
}

interface ExtractedLocation {
  name: string;
  type: string;
  notes: string;
}

interface ExtractedConsequence {
  category: 'reputation' | 'debt' | 'injury' | 'secret' | 'fact';
  key: string;
  value: string;
}

interface ExtractedSubtext {
  key: string;
  value: string;
}

interface ExtractionResponse {
  npcs: ExtractedNPC[];
  locations: ExtractedLocation[];
  consequences: ExtractedConsequence[];
  subtext: ExtractedSubtext[];
}

interface UseDmMemoryExtractionOptions {
  addMemoryAnchor: (anchor: Omit<MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
}

export function useDmMemoryExtraction({ addMemoryAnchor }: UseDmMemoryExtractionOptions) {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractMemory = useCallback(async (
    assistantMessage: string,
    existingAnchors: MemoryAnchor[],
    characterContext: CharacterContext
  ): Promise<void> => {
    // Skip very short messages — not enough content to extract from
    if (!assistantMessage || assistantMessage.trim().length < 50) return;

    setIsExtracting(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(MEMORY_EXTRACT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: assistantMessage,
          existingAnchors: existingAnchors.map(a => ({ category: a.category, key: a.key })),
          characterContext: { name: characterContext.name, level: characterContext.level },
        }),
      });

      if (!response.ok) {
        // Silently fail — never disrupt the chat
        console.warn('[Memory Extract] Failed:', response.status);
        return;
      }

      const data: ExtractionResponse = await response.json();
      let addedCount = 0;

      // Add NPCs
      for (const npc of data.npcs || []) {
        if (!npc.name?.trim()) continue;
        addMemoryAnchor({
          category: 'npc',
          key: npc.name.trim(),
          value: `${npc.relationship} — ${npc.notes}`.trim(),
        });
        addedCount++;
      }

      // Add locations
      for (const loc of data.locations || []) {
        if (!loc.name?.trim()) continue;
        addMemoryAnchor({
          category: 'location',
          key: loc.name.trim(),
          value: `${loc.type}: ${loc.notes}`.trim(),
        });
        addedCount++;
      }

      // Add consequences
      for (const con of data.consequences || []) {
        if (!con.key?.trim() || !con.value?.trim()) continue;
        addMemoryAnchor({
          category: con.category,
          key: con.key.trim(),
          value: con.value.trim(),
        });
        addedCount++;
      }

      // Add subtext (narrative tone, foreshadowing, implied tensions)
      for (const sub of data.subtext || []) {
        if (!sub.key?.trim() || !sub.value?.trim()) continue;
        addMemoryAnchor({
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
      // Fire-and-forget — never surface errors to the user
      console.warn('[Memory Extract] Error:', err);
    } finally {
      setIsExtracting(false);
    }
  }, [addMemoryAnchor]);

  return { isExtracting, extractMemory };
}
