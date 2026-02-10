import { useState } from 'react';
import { Plus, X, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  memberColors: Record<string, string>; // userId -> color
  onPlaceMarker: (marker: Omit<MapMarker, 'ownerUserId'>) => Promise<void>;
  onRemoveMarker: (x: number, y: number) => Promise<void>;
}

const GRID_SIZE = 10;
const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];

export function PartyBattleMap({ markers, currentUserId, characterName, memberColors, onPlaceMarker, onRemoveMarker }: PartyBattleMapProps) {
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [placingMode, setPlacingMode] = useState<'self' | 'enemy' | null>(null);

  const getMarkerAt = (x: number, y: number) => markers.find(m => m.x === x && m.y === y);
  const myMarker = markers.find(m => !m.isEnemy && m.ownerUserId === currentUserId);

  const handleCellClick = async (x: number, y: number) => {
    const existing = getMarkerAt(x, y);

    if (existing) {
      // Can remove own marker or enemy markers
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

  if (markers.length === 0 && !placingMode) {
    return (
      <div className="space-y-2">
        <div className="text-center py-3">
          <Map className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground mb-2">No markers placed</p>
        </div>
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
  }

  return (
    <div className="space-y-2">
      {placingMode && (
        <div className="text-[10px] text-center text-primary animate-pulse">
          Tap a cell to place {placingMode === 'self' ? 'your marker' : enemyName || 'enemy'}
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-0 border border-border/30 rounded-md overflow-hidden" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);
          const marker = getMarkerAt(x, y);

          return (
            <button
              key={`${x}-${y}`}
              onClick={() => handleCellClick(x, y)}
              className={cn(
                "aspect-square border border-border/10 flex items-center justify-center text-[8px] font-bold transition-colors",
                marker ? "" : "hover:bg-muted/20",
                placingMode && !marker && "cursor-crosshair hover:bg-primary/10"
              )}
              style={marker ? { backgroundColor: `${marker.color}30` } : undefined}
              title={marker?.name}
            >
              {marker && (
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
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
            <span key={`${m.x}-${m.y}-${i}`} className="flex items-center gap-1 text-[9px]">
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
