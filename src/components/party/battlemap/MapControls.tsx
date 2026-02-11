import { Plus, X, Ruler, Paintbrush, Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type MapMarker, type ToolMode, type UndoAction, type AreaColorId, AREA_COLORS } from './types';

interface MapControlsProps {
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  enemyName: string;
  toolMode: ToolMode;
  undoStack: UndoAction[];
  areaColor: AreaColorId;
  highlightedCellCount: number;
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  setToolMode: (v: ToolMode) => void;
  setAreaColor: (v: AreaColorId) => void;
  onUndo: () => void;
  onClearArea: () => void;
}

export function MapControls({
  myMarker, addingEnemy, enemyName, toolMode,
  undoStack, areaColor, highlightedCellCount,
  setAddingEnemy, setEnemyName, setToolMode, setAreaColor, onUndo, onClearArea,
}: MapControlsProps) {
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

      {undoStack.length > 0 && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={onUndo}>
          <Undo2 className="w-3 h-3" /> Undo
        </Button>
      )}
      {toolMode && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => setToolMode(null)}>
          Cancel
        </Button>
      )}
    </div>
  );
}
