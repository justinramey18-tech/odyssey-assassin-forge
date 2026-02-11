import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FullscreenBattleMap } from '@/components/party/battlemap/FullscreenBattleMap';
import {
  type MapMarker, type GridSize, type ToolMode, type UndoAction, type AreaColorId,
  type SpellTemplate, type SpellShape, type SpellColorId,
  GRID_SIZE_OPTIONS, MEMBER_COLORS, STORAGE_KEY_GRID_SIZE,
} from '@/components/party/battlemap/types';

const STORAGE_KEY_MAP_STATE = 'dnd-battlemap-state';

interface SavedMapState {
  markers: MapMarker[];
  highlightedCells: [string, AreaColorId][];
  spellTemplates: SpellTemplate[];
  gridSize: GridSize;
}

function loadMapState(): SavedMapState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAP_STATE);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMapState;
  } catch {
    return null;
  }
}

function saveMapState(state: SavedMapState): void {
  try {
    localStorage.setItem(STORAGE_KEY_MAP_STATE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save battle map state:', e);
  }
}

interface StandaloneBattleMapProps {
  open: boolean;
  onClose: () => void;
  characterName?: string;
}

/**
 * A self-contained battle map dialog for solo use (no party/Supabase needed).
 * Markers, areas, and spell templates persist to localStorage.
 */
export function StandaloneBattleMap({ open, onClose, characterName = 'Me' }: StandaloneBattleMapProps) {
  const [markers, setMarkers] = useState<MapMarker[]>(() => loadMapState()?.markers ?? []);
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyName, setEnemyName] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const saved = loadMapState()?.gridSize;
    if (saved && GRID_SIZE_OPTIONS.includes(saved)) return saved;
    const legacy = localStorage.getItem(STORAGE_KEY_GRID_SIZE);
    const parsed = legacy ? parseInt(legacy, 10) : null;
    return (parsed && GRID_SIZE_OPTIONS.includes(parsed as GridSize)) ? parsed as GridSize : 25;
  });
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Map<string, AreaColorId>>(() => {
    const saved = loadMapState()?.highlightedCells;
    return saved ? new Map(saved) : new Map();
  });
  const [areaColor, setAreaColor] = useState<AreaColorId>('danger');
  const [spellTemplates, setSpellTemplates] = useState<SpellTemplate[]>(() => loadMapState()?.spellTemplates ?? []);
  const [spellShape, setSpellShape] = useState<SpellShape>('cone');
  const [spellSizeFt, setSpellSizeFt] = useState<number>(15);
  const [spellColor, setSpellColor] = useState<SpellColorId>('fire');
  const [spellOrigin, setSpellOrigin] = useState<{ x: number; y: number } | null>(null);
  const [movementSpeedFt, setMovementSpeedFt] = useState<number>(30);
  const [moveRangeOrigin, setMoveRangeOrigin] = useState<{ x: number; y: number } | null>(null);

  // Auto-save to localStorage on state changes (debounced via ref)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMapState({
        markers,
        highlightedCells: Array.from(highlightedCells.entries()),
        spellTemplates,
        gridSize,
      });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [markers, highlightedCells, spellTemplates, gridSize]);

  const currentUserId = 'solo-user';
  const myMarker = markers.find(m => !m.isEnemy && m.ownerUserId === currentUserId);

  const getMarkerAt = useCallback((x: number, y: number) => markers.find(m => m.x === x && m.y === y), [markers]);

  const handleGridSizeChange = useCallback((size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(STORAGE_KEY_GRID_SIZE, String(size));
  }, []);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  const handleCellClick = useCallback((x: number, y: number) => {
    const existing = getMarkerAt(x, y);
    if (existing) {
      pushUndo({ type: 'remove', marker: existing });
      setMarkers(prev => prev.filter(m => !(m.x === x && m.y === y)));
      return;
    }
    if (toolMode === 'place-self') {
      const marker: MapMarker = { x, y, name: characterName, color: MEMBER_COLORS[0], isEnemy: false, ownerUserId: currentUserId };
      pushUndo({ type: 'place', marker });
      setMarkers(prev => [...prev, marker]);
      setToolMode(null);
    } else if (toolMode === 'place-enemy' && enemyName.trim()) {
      const marker: MapMarker = { x, y, name: enemyName.trim(), color: '#ef4444', isEnemy: true, ownerUserId: currentUserId };
      pushUndo({ type: 'place', marker });
      setMarkers(prev => [...prev, marker]);
      setToolMode(null);
      setEnemyName('');
      setAddingEnemy(false);
    }
  }, [getMarkerAt, toolMode, characterName, enemyName, pushUndo, currentUserId]);

  const handleCellDrop = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const marker = getMarkerAt(fromX, fromY);
    if (!marker) return;
    pushUndo({ type: 'move', marker: { ...marker, x: toX, y: toY }, previousPosition: { x: fromX, y: fromY } });
    setMarkers(prev => prev.map(m => (m.x === fromX && m.y === fromY) ? { ...m, x: toX, y: toY } : m));
  }, [getMarkerAt, pushUndo]);

  const handleUndo = useCallback(() => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;
    setUndoStack(prev => prev.slice(0, -1));
    if (action.type === 'place') {
      setMarkers(prev => prev.filter(m => !(m.x === action.marker.x && m.y === action.marker.y)));
    } else if (action.type === 'remove') {
      setMarkers(prev => [...prev, action.marker]);
    } else if (action.type === 'move' && action.previousPosition) {
      setMarkers(prev => prev.map(m =>
        (m.x === action.marker.x && m.y === action.marker.y)
          ? { ...m, x: action.previousPosition!.x, y: action.previousPosition!.y }
          : m
      ));
    }
  }, [undoStack]);

  const handleMeasureClick = useCallback((x: number, y: number) => {
    if (!measureStart) { setMeasureStart({ x, y }); setMeasureEnd(null); }
    else setMeasureEnd({ x, y });
  }, [measureStart]);

  const handleAreaClick = useCallback((x: number, y: number) => {
    const key = `${x},${y}`;
    setHighlightedCells(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key); else next.set(key, areaColor);
      return next;
    });
  }, [areaColor]);

  const handleSpellClick = useCallback((x: number, y: number) => {
    if (!spellOrigin) {
      setSpellOrigin({ x, y });
    } else {
      setSpellTemplates(prev => [...prev, {
        id: `spell-${Date.now()}`, shape: spellShape, sizeFt: spellSizeFt,
        originX: spellOrigin.x, originY: spellOrigin.y, directionX: x, directionY: y, color: spellColor,
      }]);
      setSpellOrigin(null);
    }
  }, [spellOrigin, spellShape, spellSizeFt, spellColor]);

  const handleMoveRangeClick = useCallback((x: number, y: number) => {
    const marker = markers.find(m => m.x === x && m.y === y);
    if (marker) {
      setMoveRangeOrigin(prev => (prev?.x === x && prev?.y === y) ? null : { x, y });
    } else {
      setMoveRangeOrigin(null);
    }
  }, [markers]);

  const handleSetToolMode = useCallback((mode: ToolMode) => {
    setToolMode(mode);
    if (mode !== 'measure') { setMeasureStart(null); setMeasureEnd(null); }
    if (mode !== 'spell') setSpellOrigin(null);
    if (mode !== 'move-range') setMoveRangeOrigin(null);
  }, []);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
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
          onClose={onClose}
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
          onClearArea={() => setHighlightedCells(new Map())}
          spellTemplates={spellTemplates}
          spellShape={spellShape}
          spellSizeFt={spellSizeFt}
          spellColor={spellColor}
          spellOrigin={spellOrigin}
          setSpellShape={setSpellShape}
          setSpellSizeFt={setSpellSizeFt}
          setSpellColor={setSpellColor}
          onSpellClick={handleSpellClick}
          onDeleteSpell={(id) => setSpellTemplates(prev => prev.filter(t => t.id !== id))}
          onClearSpells={() => { setSpellTemplates([]); setSpellOrigin(null); }}
          movementSpeedFt={movementSpeedFt}
          setMovementSpeedFt={setMovementSpeedFt}
          moveRangeOrigin={moveRangeOrigin}
          onMoveRangeClick={handleMoveRangeClick}
        />
      </DialogContent>
    </Dialog>
  );
}
