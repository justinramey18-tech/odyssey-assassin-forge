import { type MapMarker } from './types';

interface MarkerTooltipProps {
  marker: MapMarker;
  cellSize: number;
  style: React.CSSProperties;
}

export function MarkerTooltip({ marker, cellSize, style }: MarkerTooltipProps) {
  return (
    <div
      className="absolute z-30 pointer-events-none bg-background/95 border border-border/50 rounded px-2 py-1 text-[10px] shadow-lg whitespace-nowrap"
      style={{
        ...style,
        transform: `translate(-50%, -100%) translateY(-${cellSize * 0.1}px)`,
      }}
    >
      <div className="font-bold flex items-center gap-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: marker.color }} />
        {marker.name}
      </div>
      <div className="text-muted-foreground">
        Position: ({marker.x + 1}, {marker.y + 1})
        {marker.isEnemy ? ' • Enemy' : ''}
      </div>
    </div>
  );
}
