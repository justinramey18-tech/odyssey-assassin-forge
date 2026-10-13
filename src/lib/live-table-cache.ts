import type { RoundChatMessage } from '@/hooks/use-round-chat';

const PREFIX = 'odyssey-live-table-cache::';
export const LIVE_TABLE_CACHE_LIMIT = 60;

export function liveTableCacheKey(userId?: string, partyId?: string | null): string | null {
  return userId && partyId ? `${PREFIX}${userId}::${partyId}` : null;
}

/** Timestamp order, with stable input order for ties (the table's existing convention). */
export function orderTableLines(lines: RoundChatMessage[]): RoundChatMessage[] {
  return [...lines].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function readLiveTableCache(key: string | null): RoundChatMessage[] {
  if (!key) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return orderTableLines(parsed.filter((line): line is RoundChatMessage => {
      if (!line || typeof line !== 'object' || typeof line.id !== 'string' || seen.has(line.id)
        || typeof line.party_id !== 'string' || !key.endsWith(`::${line.party_id}`)
        || typeof line.user_id !== 'string' || typeof line.character_name !== 'string'
        || typeof line.content !== 'string' || typeof line.created_at !== 'string'
        || !Number.isFinite(Date.parse(line.created_at)) || typeof line.round_id !== 'string'
        || typeof line.in_character !== 'boolean' || typeof line.consumed !== 'boolean'
        || typeof line.selected !== 'boolean') return false;
      seen.add(line.id);
      return true;
    })).slice(-LIVE_TABLE_CACHE_LIMIT);
  } catch { return []; }
}

export function writeLiveTableCache(key: string | null, lines: RoundChatMessage[]): void {
  if (!key) return;
  try {
    // Preserve full line content: spell cards and reply tags must never be truncated.
    localStorage.setItem(key, JSON.stringify(orderTableLines(lines).slice(-LIVE_TABLE_CACHE_LIMIT)));
  } catch { /* A full/unavailable device cache must not interrupt the conversation. */ }
}

/** Fresh server rows win over cache; changes made while the read was in flight survive. */
export function reconcileTableLines(
  fetched: RoundChatMessage[], before: RoundChatMessage[], current: RoundChatMessage[],
): RoundChatMessage[] {
  const beforeById = new Map(before.map(line => [line.id, line]));
  const currentById = new Map(current.map(line => [line.id, line]));
  const merged = new Map<string, RoundChatMessage>();
  for (const line of fetched) {
    const prior = beforeById.get(line.id);
    const now = currentById.get(line.id);
    if (prior && !now) continue; // Deleted locally or over the live channel during the read.
    merged.set(line.id, now && now !== prior ? now : line);
  }
  for (const line of current) {
    if (!beforeById.has(line.id) || line !== beforeById.get(line.id)) merged.set(line.id, line);
  }
  return orderTableLines([...merged.values()]);
}