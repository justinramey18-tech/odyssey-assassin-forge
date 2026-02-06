import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QueuedAttack, MAX_QUEUE_SIZE } from '@/lib/combat/attackQueue';
import { Enemy } from '@/lib/combat/targetTypes';
import { TargetSelector } from './TargetSelector';
import {
  Sword,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  ArrowUp,
  ArrowDown,
  Play,
  Trash2,
  AlertTriangle,
  ListOrdered,
} from 'lucide-react';

interface AttackQueuePanelProps {
  queue: QueuedAttack[];
  enemies: Enemy[];
  actionEconomy: {
    actionCount: number;
    bonusActionCount: number;
    warnings: string[];
  };
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onUpdateTarget: (id: string, targetId: string | null, targetName: string | null) => void;
  onExecute: () => void;
  onClear: () => void;
}

export function AttackQueuePanel({
  queue,
  enemies,
  actionEconomy,
  onRemove,
  onReorder,
  onUpdateTarget,
  onExecute,
  onClear,
}: AttackQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(queue.length > 0);
  
  const sortedQueue = [...queue].sort((a, b) => a.order - b.order);
  const isEmpty = queue.length === 0;
  
  // Get roll type label
  const getRollTypeLabel = (rollType: 'normal' | 'sneak' | 'assassinate'): string => {
    switch (rollType) {
      case 'sneak': return '+Sneak';
      case 'assassinate': return 'Assassinate!';
      default: return '';
    }
  };
  
  // Get roll type color
  const getRollTypeColor = (rollType: 'normal' | 'sneak' | 'assassinate'): string => {
    switch (rollType) {
      case 'sneak': return 'text-green-400';
      case 'assassinate': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="border border-amber-500/30 bg-amber-500/5 rounded-xl overflow-hidden"
    >
      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-amber-500/10 transition-colors">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-mono text-amber-300">ATTACK QUEUE</span>
          {!isEmpty && (
            <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-200 rounded text-[10px] font-bold">
              {queue.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actionEconomy.warnings.length > 0 && (
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="p-3 pt-0 space-y-3">
          {/* Action Economy Summary */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>⚔️ {actionEconomy.actionCount} Action{actionEconomy.actionCount !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>⚡ {actionEconomy.bonusActionCount} Bonus</span>
          </div>
          
          {/* Warnings */}
          {actionEconomy.warnings.length > 0 && (
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              {actionEconomy.warnings.map((warning, i) => (
                <p key={i} className="text-[11px] text-orange-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {warning}
                </p>
              ))}
            </div>
          )}
          
          {/* Queue List */}
          {isEmpty ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>No attacks queued</p>
              <p className="text-xs mt-1">Tap "Queue" on a weapon to add attacks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQueue.map((attack, index) => (
                <div
                  key={attack.id}
                  className={cn(
                    "p-2 bg-card/50 border rounded-lg flex items-center gap-2",
                    attack.isOffhand ? "border-cyan-500/30" : "border-muted/30"
                  )}
                >
                  {/* Order number */}
                  <span className="w-5 h-5 bg-muted/30 rounded-full flex items-center justify-center text-xs font-mono">
                    {index + 1}
                  </span>
                  
                  {/* Attack info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Sword className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {attack.isOffhand ? `(Off) ` : ''}{attack.weapon.name}
                      </span>
                      {getRollTypeLabel(attack.rollType) && (
                        <span className={cn("text-[10px] font-mono", getRollTypeColor(attack.rollType))}>
                          {getRollTypeLabel(attack.rollType)}
                        </span>
                      )}
                    </div>
                    
                    {/* Target */}
                    <div className="flex items-center gap-1 mt-1">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      {attack.targetName ? (
                        <span className="text-xs text-red-300">{attack.targetName}</span>
                      ) : (
                        <select
                          value={attack.targetId || ''}
                          onChange={(e) => {
                            const targetId = e.target.value || null;
                            const enemy = enemies.find(en => en.id === targetId);
                            onUpdateTarget(attack.id, targetId, enemy?.name || null);
                          }}
                          className="text-xs bg-transparent text-muted-foreground border-none focus:outline-none"
                        >
                          <option value="">Any enemy</option>
                          {enemies.filter(e => e.currentHP > 0).map(enemy => (
                            <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => onReorder(attack.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onReorder(attack.id, 'down')}
                      disabled={index === sortedQueue.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => onRemove(attack.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Action Buttons */}
          {!isEmpty && (
            <div className="flex gap-2">
              <Button
                onClick={onClear}
                variant="outline"
                className="flex-1 h-10 border-muted/40"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={onExecute}
                className="flex-1 h-10 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute All ({queue.length})
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
