import { useCallback, useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getIconByName } from '@/lib/iconUtils';
import {
  ActiveCondition,
  ConditionConfig,
  QUICK_PRESETS,
  getConditionById,
  SEVERITY_COLORS,
  NewConditionInput,
} from '@/lib/conditions';
import { Plus, Undo } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConditionCard } from './ConditionCard';

interface ConditionQuickBarProps {
  conditions: ActiveCondition[];
  recentConditions: string[];
  onAddCondition: (input: NewConditionInput) => boolean;
  onRemoveCondition: (id: string) => void;
  onOpenDrawer: () => void;
  undoBuffer: ActiveCondition | null;
  onUndo: () => void;
  className?: string;
}

export function ConditionQuickBar({
  conditions,
  recentConditions,
  onAddCondition,
  onRemoveCondition,
  onOpenDrawer,
  undoBuffer,
  onUndo,
  className,
}: ConditionQuickBarProps) {
  // Quick-apply a preset condition
  const handleQuickApply = useCallback(
    (presetId: string) => {
      const preset = QUICK_PRESETS[presetId];
      const config = getConditionById(preset.conditionId);
      if (!preset || !config) return;

      const input: NewConditionInput = {
        conditionId: config.id,
        name: config.name,
        category: preset.concentration ? 'concentration' : config.category,
        severity: config.severity,
        durationType: preset.durationType,
        durationValue: preset.durationValue,
      };

      onAddCondition(input);
    },
    [onAddCondition]
  );

  // Get suggested quick-add buttons based on recent + common
  const quickAddOptions = useMemo(() => {
    const presetKeys = Object.keys(QUICK_PRESETS);
    
    // Prioritize recent conditions, then fill with common presets
    const orderedIds = [
      ...recentConditions.filter(id => presetKeys.includes(id)),
      ...presetKeys.filter(id => !recentConditions.includes(id)),
    ].slice(0, 6);

    return orderedIds
      .map(id => {
        const preset = QUICK_PRESETS[id];
        const config = getConditionById(preset?.conditionId || id);
        return config ? { id, config } : null;
      })
      .filter((item): item is { id: string; config: ConditionConfig } => item !== null);
  }, [recentConditions]);

  const hasActiveConditions = conditions.length > 0;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Active conditions strip */}
      {hasActiveConditions && (
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2 px-1">
            <AnimatePresence mode="popLayout">
              {conditions.map(condition => (
                <motion.div
                  key={condition.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout
                >
                  <ConditionCard
                    condition={condition}
                    onRemove={onRemoveCondition}
                    compact
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      )}

      {/* Quick-add bar */}
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 pb-2 px-1">
          {/* Open drawer button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDrawer}
            className="h-9 px-3 flex-shrink-0 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">Conditions</span>
          </Button>

          {/* Undo button (shows when undo available) */}
          <AnimatePresence>
            {undoBuffer && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUndo}
                  className="h-9 px-3 flex-shrink-0 gap-1.5 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span className="text-xs">Undo</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick-add chips */}
          {quickAddOptions.map(({ id, config }) => {
            const Icon = getIconByName(config.icon);
            const colors = SEVERITY_COLORS[config.severity];
            const isActive = conditions.some(c => c.conditionId === config.id);

            return (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickApply(id)}
                disabled={isActive}
                className={cn(
                  'h-9 px-2.5 flex-shrink-0 gap-1.5',
                  'border rounded-full',
                  isActive
                    ? 'opacity-50 cursor-not-allowed'
                    : cn(colors.bg, colors.border, 'hover:opacity-80')
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', colors.icon)} />
                <span className={cn('text-xs', colors.text)}>{config.name}</span>
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
