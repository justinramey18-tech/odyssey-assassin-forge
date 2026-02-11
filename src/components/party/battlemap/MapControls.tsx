import { Plus, X, Ruler, Paintbrush, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type MapMarker, type ToolMode, type UndoAction } from './types';

interface MapControlsProps {
  myMarker: MapMarker | undefined;
  addingEnemy: boolean;
  enemyName: string;
  toolMode: ToolMode;
  undoStack: UndoAction[];
  setAddingEnemy: (v: boolean) => void;
  setEnemyName: (v: string) => void;
  setToolMode: (v: ToolMode) => void;
  onUndo: () => void;
}

export function MapControls({
  myMarker, addingEnemy, enemyName, toolMode,
  undoStack, setAddingEnemy, setEnemyName, setToolMode, onUndo,
}: MapControlsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
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
        <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 text-red-400 border-red-400/30" onClick={() => setAddingEnemy(true)}>
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
