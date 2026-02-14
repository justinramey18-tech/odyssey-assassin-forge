import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Map as MapIcon, Minimize2, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapControls } from './MapControls';
import { MarkerTooltip } from './MarkerTooltip';
import { MeasureOverlay } from './MeasureOverlay';
import { AreaOverlay } from './AreaOverlay';
import { SpellTemplateOverlay } from './SpellTemplateOverlay';
import { MovementRangeOverlay } from './MovementRangeOverlay';
import { TierBackgroundPanel } from './TierBackgroundPanel';
import {
  type MapMarker, type GridSize, type ToolMode, type UndoAction, type AreaColorId,
  type SpellTemplate, type SpellShape, type SpellColorId, type DistanceUnit,
  type ScaleTier, type TierBackground,
  GRID_SIZE_OPTIONS, CELL_SIZE, DISTANCE_UNITS, DISTANCE_PER_SQUARE_PRESETS,
  DEFAULT_SCALE_TIERS, getActiveTier, getTierOpacity, MIN_ZOOM, MAX_ZOOM,
  getDistanceUnitAbbr, getAreaColorById,
} from './types';

interface FullscreenBattleMapProps {
  markers: MapMarker[];
  currentUserId?: string;
  toolMode: ToolMode;
  enemyName: string;
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  gridSize: GridSize;
  undoStack: UndoAction[];
  onGridSizeChange: (size: GridSize) => void;
  onCellClick: (x: number, y: number) => void;
  onCellDrop: (fromX: number, fromY: number, toX: number, toY: number) => void;
  onClose: () => void;
  setToolMode: (v: ToolMode) => void;
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  onUndo: () => void;
  getMarkerAt: (x: number, y: number) => MapMarker | undefined;
  onMeasureClick: (x: number, y: number) => void;
  onAreaClick: (x: number, y: number) => void;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  highlightedCells: Map<string, AreaColorId>;
  areaColor: AreaColorId;
  setAreaColor: (v: AreaColorId) => void;
  onClearArea: () => void;
  // Spell template props
  spellTemplates: SpellTemplate[];
  spellShape: SpellShape;
  spellSizeFt: number;
  spellColor: SpellColorId;
  spellOrigin: { x: number; y: number } | null;
  setSpellShape: (v: SpellShape) => void;
  setSpellSizeFt: (v: number) => void;
  setSpellColor: (v: SpellColorId) => void;
  onSpellClick: (x: number, y: number) => void;
  onDeleteSpell: (id: string) => void;
  onClearSpells: () => void;
  // Movement range props
  movementSpeedFt: number;
  setMovementSpeedFt: (v: number) => void;
  moveRangeOrigin: { x: number; y: number } | null;
  onMoveRangeClick: (x: number, y: number) => void;
  // Background image props
  backgroundUrl?: string;
  backgroundUploading?: boolean;
  backgroundOpacity?: number;
  onSetBackground?: (file: File) => void;
  onClearBackground?: () => void;
  onBackgroundOpacityChange?: (opacity: number) => void;
  // Distance/unit props
  distancePerSquare: number;
  distanceUnit: DistanceUnit;
  onDistancePerSquareChange: (v: number) => void;
  onDistanceUnitChange: (v: DistanceUnit) => void;
  // Auto-scale & tier background props
  autoScale?: boolean;
  onToggleAutoScale?: () => void;
  tierBackgrounds?: TierBackground[];
  onTierBackgroundUpload?: (tierId: string, file: File) => void;
  onTierBackgroundRemove?: (tierId: string) => void;
}

export function FullscreenBattleMap({
  markers, currentUserId, toolMode, enemyName, myMarker, addingEnemy, gridSize, undoStack,
  onGridSizeChange, onCellClick, onCellDrop, onClose, setToolMode, setAddingEnemy, setEnemyName,
  onUndo, getMarkerAt, onMeasureClick, onAreaClick, measureStart, measureEnd, highlightedCells,
  areaColor, setAreaColor, onClearArea,
  spellTemplates, spellShape, spellSizeFt, spellColor, spellOrigin,
  setSpellShape, setSpellSizeFt, setSpellColor, onSpellClick, onDeleteSpell, onClearSpells,
  movementSpeedFt, setMovementSpeedFt, moveRangeOrigin, onMoveRangeClick,
  backgroundUrl, backgroundUploading, backgroundOpacity, onSetBackground, onClearBackground, onBackgroundOpacityChange,
  distancePerSquare, distanceUnit, onDistancePerSquareChange, onDistanceUnitChange,
  autoScale = false, onToggleAutoScale, tierBackgrounds = [], onTierBackgroundUpload, onTierBackgroundRemove,
}: FullscreenBattleMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportRect, setViewportRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [hoveredMarker, setHoveredMarker] = useState<{ marker: MapMarker; px: number; py: number } | null>(null);
  const [dragSource, setDragSource] = useState<{ x: number; y: number } | null>(null);

  const totalSize = gridSize * CELL_SIZE;
  const cellSize = CELL_SIZE * zoom;
  const labelWidth = 28 * zoom;
  const labelHeight = 18 * zoom;

  // Auto-scale tier computation
  const activeTier = useMemo(() => autoScale ? getActiveTier(zoom) : null, [autoScale, zoom]);
  const effectiveDistancePerSquare = activeTier ? activeTier.distancePerSquare : distancePerSquare;
  const effectiveDistanceUnit = activeTier ? activeTier.distanceUnit : distanceUnit;
  const effectiveUnitAbbr = getDistanceUnitAbbr(effectiveDistanceUnit);
  const unitAbbr = effectiveUnitAbbr;

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
        setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
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

  // Viewport tracking for minimap
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

  const jumpToMarker = useCallback((marker: MapMarker) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: marker.x * cellSize + cellSize / 2 - el.clientWidth / 2 + labelWidth,
      top: marker.y * cellSize + cellSize / 2 - el.clientHeight / 2 + labelHeight,
      behavior: 'smooth',
    });
  }, [cellSize, labelWidth, labelHeight]);

  const markerMap = useMemo(() => {
    const map = new Map<string, MapMarker>();
    markers.forEach(m => map.set(`${m.x},${m.y}`, m));
    return map;
  }, [markers]);

  const handleCellInteraction = (x: number, y: number) => {
    if (toolMode === 'measure') {
      onMeasureClick(x, y);
    } else if (toolMode === 'area') {
      onAreaClick(x, y);
    } else if (toolMode === 'spell') {
      onSpellClick(x, y);
    } else if (toolMode === 'move-range') {
      onMoveRangeClick(x, y);
    } else {
      onCellClick(x, y);
    }
  };

  // Drag handlers
  const handleDragStart = (x: number, y: number, e: React.DragEvent) => {
    const marker = getMarkerAt(x, y);
    if (!marker) return;
    if (!marker.isEnemy && marker.ownerUserId !== currentUserId) return;
    setDragSource({ x, y });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (x: number, y: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource) return;
    if (dragSource.x === x && dragSource.y === y) { setDragSource(null); return; }
    if (getMarkerAt(x, y)) { setDragSource(null); return; }
    onCellDrop(dragSource.x, dragSource.y, x, y);
    setDragSource(null);
  };

  const getCursor = () => {
    if (toolMode === 'measure' || toolMode === 'spell') return 'crosshair';
    if (toolMode === 'area') return 'cell';
    if (toolMode === 'place-self' || toolMode === 'place-enemy') return 'crosshair';
    if (toolMode === 'move-range') return 'pointer';
    return 'default';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0 flex-wrap gap-1">
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
          {/* Jump-to-marker */}
          {markers.length > 0 && (
            <Select onValueChange={(v) => {
              const m = markers.find(mk => `${mk.x},${mk.y}` === v);
              if (m) jumpToMarker(m);
            }}>
              <SelectTrigger className="h-7 w-[7rem] text-[10px] border-border/30 bg-muted/30 gap-1">
                <Crosshair className="w-3 h-3 text-primary shrink-0" />
                <SelectValue placeholder="Jump to..." />
              </SelectTrigger>
              <SelectContent>
                {markers.map((m) => (
                  <SelectItem key={`${m.x},${m.y}`} value={`${m.x},${m.y}`} className="text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      {m.name} ({m.x + 1},{m.y + 1})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.75))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.33))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 ml-2" onClick={onClose}>
            <Minimize2 className="w-3 h-3" /> Exit
          </Button>
        </div>
      </div>

      {/* Tool hint */}
      {toolMode && (
        <div className="text-[11px] text-center text-primary animate-pulse py-1 shrink-0">
          {toolMode === 'place-self' && 'Tap a cell to place your marker'}
          {toolMode === 'place-enemy' && `Tap a cell to place ${enemyName || 'enemy'}`}
          {toolMode === 'measure' && (measureStart ? 'Tap second cell to measure distance' : 'Tap first cell to start measuring')}
          {toolMode === 'area' && 'Click cells to highlight/unhighlight area'}
          {toolMode === 'spell' && (spellOrigin ? 'Tap second cell to set direction' : 'Tap a cell to set spell origin')}
          {toolMode === 'move-range' && (moveRangeOrigin ? 'Tap a different token or empty cell to clear' : 'Tap a token to show its movement range')}
        </div>
      )}

      {/* Scrollable grid area */}
      <div className="flex-1 min-h-0 relative" style={{ cursor: getCursor() }}>
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-auto overscroll-contain"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          {/* Column labels */}
          <div className="sticky top-0 z-10 flex" style={{ paddingLeft: labelWidth }}>
            {Array.from({ length: gridSize }).map((_, x) => (
              <div
                key={`col-${x}`}
                className="text-[9px] text-muted-foreground text-center shrink-0 bg-background/90 border-b border-border/10"
                style={{ width: cellSize, lineHeight: `${labelHeight}px` }}
              >
                {x + 1}
              </div>
            ))}
          </div>

          <div className="flex relative">
            {/* Row labels */}
            <div className="sticky left-0 z-10 flex flex-col">
              {Array.from({ length: gridSize }).map((_, y) => (
                <div
                  key={`row-${y}`}
                  className="text-[9px] text-muted-foreground flex items-center justify-center shrink-0 bg-background/90 border-r border-border/10"
                  style={{ width: labelWidth, height: cellSize }}
                >
                  {y + 1}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="relative">
              {/* Layered tier background images */}
              {tierBackgrounds.length > 0 ? (
                DEFAULT_SCALE_TIERS.map(tier => {
                  const bg = tierBackgrounds.find(b => b.tierId === tier.id);
                  if (!bg) return null;
                  const tierOpacity = getTierOpacity(zoom, tier) * (backgroundOpacity ?? 1);
                  if (tierOpacity <= 0) return null;
                  return (
                    <img
                      key={tier.id}
                      src={bg.imageUrl}
                      alt=""
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        width: gridSize * cellSize,
                        height: gridSize * cellSize,
                        objectFit: 'cover',
                        zIndex: 0,
                        opacity: tierOpacity,
                        transition: 'opacity 0.3s ease',
                      }}
                    />
                  );
                })
              ) : backgroundUrl ? (
                <img
                  src={backgroundUrl}
                  alt=""
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: gridSize * cellSize,
                    height: gridSize * cellSize,
                    objectFit: 'cover',
                    zIndex: 0,
                    opacity: backgroundOpacity ?? 1,
                  }}
                />
              ) : null}
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
                  const highlightColorId = highlightedCells.get(`${x},${y}`);
                  const isHighlighted = !!highlightColorId;
                  const isMeasurePoint = (measureStart?.x === x && measureStart?.y === y) || (measureEnd?.x === x && measureEnd?.y === y);
                  const hasAnyBg = tierBackgrounds.length > 0 || !!backgroundUrl;
                  const cellBorderOpacity = hasAnyBg ? 0.05 : 0.1;
                  return (
                    <button
                      key={i}
                      onClick={() => handleCellInteraction(x, y)}
                      draggable={!!marker && (marker.isEnemy || marker.ownerUserId === currentUserId)}
                      onDragStart={(e) => handleDragStart(x, y, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(x, y, e)}
                      onMouseEnter={() => {
                        if (marker) {
                          const px = x * cellSize + cellSize / 2;
                          const py = y * cellSize;
                          setHoveredMarker({ marker, px, py });
                        }
                      }}
                      onMouseLeave={() => setHoveredMarker(null)}
                      className={cn(
                        "flex items-center justify-center transition-colors",
                        !isHighlighted && !marker && "hover:bg-muted/20",
                        (toolMode === 'place-self' || toolMode === 'place-enemy') && !marker && "hover:bg-primary/10",
                        isMeasurePoint && "ring-2 ring-primary/60",
                      )}
                      style={{
                        width: cellSize, height: cellSize,
                        ...(!isHighlighted && !marker ? {
                          border: `1px solid ${hasAnyBg ? `rgba(255,255,255,${cellBorderOpacity})` : `hsl(var(--border) / ${cellBorderOpacity})`}`,
                        } : {}),
                        ...(isHighlighted && highlightColorId ? {
                          backgroundColor: getAreaColorById(highlightColorId).bg,
                          border: `1px solid ${getAreaColorById(highlightColorId).border}`,
                        } : marker ? { backgroundColor: `${marker.color}30`, border: '1px solid hsl(var(--border) / 0.1)' } : {}),
                      }}
                      title={marker?.name}
                    >
                      {marker && (
                        <span
                          className="rounded-full flex items-center justify-center text-white font-bold"
                          style={{
                            backgroundColor: marker.color,
                            width: cellSize * 0.65, height: cellSize * 0.65,
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

              {/* Spell template overlay */}
              <SpellTemplateOverlay
                templates={spellTemplates}
                gridSize={gridSize}
                cellSize={cellSize}
                onDeleteTemplate={onDeleteSpell}
              />

              {/* Movement range overlay */}
              {moveRangeOrigin && (
                <MovementRangeOverlay
                  originX={moveRangeOrigin.x}
                  originY={moveRangeOrigin.y}
                  movementSpeed={movementSpeedFt}
                  distancePerSquare={effectiveDistancePerSquare}
                  gridSize={gridSize}
                  cellSize={cellSize}
                  difficultTerrain={highlightedCells}
                />
              )}

              {/* Spell origin indicator */}
              {spellOrigin && (
                <div
                  className="absolute pointer-events-none z-20 flex items-center justify-center animate-pulse"
                  style={{
                    left: spellOrigin.x * cellSize,
                    top: spellOrigin.y * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-primary border-2 border-white/80" style={{ boxShadow: '0 0 8px hsl(var(--primary))' }} />
                </div>
              )}

              {/* Measure line overlay */}
              <MeasureOverlay
                startCell={measureStart}
                endCell={measureEnd}
                gridSize={gridSize}
                cellSize={cellSize}
                offsetLeft={0}
                offsetTop={0}
                distancePerSquare={effectiveDistancePerSquare}
                distanceUnit={effectiveDistanceUnit}
              />

              {/* Hover tooltip */}
              {hoveredMarker && (
                <MarkerTooltip
                  marker={hoveredMarker.marker}
                  cellSize={cellSize}
                  style={{ left: hoveredMarker.px, top: hoveredMarker.py }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Minimap */}
        <div
          className="absolute bottom-14 right-3 border border-border/40 rounded bg-background/80 backdrop-blur-sm z-20 cursor-pointer"
          style={{ width: 100, height: 100 }}
          onClick={handleMinimapClick}
        >
          {markers.map((m, i) => (
            <div
              key={`mm-${i}`}
              className="absolute rounded-full"
              style={{
                backgroundColor: m.color,
                width: 3, height: 3,
                left: (m.x / gridSize) * 100 - 1,
                top: (m.y / gridSize) * 100 - 1,
              }}
            />
          ))}
          <div
            className="absolute border-2 border-primary/70 rounded-sm"
            style={{
              left: `${viewportRect.x * 100}%`, top: `${viewportRect.y * 100}%`,
              width: `${Math.min(viewportRect.w * 100, 100)}%`, height: `${Math.min(viewportRect.h * 100, 100)}%`,
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
            toolMode={toolMode}
            undoStack={undoStack}
            areaColor={areaColor}
            highlightedCellCount={highlightedCells.size}
            spellShape={spellShape}
            spellSizeFt={spellSizeFt}
            spellColor={spellColor}
            spellTemplateCount={spellTemplates.length}
            movementSpeedFt={movementSpeedFt}
            moveRangeActive={!!moveRangeOrigin}
            distanceUnit={effectiveDistanceUnit}
            setAddingEnemy={setAddingEnemy}
            setEnemyName={setEnemyName}
            setToolMode={setToolMode}
            setAreaColor={setAreaColor}
            setSpellShape={setSpellShape}
            setSpellSizeFt={setSpellSizeFt}
            setSpellColor={setSpellColor}
            setMovementSpeedFt={setMovementSpeedFt}
            onUndo={onUndo}
            onClearArea={onClearArea}
            onClearSpells={onClearSpells}
            hasBackground={!!backgroundUrl || tierBackgrounds.length > 0}
            backgroundUploading={backgroundUploading}
            backgroundOpacity={backgroundOpacity}
            onBackgroundUpload={!onTierBackgroundUpload ? onSetBackground : undefined}
            onClearBackground={!onTierBackgroundRemove ? onClearBackground : undefined}
            onBackgroundOpacityChange={onBackgroundOpacityChange}
          />
          {/* Tier background panel */}
          {onTierBackgroundUpload && (
            <TierBackgroundPanel
              tiers={DEFAULT_SCALE_TIERS}
              tierBackgrounds={tierBackgrounds}
              autoScale={autoScale}
              masterOpacity={backgroundOpacity ?? 1}
              uploading={backgroundUploading ?? false}
              onToggleAutoScale={() => onToggleAutoScale?.()}
              onUpload={onTierBackgroundUpload}
              onRemove={(tierId) => onTierBackgroundRemove?.(tierId)}
              onMasterOpacityChange={(v) => onBackgroundOpacityChange?.(v)}
            />
          )}
        </div>
        {/* Distance/unit controls & grid info */}
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-1 flex-wrap">
          <span>Grid: {gridSize}×{gridSize}</span>
          <span>•</span>
          {autoScale && activeTier ? (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[8px] h-4 px-1.5 py-0 border-primary/30 text-primary">
                Auto: {activeTier.label}
              </Badge>
              <span>{effectiveDistancePerSquare} {effectiveUnitAbbr}/sq</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Select value={String(distancePerSquare)} onValueChange={(v) => onDistancePerSquareChange(Number(v))}>
                <SelectTrigger className="h-5 w-[3.5rem] text-[9px] border-border/30 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTANCE_PER_SQUARE_PRESETS.map(d => (
                    <SelectItem key={d} value={String(d)} className="text-[11px]">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={distanceUnit} onValueChange={(v) => onDistanceUnitChange(v as DistanceUnit)}>
                <SelectTrigger className="h-5 w-[4.5rem] text-[9px] border-border/30 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTANCE_UNITS.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-[11px]">{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>/sq</span>
            </div>
          )}
          <span>•</span>
          <span>{gridSize * effectiveDistancePerSquare} {effectiveUnitAbbr} total</span>
        </div>
      </div>
    </div>
  );
}
