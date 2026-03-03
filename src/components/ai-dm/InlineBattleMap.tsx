import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Map as MapIcon, ZoomIn, ZoomOut, Crosshair, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MapControls } from '@/components/party/battlemap/MapControls';
import { MarkerTooltip } from '@/components/party/battlemap/MarkerTooltip';
import { MeasureOverlay } from '@/components/party/battlemap/MeasureOverlay';
import { SpellTemplateOverlay } from '@/components/party/battlemap/SpellTemplateOverlay';
import { MovementRangeOverlay } from '@/components/party/battlemap/MovementRangeOverlay';
import { TierBackgroundPanel } from '@/components/party/battlemap/TierBackgroundPanel';
import {
  type MapMarker, type GridSize, type ToolMode, type UndoAction, type AreaColorId,
  type SpellTemplate, type SpellShape, type SpellColorId, type DistanceUnit, type TierBackground, type ScaleTier,
  GRID_SIZE_OPTIONS, CELL_SIZE, MEMBER_COLORS, STORAGE_KEY_GRID_SIZE,
  DISTANCE_UNITS, DISTANCE_PER_SQUARE_PRESETS, DEFAULT_SCALE_TIERS, MIN_ZOOM, MAX_ZOOM,
  getDistanceUnitAbbr, getAreaColorById, getActiveTier, getTierOpacity, MAX_BACKGROUND_SIZE_MB,
} from '@/components/party/battlemap/types';
import { supabase } from '@/integrations/supabase/client';

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
  } catch { return null; }
}

function saveMapState(state: SavedMapState): void {
  try {
    localStorage.setItem(STORAGE_KEY_MAP_STATE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save battle map state:', e);
  }
}

interface InlineBattleMapProps {
  characterName?: string;
  pendingMarkerAdds?: MapMarker[];
  pendingMarkerRemovals?: string[];
  onPendingProcessed?: () => void;
  onMarkersChange?: (markers: MapMarker[]) => void;
  onGridSizeChange?: (size: GridSize) => void;
  onClose: () => void;
  // Party sync props
  isHost?: boolean;
  partyBackgroundUrl?: string;
  partyBackgroundOpacity?: number;
  partyTierBackgrounds?: { tierId: string; imageUrl: string }[];
  partyCustomTiers?: { id: string; distancePerSquare: number; distanceUnit: string }[];
  onPartyBackgroundChange?: (url: string | undefined) => Promise<void>;
  onPartyBackgroundOpacityChange?: (opacity: number) => Promise<void>;
  onPartyTierBackgroundsChange?: (tierBackgrounds: { tierId: string; imageUrl: string }[]) => Promise<void>;
  onPartyCustomTiersChange?: (customTiers: { id: string; distancePerSquare: number; distanceUnit: string }[]) => Promise<void>;
}

export function InlineBattleMap({
  characterName = 'Me',
  pendingMarkerAdds,
  pendingMarkerRemovals,
  onPendingProcessed,
  onMarkersChange,
  onGridSizeChange: onGridSizeChangeCallback,
  onClose,
  isHost,
  partyBackgroundUrl,
  partyBackgroundOpacity,
  partyTierBackgrounds,
  partyCustomTiers,
  onPartyBackgroundChange,
  onPartyBackgroundOpacityChange,
  onPartyTierBackgroundsChange,
  onPartyCustomTiersChange,
}: InlineBattleMapProps) {
  // ── State (same as StandaloneBattleMap) ──
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

  // ── Zoom & viewport ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.7);
  const [hoveredMarker, setHoveredMarker] = useState<{ marker: MapMarker; px: number; py: number } | null>(null);
  const [dragSource, setDragSource] = useState<{ x: number; y: number } | null>(null);

  const totalSize = gridSize * CELL_SIZE;
  const cellSize = CELL_SIZE * zoom;
  const labelWidth = 28 * zoom;
  const labelHeight = 18 * zoom;

  const tiers = customTiers;
  // Resolve effective values: non-host uses party sync data, host uses local state
  const resolvedBackgroundUrl = isHost === false ? partyBackgroundUrl : backgroundUrl;
  const resolvedBackgroundOpacity = isHost === false ? (partyBackgroundOpacity ?? 1) : backgroundOpacity;
  const resolvedTierBackgrounds = isHost === false ? (partyTierBackgrounds?.map(tb => ({ tierId: tb.tierId, imageUrl: tb.imageUrl })) ?? []) : tierBackgrounds;
  const resolvedCustomTiers: ScaleTier[] = isHost === false && partyCustomTiers
    ? partyCustomTiers.map(ct => {
        const base = DEFAULT_SCALE_TIERS.find(t => t.id === ct.id);
        return base ? { ...base, distancePerSquare: ct.distancePerSquare, distanceUnit: ct.distanceUnit as DistanceUnit } : { id: ct.id, label: ct.id, minZoom: 0, maxZoom: 10, distancePerSquare: ct.distancePerSquare, distanceUnit: ct.distanceUnit as DistanceUnit, gridMergeFactor: 1, minorLineOpacity: 0.1 };
      })
    : customTiers;
  const effectiveTiers = isHost === false && partyCustomTiers ? resolvedCustomTiers : tiers;

  // Active tier: forced tier takes priority, then auto-scale by zoom
  const activeTier = useMemo(() => {
    if (forcedTierId) {
      return effectiveTiers.find(t => t.id === forcedTierId) ?? effectiveTiers[0];
    }
    return autoScale ? getActiveTier(zoom, effectiveTiers) : null;
  }, [forcedTierId, autoScale, zoom, effectiveTiers]);
  const effectiveDistancePerSquare = activeTier ? activeTier.distancePerSquare : distancePerSquare;
  const effectiveDistanceUnit = activeTier ? activeTier.distanceUnit : distanceUnit;
  const effectiveUnitAbbr = getDistanceUnitAbbr(effectiveDistanceUnit);
  const unitAbbr = effectiveUnitAbbr;

  const currentUserId = 'solo-user';
  const myMarker = markers.find(m => !m.isEnemy && m.ownerUserId === currentUserId);

  // ── Auto-save ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMapState({ markers, highlightedCells: Array.from(highlightedCells.entries()), spellTemplates, gridSize, backgroundUrl, backgroundOpacity, distancePerSquare, distanceUnit, autoScale, tierBackgrounds, customTiers, forcedTierId });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [markers, highlightedCells, spellTemplates, gridSize, backgroundUrl, backgroundOpacity, distancePerSquare, distanceUnit, autoScale, tierBackgrounds, customTiers, forcedTierId]);

  useEffect(() => { onMarkersChange?.(markers); }, [markers, onMarkersChange]);
  useEffect(() => { onGridSizeChangeCallback?.(gridSize); }, [gridSize, onGridSizeChangeCallback]);

  // Process pending marker adds/removals
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

  // ── Marker map for fast lookup ──
  const markerMap = useMemo(() => {
    const map = new Map<string, MapMarker>();
    markers.forEach(m => map.set(`${m.x},${m.y}`, m));
    return map;
  }, [markers]);

  // ── Handlers (same as StandaloneBattleMap) ──
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
    if (action.type === 'place') setMarkers(prev => prev.filter(m => !(m.x === action.marker.x && m.y === action.marker.y)));
    else if (action.type === 'remove') setMarkers(prev => [...prev, action.marker]);
    else if (action.type === 'move' && action.previousPosition) {
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
      const path = `battlemap-backgrounds/inline-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('gear-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('gear-images').getPublicUrl(path);
      setBackgroundUrl(publicUrl);
      onPartyBackgroundChange?.(publicUrl);
      toast.success('Background set');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBackgroundUploading(false);
    }
  }, [onPartyBackgroundChange]);

  const handleClearBackground = useCallback(() => {
    setBackgroundUrl(undefined);
    onPartyBackgroundChange?.(undefined);
    toast.success('Background removed');
  }, [onPartyBackgroundChange]);

  const handleBackgroundOpacityChange = useCallback((opacity: number) => {
    setBackgroundOpacity(opacity);
    onPartyBackgroundOpacityChange?.(opacity);
  }, [onPartyBackgroundOpacityChange]);

  const handleTierBackgroundUpload = useCallback(async (tierId: string, file: File) => {
    if (file.size > MAX_BACKGROUND_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_BACKGROUND_SIZE_MB}MB`);
      return;
    }
    setBackgroundUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `battlemap-backgrounds/inline-tier-${tierId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('gear-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('gear-images').getPublicUrl(path);
      const updated = [...tierBackgrounds.filter(b => b.tierId !== tierId), { tierId, imageUrl: publicUrl }];
      setTierBackgrounds(updated);
      onPartyTierBackgroundsChange?.(updated);
      toast.success('Layer image set');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBackgroundUploading(false);
    }
  }, [tierBackgrounds, onPartyTierBackgroundsChange]);

  const handleTierBackgroundRemove = useCallback((tierId: string) => {
    const updated = tierBackgrounds.filter(b => b.tierId !== tierId);
    setTierBackgrounds(updated);
    onPartyTierBackgroundsChange?.(updated);
    toast.success('Layer image removed');
  }, [tierBackgrounds, onPartyTierBackgroundsChange]);

  const handleTierConfigChange = useCallback((tierId: string, updates: Partial<Pick<ScaleTier, 'distancePerSquare' | 'distanceUnit'>>) => {
    setCustomTiers(prev => {
      const updated = prev.map(t => t.id === tierId ? { ...t, ...updates } : t);
      onPartyCustomTiersChange?.(updated.map(t => ({ id: t.id, distancePerSquare: t.distancePerSquare, distanceUnit: t.distanceUnit })));
      return updated;
    });
  }, [onPartyCustomTiersChange]);

  const handleCellInteraction = (x: number, y: number) => {
    if (toolMode === 'measure') handleMeasureClick(x, y);
    else if (toolMode === 'area') handleAreaClick(x, y);
    else if (toolMode === 'spell') handleSpellClick(x, y);
    else if (toolMode === 'move-range') handleMoveRangeClick(x, y);
    else handleCellClick(x, y);
  };

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
    handleCellDrop(dragSource.x, dragSource.y, x, y);
    setDragSource(null);
  };

  const getCursor = () => {
    if (toolMode === 'measure' || toolMode === 'spell') return 'crosshair';
    if (toolMode === 'area') return 'cell';
    if (toolMode === 'place-self' || toolMode === 'place-enemy') return 'crosshair';
    if (toolMode === 'move-range') return 'pointer';
    return 'default';
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact header strip */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-amber-900/20 bg-black/30 shrink-0 flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <MapIcon className="w-3.5 h-3.5 text-amber-400" />
          <Select value={String(gridSize)} onValueChange={(v) => handleGridSizeChange(Number(v) as GridSize)}>
            <SelectTrigger className="h-5 w-[5rem] text-[9px] font-sans border-border/30 bg-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRID_SIZE_OPTIONS.map(s => (
                <SelectItem key={s} value={String(s)} className="text-[11px]">{s}×{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(distancePerSquare)} onValueChange={(v) => { setDistancePerSquare(Number(v)); setAutoScale(false); }}>
            <SelectTrigger className="h-5 w-[3rem] text-[9px] font-sans border-border/30 bg-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_PER_SQUARE_PRESETS.map(d => (
                <SelectItem key={d} value={String(d)} className="text-[11px]">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={distanceUnit} onValueChange={(v) => { setDistanceUnit(v as DistanceUnit); setAutoScale(false); }}>
            <SelectTrigger className="h-5 w-[3.5rem] text-[9px] font-sans border-border/30 bg-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_UNITS.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-[11px]">{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[9px] text-white/30">/sq</span>
          {activeTier && (
            <span className="text-[8px] text-amber-400/70 ml-0.5">{forcedTierId ? '' : 'Auto: '}{activeTier.label}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {/* Manual tier selector */}
          {effectiveTiers.map(tier => {
            const isActive = forcedTierId === tier.id;
            return (
              <Button
                key={tier.id}
                size="sm"
                variant="ghost"
                className={cn(
                  "text-[8px] h-5 px-1.5",
                  isActive ? "bg-amber-400/20 text-amber-300" : "text-white/30 hover:text-white/60"
                )}
                onClick={() => setForcedTierId(isActive ? null : tier.id)}
              >
                {tier.label}
              </Button>
            );
          })}
          {markers.length > 0 && (
            <Select onValueChange={(v) => {
              const m = markers.find(mk => `${mk.x},${mk.y}` === v);
              if (m) jumpToMarker(m);
            }}>
              <SelectTrigger className="h-5 w-[5.5rem] text-[9px] border-border/30 bg-white/5 gap-0.5">
                <Crosshair className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <SelectValue placeholder="Jump..." />
              </SelectTrigger>
              <SelectContent>
                {markers.map((m) => (
                  <SelectItem key={`${m.x},${m.y}`} value={`${m.x},${m.y}`} className="text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      {m.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.75))}>
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="text-[9px] text-white/40 w-7 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.33))}>
            <ZoomIn className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-1" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Tool hint */}
      {toolMode && (
        <div className="text-[10px] text-center text-amber-400 animate-pulse py-0.5 shrink-0 bg-black/20">
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
                className="text-[8px] text-white/30 text-center shrink-0 bg-black/80 border-b border-white/5"
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
                  className="text-[8px] text-white/30 flex items-center justify-center shrink-0 bg-black/80 border-r border-white/5"
                  style={{ width: labelWidth, height: cellSize }}
                >
                  {y + 1}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="relative">
              {/* Layered tier backgrounds */}
              {resolvedTierBackgrounds.length > 0 ? (
                effectiveTiers.map(tier => {
                  const bg = resolvedTierBackgrounds.find(b => b.tierId === tier.id);
                  if (!bg) return null;
                  const tierOpacity = forcedTierId
                    ? (tier.id === forcedTierId ? resolvedBackgroundOpacity : 0)
                    : getTierOpacity(zoom, tier) * resolvedBackgroundOpacity;
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
              ) : resolvedBackgroundUrl ? (
                <img
                  src={resolvedBackgroundUrl}
                  alt=""
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: gridSize * cellSize,
                    height: gridSize * cellSize,
                    objectFit: 'cover',
                    zIndex: 0,
                    opacity: resolvedBackgroundOpacity,
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
                  const hasAnyBg = resolvedTierBackgrounds.length > 0 || !!resolvedBackgroundUrl;
                  const cellBorderOpacity = hasAnyBg ? 0.02 : 0.05;
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
                        !isHighlighted && !marker && "hover:bg-white/5",
                        (toolMode === 'place-self' || toolMode === 'place-enemy') && !marker && "hover:bg-amber-500/10",
                        isMeasurePoint && "ring-2 ring-amber-400/60",
                      )}
                      style={{
                        width: cellSize, height: cellSize,
                        ...(!isHighlighted && !marker ? {
                          border: `1px solid rgba(255,255,255,${cellBorderOpacity})`,
                        } : {}),
                        ...(isHighlighted && highlightColorId ? {
                          backgroundColor: getAreaColorById(highlightColorId).bg,
                          border: `1px solid ${getAreaColorById(highlightColorId).border}`,
                        } : marker ? { backgroundColor: `${marker.color}30`, border: '1px solid rgba(255,255,255,0.05)' } : {}),
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
                onDeleteTemplate={(id) => setSpellTemplates(prev => prev.filter(t => t.id !== id))}
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
                  <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white/80" style={{ boxShadow: '0 0 8px rgba(251,191,36,0.8)' }} />
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
          className="absolute bottom-2 right-2 border border-white/10 rounded bg-black/60 backdrop-blur-sm z-20 cursor-pointer"
          style={{ width: 70, height: 70 }}
          onClick={(e) => {
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
          }}
        >
          {markers.map((m, i) => (
            <div
              key={`mm-${i}`}
              className="absolute rounded-full"
              style={{
                backgroundColor: m.color,
                width: 3, height: 3,
                left: (m.x / gridSize) * 70 - 1,
                top: (m.y / gridSize) * 70 - 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 py-1 border-t border-amber-900/20 bg-black/20 shrink-0">
          {markers.map((m, i) => (
            <span key={`leg-${i}`} className="flex items-center gap-1 text-[9px] text-white/60">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name} <span className="text-white/30">({m.x + 1},{m.y + 1})</span>
            </span>
          ))}
        </div>
      )}

      {/* MapControls toolbar - below the map area */}
      <div className="shrink-0 px-2 py-1.5 border-t border-amber-900/20 bg-black/30">
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
          setToolMode={handleSetToolMode}
          setAreaColor={setAreaColor}
          setSpellShape={setSpellShape}
          setSpellSizeFt={setSpellSizeFt}
          setSpellColor={setSpellColor}
          setMovementSpeedFt={setMovementSpeedFt}
          onUndo={handleUndo}
          onClearArea={() => setHighlightedCells(new Map())}
          onClearSpells={() => { setSpellTemplates([]); setSpellOrigin(null); }}
          hasBackground={!!resolvedBackgroundUrl || resolvedTierBackgrounds.length > 0}
          backgroundUploading={backgroundUploading}
          backgroundOpacity={resolvedBackgroundOpacity}
          onBackgroundUpload={isHost ? handleSetBackground : undefined}
          onClearBackground={isHost ? handleClearBackground : undefined}
          onBackgroundOpacityChange={isHost ? handleBackgroundOpacityChange : undefined}
        />
        {isHost !== false && (
          <TierBackgroundPanel
            tiers={effectiveTiers}
            tierBackgrounds={tierBackgrounds}
            autoScale={autoScale}
            masterOpacity={backgroundOpacity}
            uploading={backgroundUploading}
            onToggleAutoScale={() => setAutoScale(prev => !prev)}
            onUpload={handleTierBackgroundUpload}
            onRemove={handleTierBackgroundRemove}
            onMasterOpacityChange={handleBackgroundOpacityChange}
            onTierConfigChange={handleTierConfigChange}
          />
        )}
      </div>
    </div>
  );
}