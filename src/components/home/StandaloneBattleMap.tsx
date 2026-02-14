import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FullscreenBattleMap } from '@/components/party/battlemap/FullscreenBattleMap';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  type MapMarker, type GridSize, type ToolMode, type UndoAction, type AreaColorId,
  type SpellTemplate, type SpellShape, type SpellColorId, type DistanceUnit, type TierBackground, type ScaleTier,
  GRID_SIZE_OPTIONS, MEMBER_COLORS, STORAGE_KEY_GRID_SIZE, MAX_BACKGROUND_SIZE_MB, DEFAULT_SCALE_TIERS,
} from '@/components/party/battlemap/types';

const STORAGE_KEY_MAP_STATE = 'dnd-battlemap-state';

interface SavedMapState {
  markers: MapMarker[];
  highlightedCells: [string, AreaColorId][];
  spellTemplates: SpellTemplate[];
  gridSize: GridSize;
  backgroundUrl?: string;
  backgroundOpacity?: number;
  distancePerSquare?: number;
  distanceUnit?: DistanceUnit;
  autoScale?: boolean;
  tierBackgrounds?: TierBackground[];
  customTiers?: ScaleTier[];
  forcedTierId?: string | null;
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
  pendingMarkerAdds?: MapMarker[];
  pendingMarkerRemovals?: string[];
  onPendingProcessed?: () => void;
  onMarkersChange?: (markers: MapMarker[]) => void;
  onGridSizeChange?: (size: GridSize) => void;
}

/**
 * A self-contained battle map dialog for solo use (no party/Supabase needed).
 * Markers, areas, and spell templates persist to localStorage.
 */
export function StandaloneBattleMap({ open, onClose, characterName = 'Me', pendingMarkerAdds, pendingMarkerRemovals, onPendingProcessed, onMarkersChange, onGridSizeChange: onGridSizeChangeCallback }: StandaloneBattleMapProps) {
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
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>(() => loadMapState()?.backgroundUrl);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(() => loadMapState()?.backgroundOpacity ?? 1);
  const [distancePerSquare, setDistancePerSquare] = useState<number>(() => loadMapState()?.distancePerSquare ?? 5);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(() => loadMapState()?.distanceUnit ?? 'ft');
  const [autoScale, setAutoScale] = useState<boolean>(() => loadMapState()?.autoScale ?? true);
  const [tierBackgrounds, setTierBackgrounds] = useState<TierBackground[]>(() => loadMapState()?.tierBackgrounds ?? []);
  const [customTiers, setCustomTiers] = useState<ScaleTier[]>(() => loadMapState()?.customTiers ?? [...DEFAULT_SCALE_TIERS]);
  const [forcedTierId, setForcedTierId] = useState<string | null>(() => loadMapState()?.forcedTierId ?? null);

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
        backgroundUrl,
        backgroundOpacity,
        distancePerSquare,
        distanceUnit,
        autoScale,
        tierBackgrounds,
        customTiers,
        forcedTierId,
      });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [markers, highlightedCells, spellTemplates, gridSize, backgroundUrl, backgroundOpacity, distancePerSquare, distanceUnit, autoScale, tierBackgrounds, customTiers, forcedTierId]);

  // Notify parent of marker and grid size changes
  useEffect(() => { onMarkersChange?.(markers); }, [markers, onMarkersChange]);
  useEffect(() => { onGridSizeChangeCallback?.(gridSize); }, [gridSize, onGridSizeChangeCallback]);

  // Process pending marker adds/removals from auto-sync
  useEffect(() => {
    if (pendingMarkerAdds && pendingMarkerAdds.length > 0) {
      setMarkers(prev => [...prev, ...pendingMarkerAdds]);
    }
    if (pendingMarkerRemovals && pendingMarkerRemovals.length > 0) {
      setMarkers(prev => prev.filter(m => !pendingMarkerRemovals.includes(m.name)));
    }
    if ((pendingMarkerAdds?.length ?? 0) > 0 || (pendingMarkerRemovals?.length ?? 0) > 0) {
      onPendingProcessed?.();
    }
  }, [pendingMarkerAdds, pendingMarkerRemovals, onPendingProcessed]);

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

  const handleSetBackground = useCallback(async (file: File) => {
    if (file.size > MAX_BACKGROUND_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_BACKGROUND_SIZE_MB}MB`);
      return;
    }
    setBackgroundUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `battlemap-backgrounds/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('gear-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('gear-images').getPublicUrl(path);
      setBackgroundUrl(publicUrl);
      toast.success('Background set');
    } catch (e: any) {
      console.error('Background upload failed:', e);
      toast.error('Failed to upload background');
    } finally {
      setBackgroundUploading(false);
    }
  }, []);

  const handleClearBackground = useCallback(() => {
    setBackgroundUrl(undefined);
    toast.success('Background removed');
  }, []);

  const handleTierBackgroundUpload = useCallback(async (tierId: string, file: File) => {
    if (file.size > MAX_BACKGROUND_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_BACKGROUND_SIZE_MB}MB`);
      return;
    }
    setBackgroundUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `battlemap-backgrounds/tier-${tierId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('gear-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('gear-images').getPublicUrl(path);
      setTierBackgrounds(prev => [...prev.filter(b => b.tierId !== tierId), { tierId, imageUrl: publicUrl }]);
      toast.success('Layer image set');
    } catch (e: any) {
      console.error('Tier background upload failed:', e);
      toast.error('Failed to upload image');
    } finally {
      setBackgroundUploading(false);
    }
  }, []);

  const handleTierBackgroundRemove = useCallback((tierId: string) => {
    setTierBackgrounds(prev => prev.filter(b => b.tierId !== tierId));
    toast.success('Layer image removed');
  }, []);

  const handleTierConfigChange = useCallback((tierId: string, updates: Partial<Pick<ScaleTier, 'distancePerSquare' | 'distanceUnit'>>) => {
    setCustomTiers(prev => prev.map(t => t.id === tierId ? { ...t, ...updates } : t));
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
          backgroundUrl={backgroundUrl}
          backgroundUploading={backgroundUploading}
          backgroundOpacity={backgroundOpacity}
          onSetBackground={handleSetBackground}
          onClearBackground={handleClearBackground}
          onBackgroundOpacityChange={setBackgroundOpacity}
          distancePerSquare={distancePerSquare}
          distanceUnit={distanceUnit}
          onDistancePerSquareChange={(v) => { setDistancePerSquare(v); setAutoScale(false); }}
          onDistanceUnitChange={(v) => { setDistanceUnit(v); setAutoScale(false); }}
          autoScale={autoScale}
          onToggleAutoScale={() => setAutoScale(prev => !prev)}
          tierBackgrounds={tierBackgrounds}
          onTierBackgroundUpload={handleTierBackgroundUpload}
          onTierBackgroundRemove={handleTierBackgroundRemove}
          customTiers={customTiers}
          onTierConfigChange={handleTierConfigChange}
          forcedTierId={forcedTierId}
          onForceTier={setForcedTierId}
        />
      </DialogContent>
    </Dialog>
  );
}
