import { type GridSize, getFeetPerSquare, gridDistance } from './types';

interface MeasureOverlayProps {
  startCell: { x: number; y: number } | null;
  endCell: { x: number; y: number } | null;
  gridSize: GridSize;
  cellSize: number;
  offsetLeft: number;
  offsetTop: number;
}

export function MeasureOverlay({ startCell, endCell, gridSize, cellSize, offsetLeft, offsetTop }: MeasureOverlayProps) {
  if (!startCell || !endCell) return null;

  const feetPerSq = getFeetPerSquare(gridSize);
  const dist = gridDistance(startCell.x, startCell.y, endCell.x, endCell.y);
  const totalFeet = dist * feetPerSq;

  const x1 = offsetLeft + startCell.x * cellSize + cellSize / 2;
  const y1 = offsetTop + startCell.y * cellSize + cellSize / 2;
  const x2 = offsetLeft + endCell.x * cellSize + cellSize / 2;
  const y2 = offsetTop + endCell.y * cellSize + cellSize / 2;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <svg className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 3" />
      <circle cx={x1} cy={y1} r={4} fill="hsl(var(--primary))" />
      <circle cx={x2} cy={y2} r={4} fill="hsl(var(--primary))" />
      <rect x={midX - 40} y={midY - 14} width={80} height={28} rx={4} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={1} opacity={0.95} />
      <text x={midX} y={midY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="bold" fill="hsl(var(--primary))">
        {totalFeet} ft
      </text>
      <text x={midX} y={midY + 12} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="hsl(var(--muted-foreground))">
        {dist} sq
      </text>
    </svg>
  );
}
