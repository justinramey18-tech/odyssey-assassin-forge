import type { MapMarker, GridSize } from '@/components/party/battlemap/types';

export interface MapEntity {
  name: string;
  count: number;
  type: 'enemy' | 'ally' | 'object';
}

/**
 * Spiral search for the next unoccupied cell starting from (startX, startY).
 */
function findOpenCell(
  startX: number,
  startY: number,
  occupied: Set<string>,
  gridSize: number
): { x: number; y: number } | null {
  if (!occupied.has(`${startX},${startY}`)) return { x: startX, y: startY };

  for (let radius = 1; radius < gridSize; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // perimeter only
        const x = startX + dx;
        const y = startY + dy;
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        if (!occupied.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return null;
}

export function computeMapUpdates(
  extraction: { map_entities: MapEntity[]; map_entities_removed: string[] },
  existingMarkers: MapMarker[],
  gridSize: GridSize
): { markersToAdd: MapMarker[]; namesToRemove: string[] } {
  const markersToAdd: MapMarker[] = [];
  const namesToRemove: string[] = [];

  // Build occupied set
  const occupied = new Set<string>(existingMarkers.map(m => `${m.x},${m.y}`));

  // Place new entities
  const startX = Math.floor(gridSize * 0.7);
  const startY = Math.floor(gridSize * 0.5);

  for (const entity of extraction.map_entities ?? []) {
    const count = Math.max(1, Math.min(entity.count, 20)); // cap at 20
    for (let i = 0; i < count; i++) {
      const cell = findOpenCell(startX, startY + i, occupied, gridSize);
      if (!cell) continue;

      const name = count > 1 ? `${entity.name} #${i + 1}` : entity.name;
      const marker: MapMarker = {
        x: cell.x,
        y: cell.y,
        name,
        color: entity.type === 'ally' ? '#3b82f6' : '#ef4444',
        isEnemy: entity.type !== 'ally',
        ownerUserId: 'auto-sync',
      };
      markersToAdd.push(marker);
      occupied.add(`${cell.x},${cell.y}`);
    }
  }

  // Fuzzy match removals
  for (const removeName of extraction.map_entities_removed ?? []) {
    const lower = removeName.toLowerCase();
    // Exact match first
    const exact = existingMarkers.find(
      m => m.isEnemy && m.name.toLowerCase() === lower
    );
    if (exact) {
      namesToRemove.push(exact.name);
      continue;
    }
    // Base name match (ignoring #N suffix)
    const baseMatch = existingMarkers.find(
      m => m.isEnemy && m.name.replace(/ #\d+$/, '').toLowerCase() === lower
    );
    if (baseMatch) {
      namesToRemove.push(baseMatch.name);
    }
  }

  return { markersToAdd, namesToRemove };
}
