import { useState, useCallback } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ActiveCondition,
  NewConditionInput,
  formatDuration,
} from '@/lib/conditions';
import { ConditionCard } from './ConditionCard';
import { AddConditionSheet } from './AddConditionSheet';
import {
  Plus,
  Undo,
  Trash2,
  Moon,
  Sun,
  SkipForward,
  AlertCircle,
  Focus,
  Skull,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConditionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // State
  conditions: ActiveCondition[];
  debuffs: ActiveCondition[];
  buffs: ActiveCondition[];
  concentration: ActiveCondition[];
  hasConcentration: boolean;
  concentrationSpell: ActiveCondition | null;
  activeCount: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  // Undo
  undoBuffer: ActiveCondition | null;
  onUndo: () => void;
  // Actions
  onAddCondition: (input: NewConditionInput) => boolean;
  onRemoveCondition: (id: string) => void;
  onEndTurn: () => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onBreakConcentration: (reason?: string) => void;
  onClearAll: () => void;
}

export function ConditionDrawer({
  open,
  onOpenChange,
  conditions,
  debuffs,
  buffs,
  concentration,
  hasConcentration,
  concentrationSpell,
  activeCount,
  isAtCapacity,
  isNearCapacity,
  undoBuffer,
  onUndo,
  onAddCondition,
  onRemoveCondition,
  onEndTurn,
  onShortRest,
  onLongRest,
  onBreakConcentration,
  onClearAll,
}: ConditionDrawerProps) {
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<ActiveCondition | null>(null);

  const handleConditionTap = useCallback((condition: ActiveCondition) => {
    setSelectedCondition(condition);
    // Could open a detail sheet here
  }, []);

  const SectionHeader = ({
    icon: Icon,
    title,
    count,
    iconColor,
  }: {
    icon: typeof Skull;
    title: string;
    count: number;
    iconColor: string;
  }) => (
    <div className="flex items-center gap-2 py-2">
      <Icon className={cn('w-4 h-4', iconColor)} />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="flex items-center gap-2">
                  Status Board
                  {isNearCapacity && (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                </DrawerTitle>
                <DrawerDescription>
                  {activeCount} active condition{activeCount !== 1 ? 's' : ''}
                </DrawerDescription>
              </div>
              <div className="flex gap-2">
                {undoBuffer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUndo}
                    className="gap-1.5 text-amber-400 border-amber-500/50"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    Undo
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddSheetOpen(true)}
                  disabled={isAtCapacity}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>
          </DrawerHeader>

          <Separator />

          {/* Concentration alert */}
          {hasConcentration && concentrationSpell && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Focus className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">
                    Concentrating: {concentrationSpell.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBreakConcentration()}
                  className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
                >
                  Break
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDuration(
                  concentrationSpell.durationType,
                  concentrationSpell.durationValue
                )}{' '}
                remaining
              </p>
            </div>
          )}

          {/* Conditions list */}
          <ScrollArea className="flex-1 min-h-0 px-4">
            <div className="py-3 space-y-4">
              {/* Debuffs */}
              {debuffs.length > 0 && (
                <div>
                  <SectionHeader
                    icon={Skull}
                    title="Debuffs"
                    count={debuffs.length}
                    iconColor="text-red-400"
                  />
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {debuffs.map(condition => (
                        <motion.div
                          key={condition.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          layout
                        >
                          <ConditionCard
                            condition={condition}
                            onRemove={onRemoveCondition}
                            onTap={handleConditionTap}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Buffs */}
              {buffs.length > 0 && (
                <div>
                  <SectionHeader
                    icon={Sparkles}
                    title="Buffs"
                    count={buffs.length}
                    iconColor="text-emerald-400"
                  />
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {buffs.map(condition => (
                        <motion.div
                          key={condition.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          layout
                        >
                          <ConditionCard
                            condition={condition}
                            onRemove={onRemoveCondition}
                            onTap={handleConditionTap}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Concentration */}
              {concentration.length > 0 && (
                <div>
                  <SectionHeader
                    icon={Focus}
                    title="Concentration"
                    count={concentration.length}
                    iconColor="text-amber-400"
                  />
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {concentration.map(condition => (
                        <motion.div
                          key={condition.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          layout
                        >
                          <ConditionCard
                            condition={condition}
                            onRemove={onRemoveCondition}
                            onTap={handleConditionTap}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {conditions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No active conditions</p>
                  <p className="text-xs mt-1">
                    Tap + to add debuffs, buffs, or concentration effects
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Action buttons */}
          <div className="p-4 space-y-3">
            {/* Turn controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onEndTurn}
                className="flex-1 gap-1.5"
              >
                <SkipForward className="w-4 h-4" />
                End Turn
              </Button>
            </div>

            {/* Rest controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onShortRest}
                className="flex-1 gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                <Sun className="w-4 h-4" />
                Short Rest
              </Button>
              <Button
                variant="outline"
                onClick={onLongRest}
                className="flex-1 gap-1.5 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
              >
                <Moon className="w-4 h-4" />
                Long Rest
              </Button>
            </div>

            {/* Clear all */}
            {conditions.length > 0 && (
              <Button
                variant="ghost"
                onClick={onClearAll}
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear All Conditions
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add condition sheet */}
      <AddConditionSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        onAdd={onAddCondition}
      />
    </>
  );
}
