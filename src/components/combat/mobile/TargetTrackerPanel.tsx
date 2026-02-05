import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Enemy, getHealthStatus, MAX_ENEMIES } from '@/lib/combat/targetTypes';
import { EnemyCard } from './EnemyCard';
import { AddEnemySheet } from './AddEnemySheet';
import { UseTargetsReturn } from '@/hooks/use-targets';
import {
  Target,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Shield,
  Users,
} from 'lucide-react';

interface TargetTrackerPanelProps {
  targets: UseTargetsReturn;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function TargetTrackerPanel({
  targets,
  isCollapsed,
  onCollapsedChange,
}: TargetTrackerPanelProps) {
  const [showAddSheet, setShowAddSheet] = useState(false);

  const {
    enemies,
    currentTarget,
    currentTargetId,
    addEnemy,
    removeEnemy,
    updateEnemy,
    setCurrentTarget,
    dealDamage,
    healEnemy,
    clearAll,
    enemyCount,
    defeatedCount,
    activeEnemies,
  } = targets;

  // Calculate HP percent for current target
  const targetHpPercent = currentTarget && currentTarget.maxHP > 0
    ? (currentTarget.currentHP / currentTarget.maxHP) * 100
    : 0;

  const targetHealthStatus = currentTarget
    ? getHealthStatus(currentTarget.currentHP, currentTarget.maxHP)
    : null;

  // Collapsed state
  if (isCollapsed) {
    return (
      <>
        <button
          onClick={() => onCollapsedChange(false)}
          className="w-full h-[60px] bg-background/95 backdrop-blur-sm border-b border-red-900/30 flex items-center justify-between px-4"
        >
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-red-400" />
            {currentTarget ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{currentTarget.name}</span>
                <span className={cn("text-xs font-mono", targetHealthStatus?.color)}>
                  {currentTarget.currentHP}/{currentTarget.maxHP}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {currentTarget.ac}
                </span>
              </div>
            ) : enemyCount > 0 ? (
              <span className="text-sm text-muted-foreground">
                {activeEnemies.length} active / {defeatedCount} defeated
              </span>
            ) : (
              <span className="text-sm text-muted-foreground font-mono">
                No enemies tracked
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {enemyCount > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                {enemyCount}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
        
        <AddEnemySheet
          open={showAddSheet}
          onOpenChange={setShowAddSheet}
          onAddEnemy={addEnemy}
          currentEnemyCount={enemyCount}
          maxEnemies={MAX_ENEMIES}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-background/95 backdrop-blur-sm border-b border-red-900/30 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            <span className="text-xs font-mono text-red-400 uppercase tracking-wider">
              Enemies in Combat
            </span>
            {enemyCount > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                {activeEnemies.length} active
              </span>
            )}
          </div>
          <button
            onClick={() => onCollapsedChange(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>

        {/* Current Target Quick View (if any) */}
        {currentTarget && currentTarget.currentHP > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                <span className="font-semibold">{currentTarget.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-mono", targetHealthStatus?.color)}>
                  {targetHealthStatus?.label}
                </span>
                <span className="text-sm bg-muted/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {currentTarget.ac}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={targetHpPercent}
                className={cn(
                  "h-3 flex-1",
                  targetHpPercent <= 25 
                    ? "[&>div]:bg-red-500" 
                    : targetHpPercent <= 50 
                      ? "[&>div]:bg-orange-500"
                      : "[&>div]:bg-green-500"
                )}
              />
              <span className="text-sm font-mono font-bold text-foreground shrink-0">
                {currentTarget.currentHP}/{currentTarget.maxHP}
              </span>
            </div>
          </div>
        )}

        {/* Enemy List */}
        {enemyCount > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {enemies.map(enemy => (
              <EnemyCard
                key={enemy.id}
                enemy={enemy}
                isCurrentTarget={enemy.id === currentTargetId}
                onSelect={() => setCurrentTarget(enemy.id)}
                onDealDamage={(amount) => dealDamage(enemy.id, amount)}
                onHeal={(amount) => healEnemy(enemy.id, amount)}
                onRemove={() => removeEnemy(enemy.id)}
                onUpdate={(updates) => updateEnemy(enemy.id, updates)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No enemies tracked yet</p>
            <p className="text-xs mt-1">Add enemies to include them in AI DM prompts</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAddSheet(true)}
            disabled={enemyCount >= MAX_ENEMIES}
            className="flex-1 h-12 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Enemy
          </Button>
          
          {enemyCount > 0 && (
            <Button
              variant="outline"
              onClick={clearAll}
              className="h-12 px-4 border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <AddEnemySheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onAddEnemy={addEnemy}
        currentEnemyCount={enemyCount}
        maxEnemies={MAX_ENEMIES}
      />
    </>
  );
}
