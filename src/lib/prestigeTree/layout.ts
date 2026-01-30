// Node Layout Positions for Drizzt's Legacy Prestige Tree

import { PrestigeBranch, PrestigeAbility } from './types';

export interface NodePosition {
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
}

export interface LayoutConfig {
  nodeSize: number;
  mobileNodeSize: number;
  connectionLineWidth: number;
  tierGap: number;        // Vertical gap between tiers
  nodeGap: number;        // Horizontal gap between nodes
}

export const LAYOUT_CONFIG: LayoutConfig = {
  nodeSize: 64,
  mobileNodeSize: 48,
  connectionLineWidth: 2,
  tierGap: 120,
  nodeGap: 80,
};

/**
 * Calculate node positions for a branch
 * Arranges nodes in a tree-like pattern with Tier 1 at top
 */
export function calculateBranchLayout(
  abilities: PrestigeAbility[],
  branch: PrestigeBranch
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  
  // Group abilities by tier
  const tier1 = abilities.filter(a => a.branch === branch && a.tier === 1);
  const tier2 = abilities.filter(a => a.branch === branch && a.tier === 2);
  const tier3 = abilities.filter(a => a.branch === branch && a.tier === 3);
  
  // Position Tier 1 (Foundation) - top row
  tier1.forEach((ability, index) => {
    const x = calculateHorizontalPosition(index, tier1.length);
    positions.set(ability.id, { x, y: 15 });
  });
  
  // Position Tier 2 (Intermediate) - middle row
  tier2.forEach((ability, index) => {
    const x = calculateHorizontalPosition(index, tier2.length);
    positions.set(ability.id, { x, y: 45 });
  });
  
  // Position Tier 3 (Advanced) - bottom row
  tier3.forEach((ability, index) => {
    const x = calculateHorizontalPosition(index, tier3.length);
    positions.set(ability.id, { x, y: 75 });
  });
  
  return positions;
}

/**
 * Calculate horizontal position for a node in a row
 */
function calculateHorizontalPosition(index: number, total: number): number {
  if (total === 1) return 50;
  if (total === 2) return index === 0 ? 30 : 70;
  if (total === 3) return 25 + (index * 25);
  if (total === 4) return 15 + (index * 23);
  
  // For 5+ nodes, distribute evenly
  const spacing = 70 / (total - 1);
  return 15 + (index * spacing);
}

/**
 * Get connection lines between nodes based on prerequisites
 */
export interface ConnectionLine {
  fromId: string;
  toId: string;
  fromPosition: NodePosition;
  toPosition: NodePosition;
}

export function calculateConnectionLines(
  abilities: PrestigeAbility[],
  positions: Map<string, NodePosition>
): ConnectionLine[] {
  const lines: ConnectionLine[] = [];
  
  for (const ability of abilities) {
    const toPosition = positions.get(ability.id);
    if (!toPosition) continue;
    
    for (const prereqId of ability.prerequisites) {
      const fromPosition = positions.get(prereqId);
      if (fromPosition) {
        lines.push({
          fromId: prereqId,
          toId: ability.id,
          fromPosition,
          toPosition,
        });
      }
    }
  }
  
  return lines;
}

/**
 * Get branch-specific layout adjustments for constellation effect
 */
export function getBranchOffset(branch: PrestigeBranch): { x: number; y: number } {
  switch (branch) {
    case 'dual_wielding':
      return { x: -10, y: -5 };
    case 'guenhwyvar':
      return { x: 10, y: -5 };
    case 'drow_abilities':
      return { x: -10, y: 5 };
    case 'monk_abilities':
      return { x: 10, y: 5 };
  }
}
