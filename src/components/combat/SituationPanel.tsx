import { useState } from 'react';
import { 
  COMBAT_SCENARIOS, 
  COMBAT_CONDITIONS, 
  ActiveEffect,
  CombatScenario 
} from '@/lib/combat/combatTypes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  Plus, 
  X, 
  Target,
  Hexagon,
  Save,
  Sparkles
} from 'lucide-react';
import '../combat/CombatHUDStyles.css';

interface SituationPanelProps {
  conditions: string[];
  onConditionsChange: (conditions: string[]) => void;
  activeEffects: ActiveEffect[];
  onActiveEffectsChange: (effects: ActiveEffect[]) => void;
}

export function SituationPanel({
  conditions,
  onConditionsChange,
  activeEffects,
  onActiveEffectsChange,
}: SituationPanelProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('standard');
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [newEffectName, setNewEffectName] = useState('');
  const [customScenarios, setCustomScenarios] = useState<CombatScenario[]>([]);

  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const allScenarios = [...COMBAT_SCENARIOS, ...customScenarios];
    const scenario = allScenarios.find(s => s.id === scenarioId);
    if (scenario) {
      onConditionsChange(scenario.conditions);
    }
  };

  const toggleCondition = (conditionId: string) => {
    if (conditions.includes(conditionId)) {
      onConditionsChange(conditions.filter(c => c !== conditionId));
    } else {
      onConditionsChange([...conditions, conditionId]);
    }
    // Reset to custom when manually toggling
    setSelectedScenario('custom');
  };

  const addEffect = () => {
    if (!newEffectName.trim()) return;
    const newEffect: ActiveEffect = {
      id: `effect_${Date.now()}`,
      name: newEffectName.trim(),
      description: '',
    };
    onActiveEffectsChange([...activeEffects, newEffect]);
    setNewEffectName('');
  };

  const removeEffect = (effectId: string) => {
    onActiveEffectsChange(activeEffects.filter(e => e.id !== effectId));
  };

  const saveCurrentAsScenario = () => {
    const name = prompt('Enter scenario name:');
    if (!name) return;
    const newScenario: CombatScenario = {
      id: `custom_${Date.now()}`,
      name,
      conditions: [...conditions],
    };
    setCustomScenarios(prev => [...prev, newScenario]);
    setSelectedScenario(newScenario.id);
  };

  const allScenarios = [...COMBAT_SCENARIOS, ...customScenarios];

  return (
    <div className="hud-panel">
      <div className="hud-panel-header mb-3">
        <Target className="w-4 h-4" />
        <span>TACTICAL SITUATION</span>
        <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent ml-2" />
        <span className="text-[9px] text-red-400 font-mono italic">
          "Set the scene, genius"
        </span>
      </div>

      {/* Scenario Selector */}
      <div className="flex gap-2 items-center mb-3">
        <Select value={selectedScenario} onValueChange={handleScenarioChange}>
          <SelectTrigger className="flex-1 h-8 bg-black/40 border-red-900/40 text-sm">
            <SelectValue placeholder="Select Scenario" />
          </SelectTrigger>
          <SelectContent className="bg-background border-red-900/40">
            {allScenarios.map(scenario => (
              <SelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </SelectItem>
            ))}
            <SelectItem value="custom" disabled>
              <span className="text-muted-foreground">Custom Configuration</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={saveCurrentAsScenario}
          className="h-8 px-2 border border-red-900/40 hover:bg-red-600/20"
        >
          <Save className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Condition Toggles - 2 rows */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {COMBAT_CONDITIONS.slice(0, 4).map(condition => (
            <ConditionToggle
              key={condition.id}
              condition={condition}
              checked={conditions.includes(condition.id)}
              onToggle={() => toggleCondition(condition.id)}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {COMBAT_CONDITIONS.slice(4).map(condition => (
            <ConditionToggle
              key={condition.id}
              condition={condition}
              checked={conditions.includes(condition.id)}
              onToggle={() => toggleCondition(condition.id)}
            />
          ))}
        </div>
      </TooltipProvider>

      {/* Active Effects - Collapsible */}
      <Collapsible open={effectsOpen} onOpenChange={setEffectsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between py-2 px-3 bg-black/30 border border-red-900/30 rounded text-xs hover:bg-red-600/10 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-muted-foreground">ACTIVE EFFECTS</span>
              {activeEffects.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                  {activeEffects.length}
                </span>
              )}
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              effectsOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2">
            {/* Existing effects */}
            {activeEffects.map(effect => (
              <div
                key={effect.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded"
              >
                <Hexagon className="w-3 h-3 text-amber-400" />
                <span className="flex-1 text-xs text-amber-200">{effect.name}</span>
                <button
                  onClick={() => removeEffect(effect.id)}
                  className="p-0.5 hover:bg-red-500/30 rounded"
                >
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            
            {/* Add new effect */}
            <div className="flex gap-2">
              <Input
                value={newEffectName}
                onChange={(e) => setNewEffectName(e.target.value)}
                placeholder="Blessed, Invisible, etc..."
                className="flex-1 h-7 text-xs bg-black/30 border-muted/30"
                onKeyDown={(e) => e.key === 'Enter' && addEffect()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={addEffect}
                className="h-7 px-2 border border-muted/30 hover:bg-muted/20"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Individual condition toggle component
function ConditionToggle({
  condition,
  checked,
  onToggle,
}: {
  condition: { id: string; label: string; tooltip: string; mechanical: string };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label 
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all border",
            checked 
              ? "bg-green-500/20 border-green-500/50 text-green-300" 
              : "bg-black/20 border-muted/20 text-muted-foreground hover:border-muted/40"
          )}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={onToggle}
            className={cn(
              "h-3.5 w-3.5",
              checked && "border-green-500 data-[state=checked]:bg-green-600"
            )}
          />
          <span className="text-[10px] font-mono leading-tight">{condition.label}</span>
        </label>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="font-semibold text-xs">{condition.tooltip}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{condition.mechanical}</p>
      </TooltipContent>
    </Tooltip>
  );
}
