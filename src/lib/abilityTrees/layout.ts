import { AbilityTree } from '@/lib/types';

export interface TreeNodePosition {
  tree: AbilityTree;
  tier: 1 | 2 | 3 | 4 | 5;
  column: 0 | 1 | 2; // Left, Center, Right within tier
}

// ═══════════════════════════════════════════════════════════════
// AC ODYSSEY STYLE PARENT-CHILD CONNECTIONS
// Empty array = Foundation tier, always accessible
// Multiple parents = Converge point, ALL parents required
// ═══════════════════════════════════════════════════════════════
export const ABILITY_CONNECTIONS: Record<string, string[]> = {
  // Hunter tree
  'archery_master': [],
  'predator_shot': [],
  'multi_shot': ['archery_master'],
  'hunters_instinct': ['predator_shot'],
  'devastating_shot': ['multi_shot'],
  'arrow_retrieval': ['hunters_instinct'],
  'ghost_arrows': ['devastating_shot', 'arrow_retrieval'], // Converge - ALL required
  'rain_of_destruction': ['ghost_arrows'],
  
  // Warrior tree
  'weapon_master': [],
  'shield_breaker': [],
  'battlecry': ['weapon_master'],
  'warriors_resilience': ['shield_breaker'],
  'ring_of_chaos': ['battlecry'],
  'second_wind_mastery': ['warriors_resilience'],
  'hero_strike': ['ring_of_chaos', 'second_wind_mastery'], // Converge
  'spartan_rage': ['hero_strike'],
  
  // Assassin tree
  'shadow_dancer': [],
  'shadow_step': [],
  'critical_assassination': ['shadow_dancer'],
  'poison_tolerance': ['shadow_step'],
  'venomous_attacks': ['critical_assassination'],
  'sixth_sense': ['poison_tolerance'],
  'vanish': ['venomous_attacks', 'sixth_sense'], // Converge
  'deaths_veil': ['vanish'],
};

// Tier power labels for visual separators
export const TIER_LABELS: Record<number, string> = {
  1: 'Foundation',
  2: 'Basic',
  3: 'Advanced',
  4: 'Expert',
  5: 'Ultimate',
};

// Grid positioning for all 24 abilities organized into 5 tiers per tree
export const ABILITY_TREE_LAYOUT: Record<string, TreeNodePosition> = {
  // ═══════════════════════════════════════════════════════════════
  // 🏹 HUNTER TREE - Ranged combat and awareness
  // ═══════════════════════════════════════════════════════════════
  
  // Tier 1 (Top) - Entry abilities
  'archery_master': { tree: 'hunter', tier: 1, column: 0 },
  'predator_shot': { tree: 'hunter', tier: 1, column: 2 },
  
  // Tier 2
  'multi_shot': { tree: 'hunter', tier: 2, column: 0 },
  'hunters_instinct': { tree: 'hunter', tier: 2, column: 2 },
  
  // Tier 3
  'devastating_shot': { tree: 'hunter', tier: 3, column: 0 },
  'arrow_retrieval': { tree: 'hunter', tier: 3, column: 2 },
  
  // Tier 4 (Center path)
  'ghost_arrows': { tree: 'hunter', tier: 4, column: 1 },
  
  // Tier 5 (Ultimate)
  'rain_of_destruction': { tree: 'hunter', tier: 5, column: 1 },

  // ═══════════════════════════════════════════════════════════════
  // ⚔️ WARRIOR TREE - Melee combat and defense
  // ═══════════════════════════════════════════════════════════════
  
  // Tier 1 (Top) - Entry abilities
  'weapon_master': { tree: 'warrior', tier: 1, column: 0 },
  'shield_breaker': { tree: 'warrior', tier: 1, column: 2 },
  
  // Tier 2
  'battlecry': { tree: 'warrior', tier: 2, column: 0 },
  'warriors_resilience': { tree: 'warrior', tier: 2, column: 2 },
  
  // Tier 3
  'ring_of_chaos': { tree: 'warrior', tier: 3, column: 0 },
  'second_wind_mastery': { tree: 'warrior', tier: 3, column: 2 },
  
  // Tier 4 (Center path)
  'hero_strike': { tree: 'warrior', tier: 4, column: 1 },
  
  // Tier 5 (Ultimate)
  'spartan_rage': { tree: 'warrior', tier: 5, column: 1 },

  // ═══════════════════════════════════════════════════════════════
  // 🗡️ ASSASSIN TREE - Stealth, crits, and deception
  // ═══════════════════════════════════════════════════════════════
  
  // Tier 1 (Top) - Entry abilities
  'shadow_dancer': { tree: 'assassin', tier: 1, column: 0 },
  'shadow_step': { tree: 'assassin', tier: 1, column: 2 },
  
  // Tier 2
  'critical_assassination': { tree: 'assassin', tier: 2, column: 0 },
  'poison_tolerance': { tree: 'assassin', tier: 2, column: 2 },
  
  // Tier 3
  'venomous_attacks': { tree: 'assassin', tier: 3, column: 0 },
  'sixth_sense': { tree: 'assassin', tier: 3, column: 2 },
  
  // Tier 4 (Center path)
  'vanish': { tree: 'assassin', tier: 4, column: 1 },
  
  // Tier 5 (Ultimate)
  'deaths_veil': { tree: 'assassin', tier: 5, column: 1 },
};

// Get abilities by tier for a given tree
export function getAbilitiesByTier(tree: AbilityTree): Map<number, string[]> {
  const tierMap = new Map<number, string[]>();
  
  Object.entries(ABILITY_TREE_LAYOUT).forEach(([abilityId, position]) => {
    if (position.tree === tree) {
      const existing = tierMap.get(position.tier) || [];
      existing.push(abilityId);
      tierMap.set(position.tier, existing);
    }
  });
  
  return tierMap;
}

// Calculate node position in pixels
// INVERTED: Tier 5 at top (small y), Tier 1 at bottom (large y)
export function getNodePosition(
  tree: AbilityTree,
  tier: number,
  column: number,
  isMobile: boolean,
  containerWidth: number
): { x: number; y: number } {
  const tierSpacing = isMobile ? 100 : 120;
  const nodeSize = isMobile ? 64 : 80;
  const padding = isMobile ? 40 : 60;
  
  // Column positions: 0 = left, 1 = center, 2 = right
  const columnPositions = {
    0: padding + nodeSize / 2,
    1: containerWidth / 2,
    2: containerWidth - padding - nodeSize / 2,
  };
  
  const x = columnPositions[column as 0 | 1 | 2] || containerWidth / 2;
  
  // INVERT: Tier 5 at top (y=small), Tier 1 at bottom (y=large)
  const invertedTier = 6 - tier; // 5→1, 4→2, 3→3, 2→4, 1→5
  const y = (invertedTier - 1) * tierSpacing + padding + nodeSize / 2;
  
  return { x, y };
}

// Get Y position for tier separator line (between tiers)
export function getTierSeparatorY(
  tier: number, // The tier ABOVE the line
  isMobile: boolean
): number {
  const tierSpacing = isMobile ? 100 : 120;
  const padding = isMobile ? 40 : 60;
  const nodeSize = isMobile ? 64 : 80;
  
  // After inversion: tier 5 at top, tier 1 at bottom
  // Separator for tier N goes between tier N and tier N-1
  // Position it halfway between the two tier rows
  const invertedTier = 6 - tier;
  return (invertedTier - 0.5) * tierSpacing + padding + nodeSize / 2;
}

// Get children of an ability
export function getAbilityChildren(abilityId: string): string[] {
  return Object.entries(ABILITY_CONNECTIONS)
    .filter(([_, parents]) => parents.includes(abilityId))
    .map(([childId]) => childId);
}

// Generate SVG path for connection lines
export function getConnectionPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  isMobile: boolean
): string {
  if (isMobile) {
    // Simple straight line on mobile for performance
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  
  // Bezier curve on desktop for smooth diagonal connections
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

// Get all abilities in a tree sorted by tier
export function getTreeAbilities(tree: AbilityTree): string[] {
  return Object.entries(ABILITY_TREE_LAYOUT)
    .filter(([_, pos]) => pos.tree === tree)
    .sort((a, b) => {
      // Sort by tier first, then by column
      if (a[1].tier !== b[1].tier) return a[1].tier - b[1].tier;
      return a[1].column - b[1].column;
    })
    .map(([id]) => id);
}
