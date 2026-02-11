interface AreaOverlayProps {
  highlightedCells: Set<string>;
  cellSize: number;
  offsetLeft: number;
  offsetTop: number;
}

export function AreaOverlay({ highlightedCells, cellSize, offsetLeft, offsetTop }: AreaOverlayProps) {
  if (highlightedCells.size === 0) return null;

  return (
    <>
      {Array.from(highlightedCells).map(key => {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        return (
          <div
            key={key}
            className="absolute pointer-events-none rounded-sm"
            style={{
              left: offsetLeft + x * cellSize,
              top: offsetTop + y * cellSize,
              width: cellSize,
              height: cellSize,
              backgroundColor: 'hsl(var(--primary) / 0.2)',
              border: '1px solid hsl(var(--primary) / 0.4)',
            }}
          />
        );
      })}
    </>
  );
}
