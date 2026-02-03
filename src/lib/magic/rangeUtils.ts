import { SpellDefinition } from './types';

// ============================================
// RANGE & AREA UTILITIES
// ============================================

export type RangeCategory = 'self' | 'touch' | 'short' | 'medium' | 'long' | 'sight' | 'unlimited';
export type AreaShape = 'cone' | 'cube' | 'cylinder' | 'line' | 'sphere' | 'none';

export interface RangeInfo {
  category: RangeCategory;
  distance: number | null; // in feet, null for self/touch/special
  displayText: string;
  isMelee: boolean;
  isRanged: boolean;
}

export interface AreaInfo {
  shape: AreaShape;
  size: number | null; // primary dimension in feet
  displayText: string;
}

/**
 * Parse spell range string into structured info
 */
export function parseRange(rangeStr: string): RangeInfo {
  const lower = rangeStr.toLowerCase().trim();
  
  // Self ranges
  if (lower === 'self' || lower.startsWith('self (')) {
    return {
      category: 'self',
      distance: null,
      displayText: rangeStr,
      isMelee: false,
      isRanged: false,
    };
  }
  
  // Touch
  if (lower === 'touch') {
    return {
      category: 'touch',
      distance: 5,
      displayText: 'Touch',
      isMelee: true,
      isRanged: false,
    };
  }
  
  // Sight/unlimited
  if (lower === 'sight' || lower === 'unlimited') {
    return {
      category: lower === 'sight' ? 'sight' : 'unlimited',
      distance: null,
      displayText: rangeStr,
      isMelee: false,
      isRanged: true,
    };
  }
  
  // Parse distance (e.g., "30 feet", "120 ft")
  const distMatch = lower.match(/(\d+)\s*(feet|ft|foot)/);
  if (distMatch) {
    const distance = parseInt(distMatch[1], 10);
    let category: RangeCategory = 'short';
    
    if (distance <= 10) category = 'touch';
    else if (distance <= 30) category = 'short';
    else if (distance <= 60) category = 'medium';
    else if (distance <= 150) category = 'long';
    else category = 'long';
    
    return {
      category,
      distance,
      displayText: `${distance} ft`,
      isMelee: distance <= 5,
      isRanged: distance > 5,
    };
  }
  
  // Default fallback
  return {
    category: 'short',
    distance: null,
    displayText: rangeStr,
    isMelee: false,
    isRanged: true,
  };
}

/**
 * Parse area of effect from range string
 */
export function parseArea(rangeStr: string): AreaInfo {
  const lower = rangeStr.toLowerCase();
  
  // Check for area patterns in the range (e.g., "Self (15-foot cone)")
  const coneMatch = lower.match(/(\d+)[- ]foot\s*cone/i);
  if (coneMatch) {
    return {
      shape: 'cone',
      size: parseInt(coneMatch[1], 10),
      displayText: `${coneMatch[1]}-ft Cone`,
    };
  }
  
  const cubeMatch = lower.match(/(\d+)[- ]foot\s*cube/i);
  if (cubeMatch) {
    return {
      shape: 'cube',
      size: parseInt(cubeMatch[1], 10),
      displayText: `${cubeMatch[1]}-ft Cube`,
    };
  }
  
  const sphereMatch = lower.match(/(\d+)[- ]foot[- ]radius\s*sphere/i);
  if (sphereMatch) {
    return {
      shape: 'sphere',
      size: parseInt(sphereMatch[1], 10),
      displayText: `${sphereMatch[1]}-ft Sphere`,
    };
  }
  
  const cylinderMatch = lower.match(/(\d+)[- ]foot[- ]radius.*cylinder/i);
  if (cylinderMatch) {
    return {
      shape: 'cylinder',
      size: parseInt(cylinderMatch[1], 10),
      displayText: `${cylinderMatch[1]}-ft Cylinder`,
    };
  }
  
  const lineMatch = lower.match(/(\d+)[- ]foot\s*line/i);
  if (lineMatch) {
    return {
      shape: 'line',
      size: parseInt(lineMatch[1], 10),
      displayText: `${lineMatch[1]}-ft Line`,
    };
  }
  
  return {
    shape: 'none',
    size: null,
    displayText: '',
  };
}

/**
 * Get range category color
 */
export function getRangeCategoryColor(category: RangeCategory): string {
  switch (category) {
    case 'self': return 'text-cyan-400';
    case 'touch': return 'text-emerald-400';
    case 'short': return 'text-green-400';
    case 'medium': return 'text-amber-400';
    case 'long': return 'text-orange-400';
    case 'sight': return 'text-purple-400';
    case 'unlimited': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

/**
 * Get area shape icon name
 */
export function getAreaShapeIcon(shape: AreaShape): string {
  switch (shape) {
    case 'cone': return 'Triangle';
    case 'cube': return 'Square';
    case 'sphere': return 'Circle';
    case 'cylinder': return 'Cylinder';
    case 'line': return 'ArrowRight';
    default: return 'Target';
  }
}

/**
 * Get spell level theme colors
 */
export function getSpellLevelTheme(level: number): {
  borderColor: string;
  bgGradient: string;
  textColor: string;
  glowColor: string;
} {
  // Cantrips: Gray/silver
  if (level === 0) {
    return {
      borderColor: 'border-slate-500/40',
      bgGradient: 'from-slate-600/20 to-slate-800/10',
      textColor: 'text-slate-300',
      glowColor: 'shadow-slate-500/20',
    };
  }
  
  // 1st-2nd level: Blue
  if (level <= 2) {
    return {
      borderColor: 'border-blue-500/40',
      bgGradient: 'from-blue-600/20 to-blue-900/10',
      textColor: 'text-blue-300',
      glowColor: 'shadow-blue-500/20',
    };
  }
  
  // 3rd-4th level: Purple
  if (level <= 4) {
    return {
      borderColor: 'border-purple-500/40',
      bgGradient: 'from-purple-600/20 to-purple-900/10',
      textColor: 'text-purple-300',
      glowColor: 'shadow-purple-500/20',
    };
  }
  
  // 5th level: Gold
  return {
    borderColor: 'border-amber-500/40',
    bgGradient: 'from-amber-600/20 to-amber-900/10',
    textColor: 'text-amber-300',
    glowColor: 'shadow-amber-500/20',
  };
}
