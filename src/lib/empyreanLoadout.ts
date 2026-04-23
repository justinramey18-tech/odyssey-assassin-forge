/**
 * Empyrean Rider Loadout — Gear System
 * 
 * Clean, Empyrean-only gear management. Does NOT share storage or types
 * with Assassin's Ledger's CharacterEquipment system. Separate scoped keys,
 * separate shapes, separate lifecycle.
 * 
 * Storage keys (both scoped via @/lib/scoped-storage):
 *   - 'empyrean-loadout'  → EmpyreanLoadoutState
 *   - 'empyrean-gold'     → number
 * 
 * Usage:
 *   const loadout = loadEmpyreanLoadout();
 *   const gold = loadEmpyreanGold();
 *   
 *   // Check if user can afford a forge
 *   if (canAffordForge('rare', loadout, gold)) { ... }
 *   
 *   // Forge an item (AI-generated content comes from the edge function in G4)
 *   const newItem = createEmpyreanGearItem({ slot: 'chest', rarity: 'rare', ... });
 *   addItemToInventory(newItem);
 *   
 *   // Equip/unequip
 *   equipItem(newItem.id);
 *   unequipSlot('chest');
 */

import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

// ─── Types ─────────────────────────────────────────────────────────────────

export type EmpyreanSlot = 'head' | 'chest' | 'weapon' | 'dagger' | 'wings' | 'potions';

export type EmpyreanRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type EmpyreanStatKey = 'physical' | 'mental' | 'endurance' | 'evasion' | 'social';

export type EmpyreanStatBlock = Partial<Record<EmpyreanStatKey, number>>;

export interface EmpyreanGearItem {
  id: string;
  name: string;
  slot: EmpyreanSlot;
  rarity: EmpyreanRarity;
  description: string;
  stats: EmpyreanStatBlock;
  createdAt: number;
  /** Original prose the user forged this from, for regeneration. Optional. */
  forgedFrom?: string;
}

export interface EmpyreanLoadoutState {
  /** Map of slot → equipped item id (or undefined for empty slots). */
  equipped: Partial<Record<EmpyreanSlot, string>>;
  /** All gear items the rider owns (equipped AND unequipped). Inventory. */
  inventory: EmpyreanGearItem[];
  /** Set of slots that have used their free first-forge. Persisted for cost tracking. */
  freeForgesSpent: EmpyreanSlot[];
}

// ─── Storage Keys ──────────────────────────────────────────────────────────

const LOADOUT_KEY = 'empyrean-loadout';
const GOLD_KEY = 'empyrean-gold';

// ─── Defaults ──────────────────────────────────────────────────────────────

export const STARTING_GOLD = 100;

export const RARITY_GOLD_COST: Record<EmpyreanRarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 75,
  epic: 200,
  legendary: 500,
};

/** Minimum rider level required to forge each rarity tier. */
export const RARITY_LEVEL_REQUIREMENT: Record<EmpyreanRarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 1,
  epic: 5,
  legendary: 10,
};

/** Rarity display metadata — hex colors match common RPG conventions. */
export const RARITY_META: Record<EmpyreanRarity, { label: string; color: string; glow: string }> = {
  common:    { label: 'Common',    color: '#d4d4d8', glow: 'rgba(212,212,216,0.2)' },
  uncommon:  { label: 'Uncommon',  color: '#4ade80', glow: 'rgba(74,222,128,0.25)' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: 'rgba(96,165,250,0.3)' },
  epic:      { label: 'Epic',      color: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  legendary: { label: 'Legendary', color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },
};

/**
 * Stat budget per rarity. The AI (in G4) uses this to ensure it assigns
 * consistent power levels regardless of prose. Shape: number of stats × value pattern.
 */
export interface RarityStatBudget {
  statCount: number;
  values: number[]; // e.g. [2, 1] means first stat gets +2, second gets +1
}

export const RARITY_STAT_BUDGET: Record<EmpyreanRarity, RarityStatBudget> = {
  common:    { statCount: 1, values: [1] },
  uncommon:  { statCount: 1, values: [2] },
  rare:      { statCount: 2, values: [2, 1] },
  epic:      { statCount: 2, values: [3, 2] },
  legendary: { statCount: 3, values: [4, 3, 2] },
};

/** Slot display metadata. */
export const SLOT_META: Record<EmpyreanSlot, { label: string; emoji: string }> = {
  head:    { label: 'Head',    emoji: '🛡' },
  chest:   { label: 'Chest',   emoji: '🎽' },
  weapon:  { label: 'Weapon',  emoji: '⚔' },
  dagger:  { label: 'Dagger',  emoji: '🗡' },
  wings:   { label: 'Wings',   emoji: '🪽' },
  potions: { label: 'Potions', emoji: '🧪' },
};

export const ALL_SLOTS: EmpyreanSlot[] = ['head', 'chest', 'weapon', 'dagger', 'wings', 'potions'];
export const ALL_RARITIES: EmpyreanRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const ALL_STATS: EmpyreanStatKey[] = ['physical', 'mental', 'endurance', 'evasion', 'social'];

export const STAT_META: Record<EmpyreanStatKey, { label: string; description: string }> = {
  physical:  { label: 'Physical',   description: 'Melee damage, strength checks.' },
  mental:    { label: 'Mental',     description: 'Signet control, bond resonance.' },
  endurance: { label: 'Endurance',  description: 'HP, stamina, burnout resistance.' },
  evasion:   { label: 'Evasion',    description: 'Dodge, aerial maneuvering.' },
  social:    { label: 'Social',     description: 'Intimidation, persuasion, command presence.' },
};

// ─── Loadout Storage ───────────────────────────────────────────────────────

function emptyLoadout(): EmpyreanLoadoutState {
  return { equipped: {}, inventory: [], freeForgesSpent: [] };
}

export function loadEmpyreanLoadout(): EmpyreanLoadoutState {
  try {
    const raw = getScopedItem(LOADOUT_KEY);
    if (!raw) return emptyLoadout();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyLoadout();
    return {
      equipped: parsed.equipped ?? {},
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      freeForgesSpent: Array.isArray(parsed.freeForgesSpent) ? parsed.freeForgesSpent : [],
    };
  } catch {
    return emptyLoadout();
  }
}

export function saveEmpyreanLoadout(state: EmpyreanLoadoutState): void {
  try {
    setScopedItem(LOADOUT_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearEmpyreanLoadout(): void {
  try {
    removeScopedItem(LOADOUT_KEY);
  } catch {
    // ignore
  }
}

// ─── Gold Storage ──────────────────────────────────────────────────────────

export function loadEmpyreanGold(): number {
  try {
    const raw = getScopedItem(GOLD_KEY);
    if (raw === null || raw === undefined) return STARTING_GOLD;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : STARTING_GOLD;
  } catch {
    return STARTING_GOLD;
  }
}

export function saveEmpyreanGold(amount: number): void {
  try {
    const clamped = Math.max(0, Math.floor(amount));
    setScopedItem(GOLD_KEY, clamped.toString());
  } catch {
    // ignore
  }
}

export function addEmpyreanGold(delta: number): number {
  const current = loadEmpyreanGold();
  const next = Math.max(0, current + Math.floor(delta));
  saveEmpyreanGold(next);
  return next;
}

export function clearEmpyreanGold(): void {
  try {
    removeScopedItem(GOLD_KEY);
  } catch {
    // ignore
  }
}

// ─── Core Operations ───────────────────────────────────────────────────────

/**
 * Create a new gear item. Caller supplies AI-generated name/description/stats.
 * Returns a fully-formed EmpyreanGearItem ready to be added to inventory.
 */
export function createEmpyreanGearItem(params: {
  name: string;
  slot: EmpyreanSlot;
  rarity: EmpyreanRarity;
  description: string;
  stats: EmpyreanStatBlock;
  forgedFrom?: string;
}): EmpyreanGearItem {
  return {
    id: `gear_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: params.name,
    slot: params.slot,
    rarity: params.rarity,
    description: params.description,
    stats: params.stats,
    createdAt: Date.now(),
    forgedFrom: params.forgedFrom,
  };
}

export function addItemToInventory(item: EmpyreanGearItem): EmpyreanLoadoutState {
  const state = loadEmpyreanLoadout();
  state.inventory = [...state.inventory, item];
  saveEmpyreanLoadout(state);
  return state;
}

export function removeItemFromInventory(itemId: string): EmpyreanLoadoutState {
  const state = loadEmpyreanLoadout();
  const item = state.inventory.find(i => i.id === itemId);
  state.inventory = state.inventory.filter(i => i.id !== itemId);
  // If this item was equipped, unequip it too.
  if (item && state.equipped[item.slot] === itemId) {
    const { [item.slot]: _removed, ...rest } = state.equipped;
    state.equipped = rest;
  }
  saveEmpyreanLoadout(state);
  return state;
}

/**
 * Equip an inventory item. Replaces whatever is currently in that slot.
 * Returns the updated state, or null if the item doesn't exist.
 */
export function equipItem(itemId: string): EmpyreanLoadoutState | null {
  const state = loadEmpyreanLoadout();
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return null;
  state.equipped = { ...state.equipped, [item.slot]: itemId };
  saveEmpyreanLoadout(state);
  return state;
}

export function unequipSlot(slot: EmpyreanSlot): EmpyreanLoadoutState {
  const state = loadEmpyreanLoadout();
  const { [slot]: _removed, ...rest } = state.equipped;
  state.equipped = rest;
  saveEmpyreanLoadout(state);
  return state;
}

export function getEquippedItem(state: EmpyreanLoadoutState, slot: EmpyreanSlot): EmpyreanGearItem | null {
  const id = state.equipped[slot];
  if (!id) return null;
  return state.inventory.find(i => i.id === id) ?? null;
}

export function getInventoryBySlot(state: EmpyreanLoadoutState, slot: EmpyreanSlot): EmpyreanGearItem[] {
  return state.inventory.filter(i => i.slot === slot);
}

// ─── Forge Cost Logic ──────────────────────────────────────────────────────

/**
 * Returns the gold cost to forge an item of the given slot+rarity, accounting
 * for the first-free-per-slot rule.
 */
export function getForgeCost(slot: EmpyreanSlot, rarity: EmpyreanRarity, state: EmpyreanLoadoutState): number {
  const isFirstForge = !state.freeForgesSpent.includes(slot);
  if (isFirstForge) return 0;
  return RARITY_GOLD_COST[rarity];
}

/**
 * Validates that a forge is allowed: level permits rarity, gold covers cost.
 * Returns null if OK, or a user-facing error message.
 */
export function validateForge(params: {
  slot: EmpyreanSlot;
  rarity: EmpyreanRarity;
  riderLevel: number;
  currentGold: number;
  state: EmpyreanLoadoutState;
}): string | null {
  const { slot, rarity, riderLevel, currentGold, state } = params;
  const minLevel = RARITY_LEVEL_REQUIREMENT[rarity];
  if (riderLevel < minLevel) {
    return `${RARITY_META[rarity].label} items require rider level ${minLevel}.`;
  }
  const cost = getForgeCost(slot, rarity, state);
  if (currentGold < cost) {
    return `Not enough gold. Costs ${cost}, you have ${currentGold}.`;
  }
  return null;
}

export function canAffordForge(rarity: EmpyreanRarity, state: EmpyreanLoadoutState, currentGold: number): boolean {
  const anyRemainingFreeForges = ALL_SLOTS.some(s => !state.freeForgesSpent.includes(s));
  if (anyRemainingFreeForges) return true;
  return currentGold >= RARITY_GOLD_COST[rarity];
}

/**
 * Commit a forge: charge gold (if not free), mark slot's free-forge as spent,
 * add item to inventory. Returns updated state.
 */
export function commitForge(params: {
  item: EmpyreanGearItem;
  state: EmpyreanLoadoutState;
}): { state: EmpyreanLoadoutState; goldSpent: number } {
  const { item, state } = params;
  const isFirstForge = !state.freeForgesSpent.includes(item.slot);
  const goldSpent = isFirstForge ? 0 : RARITY_GOLD_COST[item.rarity];

  if (!isFirstForge) {
    addEmpyreanGold(-goldSpent);
  }

  const updated: EmpyreanLoadoutState = {
    ...state,
    inventory: [...state.inventory, item],
    freeForgesSpent: isFirstForge ? [...state.freeForgesSpent, item.slot] : state.freeForgesSpent,
  };
  saveEmpyreanLoadout(updated);
  return { state: updated, goldSpent };
}

// ─── Aggregated Stats (for DM context, stat display, etc.) ─────────────────

export function getAggregatedLoadoutStats(state: EmpyreanLoadoutState): EmpyreanStatBlock {
  const totals: EmpyreanStatBlock = {};
  for (const slot of ALL_SLOTS) {
    const item = getEquippedItem(state, slot);
    if (!item) continue;
    for (const key of ALL_STATS) {
      const v = item.stats[key];
      if (v) totals[key] = (totals[key] ?? 0) + v;
    }
  }
  return totals;
}

/**
 * Produce a terse summary string for the DM's system prompt context.
 * Example: "Equipped gear: Venin's Shoulder (chest, Rare, +2 physical), Obsidian Fang (dagger, Uncommon, +2 evasion)."
 */
export function getEquippedGearSummary(state: EmpyreanLoadoutState): string {
  const equippedItems: EmpyreanGearItem[] = ALL_SLOTS
    .map(slot => getEquippedItem(state, slot))
    .filter((i): i is EmpyreanGearItem => !!i);

  if (equippedItems.length === 0) return '';

  const parts = equippedItems.map(item => {
    const statStr = Object.entries(item.stats)
      .map(([k, v]) => `+${v} ${k}`)
      .join(', ');
    return `${item.name} (${item.slot}, ${RARITY_META[item.rarity].label}${statStr ? ', ' + statStr : ''})`;
  });

  return `Equipped gear: ${parts.join('; ')}.`;
}
