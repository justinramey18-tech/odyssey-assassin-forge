import { useMemo } from 'react';
import type { Message } from '@/components/oracle/types';

/**
 * Extracts unique NPC names from chat history for autocomplete.
 * Looks for:
 * 1. **Name:** dialogue patterns (from NPC voicing responses)
 * 2. Common NPC introduction patterns in DM narration
 * 3. Capitalized proper nouns that appear 2+ times in assistant messages
 */
export function useNPCAutocomplete(messages: Message[]): string[] {
  return useMemo(() => {
    const names = new Map<string, number>(); // name -> count

    const EXCLUDED = new Set([
      'the', 'you', 'your', 'they', 'and', 'but', 'for', 'not', 'with',
      'this', 'that', 'from', 'have', 'has', 'are', 'was', 'were', 'been',
      'will', 'would', 'could', 'should', 'can', 'may', 'might',
      'attack', 'damage', 'roll', 'hit', 'miss', 'turn', 'round',
      'north', 'south', 'east', 'west', 'here', 'there', 'then', 'now',
      'gold', 'silver', 'copper', 'potion', 'scroll', 'sword', 'shield',
      'initiative', 'combat', 'battle', 'action', 'bonus', 'spell',
      'player', 'character', 'party', 'group', 'dragon', 'rider',
      'chapter', 'session', 'scene', 'area', 'room', 'door', 'wall',
      'however', 'suddenly', 'quickly', 'slowly', 'before', 'after',
    ]);

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const text = msg.content;

      // Pattern 1: **Name:** dialogue (from NPC voicing responses)
      const voicingPattern = /\*\*([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?(?:\s+(?:the\s+)?[A-Z][a-zA-Z']+)?)\*\*:/g;
      let m;
      while ((m = voicingPattern.exec(text)) !== null) {
        const name = m[1].trim();
        if (!EXCLUDED.has(name.toLowerCase())) {
          names.set(name, (names.get(name) || 0) + 5); // High weight for confirmed NPCs
        }
      }

      // Pattern 2: NPC introductions
      const introPatterns = [
        /(?:a|an|the)\s+\w+\s+(?:named|called|known\s+as)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
        /introduces?\s+(?:him|her|them)self\s+as\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,2})/g,
        /["'""](?:I\s+am|My\s+name\s+is|I'm|Call\s+me)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
        /(?:Captain|Mayor|Lord|Lady|King|Queen|Prince|Princess|Elder|Priest(?:ess)?|Commander|Chief)\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)?)/g,
      ];
      for (const pat of introPatterns) {
        const regex = new RegExp(pat.source, pat.flags);
        while ((m = regex.exec(text)) !== null) {
          const name = m[1]?.trim();
          if (name && name.length >= 3 && !EXCLUDED.has(name.toLowerCase())) {
            names.set(name, (names.get(name) || 0) + 3);
          }
        }
      }

      // Pattern 3: Repeated capitalized names (likely NPCs)
      const capitalPattern = /\b([A-Z][a-z]{2,}(?:'[a-z]+)?)\b/g;
      while ((m = capitalPattern.exec(text)) !== null) {
        const name = m[1];
        if (!EXCLUDED.has(name.toLowerCase())) {
          names.set(name, (names.get(name) || 0) + 1);
        }
      }
    }

    // Also check user messages for @NPC tags already used
    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const tagPattern = /@([A-Z][a-zA-Z']+)/g;
      let m;
      while ((m = tagPattern.exec(msg.content)) !== null) {
        const name = m[1];
        if (!EXCLUDED.has(name.toLowerCase())) {
          names.set(name, (names.get(name) || 0) + 3);
        }
      }
    }

    // Return names with count >= 2, sorted by frequency
    return Array.from(names.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [messages]);
}

/**
 * Given current input text and cursor position, determine if user is typing an @mention.
 * Returns the partial text after @ if active, or null.
 */
export function getAtMentionQuery(text: string, cursorPos: number): { query: string; startIndex: number } | null {
  // Look backward from cursor for @
  const beforeCursor = text.slice(0, cursorPos);
  const match = beforeCursor.match(/@([A-Za-z']*)\s*$/);
  if (!match) return null;
  // Only trigger if @ is at start of text or preceded by whitespace
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) return null;
  return { query: match[1], startIndex: atIndex };
}

/**
 * Filter NPC names by partial query (case-insensitive prefix match)
 */
export function filterNPCNames(names: string[], query: string): string[] {
  if (!query) return names.slice(0, 8);
  const q = query.toLowerCase();
  return names.filter(n => n.toLowerCase().startsWith(q)).slice(0, 8);
}
