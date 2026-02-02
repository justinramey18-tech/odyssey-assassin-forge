import { useState } from 'react';
import { Dices, LayoutGrid, Plus, Minus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AbilityName, 
  ABILITY_CONFIG, 
  ABILITY_ORDER,
  STANDARD_ARRAY,
  modifierToString,
  BaseAbilityScores,
  AbilityScoreBreakdown,
} from '@/lib/abilityScores/types';
import { getIconByName } from '@/lib/iconUtils';

interface AbilityScoresPanelProps {
  baseScores: BaseAbilityScores;
  getScoreBreakdown: (ability: AbilityName) => AbilityScoreBreakdown;
  onIncrementScore: (ability: AbilityName) => void;
  onDecrementScore: (ability: AbilityName) => void;
  onRandomizeScores: () => number[];
  onApplyScores: (scores: BaseAbilityScores) => void;
}

export function AbilityScoresPanel({
  baseScores,
  getScoreBreakdown,
  onIncrementScore,
  onDecrementScore,
  onRandomizeScores,
  onApplyScores,
}: AbilityScoresPanelProps) {
  const [isRandomizeOpen, setIsRandomizeOpen] = useState(false);
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [scoreAssignments, setScoreAssignments] = useState<Record<AbilityName, number | null>>({
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  });

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' = 'light') => {
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'light' ? 10 : 25);
    }
  };

  const handleRoll = () => {
    const scores = onRandomizeScores();
    setRolledScores(scores);
    // Reset assignments
    setScoreAssignments({
      strength: null,
      dexterity: null,
      constitution: null,
      intelligence: null,
      wisdom: null,
      charisma: null,
    });
    triggerHaptic('medium');
    toast.success('🎲 Rolled new scores!');
  };

  const handleApplyRandomized = () => {
    // Check if all abilities are assigned
    const allAssigned = ABILITY_ORDER.every(ability => scoreAssignments[ability] !== null);
    if (!allAssigned) {
      toast.error('Assign a score to each ability');
      return;
    }

    const newScores: BaseAbilityScores = {
      strength: scoreAssignments.strength!,
      dexterity: scoreAssignments.dexterity!,
      constitution: scoreAssignments.constitution!,
      intelligence: scoreAssignments.intelligence!,
      wisdom: scoreAssignments.wisdom!,
      charisma: scoreAssignments.charisma!,
    };

    onApplyScores(newScores);
    setIsRandomizeOpen(false);
    toast.success('Ability scores applied!');
    triggerHaptic('medium');
  };

  const handleApplyStandardArray = () => {
    // Quick-apply standard array in order: highest to STR, DEX, CON, etc.
    const sorted = [...STANDARD_ARRAY].sort((a, b) => b - a);
    const newScores: BaseAbilityScores = {
      strength: sorted[0],
      dexterity: sorted[1],
      constitution: sorted[2],
      intelligence: sorted[3],
      wisdom: sorted[4],
      charisma: sorted[5],
    };
    onApplyScores(newScores);
    toast.success('Standard array applied (15, 14, 13, 12, 10, 8)');
    triggerHaptic('medium');
  };

  // Get available scores for dropdown (not already assigned)
  const getAvailableScores = (currentAbility: AbilityName): number[] => {
    const usedScores = ABILITY_ORDER
      .filter(a => a !== currentAbility && scoreAssignments[a] !== null)
      .map(a => scoreAssignments[a]!);
    
    return rolledScores.filter(score => {
      const usedCount = usedScores.filter(s => s === score).length;
      const totalCount = rolledScores.filter(s => s === score).length;
      return usedCount < totalCount;
    });
  };

  return (
    <div className="space-y-3">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Ability Scores
        </h3>
        <div className="flex gap-2">
          <Sheet open={isRandomizeOpen} onOpenChange={setIsRandomizeOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                <Dices className="w-3 h-3" />
                Roll
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Dices className="w-5 h-5 text-amber-400" />
                  Randomize Ability Scores
                </SheetTitle>
              </SheetHeader>
              
              <ScrollArea className="h-[calc(70vh-160px)] mt-4">
                <div className="space-y-6 pr-2">
                  {/* Roll button */}
                  <div className="flex flex-col items-center gap-4">
                    <Button 
                      onClick={handleRoll} 
                      className="gap-2 bg-amber-600 hover:bg-amber-700"
                    >
                      <Dices className="w-4 h-4" />
                      Roll 4d6 Drop Lowest (×6)
                    </Button>
                    
                    {/* Rolled scores display */}
                    {rolledScores.length > 0 && (
                      <div className="flex gap-2 flex-wrap justify-center">
                        {rolledScores.map((score, idx) => (
                          <div 
                            key={idx}
                            className="w-12 h-12 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 flex items-center justify-center"
                          >
                            <span className="text-xl font-bold text-amber-400">{score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment dropdowns */}
                  {rolledScores.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground text-center">
                        Assign each score to an ability:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {ABILITY_ORDER.map(ability => {
                          const config = ABILITY_CONFIG[ability];
                          const Icon = getIconByName(config.icon);
                          const available = getAvailableScores(ability);
                          
                          return (
                            <div 
                              key={ability}
                              className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                            >
                              <Icon className={cn("w-4 h-4", config.color)} />
                              <span className="text-xs font-medium w-8">{config.abbr}</span>
                              <Select
                                value={scoreAssignments[ability]?.toString() ?? ''}
                                onValueChange={(val) => {
                                  setScoreAssignments(prev => ({
                                    ...prev,
                                    [ability]: val ? parseInt(val) : null,
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 w-16">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {available.map((score, idx) => (
                                    <SelectItem key={`${score}-${idx}`} value={score.toString()}>
                                      {score}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <SheetFooter className="mt-4">
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button 
                  onClick={handleApplyRandomized}
                  disabled={rolledScores.length === 0 || !ABILITY_ORDER.every(a => scoreAssignments[a] !== null)}
                  className="bg-primary"
                >
                  Apply Scores
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button 
            size="sm" 
            variant="outline" 
            className="gap-1 h-7 text-xs"
            onClick={handleApplyStandardArray}
          >
            <LayoutGrid className="w-3 h-3" />
            Array
          </Button>
        </div>
      </div>

      {/* Ability score rows */}
      <div className="space-y-2">
        {ABILITY_ORDER.map(ability => {
          const config = ABILITY_CONFIG[ability];
          const breakdown = getScoreBreakdown(ability);
          const Icon = getIconByName(config.icon);
          
          return (
            <div 
              key={ability}
              className="flex items-center gap-2 p-2 rounded-lg border bg-card/50"
            >
              {/* Icon and name */}
              <div className="flex items-center gap-2 w-24">
                <Icon className={cn("w-4 h-4", config.color)} />
                <span className="text-xs font-semibold uppercase">{config.abbr}</span>
              </div>
              
              {/* Base score with +/- buttons */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    onDecrementScore(ability);
                    triggerHaptic();
                  }}
                  disabled={baseScores[ability] <= 1}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-6 text-center font-mono text-sm">
                  {breakdown.base}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    onIncrementScore(ability);
                    triggerHaptic();
                  }}
                  disabled={baseScores[ability] >= 30}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Gear bonus */}
              {breakdown.gearBonus !== 0 && (
                <span className="text-xs text-cyan-400 font-mono">
                  {breakdown.gearBonus > 0 ? '+' : ''}{breakdown.gearBonus} gear
                </span>
              )}
              
              {/* Spacer */}
              <div className="flex-1" />
              
              {/* Final score and modifier */}
              <div className="flex items-center gap-2">
                <span className={cn("font-bold", config.color)}>
                  {breakdown.total}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({modifierToString(breakdown.modifier)})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
