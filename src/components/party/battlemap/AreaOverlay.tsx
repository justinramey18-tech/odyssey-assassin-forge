import { type AreaColorId, getAreaColorById } from './types';

interface AreaOverlayProps {
  highlightedCells: Map<string, AreaColorId>;
  cellSize: number;
  offsetLeft: number;
  offsetTop: number;
}

export function AreaOverlay({ highlightedCells, cellSize, offsetLeft, offsetTop }: AreaOverlayProps) {
  if (highlightedCells.size === 0) return null;

  return (
    <>
      {Array.from(highlightedCells.entries()).map(([key, colorId]) => {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        const areaColor = getAreaColorById(colorId);
        return (
          <div
            key={key}
            className="absolute pointer-events-none rounded-sm"
            style={{
              left: offsetLeft + x * cellSize,
              top: offsetTop + y * cellSize,
              width: cellSize,
              height: cellSize,
              backgroundColor: areaColor.bg,
              border: `1px solid ${areaColor.border}`,
            }}
          />
        );
      })}
    </>
  );
}
