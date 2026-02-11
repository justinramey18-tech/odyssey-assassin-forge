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
export const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];
export const STORAGE_KEY_GRID_SIZE = 'dnd-battlemap-grid-size';

export type ToolMode = 'place-self' | 'place-enemy' | 'measure' | 'area' | null;

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

/** 300ft total battlefield, so feet per square = 300 / gridSize */
export function getFeetPerSquare(gridSize: GridSize): number {
  return 300 / gridSize;
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
