import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Plus, X, Map as MapIcon, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const GRID_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type GridSize = typeof GRID_SIZE_OPTIONS[number];
const STORAGE_KEY_GRID_SIZE = 'dnd-battlemap-grid-size';
const INLINE_GRID_SIZE = 10;
const CELL_SIZE = 40;
const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];

export function PartyBattleMap({ markers, currentUserId, characterName, memberColors, onPlaceMarker, onRemoveMarker }: PartyBattleMapProps) {
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [placingMode, setPlacingMode] = useState<'self' | 'enemy' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GRID_SIZE);
    const parsed = saved ? parseInt(saved, 10) : null;
    return (parsed && GRID_SIZE_OPTIONS.includes(parsed as GridSize)) ? parsed as GridSize : 25;
  });

  const handleGridSizeChange = useCallback((size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(STORAGE_KEY_GRID_SIZE, String(size));
  }, []);

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

  // Inline 10x10 preview
  const inlineGrid = (
    <div className="space-y-2">
      {placingMode && (
        <div className="text-[10px] text-center text-primary animate-pulse">
          Tap a cell to place {placingMode === 'self' ? 'your marker' : enemyName || 'enemy'}
        </div>
      )}
      <div
        className="grid gap-0 border border-border/30 rounded-md overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${INLINE_GRID_SIZE}, 1fr)` }}
      >
        {Array.from({ length: INLINE_GRID_SIZE * INLINE_GRID_SIZE }).map((_, i) => {
          const x = i % INLINE_GRID_SIZE;
          const y = Math.floor(i / INLINE_GRID_SIZE);
          const marker = getMarkerAt(x, y);
          return (
            <button
              key={`${x}-${y}`}
              onClick={() => handleCellClick(x, y)}
              className={cn(
                "aspect-square border border-border/10 flex items-center justify-center transition-colors text-[8px] font-bold",
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

  return (
    <>
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
        {inlineGrid}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-0 flex flex-col border-none rounded-none bg-background">
          <FullscreenBattleMap
            markers={markers}
            placingMode={placingMode}
            enemyName={enemyName}
            myMarker={myMarker}
            addingEnemy={addingEnemy}
            gridSize={gridSize}
            onGridSizeChange={handleGridSizeChange}
            onCellClick={handleCellClick}
            onClose={() => setFullscreen(false)}
            setPlacingMode={setPlacingMode}
            setAddingEnemy={setAddingEnemy}
            setEnemyName={setEnemyName}
            getMarkerAt={getMarkerAt}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Fullscreen 100x100 scrollable map ---

interface FullscreenBattleMapProps {
  markers: MapMarker[];
  placingMode: 'self' | 'enemy' | null;
  enemyName: string;
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  onCellClick: (x: number, y: number) => void;
  onClose: () => void;
  setPlacingMode: (v: 'self' | 'enemy' | null) => void;
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  getMarkerAt: (x: number, y: number) => MapMarker | undefined;
}

function FullscreenBattleMap({
  markers, placingMode, enemyName, myMarker, addingEnemy, gridSize, onGridSizeChange,
  onCellClick, onClose, setPlacingMode, setAddingEnemy, setEnemyName, getMarkerAt
}: FullscreenBattleMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportRect, setViewportRect] = useState({ x: 0, y: 0, w: 1, h: 1 });

  const totalSize = gridSize * CELL_SIZE;

  // Pinch-to-zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let lastDistance = 0;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDistance > 0) {
        const delta = (dist - lastDistance) * 0.005;
        setZoom(prev => Math.min(3, Math.max(0.3, prev + delta)));
      }
      lastDistance = dist;
    };
    const onTouchEnd = () => { lastDistance = 0; };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Track viewport for minimap
  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scaledTotal = totalSize * zoom;
    setViewportRect({
      x: el.scrollLeft / scaledTotal,
      y: el.scrollTop / scaledTotal,
      w: el.clientWidth / scaledTotal,
      h: el.clientHeight / scaledTotal,
    });
  }, [zoom, totalSize]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateViewport();
    el.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      el.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [updateViewport]);

  // Update viewport when zoom changes
  useEffect(() => { updateViewport(); }, [zoom, updateViewport]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!el) return;
    const fracX = (e.clientX - rect.left) / rect.width;
    const fracY = (e.clientY - rect.top) / rect.height;
    const scaledTotal = totalSize * zoom;
    el.scrollTo({
      left: fracX * scaledTotal - el.clientWidth / 2,
      top: fracY * scaledTotal - el.clientHeight / 2,
      behavior: 'smooth',
    });
  };

  const cellSize = CELL_SIZE * zoom;

  // Precompute marker positions into a Set for fast lookup
  const markerMap = useMemo(() => {
    const map = new Map<string, MapMarker>();
    markers.forEach(m => map.set(`${m.x},${m.y}`, m));
    return map;
  }, [markers]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
        <DialogTitle className="font-cinzel font-semibold text-sm flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-primary" /> Battle Map
          <Select value={String(gridSize)} onValueChange={(v) => onGridSizeChange(Number(v) as GridSize)}>
            <SelectTrigger className="h-6 w-[5.5rem] text-[10px] font-sans font-normal border-border/30 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRID_SIZE_OPTIONS.map(s => (
                <SelectItem key={s} value={String(s)} className="text-[11px]">{s}×{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DialogTitle>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(3, z + 0.15))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 ml-2" onClick={onClose}>
            <Minimize2 className="w-3 h-3" /> Exit
          </Button>
        </div>
      </div>

      {/* Placing hint */}
      {placingMode && (
        <div className="text-[11px] text-center text-primary animate-pulse py-1 shrink-0">
          Tap a cell to place {placingMode === 'self' ? 'your marker' : enemyName || 'enemy'}
        </div>
      )}

      {/* Scrollable grid area */}
      <div className="flex-1 min-h-0 relative">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto overscroll-contain"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          {/* Column coordinate labels */}
          <div className="sticky top-0 z-10 flex" style={{ paddingLeft: 28 * zoom }}>
            {Array.from({ length: gridSize }).map((_, x) => (
              <div
                key={`col-${x}`}
                className="text-[9px] text-muted-foreground text-center shrink-0 bg-background/90 border-b border-border/10"
                style={{ width: cellSize, lineHeight: `${18 * zoom}px` }}
              >
                {x + 1}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Row coordinate labels */}
            <div className="sticky left-0 z-10 flex flex-col" style={{ marginTop: 0 }}>
              {Array.from({ length: gridSize }).map((_, y) => (
                <div
                  key={`row-${y}`}
                  className="text-[9px] text-muted-foreground flex items-center justify-center shrink-0 bg-background/90 border-r border-border/10"
                  style={{ width: 28 * zoom, height: cellSize }}
                >
                  {y + 1}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                const x = i % gridSize;
                const y = Math.floor(i / gridSize);
                const marker = markerMap.get(`${x},${y}`);
                return (
                  <button
                    key={i}
                    onClick={() => onCellClick(x, y)}
                    className={cn(
                      "border border-border/10 flex items-center justify-center transition-colors",
                      marker ? "" : "hover:bg-muted/20",
                      placingMode && !marker && "cursor-crosshair hover:bg-primary/10"
                    )}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      ...(marker ? { backgroundColor: `${marker.color}30` } : {}),
                    }}
                    title={marker?.name}
                  >
                    {marker && (
                      <span
                        className="rounded-full flex items-center justify-center text-white font-bold"
                        style={{
                          backgroundColor: marker.color,
                          width: cellSize * 0.65,
                          height: cellSize * 0.65,
                          fontSize: cellSize * 0.35,
                        }}
                      >
                        {marker.isEnemy ? '!' : marker.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Minimap overlay */}
        <div
          className="absolute bottom-14 right-3 border border-border/40 rounded bg-background/80 backdrop-blur-sm z-20 cursor-pointer"
          style={{ width: 100, height: 100 }}
          onClick={handleMinimapClick}
        >
          {/* Marker dots */}
          {markers.map((m, i) => (
            <div
              key={`mm-${i}`}
              className="absolute rounded-full"
              style={{
                backgroundColor: m.color,
                width: 3,
                height: 3,
                left: (m.x / gridSize) * 100 - 1,
                top: (m.y / gridSize) * 100 - 1,
              }}
            />
          ))}
          {/* Viewport rect */}
          <div
            className="absolute border-2 border-primary/70 rounded-sm"
            style={{
              left: `${viewportRect.x * 100}%`,
              top: `${viewportRect.y * 100}%`,
              width: `${Math.min(viewportRect.w * 100, 100)}%`,
              height: `${Math.min(viewportRect.h * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 px-3 py-2 border-t border-border/20">
        <div className="flex flex-wrap gap-1.5">
          {markers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mr-2">
              {markers.map((m, i) => (
                <span key={`leg-${i}`} className="flex items-center gap-1 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name} <span className="text-muted-foreground">({m.x + 1},{m.y + 1})</span>
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
      </div>
    </div>
  );
}

// --- Shared Controls ---

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
