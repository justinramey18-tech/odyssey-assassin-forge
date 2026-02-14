import { useState, useCallback } from 'react';
import { Plus, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FullscreenBattleMap } from './battlemap/FullscreenBattleMap';
import {
  type MapMarker, type GridSize, type ToolMode, type UndoAction, type AreaColorId,
  type SpellTemplate, type SpellShape, type SpellColorId,
  GRID_SIZE_OPTIONS, INLINE_GRID_SIZE, MEMBER_COLORS, STORAGE_KEY_GRID_SIZE,
} from './battlemap/types';

export type { MapMarker } from './battlemap/types';

interface PartyBattleMapProps {
  markers: MapMarker[];
  currentUserId?: string;
  characterName: string;
  memberColors: Record<string, string>;
  onPlaceMarker: (marker: Omit<MapMarker, 'ownerUserId'>) => Promise<void>;
  onRemoveMarker: (x: number, y: number) => Promise<void>;
  onMoveMarker?: (fromX: number, fromY: number, toX: number, toY: number) => Promise<void>;
  backgroundUrl?: string;
  backgroundUploading?: boolean;
  onSetBackground?: (file: File) => void;
  onClearBackground?: () => void;
}

export function PartyBattleMap({ markers, currentUserId, characterName, memberColors, onPlaceMarker, onRemoveMarker, onMoveMarker, backgroundUrl, backgroundUploading, onSetBackground, onClearBackground }: PartyBattleMapProps) {
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GRID_SIZE);
    const parsed = saved ? parseInt(saved, 10) : null;
    return (parsed && GRID_SIZE_OPTIONS.includes(parsed as GridSize)) ? parsed as GridSize : 25;
  });

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // Measure tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  // Area highlight state
  const [highlightedCells, setHighlightedCells] = useState<Map<string, AreaColorId>>(new Map());
  const [areaColor, setAreaColor] = useState<AreaColorId>('danger');

  // Spell template state
  const [spellTemplates, setSpellTemplates] = useState<SpellTemplate[]>([]);
  const [spellShape, setSpellShape] = useState<SpellShape>('cone');
  const [spellSizeFt, setSpellSizeFt] = useState<number>(15);
  const [spellColor, setSpellColor] = useState<SpellColorId>('fire');
  const [spellOrigin, setSpellOrigin] = useState<{ x: number; y: number } | null>(null);

  // Movement range state
  const [movementSpeedFt, setMovementSpeedFt] = useState<number>(30);
  const [moveRangeOrigin, setMoveRangeOrigin] = useState<{ x: number; y: number } | null>(null);

  const handleGridSizeChange = useCallback((size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(STORAGE_KEY_GRID_SIZE, String(size));
  }, []);

  const getMarkerAt = useCallback((x: number, y: number) => markers.find(m => m.x === x && m.y === y), [markers]);
  const myMarker = markers.find(m => !m.isEnemy && m.ownerUserId === currentUserId);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  const handleCellClick = useCallback(async (x: number, y: number) => {
    const existing = getMarkerAt(x, y);

    if (existing) {
      if (existing.ownerUserId === currentUserId || existing.isEnemy) {
        pushUndo({ type: 'remove', marker: existing });
        await onRemoveMarker(x, y);
      }
      return;
    }

    if (toolMode === 'place-self') {
      const color = memberColors[currentUserId || ''] || MEMBER_COLORS[0];
      const marker = { x, y, name: characterName, color, isEnemy: false };
      pushUndo({ type: 'place', marker: { ...marker, ownerUserId: currentUserId || '' } });
      await onPlaceMarker(marker);
      setToolMode(null);
    } else if (toolMode === 'place-enemy' && enemyName.trim()) {
      const marker = { x, y, name: enemyName.trim(), color: '#ef4444', isEnemy: true };
      pushUndo({ type: 'place', marker: { ...marker, ownerUserId: currentUserId || '' } });
      await onPlaceMarker(marker);
      setToolMode(null);
      setEnemyName('');
      setAddingEnemy(false);
    }
  }, [getMarkerAt, currentUserId, toolMode, memberColors, characterName, enemyName, onPlaceMarker, onRemoveMarker, pushUndo]);

  const handleCellDrop = useCallback(async (fromX: number, fromY: number, toX: number, toY: number) => {
    const marker = getMarkerAt(fromX, fromY);
    if (!marker) return;
    pushUndo({ type: 'move', marker, previousPosition: { x: fromX, y: fromY } });
    if (onMoveMarker) {
      await onMoveMarker(fromX, fromY, toX, toY);
    } else {
      await onRemoveMarker(fromX, fromY);
      await onPlaceMarker({ x: toX, y: toY, name: marker.name, color: marker.color, isEnemy: marker.isEnemy });
    }
  }, [getMarkerAt, onMoveMarker, onRemoveMarker, onPlaceMarker, pushUndo]);

  const handleUndo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;
    setUndoStack(prev => prev.slice(0, -1));

    if (action.type === 'place') {
      await onRemoveMarker(action.marker.x, action.marker.y);
    } else if (action.type === 'remove') {
      await onPlaceMarker({ x: action.marker.x, y: action.marker.y, name: action.marker.name, color: action.marker.color, isEnemy: action.marker.isEnemy });
    } else if (action.type === 'move' && action.previousPosition) {
      await onRemoveMarker(action.marker.x, action.marker.y);
      await onPlaceMarker({ x: action.previousPosition.x, y: action.previousPosition.y, name: action.marker.name, color: action.marker.color, isEnemy: action.marker.isEnemy });
    }
  }, [undoStack, onRemoveMarker, onPlaceMarker]);

  const handleMeasureClick = useCallback((x: number, y: number) => {
    if (!measureStart) {
      setMeasureStart({ x, y });
      setMeasureEnd(null);
    } else {
      setMeasureEnd({ x, y });
    }
  }, [measureStart]);

  const handleAreaClick = useCallback((x: number, y: number) => {
    const key = `${x},${y}`;
    setHighlightedCells(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, areaColor);
      return next;
    });
  }, [areaColor]);

  const handleClearArea = useCallback(() => {
    setHighlightedCells(new Map());
  }, []);

  const handleSpellClick = useCallback((x: number, y: number) => {
    if (!spellOrigin) {
      setSpellOrigin({ x, y });
    } else {
      const template: SpellTemplate = {
        id: `spell-${Date.now()}`,
        shape: spellShape,
        sizeFt: spellSizeFt,
        originX: spellOrigin.x,
        originY: spellOrigin.y,
        directionX: x,
        directionY: y,
        color: spellColor,
      };
      setSpellTemplates(prev => [...prev, template]);
      setSpellOrigin(null);
    }
  }, [spellOrigin, spellShape, spellSizeFt, spellColor]);

  const handleDeleteSpell = useCallback((id: string) => {
    setSpellTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleClearSpells = useCallback(() => {
    setSpellTemplates([]);
    setSpellOrigin(null);
  }, []);

  const handleMoveRangeClick = useCallback((x: number, y: number) => {
    const marker = markers.find(m => m.x === x && m.y === y);
    if (marker) {
      // Toggle: click same marker to clear, or click new marker to switch
      if (moveRangeOrigin?.x === x && moveRangeOrigin?.y === y) {
        setMoveRangeOrigin(null);
      } else {
        setMoveRangeOrigin({ x, y });
      }
    } else if (moveRangeOrigin) {
      // Clicking empty cell clears
      setMoveRangeOrigin(null);
    }
  }, [markers, moveRangeOrigin]);

  // Reset measure/spell/move-range when switching tools
  const handleSetToolMode = useCallback((mode: ToolMode) => {
    setToolMode(mode);
    if (mode !== 'measure') {
      setMeasureStart(null);
      setMeasureEnd(null);
    }
    if (mode !== 'spell') {
      setSpellOrigin(null);
    }
    if (mode !== 'move-range') {
      setMoveRangeOrigin(null);
    }
  }, []);

  // Inline 10×10 preview
  const inlineGrid = (
    <div className="space-y-2">
      {(toolMode === 'place-self' || toolMode === 'place-enemy') && (
        <div className="text-[10px] text-center text-primary animate-pulse">
          Tap a cell to place {toolMode === 'place-self' ? 'your marker' : enemyName || 'enemy'}
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
                (toolMode === 'place-self' || toolMode === 'place-enemy') && !marker && "cursor-crosshair hover:bg-primary/10"
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
      <div className="flex gap-1.5 flex-wrap">
        {!myMarker && (
          <Button
            size="sm"
            variant={toolMode === 'place-self' ? 'default' : 'outline'}
            className="text-[10px] h-6 gap-1"
            onClick={() => handleSetToolMode(toolMode === 'place-self' ? null : 'place-self')}
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
              variant={toolMode === 'place-enemy' ? 'default' : 'outline'}
              className="text-[10px] h-6"
              onClick={() => handleSetToolMode(enemyName.trim() ? 'place-enemy' : null)}
              disabled={!enemyName.trim()}
            >
              Place
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setAddingEnemy(false); setEnemyName(''); handleSetToolMode(null); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 text-destructive border-destructive/30" onClick={() => setAddingEnemy(true)}>
            <Plus className="w-3 h-3" /> Enemy
          </Button>
        )}
        {toolMode && (
          <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => handleSetToolMode(null)}>
            Cancel
          </Button>
        )}
      </div>
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
            currentUserId={currentUserId}
            toolMode={toolMode}
            enemyName={enemyName}
            myMarker={myMarker}
            addingEnemy={addingEnemy}
            gridSize={gridSize}
            undoStack={undoStack}
            onGridSizeChange={handleGridSizeChange}
            onCellClick={handleCellClick}
            onCellDrop={handleCellDrop}
            onClose={() => setFullscreen(false)}
            setToolMode={handleSetToolMode}
            setAddingEnemy={setAddingEnemy}
            setEnemyName={setEnemyName}
            onUndo={handleUndo}
            getMarkerAt={getMarkerAt}
            onMeasureClick={handleMeasureClick}
            onAreaClick={handleAreaClick}
            measureStart={measureStart}
            measureEnd={measureEnd}
            highlightedCells={highlightedCells}
            areaColor={areaColor}
            setAreaColor={setAreaColor}
            onClearArea={handleClearArea}
            spellTemplates={spellTemplates}
            spellShape={spellShape}
            spellSizeFt={spellSizeFt}
            spellColor={spellColor}
            spellOrigin={spellOrigin}
            setSpellShape={setSpellShape}
            setSpellSizeFt={setSpellSizeFt}
            setSpellColor={setSpellColor}
            onSpellClick={handleSpellClick}
            onDeleteSpell={handleDeleteSpell}
            onClearSpells={handleClearSpells}
            movementSpeedFt={movementSpeedFt}
            setMovementSpeedFt={setMovementSpeedFt}
            moveRangeOrigin={moveRangeOrigin}
            onMoveRangeClick={handleMoveRangeClick}
            backgroundUrl={backgroundUrl}
            backgroundUploading={backgroundUploading}
            onSetBackground={onSetBackground}
            onClearBackground={onClearBackground}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
