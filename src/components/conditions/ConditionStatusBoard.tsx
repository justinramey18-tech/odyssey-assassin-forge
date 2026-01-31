import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  Plus,
  Skull,
  Sparkles,
  Trash2,
  SkipForward,
  MessageCircle,
  Coffee,
  Moon,
  Activity,
} from 'lucide-react';
import { ActiveCondition } from '@/lib/conditions/types';
import { ConditionCard } from './ConditionCard';
import { AddConditionSheet } from './AddConditionSheet';
import { Personality } from '@/components/oracle/types';
import './ConditionStyles.css';

interface ConditionStatusBoardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Condition data and actions from useConditions hook
  activeConditions: ActiveCondition[];
  activeBuffs: ActiveCondition[];
  hasCriticalCondition: boolean;
  onAddCondition: (params: {
    conditionId: string;
    name?: string;
    source?: string;
    durationType: 'rounds' | 'minutes' | 'hours' | 'save_ends' | 'indefinite';
    durationValue: number;
    isConcentration?: boolean;
    notes?: string;
  }) => void;
  onRemoveCondition: (id: string) => void;
  onAdjustDuration: (id: string, delta: number) => void;
  onHandleSave: (id: string, success: boolean) => void;
  onTickRounds: (rounds?: number) => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onClearAll: () => void;
  // Oracle integration
  personality?: Personality;
  onAskOracle?: () => void;
}

export function ConditionStatusBoard({
  open,
  onOpenChange,
  activeConditions,
  activeBuffs,
  hasCriticalCondition,
  onAddCondition,
  onRemoveCondition,
  onAdjustDuration,
  onHandleSave,
  onTickRounds,
  onShortRest,
  onLongRest,
  onClearAll,
  personality = 'deadpool',
  onAskOracle,
}: ConditionStatusBoardProps) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  
  const totalActive = activeConditions.length + activeBuffs.length;
  const criticalCount = activeConditions.filter(c => c.severity === 'critical').length;
  
  // Quick stats text
  const statusText = totalActive === 0
    ? 'No active conditions'
    : `${totalActive} Active${criticalCount > 0 ? ` · ${criticalCount} Critical` : ''}`;
  
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className={cn(
            "w-[90vw] max-w-[400px] p-0 flex flex-col",
            "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
            hasCriticalCondition && "border-r-2 border-red-500/50"
          )}
        >
          {/* Header */}
          <SheetHeader className="p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 font-cinzel">
                <Activity className={cn(
                  "w-5 h-5",
                  hasCriticalCondition ? "text-red-400 animate-pulse" : "text-amber-400"
                )} />
                <span className={hasCriticalCondition ? "text-red-400" : "text-amber-400"}>
                  Condition Status
                </span>
              </SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {statusText}
            </p>
          </SheetHeader>
          
          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 p-3 border-b border-white/10 shrink-0 overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSheet(true)}
              className="shrink-0 border-amber-500/50 hover:bg-amber-500/20"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTickRounds(1)}
              className="shrink-0"
              disabled={totalActive === 0}
            >
              <SkipForward className="w-4 h-4 mr-1" />
              End Turn
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onShortRest}
              className="shrink-0 border-cyan-500/50 hover:bg-cyan-500/20"
            >
              <Coffee className="w-4 h-4 mr-1" />
              Short
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onLongRest}
              className="shrink-0 border-blue-500/50 hover:bg-blue-500/20"
            >
              <Moon className="w-4 h-4 mr-1" />
              Long
            </Button>
          </div>
          
          {/* Scrollable Content */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
              {/* Active Debuffs */}
              {activeConditions.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-xs font-mono text-red-400 mb-3">
                    <Skull className="w-4 h-4" />
                    ACTIVE CONDITIONS
                  </h3>
                  <div className="space-y-3">
                    {activeConditions.map(condition => (
                      <ConditionCard
                        key={condition.id}
                        condition={condition}
                        personality={personality}
                        onRemove={() => onRemoveCondition(condition.id)}
                        onAdjustDuration={(delta) => onAdjustDuration(condition.id, delta)}
                        onSaveResult={
                          condition.duration.type === 'save_ends'
                            ? (success) => onHandleSave(condition.id, success)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Active Buffs */}
              {activeBuffs.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-xs font-mono text-green-400 mb-3">
                    <Sparkles className="w-4 h-4" />
                    ACTIVE BUFFS
                  </h3>
                  <div className="space-y-3">
                    {activeBuffs.map(condition => (
                      <ConditionCard
                        key={condition.id}
                        condition={condition}
                        personality={personality}
                        onRemove={() => onRemoveCondition(condition.id)}
                        onAdjustDuration={(delta) => onAdjustDuration(condition.id, delta)}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Empty State */}
              {totalActive === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No active conditions or buffs
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Tap "Add" to apply a condition
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Footer Actions */}
          <div className="p-3 border-t border-white/10 shrink-0 flex gap-2">
            {onAskOracle && (
              <Button
                variant="outline"
                className="flex-1 border-purple-500/50 hover:bg-purple-500/20"
                onClick={onAskOracle}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Ask Oracle
              </Button>
            )}
            
            {totalActive > 0 && (
              <Button
                variant="outline"
                className="border-red-500/50 hover:bg-red-500/20 text-red-400"
                onClick={onClearAll}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Add Condition Sheet */}
      <AddConditionSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onAdd={onAddCondition}
      />
    </>
  );
}
