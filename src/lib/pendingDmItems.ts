// Pending items awarded by the AI DM, held for player review before entering inventory.

import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

export const PENDING_DM_ITEMS_KEY = 'odyssey-pending-dm-items';
export const PENDING_DM_ITEMS_EVENT = 'odyssey-pending-dm-items-change';

export interface PendingDmItem {
  id: string;
  name: string;
  quantity: number;
  acquiredAt: string;
}

export function loadPendingDmItems(): PendingDmItem[] {
  try {
    const raw = getScopedItem(PENDING_DM_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[PendingDmItems] Failed to load:', e);
    return [];
  }
}

function persist(items: PendingDmItem[]) {
  try {
    if (items.length === 0) removeScopedItem(PENDING_DM_ITEMS_KEY);
    else setScopedItem(PENDING_DM_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('[PendingDmItems] Failed to save:', e);
  }
  window.dispatchEvent(new CustomEvent(PENDING_DM_ITEMS_EVENT, { detail: items }));
}

export function addPendingDmItems(incoming: Array<{ name: string; quantity?: number }>): PendingDmItem[] {
  const clean = (incoming || [])
    .filter(i => i && typeof i.name === 'string' && i.name.trim().length > 0)
    .slice(0, 12)
    .map(i => ({
      id: crypto.randomUUID(),
      name: i.name.trim().slice(0, 120),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      acquiredAt: new Date().toISOString(),
    }));
  if (clean.length === 0) return loadPendingDmItems();
  const next = [...loadPendingDmItems(), ...clean].slice(-30);
  persist(next);
  return next;
}

export function removePendingDmItem(id: string): PendingDmItem[] {
  const next = loadPendingDmItems().filter(i => i.id !== id);
  persist(next);
  return next;
}

export function clearPendingDmItems(): void {
  persist([]);
}
