import { useState } from 'react';
import { Plus, X, Map, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface MapMarker {
  x: number;
  y: number;
  name: string;
  color: string;
  isEnemy: boolean;
  ownerUserId: string;
}

interface PartyBattleMapProps {
  markers: MapMarker[];
  currentUserId?: string;
  characterName: string;
  memberColors: Record<string, string>;
  onPlaceMarker: (marker: Omit<MapMarker, 'ownerUserId'>) => Promise<void>;
  onRemoveMarker: (x: number, y: number) => Promise<void>;
}

const GRID_SIZE = 10;
const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];

export function PartyBattleMap({ markers, currentUserId, characterName, memberColors, onPlaceMarker, onRemoveMarker }: PartyBattleMapProps) {
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [placingMode, setPlacingMode] = useState<'self' | 'enemy' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const getMarkerAt = (x: number, y: number) => markers.find(m => m.x === x && m.y === y);
  const myMarker = markers.find(m => !m.isEnemy && m.ownerUserId === currentUserId);

  const handleCellClick = async (x: number, y: number) => {
    const existing = getMarkerAt(x, y);

    if (existing) {
      if (existing.ownerUserId === currentUserId || existing.isEnemy) {
        await onRemoveMarker(x, y);
      }
      return;
    }

    if (placingMode === 'self') {
      const color = memberColors[currentUserId || ''] || MEMBER_COLORS[0];
      await onPlaceMarker({ x, y, name: characterName, color, isEnemy: false });
      setPlacingMode(null);
    } else if (placingMode === 'enemy' && enemyName.trim()) {
      await onPlaceMarker({ x, y, name: enemyName.trim(), color: '#ef4444', isEnemy: true });
      setPlacingMode(null);
      setEnemyName('');
      setAddingEnemy(false);
    }
  };

  const gridContent = (isFullscreen: boolean) => (
    <div className={cn("space-y-2", isFullscreen && "flex flex-col h-full")}>
      {placingMode && (
        <div className="text-[10px] text-center text-primary animate-pulse">
          Tap a cell to place {placingMode === 'self' ? 'your marker' : enemyName || 'enemy'}
        </div>
      )}

      {/* Grid */}
      <div
        className={cn(
          "grid gap-0 border border-border/30 rounded-md overflow-hidden",
          isFullscreen && "flex-1"
        )}
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: isFullscreen ? `repeat(${GRID_SIZE}, 1fr)` : undefined,
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);
          const marker = getMarkerAt(x, y);

          return (
            <button
              key={`${x}-${y}`}
              onClick={() => handleCellClick(x, y)}
              className={cn(
                "aspect-square border border-border/10 flex items-center justify-center transition-colors",
                isFullscreen ? "text-sm font-bold" : "text-[8px] font-bold",
                marker ? "" : "hover:bg-muted/20",
                placingMode && !marker && "cursor-crosshair hover:bg-primary/10"
              )}
              style={marker ? { backgroundColor: `${marker.color}30` } : undefined}
              title={marker?.name}
            >
              {marker && (
                <span
                  className={cn(
                    "rounded-full flex items-center justify-center text-white",
                    isFullscreen ? "w-6 h-6 text-xs" : "w-3.5 h-3.5"
                  )}
                  style={{ backgroundColor: marker.color }}
                >
                  {marker.isEnemy ? '!' : marker.name.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {markers.map((m, i) => (
            <span key={`${m.x}-${m.y}-${i}`} className={cn("flex items-center gap-1", isFullscreen ? "text-xs" : "text-[9px]")}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name}
            </span>
          ))}
        </div>
      )}

      <MapControls
        myMarker={myMarker}
        addingEnemy={addingEnemy}
        enemyName={enemyName}
        placingMode={placingMode}
        setAddingEnemy={setAddingEnemy}
        setEnemyName={setEnemyName}
        setPlacingMode={setPlacingMode}
      />
    </div>
  );

  return (
    <>
      {/* Inline preview with fullscreen button */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-6 gap-1"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="w-3 h-3" /> Fullscreen
          </Button>
        </div>
        {gridContent(false)}
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-4 flex flex-col border-none rounded-none bg-background">
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="font-cinzel font-semibold text-sm flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" /> Battle Map
            </DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] h-6 gap-1"
              onClick={() => setFullscreen(false)}
            >
              <Minimize2 className="w-3 h-3" /> Exit
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {gridContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MapControls({ myMarker, addingEnemy, enemyName, placingMode, setAddingEnemy, setEnemyName, setPlacingMode }: {
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  enemyName: string;
  placingMode: 'self' | 'enemy' | null;
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  setPlacingMode: (v: 'self' | 'enemy' | null) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {!myMarker && (
        <Button
          size="sm"
          variant={placingMode === 'self' ? 'default' : 'outline'}
          className="text-[10px] h-6 gap-1"
          onClick={() => setPlacingMode(placingMode === 'self' ? null : 'self')}
        >
          <Plus className="w-3 h-3" /> Place Me
        </Button>
      )}
      {addingEnemy ? (
        <div className="flex gap-1 items-center">
          <Input
            value={enemyName}
            onChange={(e) => setEnemyName(e.target.value.slice(0, 20))}
            placeholder="Enemy name"
            className="h-6 text-[10px] w-24"
          />
          <Button
            size="sm"
            variant={placingMode === 'enemy' ? 'default' : 'outline'}
            className="text-[10px] h-6"
            onClick={() => setPlacingMode(enemyName.trim() ? 'enemy' : null)}
            disabled={!enemyName.trim()}
          >
            Place
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setAddingEnemy(false); setEnemyName(''); setPlacingMode(null); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 text-red-400 border-red-400/30" onClick={() => setAddingEnemy(true)}>
          <Plus className="w-3 h-3" /> Enemy
        </Button>
      )}
      {placingMode && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => setPlacingMode(null)}>
          Cancel
        </Button>
      )}
    </div>
  );
}
