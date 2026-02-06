import { cn } from '@/lib/utils';
import { Enemy, getHealthStatus } from '@/lib/combat/targetTypes';
import { Target, X } from 'lucide-react';

interface TargetSelectorProps {
  enemies: Enemy[];
  selectedTargetId: string | null;
  onSelectTarget: (targetId: string | null, targetName: string | null) => void;
  className?: string;
  compact?: boolean;
}

export function TargetSelector({
  enemies,
  selectedTargetId,
  onSelectTarget,
  className,
  compact = false,
}: TargetSelectorProps) {
  const activeEnemies = enemies.filter(e => e.currentHP > 0);
  
  if (activeEnemies.length === 0 && !compact) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <Target className="w-4 h-4" />
        <span>No enemies tracked</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto scrollbar-none", className)}>
      <div className="flex items-center gap-1 shrink-0">
        <Target className="w-4 h-4 text-red-400" />
        {!compact && <span className="text-[10px] text-muted-foreground uppercase">Target:</span>}
      </div>
      
      <div className="flex gap-1.5 flex-nowrap">
        {/* No target option */}
        <button
          onClick={() => onSelectTarget(null, null)}
          className={cn(
            "px-2 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-all active:scale-95",
            selectedTargetId === null
              ? "bg-muted/50 text-foreground ring-1 ring-muted"
              : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
          )}
        >
          Any
        </button>
        
        {/* Enemy chips */}
        {activeEnemies.map(enemy => {
          const isSelected = selectedTargetId === enemy.id;
          const healthStatus = getHealthStatus(enemy.currentHP, enemy.maxHP);
          
          return (
            <button
              key={enemy.id}
              onClick={() => onSelectTarget(enemy.id, enemy.name)}
              className={cn(
                "px-2 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-all active:scale-95 flex items-center gap-1",
                isSelected
                  ? "bg-red-500/30 text-red-200 ring-1 ring-red-500/50"
                  : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
              )}
            >
              {/* Health indicator dot */}
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                healthStatus.label === 'Dead' ? 'bg-gray-500' :
                healthStatus.label === 'Critical' ? 'bg-red-500' :
                healthStatus.label === 'Bloodied' ? 'bg-orange-500' :
                'bg-green-500'
              )} />
              {enemy.name}
              {isSelected && <span className="text-green-400">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact inline target selector for weapon cards
 */
export function InlineTargetSelector({
  enemies,
  selectedTargetId,
  onSelectTarget,
  className,
}: Omit<TargetSelectorProps, 'compact'>) {
  const activeEnemies = enemies.filter(e => e.currentHP > 0);
  const selectedEnemy = enemies.find(e => e.id === selectedTargetId);
  
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Target className="w-3.5 h-3.5 text-red-400" />
      
      {selectedEnemy ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-300 font-mono">{selectedEnemy.name}</span>
          <button
            onClick={() => onSelectTarget(null, null)}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : activeEnemies.length > 0 ? (
        <select
          value={selectedTargetId || ''}
          onChange={(e) => {
            const targetId = e.target.value || null;
            const enemy = enemies.find(en => en.id === targetId);
            onSelectTarget(targetId, enemy?.name || null);
          }}
          className="bg-transparent text-xs text-muted-foreground border-none focus:outline-none cursor-pointer"
        >
          <option value="">Select target...</option>
          {activeEnemies.map(enemy => (
            <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-muted-foreground">No targets</span>
      )}
    </div>
  );
}
