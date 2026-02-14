import { useRef } from 'react';
import { Plus, X, Ruler, Paintbrush, Undo2, Trash2, Sparkles, Footprints, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type MapMarker, type ToolMode, type UndoAction, type AreaColorId, type SpellShape, type SpellColorId,
  AREA_COLORS, SPELL_SHAPE_LABELS, SPELL_SIZE_OPTIONS, SPELL_TEMPLATE_COLORS, MOVEMENT_SPEED_OPTIONS,
} from './types';

interface MapControlsProps {
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  enemyName: string;
  toolMode: ToolMode;
  undoStack: UndoAction[];
  areaColor: AreaColorId;
  highlightedCellCount: number;
  spellShape: SpellShape;
  spellSizeFt: number;
  spellColor: SpellColorId;
  spellTemplateCount: number;
  movementSpeedFt: number;
  moveRangeActive: boolean;
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  setToolMode: (v: ToolMode) => void;
  setAreaColor: (v: AreaColorId) => void;
  setSpellShape: (v: SpellShape) => void;
  setSpellSizeFt: (v: number) => void;
  setSpellColor: (v: SpellColorId) => void;
  setMovementSpeedFt: (v: number) => void;
  onUndo: () => void;
  onClearArea: () => void;
  onClearSpells: () => void;
  hasBackground?: boolean;
  backgroundUploading?: boolean;
  backgroundOpacity?: number;
  onBackgroundUpload?: (file: File) => void;
  onClearBackground?: () => void;
  onBackgroundOpacityChange?: (opacity: number) => void;
}

export function MapControls({
  myMarker, addingEnemy, enemyName, toolMode,
  undoStack, areaColor, highlightedCellCount,
  spellShape, spellSizeFt, spellColor, spellTemplateCount,
  movementSpeedFt, moveRangeActive,
  setAddingEnemy, setEnemyName, setToolMode, setAreaColor,
  setSpellShape, setSpellSizeFt, setSpellColor, setMovementSpeedFt,
  onUndo, onClearArea, onClearSpells,
  hasBackground, backgroundUploading, backgroundOpacity, onBackgroundUpload, onClearBackground, onBackgroundOpacityChange,
}: MapControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {!myMarker && (
        <Button
          size="sm"
          variant={toolMode === 'place-self' ? 'default' : 'outline'}
          className="text-[10px] h-6 gap-1"
          onClick={() => setToolMode(toolMode === 'place-self' ? null : 'place-self')}
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
            onClick={() => setToolMode(enemyName.trim() ? 'place-enemy' : null)}
            disabled={!enemyName.trim()}
          >
            Place
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setAddingEnemy(false); setEnemyName(''); setToolMode(null); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 text-destructive border-destructive/30" onClick={() => setAddingEnemy(true)}>
          <Plus className="w-3 h-3" /> Enemy
        </Button>
      )}
      <Button
        size="sm"
        variant={toolMode === 'measure' ? 'default' : 'outline'}
        className="text-[10px] h-6 gap-1"
        onClick={() => setToolMode(toolMode === 'measure' ? null : 'measure')}
      >
        <Ruler className="w-3 h-3" /> Measure
      </Button>
      <Button
        size="sm"
        variant={toolMode === 'area' ? 'default' : 'outline'}
        className="text-[10px] h-6 gap-1"
        onClick={() => setToolMode(toolMode === 'area' ? null : 'area')}
      >
        <Paintbrush className="w-3 h-3" /> Area
      </Button>
      <Button
        size="sm"
        variant={toolMode === 'spell' ? 'default' : 'outline'}
        className="text-[10px] h-6 gap-1"
        onClick={() => setToolMode(toolMode === 'spell' ? null : 'spell')}
      >
        <Sparkles className="w-3 h-3" /> Spell
      </Button>
      <Button
        size="sm"
        variant={toolMode === 'move-range' ? 'default' : 'outline'}
        className="text-[10px] h-6 gap-1"
        onClick={() => setToolMode(toolMode === 'move-range' ? null : 'move-range')}
      >
        <Footprints className="w-3 h-3" /> Move
      </Button>

      {/* Area color picker — shown when area tool is active */}
      {toolMode === 'area' && (
        <div className="flex items-center gap-1 ml-1 border-l border-border/30 pl-2">
          {AREA_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => setAreaColor(c.id)}
              title={c.label}
              className="w-5 h-5 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c.color,
                borderColor: areaColor === c.id ? 'hsl(var(--foreground))' : 'transparent',
                transform: areaColor === c.id ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
          {highlightedCellCount > 0 && (
            <Button size="sm" variant="ghost" className="text-[10px] h-5 gap-1 ml-1" onClick={onClearArea}>
              <Trash2 className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Spell template controls — shown when spell tool is active */}
      {toolMode === 'spell' && (
        <div className="flex items-center gap-1.5 ml-1 border-l border-border/30 pl-2 flex-wrap">
          <Select value={spellShape} onValueChange={(v) => setSpellShape(v as SpellShape)}>
            <SelectTrigger className="h-6 w-[5rem] text-[10px] border-border/30 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SPELL_SHAPE_LABELS) as SpellShape[]).map(s => (
                <SelectItem key={s} value={s} className="text-[11px]">{SPELL_SHAPE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(spellSizeFt)} onValueChange={(v) => setSpellSizeFt(Number(v))}>
            <SelectTrigger className="h-6 w-[4.5rem] text-[10px] border-border/30 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPELL_SIZE_OPTIONS.map(s => (
                <SelectItem key={s} value={String(s)} className="text-[11px]">{s} ft</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {SPELL_TEMPLATE_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => setSpellColor(c.id)}
              title={c.label}
              className="w-5 h-5 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c.color,
                borderColor: spellColor === c.id ? 'hsl(var(--foreground))' : 'transparent',
                transform: spellColor === c.id ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
          {spellTemplateCount > 0 && (
            <Button size="sm" variant="ghost" className="text-[10px] h-5 gap-1 ml-1" onClick={onClearSpells}>
              <Trash2 className="w-3 h-3" /> Clear All
            </Button>
          )}
        </div>
      )}

      {/* Movement range speed picker */}
      {toolMode === 'move-range' && (
        <div className="flex items-center gap-1.5 ml-1 border-l border-border/30 pl-2">
          <Select value={String(movementSpeedFt)} onValueChange={(v) => setMovementSpeedFt(Number(v))}>
            <SelectTrigger className="h-6 w-[5rem] text-[10px] border-border/30 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOVEMENT_SPEED_OPTIONS.map(s => (
                <SelectItem key={s} value={String(s)} className="text-[11px]">{s} ft</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {moveRangeActive && (
            <span className="text-[9px] text-muted-foreground">Dash: {movementSpeedFt * 2}ft</span>
          )}
        </div>
      )}

      {undoStack.length > 0 && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={onUndo}>
          <Undo2 className="w-3 h-3" /> Undo
        </Button>
      )}

      {/* Background image upload */}
      {onBackgroundUpload && (
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onBackgroundUpload(file);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant={hasBackground ? 'default' : 'outline'}
            className="text-[10px] h-6 gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={backgroundUploading}
          >
            {backgroundUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            {hasBackground ? 'Change' : 'Image'}
          </Button>
          {hasBackground && onClearBackground && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={onClearBackground}>
              <X className="w-3 h-3" />
            </Button>
          )}
          {hasBackground && onBackgroundOpacityChange && (
            <div className="flex items-center gap-1 ml-0.5">
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">{Math.round((backgroundOpacity ?? 1) * 100)}%</span>
              <input
                type="range"
                min="5"
                max="100"
                value={Math.round((backgroundOpacity ?? 1) * 100)}
                onChange={(e) => onBackgroundOpacityChange(Number(e.target.value) / 100)}
                className="w-16 h-4 accent-primary cursor-pointer"
              />
            </div>
          )}
        </div>
      )}

      {toolMode && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => setToolMode(null)}>
          Cancel
        </Button>
      )}
    </div>
  );
}
