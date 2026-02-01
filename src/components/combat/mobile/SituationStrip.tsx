import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ChevronDown, 
  ChevronUp,
  Target,
  Pencil,
  Save,
  Activity
} from 'lucide-react';
import { 
  COMBAT_CONDITIONS, 
  COMBAT_SCENARIOS,
  CombatScenario 
} from '@/lib/combat/combatTypes';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ConditionQuickBar } from '@/components/conditions';
import { usePromptDrawers } from '@/components/drawers';

interface SituationStripProps {
  conditions: string[];
  onConditionsChange: (conditions: string[]) => void;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function SituationStrip({
  conditions,
  onConditionsChange,
  isCollapsed,
  onCollapsedChange,
}: SituationStripProps) {
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('standard');
  
  // Access drawer context for conditions system
  let drawerContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    drawerContext = usePromptDrawers();
  } catch {
    // Not inside PromptDrawerProvider
  }
  
  const conditionsSystem = drawerContext?.conditions;

  const handleScenarioSelect = (scenario: CombatScenario) => {
    setSelectedScenario(scenario.id);
    onConditionsChange(scenario.conditions);
    setShowScenarioPicker(false);
  };

  const toggleCondition = (conditionId: string) => {
    if (conditions.includes(conditionId)) {
      onConditionsChange(conditions.filter(c => c !== conditionId));
    } else {
      onConditionsChange([...conditions, conditionId]);
    }
    setSelectedScenario('custom');
  };

  // Get active condition labels for collapsed view
  const activeLabels = conditions
    .map(c => COMBAT_CONDITIONS.find(cc => cc.id === c)?.label)
    .filter(Boolean);

  // Collapsed state
  if (isCollapsed) {
    return (
      <button
        onClick={() => onCollapsedChange(false)}
        className="sticky top-16 z-40 w-full h-[60px] bg-background/95 backdrop-blur-sm border-b border-red-900/30 flex items-center justify-between px-4"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-red-400" />
          <span className="text-sm font-mono text-muted-foreground">
            {activeLabels.length > 0 
              ? activeLabels.slice(0, 2).join(' + ') + (activeLabels.length > 2 ? ` +${activeLabels.length - 2}` : '')
              : 'Standard Combat'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">[Edit]</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
    );
  }

  return (
    <>
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-red-900/30 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            <span className="text-xs font-mono text-red-400">TACTICAL SITUATION</span>
          </div>
          <button
            onClick={() => onCollapsedChange(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>

        {/* Scenario Selector - Full Width Touch Target */}
        <button
          onClick={() => setShowScenarioPicker(true)}
          className="w-full h-12 flex items-center justify-between px-4 bg-black/40 border border-red-900/40 rounded-lg active:scale-[0.99] transition-transform"
        >
          <span className="text-sm">
            {COMBAT_SCENARIOS.find(s => s.id === selectedScenario)?.name || 'Custom Configuration'}
          </span>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Condition Toggles - Large Touch Targets */}
        <div className="grid grid-cols-2 gap-2">
          {COMBAT_CONDITIONS.slice(0, 4).map(condition => (
            <ConditionButton
              key={condition.id}
              condition={condition}
              checked={conditions.includes(condition.id)}
              onToggle={() => toggleCondition(condition.id)}
            />
          ))}
        </div>

        {/* Second Row - More Conditions */}
        <div className="grid grid-cols-2 gap-2">
          {COMBAT_CONDITIONS.slice(4).map(condition => (
            <ConditionButton
              key={condition.id}
              condition={condition}
              checked={conditions.includes(condition.id)}
              onToggle={() => toggleCondition(condition.id)}
            />
          ))}
        </div>

        {/* Status Conditions Quick Bar (debuffs/buffs from conditions system) */}
        {conditionsSystem && (
          <div className="pt-2 border-t border-red-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">
                Status Effects
              </span>
              {conditionsSystem.activeCount > 0 && (
                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                  {conditionsSystem.activeCount}
                </span>
              )}
            </div>
            <ConditionQuickBar
              conditions={conditionsSystem.conditions}
              recentConditions={conditionsSystem.recentConditions}
              onAddCondition={conditionsSystem.addCondition}
              onRemoveCondition={conditionsSystem.removeCondition}
              onOpenDrawer={drawerContext?.openConditionsDrawer ?? (() => {})}
              undoBuffer={conditionsSystem.undoBuffer}
              onUndo={conditionsSystem.undoRemove}
            />
          </div>
        )}
      </div>

      {/* Scenario Picker Bottom Sheet */}
      <Sheet open={showScenarioPicker} onOpenChange={setShowScenarioPicker}>
        <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-cinzel text-red-400">Select Scenario</SheetTitle>
            <SheetDescription>
              Choose a preset or configure your own conditions
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 mt-4">
            {COMBAT_SCENARIOS.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => handleScenarioSelect(scenario)}
                className={cn(
                  "w-full h-14 flex items-center justify-between px-4 rounded-lg border transition-all active:scale-[0.99]",
                  selectedScenario === scenario.id
                    ? "bg-red-500/20 border-red-500/50 text-red-300"
                    : "bg-muted/10 border-muted/30 hover:border-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2",
                    selectedScenario === scenario.id
                      ? "border-red-400 bg-red-400"
                      : "border-muted-foreground"
                  )} />
                  <span className="text-sm">{scenario.name}</span>
                </div>
                {scenario.conditions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {scenario.conditions.length} conditions
                  </span>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ConditionButton({
  condition,
  checked,
  onToggle,
}: {
  condition: { id: string; label: string; tooltip: string };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "h-14 flex items-center gap-3 px-3 rounded-lg border transition-all active:scale-[0.98]",
        checked
          ? "bg-green-500/20 border-green-500/50 text-green-300"
          : "bg-black/20 border-muted/20 text-muted-foreground hover:border-muted/40"
      )}
    >
      <Checkbox
        checked={checked}
        className={cn(
          "h-5 w-5 rounded",
          checked && "border-green-500 data-[state=checked]:bg-green-600"
        )}
      />
      <span className="text-xs font-mono leading-tight text-left flex-1">
        {condition.label}
      </span>
    </button>
  );
}
