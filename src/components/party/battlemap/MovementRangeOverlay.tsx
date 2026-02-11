import { useMemo } from 'react';
import { type GridSize, type AreaColorId, getFeetPerSquare } from './types';

interface MovementRangeOverlayProps {
  originX: number;
  originY: number;
  movementSpeedFt: number;
  gridSize: GridSize;
  cellSize: number;
  /** Highlighted area cells act as difficult terrain (double movement cost) */
  difficultTerrain: Map<string, AreaColorId>;
}

export function MovementRangeOverlay({
  originX, originY, movementSpeedFt, gridSize, cellSize, difficultTerrain,
}: MovementRangeOverlayProps) {
  const feetPerSq = getFeetPerSquare(gridSize);
  const moveBudget = movementSpeedFt / feetPerSq;
  const dashBudget = (movementSpeedFt * 2) / feetPerSq;

  const cells = useMemo(() => {
    // BFS/Dijkstra to account for difficult terrain costing double
    const costMap = new Map<string, number>();
    const key = (x: number, y: number) => `${x},${y}`;
    
    // Priority queue as simple sorted array (grid is small enough)
    const queue: { x: number; y: number; cost: number }[] = [{ x: originX, y: originY, cost: 0 }];
    costMap.set(key(originX, originY), 0);

    // 8-directional movement (D&D allows diagonal)
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];

    while (queue.length > 0) {
      // Find minimum cost entry
      let minIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].cost < queue[minIdx].cost) minIdx = i;
      }
      const current = queue.splice(minIdx, 1)[0];

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;

        // Base cost: 1 square (D&D simplified diagonal = same cost)
        const isDifficult = difficultTerrain.has(key(nx, ny));
        const stepCost = isDifficult ? 2 : 1;
        const newCost = current.cost + stepCost;

        if (newCost > dashBudget) continue;

        const nk = key(nx, ny);
        const prev = costMap.get(nk);
        if (prev === undefined || newCost < prev) {
          costMap.set(nk, newCost);
          queue.push({ x: nx, y: ny, cost: newCost });
        }
      }
    }

    const result: { x: number; y: number; isDash: boolean }[] = [];
    costMap.forEach((cost, k) => {
      if (k === key(originX, originY)) return;
      result.push({
        x: parseInt(k.split(',')[0]),
        y: parseInt(k.split(',')[1]),
        isDash: cost > moveBudget,
      });
    });
    return result;
  }, [originX, originY, moveBudget, dashBudget, gridSize, difficultTerrain]);

  return (
    <>
      {cells.map(({ x, y, isDash }) => (
        <div
          key={`mr-${x},${y}`}
          className="absolute pointer-events-none z-10"
          style={{
            left: x * cellSize,
            top: y * cellSize,
            width: cellSize,
            height: cellSize,
            backgroundColor: isDash ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.25)',
            border: `1px solid ${isDash ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.4)'}`,
          }}
        />
      ))}
    </>
  );
}
