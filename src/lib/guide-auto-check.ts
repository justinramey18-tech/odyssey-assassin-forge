import { getAuthToken } from '@/lib/auth-token';

const ENABLED_KEY = 'guide-auto-check-enabled';
const BADGES_KEY = 'guide-conflict-badges';

export type ConflictDetail = {
  description: string;
  severity?: string;
  guideNames?: string[];
  otherGuideName?: string;
  targetExcerpt?: string;
  otherExcerpt?: string;
  suggestion?: string;
};

export type ConflictBadge = {
  count: number;
  descriptions: string[];
  details?: ConflictDetail[];
  checkedAt: number;
};

export function isAutoCheckEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoCheckEnabled(v: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function loadConflictBadges(): Record<string, ConflictBadge> {
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, ConflictBadge>;
  } catch {
    return {};
  }
}

function persist(map: Record<string, ConflictBadge>) {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function saveConflictBadge(
  guideId: string,
  conflicts: Array<{ description: string }>,
): Record<string, ConflictBadge> {
  const map = loadConflictBadges();
  if (conflicts && conflicts.length > 0) {
    map[guideId] = {
      count: conflicts.length,
      descriptions: conflicts.slice(0, 3).map(c => String(c?.description ?? '')),
      checkedAt: Date.now(),
    };
  } else {
    delete map[guideId];
  }
  persist(map);
  return map;
}

export function clearConflictBadge(guideId: string): Record<string, ConflictBadge> {
  const map = loadConflictBadges();
  delete map[guideId];
  persist(map);
  return map;
}

export async function runQuickScan(
  target: { id: string; name: string; content: string },
  others: Array<{ id: string; name: string; content: string }>,
): Promise<Array<{ description: string; guideIds?: string[]; guideNames?: string[]; severity?: string }>> {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guide-quality-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'quick_scan',
        targetGuide: target,
        otherGuides: others,
        model: 'google/gemini-3-flash-preview',
      }),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    if (!data || data.parseError) return [];
    const list = data.conflicts ?? data.issues ?? data.results;
    if (!Array.isArray(list)) return [];
    return list.filter((c: unknown) => c && typeof c === 'object');
  } catch {
    return [];
  }
}
