import { useMemo } from 'react';
import { type GridSize, getFeetPerSquare, gridDistance } from './types';

interface MovementRangeOverlayProps {
  originX: number;
  originY: number;
  movementSpeedFt: number;
  gridSize: GridSize;
  cellSize: number;
}

export function MovementRangeOverlay({
  originX, originY, movementSpeedFt, gridSize, cellSize,
}: MovementRangeOverlayProps) {
  const feetPerSq = getFeetPerSquare(gridSize);
  const moveSquares = movementSpeedFt / feetPerSq;
  const dashSquares = (movementSpeedFt * 2) / feetPerSq;

  const cells = useMemo(() => {
    const result: { x: number; y: number; isDash: boolean }[] = [];
    const range = Math.ceil(dashSquares);
    for (let x = originX - range; x <= originX + range; x++) {
      for (let y = originY - range; y <= originY + range; y++) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        if (x === originX && y === originY) continue;
        const dist = gridDistance(originX, originY, x, y);
        if (dist <= dashSquares) {
          result.push({ x, y, isDash: dist > moveSquares });
        }
      }
    }
    return result;
  }, [originX, originY, moveSquares, dashSquares, gridSize]);

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
