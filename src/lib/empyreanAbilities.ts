/**
 * Empyrean Ability Trees — Rider Skills System
 *
 * Empyrean-only ability system. Does NOT share storage, types, or logic with
 * Assassin's Ledger's abilities system (src/lib/abilities.ts, etc).
 *
 * 4 trees (Combat / Bond / Channeling / Mental) × 3 tiers × 2-3 abilities = 28 total.
 * Unlock cost: T1 = 20g, T2 = 75g, T3 = 200g. No tier gates beyond gold.
 * Once unlocked, an ability is permanently owned and always available in the
 * Empyrean Ability Picker — no loadout slots, no equip/unequip.
 *
 * Storage:
 *   'empyrean-abilities-unlocked' → string[] of ability IDs
 *
 * Gold integration: uses loadEmpyreanGold / addEmpyreanGold from './empyreanLoadout'.
 */

import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';
import { loadEmpyreanGold, addEmpyreanGold } from '@/lib/empyreanLoadout';

// ─── Types ─────────────────────────────────────────────────────────────────

export type EmpyreanAbilityTree = 'combat' | 'bond' | 'channeling' | 'mental';
export type EmpyreanAbilityTier = 't1' | 't2' | 't3';

export interface EmpyreanAbility {
  id: string;
  name: string;
  tree: EmpyreanAbilityTree;
  tier: EmpyreanAbilityTier;
  description: string;
  /** Prose sent to the DM when the ability is used. */
  prompt: string;
}

// ─── Storage Key ───────────────────────────────────────────────────────────

const UNLOCKED_KEY = 'empyrean-abilities-unlocked';

// ─── Tier Cost Table ───────────────────────────────────────────────────────

export const TIER_GOLD_COST: Record<EmpyreanAbilityTier, number> = {
  t1: 20,
  t2: 75,
  t3: 200,
};

// ─── Tree Metadata ─────────────────────────────────────────────────────────

export const TREE_META: Record<EmpyreanAbilityTree, {
  label: string;
  emoji: string;
  color: string;
  description: string;
}> = {
  combat: {
    label: 'Combat',
    emoji: '🗡',
    color: '#f97316',
    description: 'Hand-to-hand, blades, and physical martial training.',
  },
  bond: {
    label: 'Bond',
    emoji: '🐉',
    color: '#a855f7',
    description: 'Dragon partnership, flight, and aerial combat.',
  },
  channeling: {
    label: 'Channeling',
    emoji: '✨',
    color: '#60a5fa',
    description: 'The baseline magic every rider learns. Separate from your signet.',
  },
  mental: {
    label: 'Mental Shields & Grounding',
    emoji: '🧠',
    color: '#22c55e',
    description: 'Ward your mind, center your emotions, resist intrusion.',
  },
};

export const TIER_META: Record<EmpyreanAbilityTier, {
  label: string;
  year: string;
  color: string;
}> = {
  t1: { label: 'Tier I',   year: 'Cadet',        color: '#94a3b8' },
  t2: { label: 'Tier II',  year: 'Second-Year',  color: '#fbbf24' },
  t3: { label: 'Tier III', year: 'Third-Year',   color: '#c084fc' },
};

export const ALL_TREES: EmpyreanAbilityTree[] = ['combat', 'bond', 'channeling', 'mental'];
export const ALL_TIERS: EmpyreanAbilityTier[] = ['t1', 't2', 't3'];

// ─── Ability Catalog — 28 abilities ────────────────────────────────────────

export const EMPYREAN_ABILITIES: EmpyreanAbility[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // COMBAT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'combat_parry_training',
    name: 'Parry Training',
    tree: 'combat', tier: 't1',
    description: 'Counter an incoming melee strike with trained reflex.',
    prompt: 'I bring my blade up in a trained parry, redirecting the incoming strike and looking for the opening in my opponent\'s follow-through. Describe how the clash unfolds and whether I create an advantage.',
  },
  {
    id: 'combat_grappling_basics',
    name: 'Grappling Basics',
    tree: 'combat', tier: 't1',
    description: 'Close-quarters hold or escape against a single opponent.',
    prompt: 'I close the distance and engage my opponent in a grapple — looking for a hold, a throw, or a way out of their reach. Describe the struggle and who gains control.',
  },
  {
    id: 'combat_blade_balance',
    name: 'Blade Balance',
    tree: 'combat', tier: 't1',
    description: 'Keep footing on uneven, slick, or unstable ground.',
    prompt: 'I shift my weight low and find footing — rain-slick stone, tilted floorboards, shifting gravel, whatever the ground gives me. Describe how I press the fight without losing balance.',
  },
  {
    id: 'combat_dual_wielding',
    name: 'Dual-Wielding',
    tree: 'combat', tier: 't2',
    description: 'Fight with blade and dagger, alternating strikes to overwhelm.',
    prompt: 'I draw my dagger alongside my primary blade and attack with both — alternating strikes to overwhelm my opponent\'s guard. Describe the rhythm of the exchange.',
  },
  {
    id: 'combat_feint_and_commit',
    name: 'Feint and Commit',
    tree: 'combat', tier: 't2',
    description: 'Bait an opening with a fake strike, then punish the reaction.',
    prompt: 'I telegraph a high strike, wait for the reaction, and commit to a low thrust the instant my opponent overcommits. Describe whether the bait works.',
  },
  {
    id: 'combat_blade_storm',
    name: 'Blade Storm',
    tree: 'combat', tier: 't3',
    description: 'Three-strike overwhelming combo meant to crush weaker guards.',
    prompt: 'I unleash a three-strike combination — high, low, center — pressing the attack before my opponent can reset. Describe the combo and its impact.',
  },
  {
    id: 'combat_killing_edge',
    name: 'Killing Edge',
    tree: 'combat', tier: 't3',
    description: 'Precision strike aimed at a vulnerable point. Lethal if it lands.',
    prompt: 'I watch for the opening and commit to a precision strike at a vulnerable point — throat, joint, heart. Describe whether the blade finds its mark.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BOND
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'bond_basic_flight_commands',
    name: 'Basic Flight Commands',
    tree: 'bond', tier: 't1',
    description: 'Direct your dragon\'s turns, altitude, and speed with minimal words.',
    prompt: 'I relay a flight command to my dragon — turn, climb, dive, break formation. Describe how cleanly the instruction lands through the bond and how my dragon responds.',
  },
  {
    id: 'bond_saddle_stability',
    name: 'Saddle Stability',
    tree: 'bond', tier: 't1',
    description: 'Stay seated through rough flight or evasive maneuvers.',
    prompt: 'I brace in the saddle as my dragon rolls and banks through rough air. Describe whether I hold my seat and what I see during the maneuver.',
  },
  {
    id: 'bond_bond_ping',
    name: 'Bond Ping',
    tree: 'bond', tier: 't1',
    description: 'Briefly sense your dragon\'s current emotional state.',
    prompt: 'I reach down the bond to sense my dragon — not a conversation, just a check. Describe what I feel: calm, wary, amused, irritated, hunting.',
  },
  {
    id: 'bond_aerial_evasion',
    name: 'Aerial Evasion',
    tree: 'bond', tier: 't2',
    description: 'Guide your dragon through incoming fire or wyvern pursuit.',
    prompt: 'I direct my dragon through incoming fire or hostile pursuit — sharp rolls, evasive drops, commits to cover. Describe the chase and whether we shake what\'s behind us.',
  },
  {
    id: 'bond_shared_sense',
    name: 'Shared Sense',
    tree: 'bond', tier: 't2',
    description: 'Briefly see or hear through your dragon\'s perception.',
    prompt: 'I open the bond wide enough to see briefly through my dragon\'s eyes. Describe what I witness from their vantage.',
  },
  {
    id: 'bond_diving_assault',
    name: 'Diving Assault',
    tree: 'bond', tier: 't3',
    description: 'Controlled steep dive into an attack on a ground target.',
    prompt: 'I signal the dive — my dragon folds their wings and drops toward the target at speed. Describe the approach, the final pull, and the strike as we hit.',
  },
  {
    id: 'bond_battle_bond',
    name: 'Battle Bond',
    tree: 'bond', tier: 't3',
    description: 'Combat-state link where your dragon anticipates your intent without words.',
    prompt: 'I lock into the battle bond — no commands needed, my dragon anticipates my intent as we move as one. Describe the next exchange from our unified perspective.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CHANNELING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'channeling_spark_flicker',
    name: 'Spark Flicker',
    tree: 'channeling', tier: 't1',
    description: 'Light a candle, torch, fuse, or kindling without flint.',
    prompt: 'I channel a small flame to life — candlewick, tinder, the edge of a torch. Describe the spark catching and the light that follows.',
  },
  {
    id: 'channeling_ward_sense',
    name: 'Ward Sense',
    tree: 'channeling', tier: 't1',
    description: 'Detect the proximity of the ward line or any nearby warding.',
    prompt: 'I extend my senses to feel for ward magic in the area — the line itself, or smaller wardings inside a room or doorway. Describe what I detect and where.',
  },
  {
    id: 'channeling_channel_pulse',
    name: 'Channel Pulse',
    tree: 'channeling', tier: 't1',
    description: 'Push a brief burst of kinetic force — roughly like a shove.',
    prompt: 'I push a short burst of channeled force toward my target — not enough to wound, enough to knock them back or break a grip. Describe the impact.',
  },
  {
    id: 'channeling_minor_healing',
    name: 'Minor Healing',
    tree: 'channeling', tier: 't2',
    description: 'Close a shallow wound or stop minor bleeding.',
    prompt: 'I place my hand on the wound and channel what I can — enough to close the skin, stop the bleed. Describe the healing and how much strain it costs me.',
  },
  {
    id: 'channeling_object_pull',
    name: 'Object Pull',
    tree: 'channeling', tier: 't2',
    description: 'Summon a small held object from within arm\'s reach.',
    prompt: 'I reach with channeled intent and pull a small object toward my hand — a blade, a key, a fallen scroll. Describe the pull and whether anyone notices.',
  },
  {
    id: 'channeling_venin_ward',
    name: 'Venin Ward',
    tree: 'channeling', tier: 't3',
    description: 'Temporary shield against venin magic for yourself or one ally.',
    prompt: 'I throw a focused ward against venin magic — for myself or someone close. Describe the ward taking shape, what it blocks, and how long it holds.',
  },
  {
    id: 'channeling_deep_channel',
    name: 'Deep Channel',
    tree: 'channeling', tier: 't3',
    description: 'Overchannel through normal limits — the cost is burnout.',
    prompt: 'I push past the safe limit of my channeling, knowing what it will cost me. Describe the surge of power, what I accomplish with it, and the burnout that follows.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MENTAL SHIELDS & GROUNDING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'mental_shield_reflex',
    name: 'Shield Reflex',
    tree: 'mental', tier: 't1',
    description: 'Raise a basic mental ward against incoming intinnsic or intrusion.',
    prompt: 'I snap up my mental shields — fast, reflexive, not elegant but solid. Describe whether I catch the intrusion in time and what it feels like on the other side of my ward.',
  },
  {
    id: 'mental_grounding_breath',
    name: 'Grounding Breath',
    tree: 'mental', tier: 't1',
    description: 'Center yourself after an emotional spike or burnout wave.',
    prompt: 'I breathe through the spike — feet on the floor, hand on something solid, bringing myself back. Describe the moment of grounding and what comes back into focus.',
  },
  {
    id: 'mental_read_the_room',
    name: 'Read the Room',
    tree: 'mental', tier: 't1',
    description: 'Sense hostile intent or emotional tension in a space.',
    prompt: 'I let my attention drift across the room — body language, tension, the edges of people\'s moods. Describe what I pick up about who\'s dangerous, who\'s scared, and who\'s lying.',
  },
  {
    id: 'mental_fortified_ward',
    name: 'Fortified Ward',
    tree: 'mental', tier: 't2',
    description: 'A stronger, longer-duration mental shield I can hold during sustained pressure.',
    prompt: 'I build a layered mental ward — slower to raise but harder to breach. Describe the shield settling into place and how long I can hold it under pressure.',
  },
  {
    id: 'mental_bond_firewall',
    name: 'Bond Firewall',
    tree: 'mental', tier: 't2',
    description: 'Keep your own thoughts separate from your dragon\'s in intense moments.',
    prompt: 'I partition the bond — my thoughts on one side, my dragon\'s on the other — so neither of us bleeds through into the other. Describe the separation and what each side feels.',
  },
  {
    id: 'mental_absolute_silence',
    name: 'Absolute Silence',
    tree: 'mental', tier: 't3',
    description: 'Complete mental cloaking — invisible to scrying or probing.',
    prompt: 'I fold myself into absolute silence — no bond signature, no emotional signal, nothing that a scryer could follow. Describe how deep the quiet goes and who\'s looking.',
  },
  {
    id: 'mental_venin_resistance',
    name: 'Venin Resistance',
    tree: 'mental', tier: 't3',
    description: 'Resist venin attempts to corrupt, turn, or whisper into your mind.',
    prompt: 'I set my mind against venin corruption — not just shielding, actively rejecting the pull. Describe the resistance and what the venin influence feels like as I refuse it.',
  },
];

// ─── Lookups ───────────────────────────────────────────────────────────────

export function getAbilityById(id: string): EmpyreanAbility | null {
  return EMPYREAN_ABILITIES.find(a => a.id === id) ?? null;
}

export function getAbilitiesByTree(tree: EmpyreanAbilityTree): EmpyreanAbility[] {
  return EMPYREAN_ABILITIES.filter(a => a.tree === tree);
}

export function getAbilitiesByTreeAndTier(tree: EmpyreanAbilityTree, tier: EmpyreanAbilityTier): EmpyreanAbility[] {
  return EMPYREAN_ABILITIES.filter(a => a.tree === tree && a.tier === tier);
}

export function getAbilityCost(ability: EmpyreanAbility): number {
  return TIER_GOLD_COST[ability.tier];
}

// ─── Unlocked-Abilities Storage ────────────────────────────────────────────

export function loadUnlockedAbilityIds(): string[] {
  try {
    const raw = getScopedItem(UNLOCKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function saveUnlockedAbilityIds(ids: string[]): void {
  try {
    const unique = Array.from(new Set(ids));
    setScopedItem(UNLOCKED_KEY, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

export function clearUnlockedAbilities(): void {
  try {
    removeScopedItem(UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

export function isAbilityUnlocked(abilityId: string): boolean {
  return loadUnlockedAbilityIds().includes(abilityId);
}

export function getUnlockedAbilities(): EmpyreanAbility[] {
  const ids = loadUnlockedAbilityIds();
  const set = new Set(ids);
  return EMPYREAN_ABILITIES.filter(a => set.has(a.id));
}

// ─── Purchase Logic ────────────────────────────────────────────────────────

export interface PurchaseResult {
  success: boolean;
  error?: string;
  goldRemaining?: number;
}

/**
 * Attempt to unlock an ability. Deducts gold, adds to unlocked storage.
 */
export function purchaseAbility(abilityId: string): PurchaseResult {
  const ability = getAbilityById(abilityId);
  if (!ability) {
    return { success: false, error: 'Unknown ability.' };
  }
  const ids = loadUnlockedAbilityIds();
  if (ids.includes(abilityId)) {
    return { success: false, error: 'Already unlocked.' };
  }
  const cost = getAbilityCost(ability);
  const currentGold = loadEmpyreanGold();
  if (currentGold < cost) {
    return { success: false, error: `Not enough gold. Costs ${cost}, you have ${currentGold}.` };
  }
  const remaining = addEmpyreanGold(-cost);
  saveUnlockedAbilityIds([...ids, abilityId]);
  return { success: true, goldRemaining: remaining };
}

/**
 * Check whether an ability CAN be purchased without buying it.
 */
export function validatePurchase(abilityId: string, currentGold: number): string | null {
  const ability = getAbilityById(abilityId);
  if (!ability) return 'Unknown ability.';
  if (isAbilityUnlocked(abilityId)) return 'Already unlocked.';
  const cost = getAbilityCost(ability);
  if (currentGold < cost) return `Not enough gold. Costs ${cost}, you have ${currentGold}.`;
  return null;
}
