export interface MapMarker {
  x: number;
  y: number;
  name: string;
  color: string;
  isEnemy: boolean;
  ownerUserId: string;
}

export type GridSize = 10 | 25 | 50 | 100;
export const GRID_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const CELL_SIZE = 40;
export const INLINE_GRID_SIZE = 10;
export const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];
export const STORAGE_KEY_GRID_SIZE = 'dnd-battlemap-grid-size';
export const MAX_BACKGROUND_SIZE_MB = 5;

// ── Distance Unit System ──
export type DistanceUnit = 'ft' | 'mi' | 'km' | 'leagues' | 'm' | 'yd';

export const DISTANCE_UNITS: { id: DistanceUnit; label: string }[] = [
  { id: 'ft', label: 'Feet' },
  { id: 'm', label: 'Meters' },
  { id: 'yd', label: 'Yards' },
  { id: 'mi', label: 'Miles' },
  { id: 'km', label: 'Kilometers' },
  { id: 'leagues', label: 'Leagues' },
];

export const DISTANCE_PER_SQUARE_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 50, 100] as const;

export function getDistanceUnitAbbr(unit: DistanceUnit): string {
  switch (unit) {
    case 'ft': return 'ft';
    case 'mi': return 'mi';
    case 'km': return 'km';
    case 'leagues': return 'lg';
    case 'm': return 'm';
    case 'yd': return 'yd';
  }
}

export type ToolMode = 'place-self' | 'place-enemy' | 'measure' | 'area' | 'spell' | 'move-range' | null;

// ── Auto-Scale Tier System ──

export interface ScaleTier {
  id: string;
  label: string;
  minZoom: number;
  maxZoom: number;
  distancePerSquare: number;
  distanceUnit: DistanceUnit;
  gridMergeFactor: number;
  minorLineOpacity: number;
}

export interface TierBackground {
  tierId: string;
  imageUrl: string;
}

export const DEFAULT_SCALE_TIERS: ScaleTier[] = [
  { id: 'tactical', label: 'Feet', minZoom: 0.6, maxZoom: 3.0, distancePerSquare: 5, distanceUnit: 'ft', gridMergeFactor: 1, minorLineOpacity: 0.1 },
  { id: 'local', label: 'Miles', minZoom: 0.25, maxZoom: 0.6, distancePerSquare: 1, distanceUnit: 'mi', gridMergeFactor: 1, minorLineOpacity: 0.1 },
  { id: 'regional', label: 'Leagues', minZoom: 0.05, maxZoom: 0.25, distancePerSquare: 1, distanceUnit: 'leagues', gridMergeFactor: 1, minorLineOpacity: 0.1 },
];

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3.0;

/** Returns the active scale tier for a given zoom level */
export function getActiveTier(zoom: number, tiers: ScaleTier[] = DEFAULT_SCALE_TIERS): ScaleTier {
  for (const tier of tiers) {
    if (zoom >= tier.minZoom && zoom < tier.maxZoom) return tier;
  }
  // Fallback: return first tier if zoom >= max, last if zoom < min
  if (zoom >= tiers[0].maxZoom) return tiers[0];
  return tiers[tiers.length - 1];
}

/**
 * Returns a 0-1 opacity for a tier's background at a given zoom.
 * Cross-fades at tier boundaries using a 15% fade zone on each edge.
 */
export function getTierOpacity(zoom: number, tier: ScaleTier): number {
  if (zoom < tier.minZoom || zoom >= tier.maxZoom) return 0;
  const range = tier.maxZoom - tier.minZoom;
  const fadeZone = range * 0.15;
  const distFromMin = zoom - tier.minZoom;
  const distFromMax = tier.maxZoom - zoom;
  let opacity = 1;
  if (distFromMin < fadeZone && fadeZone > 0) opacity = Math.min(opacity, distFromMin / fadeZone);
  if (distFromMax < fadeZone && fadeZone > 0) opacity = Math.min(opacity, distFromMax / fadeZone);
  return Math.max(0, Math.min(1, opacity));
}

export const MOVEMENT_SPEED_OPTIONS = [15, 20, 25, 30, 35, 40, 50, 60, 80] as const;

export const AREA_COLORS = [
  { id: 'danger', label: 'Danger', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)' },
  { id: 'buff', label: 'Buff', color: '#3b82f6', bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.4)' },
  { id: 'heal', label: 'Heal', color: '#10b981', bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)' },
  { id: 'warning', label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)' },
  { id: 'arcane', label: 'Arcane', color: '#a855f7', bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.4)' },
] as const;

export type AreaColorId = typeof AREA_COLORS[number]['id'];

export function getAreaColorById(id: AreaColorId) {
  return AREA_COLORS.find(c => c.id === id)!;
}

/** Feet per square based on grid size */
export function getFeetPerSquare(gridSize: GridSize): number {
  switch (gridSize) {
    case 100: return 1;
    case 50: return 2;
    case 25: return 4;
    case 10: return 10;
  }
}

export function gridDistance(x1: number, y1: number, x2: number, y2: number): number {
  // D&D 5e uses the "each diagonal counts as 5ft" simplified rule
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

export interface UndoAction {
  type: 'place' | 'remove' | 'move';
  marker: MapMarker;
  previousPosition?: { x: number; y: number };
}

// ── Spell Template Types ──

export type SpellShape = 'cone' | 'sphere' | 'cube' | 'line';

export const SPELL_SHAPE_LABELS: Record<SpellShape, string> = {
  cone: 'Cone',
  sphere: 'Sphere',
  cube: 'Cube',
  line: 'Line',
};

export const SPELL_SIZE_OPTIONS = [5, 10, 15, 20, 30, 40, 60, 100] as const;

export interface SpellTemplate {
  id: string;
  shape: SpellShape;
  /** Size in feet */
  sizeFt: number;
  /** Origin cell */
  originX: number;
  originY: number;
  /** Direction cell (for cone/line/cube direction) */
  directionX: number;
  directionY: number;
  color: string;
}

export const SPELL_TEMPLATE_COLORS = [
  { id: 'fire', label: 'Fire', color: '#ef4444', fill: 'rgba(239,68,68,0.25)', stroke: 'rgba(239,68,68,0.7)' },
  { id: 'ice', label: 'Ice', color: '#38bdf8', fill: 'rgba(56,189,248,0.25)', stroke: 'rgba(56,189,248,0.7)' },
  { id: 'nature', label: 'Nature', color: '#22c55e', fill: 'rgba(34,197,94,0.25)', stroke: 'rgba(34,197,94,0.7)' },
  { id: 'arcane', label: 'Arcane', color: '#a855f7', fill: 'rgba(168,85,247,0.25)', stroke: 'rgba(168,85,247,0.7)' },
  { id: 'divine', label: 'Divine', color: '#facc15', fill: 'rgba(250,204,21,0.25)', stroke: 'rgba(250,204,21,0.7)' },
] as const;

export type SpellColorId = typeof SPELL_TEMPLATE_COLORS[number]['id'];

export function getSpellColorById(id: SpellColorId) {
  return SPELL_TEMPLATE_COLORS.find(c => c.id === id)!;
}

/**
 * Compute the cells covered by a spell template.
 * Returns array of {x,y} grid coordinates.
 */
export function getSpellTemplateCells(
  template: SpellTemplate,
  gridSize: GridSize
): { x: number; y: number }[] {
  const feetPerSq = getFeetPerSquare(gridSize);
  const radiusSq = template.sizeFt / feetPerSq;
  const cells: { x: number; y: number }[] = [];

  const { originX: ox, originY: oy, directionX: dx, directionY: dy } = template;
  const angle = Math.atan2(dy - oy, dx - ox);

  switch (template.shape) {
    case 'sphere': {
      // Circle centered on origin
      const r = radiusSq;
      for (let x = Math.floor(ox - r); x <= Math.ceil(ox + r); x++) {
        for (let y = Math.floor(oy - r); y <= Math.ceil(oy + r); y++) {
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
          const dist = Math.sqrt((x - ox) ** 2 + (y - oy) ** 2);
          if (dist <= r + 0.5) cells.push({ x, y });
        }
      }
      break;
    }
    case 'cube': {
      // Square of side = sizeFt, extending from origin in direction
      const side = radiusSq;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Check cells in bounding box
      for (let x = Math.floor(ox - side); x <= Math.ceil(ox + side); x++) {
        for (let y = Math.floor(oy - side); y <= Math.ceil(oy + side); y++) {
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
          // Rotate point into cube's local frame
          const lx = (x - ox) * cosA + (y - oy) * sinA;
          const ly = -(x - ox) * sinA + (y - oy) * cosA;
          if (lx >= -0.5 && lx < side + 0.5 && Math.abs(ly) <= side / 2 + 0.5) {
            cells.push({ x, y });
          }
        }
      }
      break;
    }
    case 'cone': {
      // 53-degree cone (D&D standard) from origin in direction
      const length = radiusSq;
      const halfAngle = (53 / 2) * (Math.PI / 180);
      for (let x = Math.floor(ox - length); x <= Math.ceil(ox + length); x++) {
        for (let y = Math.floor(oy - length); y <= Math.ceil(oy + length); y++) {
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
          const relX = x - ox;
          const relY = y - oy;
          const dist = Math.sqrt(relX * relX + relY * relY);
          if (dist > length + 0.5 || dist < 0.1) continue;
          const cellAngle = Math.atan2(relY, relX);
          let angleDiff = Math.abs(cellAngle - angle);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          if (angleDiff <= halfAngle + 0.1) cells.push({ x, y });
        }
      }
      break;
    }
    case 'line': {
      // 5ft wide line from origin in direction for sizeFt length
      const length = radiusSq;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const halfWidth = 0.5 + 0.3; // ~5ft wide
      for (let x = Math.floor(ox - length); x <= Math.ceil(ox + length); x++) {
        for (let y = Math.floor(oy - length); y <= Math.ceil(oy + length); y++) {
          if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
          const lx = (x - ox) * cosA + (y - oy) * sinA;
          const ly = -(x - ox) * sinA + (y - oy) * cosA;
          if (lx >= -0.5 && lx <= length + 0.5 && Math.abs(ly) <= halfWidth) {
            cells.push({ x, y });
          }
        }
      }
      break;
    }
  }

  return cells;
}
