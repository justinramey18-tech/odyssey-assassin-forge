import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ABILITY_ORDER, 
  ABILITY_CONFIG, 
  STANDARD_ARRAY, 
  BaseAbilityScores,
  scoreToModifier,
  modifierToString,
  AbilityName,
} from '@/lib/abilityScores/types';
import { calculateMaxHP, getHPBreakdown } from '@/lib/hpCalculation';
import { cn } from '@/lib/utils';
import { WizardState, ScoreGenerationMethod, StepValidation } from '../types';
import { Dices, ListOrdered, SlidersHorizontal, Wand2, Heart, Info, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ValidationFeedback } from '../ValidationFeedback';
import wizardBackground from '@/assets/wizard-background.jpg';

interface AbilityScoresStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'abilityScores' | 'scoreGenerationMethod'>>) => void;
  validation?: StepValidation;
}

// Assassin-optimized score priority
const ASSASSIN_PRIORITY: AbilityName[] = ['dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'strength'];

export function AbilityScoresStep({ state, onUpdate, validation }: AbilityScoresStepProps) {
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [assignedScores, setAssignedScores] = useState<Record<AbilityName, number | null>>({
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  });
  const [isRolling, setIsRolling] = useState(false);
  const [activeTab, setActiveTab] = useState<ScoreGenerationMethod>(state.scoreGenerationMethod);

  // Calculate HP preview
  const conMod = useMemo(() => scoreToModifier(state.abilityScores.constitution), [state.abilityScores.constitution]);
  const hpBreakdown = useMemo(() => getHPBreakdown(state.level, conMod, 0), [state.level, conMod]);

  // Roll 4d6 drop lowest
  const roll4d6DropLowest = (): number => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls.slice(0, 3).reduce((sum, val) => sum + val, 0);
  };

  const handleRollAll = async () => {
    setIsRolling(true);
    
    // Animate rolling effect
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setRolledScores(prev => {
        const newScores = [...prev];
        newScores[i] = roll4d6DropLowest();
        return newScores;
      });
    }
    
    // Reset assignments
    setAssignedScores({
      strength: null,
      dexterity: null,
      constitution: null,
      intelligence: null,
      wisdom: null,
      charisma: null,
    });
    
    setIsRolling(false);
  };

  const handleAutoAssign = (scores: number[]) => {
    const sortedScores = [...scores].sort((a, b) => b - a);
    const newScores: BaseAbilityScores = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    
    ASSASSIN_PRIORITY.forEach((ability, index) => {
      newScores[ability] = sortedScores[index] || 10;
    });
    
    onUpdate({ abilityScores: newScores, scoreGenerationMethod: activeTab });
  };

  const handleStandardArrayAssign = (ability: AbilityName, score: number) => {
    const newAssigned = { ...assignedScores };
    
    // Remove this score from any other ability
    Object.keys(newAssigned).forEach(key => {
      if (newAssigned[key as AbilityName] === score) {
        newAssigned[key as AbilityName] = null;
      }
    });
    
    // Assign to new ability
    newAssigned[ability] = score;
    setAssignedScores(newAssigned);
    
    // Update wizard state with assigned values
    const newScores: BaseAbilityScores = {
      strength: newAssigned.strength ?? 10,
      dexterity: newAssigned.dexterity ?? 10,
      constitution: newAssigned.constitution ?? 10,
      intelligence: newAssigned.intelligence ?? 10,
      wisdom: newAssigned.wisdom ?? 10,
      charisma: newAssigned.charisma ?? 10,
    };
    onUpdate({ abilityScores: newScores, scoreGenerationMethod: 'standard' });
  };

  const handleManualChange = (ability: AbilityName, value: number) => {
    onUpdate({
      abilityScores: { ...state.abilityScores, [ability]: value },
      scoreGenerationMethod: 'manual',
    });
  };

  const getUnassignedScores = (pool: number[]): number[] => {
    const assigned = Object.values(assignedScores).filter(v => v !== null) as number[];
    const remaining = [...pool];
    assigned.forEach(score => {
      const idx = remaining.indexOf(score);
      if (idx !== -1) remaining.splice(idx, 1);
    });
    return remaining;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      <div className="fixed inset-0 bg-background/50 -z-10" />
      
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-display font-bold text-foreground">Ability Scores</h2>
          <p className="text-sm text-muted-foreground mt-1">Define your character's core attributes</p>
        </div>

        <div className="parchment-bg rounded-lg border border-border p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScoreGenerationMethod)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="standard" className="text-xs">
                <ListOrdered className="w-3 h-3 mr-1" />
                Standard
              </TabsTrigger>
              <TabsTrigger value="roll" className="text-xs">
                <Dices className="w-3 h-3 mr-1" />
                Roll
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs">
                <SlidersHorizontal className="w-3 h-3 mr-1" />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Standard Array */}
            <TabsContent value="standard" className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {getUnassignedScores(STANDARD_ARRAY).map((score, i) => (
                  <div
                    key={`pool-${score}-${i}`}
                    className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center font-display font-bold text-primary"
                  >
                    {score}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {ABILITY_ORDER.map((ability) => {
                  const config = ABILITY_CONFIG[ability];
                  const assigned = assignedScores[ability];
                  const modifier = assigned ? scoreToModifier(assigned) : 0;
                  
                  return (
                    <div
                      key={ability}
                      className={cn(
                        "p-3 rounded-lg border transition-all",
                        assigned 
                          ? "bg-primary/10 border-primary/50" 
                          : "bg-background/50 border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={cn("text-xs font-display uppercase", config.color)}>
                          {config.abbr}
                        </span>
                        {assigned && (
                          <span className="text-lg font-display font-bold text-foreground">
                            {assigned}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({modifierToString(modifier)})
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {STANDARD_ARRAY.map((score) => (
                          <button
                            key={score}
                            onClick={() => handleStandardArrayAssign(ability, score)}
                            disabled={assignedScores[ability] === score}
                            className={cn(
                              "w-7 h-7 text-xs rounded border transition-all",
                              assignedScores[ability] === score
                                ? "bg-primary text-primary-foreground border-primary"
                                : Object.values(assignedScores).includes(score)
                                  ? "bg-muted/50 text-muted-foreground border-border opacity-50"
                                  : "bg-background border-border hover:border-primary hover:bg-primary/10"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleAutoAssign(STANDARD_ARRAY)}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-Assign for Assassin
              </Button>
            </TabsContent>

            {/* Roll 4d6 Drop Lowest */}
            <TabsContent value="roll" className="space-y-4 mt-4">
              <div className="flex justify-center gap-2 mb-4">
                <Button onClick={handleRollAll} disabled={isRolling} size="sm">
                  <Dices className="w-4 h-4 mr-2" />
                  {isRolling ? 'Rolling...' : rolledScores.length > 0 ? 'Reroll All' : 'Roll 4d6 Drop Lowest'}
                </Button>
                {rolledScores.length === 6 && (
                  <Button variant="outline" size="sm" onClick={() => handleAutoAssign(rolledScores)}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Auto-Assign
                  </Button>
                )}
              </div>
              
              {rolledScores.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {getUnassignedScores(rolledScores).map((score, i) => (
                    <div
                      key={`rolled-${score}-${i}`}
                      className="w-12 h-12 rounded-lg bg-primary/20 border-2 border-primary/50 flex items-center justify-center font-display font-bold text-primary text-lg animate-in fade-in duration-300"
                    >
                      {score}
                    </div>
                  ))}
                </div>
              )}
              
              {rolledScores.length === 6 && (
                <div className="grid grid-cols-2 gap-2">
                  {ABILITY_ORDER.map((ability) => {
                    const config = ABILITY_CONFIG[ability];
                    const currentScore = state.abilityScores[ability];
                    const modifier = scoreToModifier(currentScore);
                    
                    return (
                      <div
                        key={ability}
                        className="p-3 rounded-lg border bg-background/50 border-border"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={cn("text-xs font-display uppercase", config.color)}>
                            {config.abbr}
                          </span>
                          <span className="text-lg font-display font-bold text-foreground">
                            {currentScore}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({modifierToString(modifier)})
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rolledScores.map((score, idx) => (
                            <button
                              key={`${ability}-${score}-${idx}`}
                              onClick={() => {
                                const newScores = { ...state.abilityScores, [ability]: score };
                                onUpdate({ abilityScores: newScores, scoreGenerationMethod: 'roll' });
                              }}
                              className={cn(
                                "w-7 h-7 text-xs rounded border transition-all",
                                state.abilityScores[ability] === score
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:border-primary hover:bg-primary/10"
                              )}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {rolledScores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Dices className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click "Roll 4d6 Drop Lowest" to generate your ability scores</p>
                </div>
              )}
            </TabsContent>

            {/* Manual Entry */}
            <TabsContent value="manual" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdate({
                    abilityScores: {
                      strength: 10,
                      dexterity: 10,
                      constitution: 10,
                      intelligence: 10,
                      wisdom: 10,
                      charisma: 10,
                    },
                    scoreGenerationMethod: 'manual',
                  })}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
              
              {ABILITY_ORDER.map((ability) => {
                const config = ABILITY_CONFIG[ability];
                const score = state.abilityScores[ability];
                const modifier = scoreToModifier(score);
                
                return (
                  <div key={ability} className="flex items-center gap-3">
                    <div className={cn("w-12 text-xs font-display uppercase", config.color)}>
                      {config.abbr}
                    </div>
                    <Slider
                      value={[score]}
                      onValueChange={(vals) => handleManualChange(ability, vals[0])}
                      min={3}
                      max={18}
                      step={1}
                      className="flex-1"
                    />
                    <div className="w-16 text-right">
                      <span className="font-display font-bold text-foreground">{score}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({modifierToString(modifier)})
                      </span>
                    </div>
                  </div>
                );
              })}
              
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleAutoAssign(STANDARD_ARRAY)}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Apply Assassin Build
              </Button>
            </TabsContent>
          </Tabs>

          {/* HP Preview */}
          <div className="bg-background/30 rounded-md p-3 border border-border/50 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-destructive" />
                <span className="text-xs font-display uppercase text-muted-foreground">
                  Starting HP
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">HP Breakdown:</p>
                        <p>Base (d8): {hpBreakdown.baseHP}</p>
                        {hpBreakdown.levelHP > 0 && <p>Level bonus: +{hpBreakdown.levelHP}</p>}
                        <p>CON bonus: {hpBreakdown.constitutionHP >= 0 ? '+' : ''}{hpBreakdown.constitutionHP}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-2xl font-display font-bold text-destructive">
                {hpBreakdown.totalHP}
              </span>
            </div>
          </div>

          {/* Validation Feedback */}
          {validation && (validation.warnings.length > 0 || validation.errors.length > 0) && (
            <ValidationFeedback validation={validation} compact className="mt-3" />
          )}
        </div>
      </div>
    </div>
  );
}
