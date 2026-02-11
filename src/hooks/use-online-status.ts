import { useState, useEffect, useCallback, useMemo } from 'react';

const ONLINE_TIMEOUT_MS = 60_000; // 1 minute
const REFRESH_INTERVAL_MS = 10_000; // Re-evaluate every 10s

export interface OnlineInfo {
  isOnline: boolean;
  lastSeenLabel: string | null; // null when online
}

/**
 * Determines whether a member is online based on their updated_at timestamp.
 * "Online" = updated_at within the last 60 seconds.
 */
function getOnlineInfo(updatedAt: string, now: number): OnlineInfo {
  const lastSeen = new Date(updatedAt).getTime();
  const diffMs = now - lastSeen;

  if (diffMs <= ONLINE_TIMEOUT_MS) {
    return { isOnline: true, lastSeenLabel: null };
  }

  // Format "last seen X ago"
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 120) return { isOnline: false, lastSeenLabel: 'Last seen 1m ago' };

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return { isOnline: false, lastSeenLabel: `Last seen ${diffMin}m ago` };

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { isOnline: false, lastSeenLabel: `Last seen ${diffHours}h ago` };

  const diffDays = Math.floor(diffHours / 24);
  return { isOnline: false, lastSeenLabel: `Last seen ${diffDays}d ago` };
}

/**
 * Hook that returns a map of userId -> OnlineInfo for a list of party members.
 * Re-evaluates every 10 seconds to keep the status fresh.
 */
export function useOnlineStatus(
  members: Array<{ user_id: string; updated_at: string }>
): Record<string, OnlineInfo> {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    const map: Record<string, OnlineInfo> = {};
    for (const m of members) {
      map[m.user_id] = getOnlineInfo(m.updated_at, now);
    }
    return map;
  }, [members, now]);
}

/**
 * Returns just the online count for a members list.
 */
export function useOnlineCount(
  members: Array<{ user_id: string; updated_at: string }>
): number {
  const statuses = useOnlineStatus(members);
  return useMemo(
    () => Object.values(statuses).filter(s => s.isOnline).length,
    [statuses]
  );
}
