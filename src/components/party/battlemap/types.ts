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
