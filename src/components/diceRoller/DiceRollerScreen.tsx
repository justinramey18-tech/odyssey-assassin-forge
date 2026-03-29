import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Dices, Sparkles, Swords, Eye, MessageCircle, Wrench, Plus, Minus, Settings2, ChevronUp, ChevronDown, Equal, Wand2, RotateCcw, Play, SlidersHorizontal, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DICE_CONFIG,
  DICE_ORDER,
  SKILLS,
  ABILITY_SCORES,
  AI_DM_PROMPTS,
  formatPromptWithRoll,
  getAbilityScoreDisplay,
  getSkillsForDisplay,
  getAIDMPromptsForDisplay,
  type DieSize,
  type AbilityScore,
  type AIPromptTemplate,
} from '@/lib/diceRollerConfig';
import { isEmpyreanMode } from '@/lib/empyreanLabels';
import { rollDie } from '@/lib/diceRoller';
import { getD20RollQuality } from '@/lib/rollQuality';
import { DiceOddsWidget } from '@/components/settings/DiceOddsWidget';
import { DiceOddsMode, loadDiceOddsMode, saveDiceOddsMode } from '@/lib/diceOdds';
import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { AlignmentBanner } from '@/components/alignment/AlignmentBanner';
import { AlignmentBadge } from '@/components/alignment/AlignmentBadge';
import { type AlignmentScore as AlignmentScoreType, getPromptAlignment, isAlignmentMatch, sortByAlignmentProximity } from '@/lib/alignmentSpectrum';

// Ability score presets
interface AbilityPreset {
  id: string;
  name: string;
  description: string;
  scores: number[];
}

const ABILITY_PRESETS: AbilityPreset[] = [
  { id: 'standard', name: 'Standard Array', description: 'Balanced default', scores: [15, 14, 13, 12, 10, 8] },
  { id: 'heroic', name: 'Heroic Array', description: 'Higher stats', scores: [17, 15, 13, 12, 10, 8] },
  { id: 'elite', name: 'Elite Array', description: 'Very strong', scores: [18, 16, 14, 12, 10, 8] },
  { id: 'pointbuy_balanced', name: 'Point Buy: Balanced', description: '27 points, even spread', scores: [14, 14, 14, 12, 10, 8] },
  { id: 'pointbuy_focused', name: 'Point Buy: Focused', description: '27 points, one high stat', scores: [15, 15, 15, 8, 8, 8] },
  { id: 'pointbuy_specialist', name: 'Point Buy: Specialist', description: '27 points, SAD build', scores: [15, 14, 14, 10, 10, 8] },
  { id: 'all_tens', name: 'Commoner', description: 'All 10s (no modifiers)', scores: [10, 10, 10, 10, 10, 10] },
];

// Convert ability score to modifier
const scoreToModifier = (score: number): number => Math.floor((score - 10) / 2);

// Ability order for assignment
const ABILITY_ORDER: AbilityScore[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface DiceRollerScreenProps {
  onBack: () => void;
  onShareToParty?: (label: string, expression: string, result: number, details: unknown) => void;
}

// Roll mode for advantage/disadvantage
type RollMode = 'normal' | 'advantage' | 'disadvantage';

interface RollResult {
  die: DieSize;
  result: number;
  rawRoll: number;
  modifier: number;
  timestamp: number;
  label?: string;
  // For advantage/disadvantage tracking
  rollMode?: RollMode;
  allRolls?: number[]; // Both d20 rolls when using adv/disadv
  droppedRoll?: number; // The roll that wasn't used
  // For custom expressions
  isCustom?: boolean;
  customBreakdown?: string;
}

// Custom dice expression types
interface DiceTerm {
  count: number;
  sides: number;
  rolls: number[];
  total: number;
}

interface ParsedExpression {
  terms: DiceTerm[];
  modifier: number;
  total: number;
  breakdown: string;
  expression: string;
}

// Parse dice expression like "2d6+1d8+4" or "4d6-2"
const parseDiceExpression = (expr: string): ParsedExpression | null => {
  // Normalize input: remove spaces, lowercase
  const normalized = expr.replace(/\s+/g, '').toLowerCase();
  
  if (!normalized) return null;
  
  // Validate basic format - only allow dice, numbers, +, -
  if (!/^[\dd+-]+$/.test(normalized)) return null;
  
  // Split into tokens while preserving + and -
  const tokens = normalized.match(/[+-]?(\d+d\d+|\d+)/g);
  if (!tokens) return null;
  
  const terms: DiceTerm[] = [];
  let modifier = 0;
  
  for (const token of tokens) {
    // Check if it's a dice expression (XdY)
    const diceMatch = token.match(/^([+-])?(\d+)d(\d+)$/);
    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1;
      const count = parseInt(diceMatch[2], 10);
      const sides = parseInt(diceMatch[3], 10);
      
      // Validate reasonable values
      if (count < 1 || count > 100 || sides < 1 || sides > 1000) {
        return null;
      }
      
      // Roll the dice
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const total = rolls.reduce((sum, r) => sum + r, 0) * sign;
      
      terms.push({ count: count * sign, sides, rolls, total });
    } else {
      // It's a flat modifier
      const modMatch = token.match(/^([+-])?(\d+)$/);
      if (modMatch) {
        const sign = modMatch[1] === '-' ? -1 : 1;
        const value = parseInt(modMatch[2], 10);
        modifier += value * sign;
      }
    }
  }
  
  if (terms.length === 0 && modifier === 0) return null;
  
  // Calculate total
  const diceTotal = terms.reduce((sum, t) => sum + t.total, 0);
  const total = diceTotal + modifier;
  
  // Build breakdown string
  const breakdownParts: string[] = [];
  for (const term of terms) {
    const prefix = breakdownParts.length > 0 && term.count > 0 ? '+' : '';
    const countStr = Math.abs(term.count);
    const sign = term.count < 0 ? '-' : prefix;
    breakdownParts.push(`${sign}${countStr}d${term.sides}[${term.rolls.join(',')}]`);
  }
  if (modifier !== 0) {
    const modSign = modifier > 0 ? (breakdownParts.length > 0 ? '+' : '') : '';
    breakdownParts.push(`${modSign}${modifier}`);
  }
  
  return {
    terms,
    modifier,
    total,
    breakdown: breakdownParts.join(''),
    expression: normalized,
  };
};

// Storage keys
const MODIFIERS_STORAGE_KEY = 'odyssey-dice-modifiers';
const PROFICIENCY_STORAGE_KEY = 'odyssey-proficiency-bonus';
const PROFICIENT_SKILLS_KEY = 'odyssey-proficient-skills';
const PROFICIENT_SAVES_KEY = 'odyssey-proficient-saves';
const EXPERTISE_SKILLS_KEY = 'odyssey-expertise-skills';
const ROLL_MODE_KEY = 'odyssey-roll-mode';

type AbilityModifiers = Record<AbilityScore, number>;

const DEFAULT_MODIFIERS: AbilityModifiers = {
  str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
};

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[intensity]);
  }
};

export function DiceRollerScreen({ onBack, onShareToParty }: DiceRollerScreenProps) {
  const { toast } = useToast();
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPromptTemplate | null>(null);
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  
  // Modifier state
  const [abilityModifiers, setAbilityModifiers] = useState<AbilityModifiers>(DEFAULT_MODIFIERS);
  const [proficiencyBonus, setProficiencyBonus] = useState(2);
  const [proficientSkills, setProficientSkills] = useState<Set<string>>(new Set());
  const [proficientSaves, setProficientSaves] = useState<Set<AbilityScore>>(new Set());
  const [expertiseSkills, setExpertiseSkills] = useState<Set<string>>(new Set());
  const [modifiersOpen, setModifiersOpen] = useState(false);
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [quickSetOpen, setQuickSetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<AbilityPreset | null>(null);
  const [scoreAssignments, setScoreAssignments] = useState<Record<AbilityScore, number | null>>({
    str: null, dex: null, con: null, int: null, wis: null, cha: null,
  });
  const [customExpression, setCustomExpression] = useState('');
  const [customResult, setCustomResult] = useState<ParsedExpression | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Dice odds mode (synced with settings)
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  
  // Handle dice odds change
  const handleDiceOddsChange = useCallback((mode: DiceOddsMode) => {
    setDiceOddsMode(mode);
    saveDiceOddsMode(mode);
  }, []);

  // Load saved modifiers on mount
  useEffect(() => {
    try {
      const savedMods = localStorage.getItem(MODIFIERS_STORAGE_KEY);
      if (savedMods) setAbilityModifiers(JSON.parse(savedMods));
      
      const savedProf = localStorage.getItem(PROFICIENCY_STORAGE_KEY);
      if (savedProf) setProficiencyBonus(parseInt(savedProf, 10));
      
      const savedSkills = localStorage.getItem(PROFICIENT_SKILLS_KEY);
      if (savedSkills) setProficientSkills(new Set(JSON.parse(savedSkills)));
      
      const savedSaves = localStorage.getItem(PROFICIENT_SAVES_KEY);
      if (savedSaves) setProficientSaves(new Set(JSON.parse(savedSaves)));
      
      const savedExpertise = localStorage.getItem(EXPERTISE_SKILLS_KEY);
      if (savedExpertise) setExpertiseSkills(new Set(JSON.parse(savedExpertise)));
      
      const savedRollMode = localStorage.getItem(ROLL_MODE_KEY);
      if (savedRollMode) setRollMode(savedRollMode as RollMode);
    } catch (e) {
      console.error('Failed to load modifiers:', e);
    }
  }, []);

  // Save modifiers when they change
  useEffect(() => {
    localStorage.setItem(MODIFIERS_STORAGE_KEY, JSON.stringify(abilityModifiers));
  }, [abilityModifiers]);

  useEffect(() => {
    localStorage.setItem(PROFICIENCY_STORAGE_KEY, proficiencyBonus.toString());
  }, [proficiencyBonus]);

  useEffect(() => {
    localStorage.setItem(PROFICIENT_SKILLS_KEY, JSON.stringify([...proficientSkills]));
  }, [proficientSkills]);

  useEffect(() => {
    localStorage.setItem(PROFICIENT_SAVES_KEY, JSON.stringify([...proficientSaves]));
  }, [proficientSaves]);

  useEffect(() => {
    localStorage.setItem(EXPERTISE_SKILLS_KEY, JSON.stringify([...expertiseSkills]));
  }, [expertiseSkills]);

  useEffect(() => {
    localStorage.setItem(ROLL_MODE_KEY, rollMode);
  }, [rollMode]);

  // Update ability modifier
  const updateModifier = (ability: AbilityScore, delta: number) => {
    triggerHaptic('light');
    setAbilityModifiers(prev => ({
      ...prev,
      [ability]: Math.max(-10, Math.min(10, prev[ability] + delta)),
    }));
  };

  // Toggle skill proficiency
  const toggleSkillProficiency = (skillId: string) => {
    triggerHaptic('light');
    setProficientSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
        // Also remove expertise if removing proficiency
        setExpertiseSkills(exp => {
          const newExp = new Set(exp);
          newExp.delete(skillId);
          return newExp;
        });
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  // Toggle expertise (requires proficiency first)
  const toggleExpertise = (skillId: string) => {
    // Can only have expertise if proficient
    if (!proficientSkills.has(skillId)) return;
    
    triggerHaptic('light');
    setExpertiseSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const toggleSaveProficiency = (ability: AbilityScore) => {
    triggerHaptic('light');
    setProficientSaves(prev => {
      const next = new Set(prev);
      if (next.has(ability)) next.delete(ability);
      else next.add(ability);
      return next;
    });
  };

  // Cycle through roll modes
  const cycleRollMode = () => {
    triggerHaptic('light');
    setRollMode(prev => {
      if (prev === 'normal') return 'advantage';
      if (prev === 'advantage') return 'disadvantage';
      return 'normal';
    });
  };

  // Quick-set: Select a preset
  const handlePresetSelect = (preset: AbilityPreset) => {
    triggerHaptic('light');
    setSelectedPreset(preset);
    // Reset assignments
    setScoreAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
  };

  // Quick-set: Assign a score to an ability
  const assignScoreToAbility = (ability: AbilityScore, score: number) => {
    triggerHaptic('light');
    setScoreAssignments(prev => {
      // If this ability already has this score, remove it
      if (prev[ability] === score) {
        return { ...prev, [ability]: null };
      }
      // Remove the score from any other ability that had it
      const updated = { ...prev };
      for (const key of Object.keys(updated) as AbilityScore[]) {
        if (updated[key] === score) {
          updated[key] = null;
        }
      }
      updated[ability] = score;
      return updated;
    });
  };

  // Quick-set: Apply the assignments
  const applyQuickSet = () => {
    if (!selectedPreset) return;
    
    // Check all abilities are assigned
    const allAssigned = ABILITY_ORDER.every(ability => scoreAssignments[ability] !== null);
    if (!allAssigned) {
      toast({
        title: 'Incomplete Assignment',
        description: 'Please assign all 6 scores to abilities',
        variant: 'destructive',
      });
      return;
    }
    
    // Convert scores to modifiers and apply
    const newModifiers: AbilityModifiers = { ...DEFAULT_MODIFIERS };
    for (const ability of ABILITY_ORDER) {
      const score = scoreAssignments[ability];
      if (score !== null) {
        newModifiers[ability] = scoreToModifier(score);
      }
    }
    
    setAbilityModifiers(newModifiers);
    triggerHaptic('heavy');
    toast({
      title: 'Scores Applied!',
      description: `${selectedPreset.name} modifiers have been set`,
      className: 'border-primary bg-primary/10',
    });
    setQuickSetOpen(false);
    setSelectedPreset(null);
    setScoreAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
  };

  // Quick-set: Auto-assign in order (for quick apply)
  const autoAssignInOrder = () => {
    if (!selectedPreset) return;
    triggerHaptic('light');
    const newAssignments: Record<AbilityScore, number | null> = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    ABILITY_ORDER.forEach((ability, index) => {
      newAssignments[ability] = selectedPreset.scores[index];
    });
    setScoreAssignments(newAssignments);
  };

  // Roll custom dice expression
  const rollCustomExpression = useCallback(() => {
    if (!customExpression.trim()) return;
    
    setIsRolling(true);
    triggerHaptic('medium');
    
    // Animate briefly
    let iterations = 0;
    const maxIterations = 8;
    
    const animate = setInterval(() => {
      iterations++;
      // Show random numbers during animation
      const animResult = Math.floor(Math.random() * 20) + 1;
      setCustomResult({
        terms: [],
        modifier: 0,
        total: animResult,
        breakdown: '...',
        expression: customExpression,
      });
      
      if (iterations >= maxIterations) {
        clearInterval(animate);
        
        const parsed = parseDiceExpression(customExpression);
        if (!parsed) {
          setIsRolling(false);
          setCustomResult(null);
          toast({
            title: 'Invalid Expression',
            description: 'Use format like 2d6+4 or 1d20+1d8-2',
            variant: 'destructive',
          });
          return;
        }
        
        setCustomResult(parsed);
        
        // Also add to current roll for AI prompts
        const customRoll: RollResult = {
          die: 'd20', // Placeholder
          rawRoll: parsed.total,
          modifier: 0,
          result: parsed.total,
          timestamp: Date.now(),
          label: `Custom: ${parsed.expression}`,
          isCustom: true,
          customBreakdown: parsed.breakdown,
        };
        setCurrentRoll(customRoll);
        setRollHistory(prev => [customRoll, ...prev.slice(0, 19)]);
        
        setIsRolling(false);
        triggerHaptic('heavy');
      }
    }, 50);
  }, [customExpression, toast]);

  // Quick expression buttons
  const QUICK_EXPRESSIONS = ['2d6', '1d8+4', '4d6', '2d10+5', '8d6', '1d20+5'];

  // Roll a die with animation and modifier
  const rollDice = useCallback((die: DieSize, label?: string, modifier: number = 0, useRollMode: boolean = false) => {
    setIsRolling(true);
    triggerHaptic('medium');

    const sides = DICE_CONFIG[die].sides;
    let iterations = 0;
    const maxIterations = 10;
    
    // Determine if we should use advantage/disadvantage (only for d20)
    const effectiveMode = (useRollMode && die === 'd20') ? rollMode : 'normal';
    const rollCount = effectiveMode !== 'normal' ? 2 : 1;
    
    const animate = setInterval(() => {
      iterations++;
      const animRoll = Math.floor(Math.random() * sides) + 1;
      setCurrentRoll({
        die,
        rawRoll: animRoll,
        modifier,
        result: animRoll + modifier,
        timestamp: Date.now(),
        label,
        rollMode: effectiveMode,
      });

      if (iterations >= maxIterations) {
        clearInterval(animate);
        
        // Roll the dice
        const allRolls: number[] = [];
        for (let i = 0; i < rollCount; i++) {
          allRolls.push(rollDie(sides));
        }
        
        // Determine final roll based on mode
        let finalRawRoll: number;
        let droppedRoll: number | undefined;
        
        if (effectiveMode === 'advantage') {
          finalRawRoll = Math.max(...allRolls);
          droppedRoll = Math.min(...allRolls);
        } else if (effectiveMode === 'disadvantage') {
          finalRawRoll = Math.min(...allRolls);
          droppedRoll = Math.max(...allRolls);
        } else {
          finalRawRoll = allRolls[0];
        }
        
        const newRoll: RollResult = {
          die,
          rawRoll: finalRawRoll,
          modifier,
          result: finalRawRoll + modifier,
          timestamp: Date.now(),
          label,
          rollMode: effectiveMode,
          allRolls: rollCount > 1 ? allRolls : undefined,
          droppedRoll,
        };
        setCurrentRoll(newRoll);
        setRollHistory(prev => [newRoll, ...prev.slice(0, 19)]);
        setIsRolling(false);
        triggerHaptic('heavy');
      }
    }, 50);
  }, [rollMode]);

  // Roll skill check (d20) with modifiers, expertise, and roll mode
  const rollSkill = useCallback((skillId: string, skillName: string, ability: AbilityScore) => {
    const abilityMod = abilityModifiers[ability];
    const isProficient = proficientSkills.has(skillId);
    const hasExpertise = expertiseSkills.has(skillId);
    const profMultiplier = hasExpertise ? 2 : (isProficient ? 1 : 0);
    const profBonus = proficiencyBonus * profMultiplier;
    const totalMod = abilityMod + profBonus;
    const indicator = hasExpertise ? '★' : (isProficient ? '●' : '');
    rollDice('d20', `${indicator}${skillName} (${getAbilityScoreDisplay(ability).abbr})`, totalMod, true);
  }, [rollDice, abilityModifiers, proficiencyBonus, proficientSkills, expertiseSkills]);

  // Roll saving throw (d20) with modifiers and roll mode
  const rollSave = useCallback((ability: AbilityScore) => {
    const abilityMod = abilityModifiers[ability];
    const profBonus = proficientSaves.has(ability) ? proficiencyBonus : 0;
    const totalMod = abilityMod + profBonus;
    const profIndicator = profBonus > 0 ? '●' : '';
    rollDice('d20', `${profIndicator}${getAbilityScoreDisplay(ability).name} Save`, totalMod, true);
  }, [rollDice, abilityModifiers, proficiencyBonus, proficientSaves]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      triggerHaptic('light');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Copy roll result with modifier breakdown
  const copyRollResult = useCallback(() => {
    if (!currentRoll) return;
    let text: string;
    
    // Build roll mode prefix
    const modePrefix = currentRoll.rollMode === 'advantage' 
      ? '(ADV) ' 
      : currentRoll.rollMode === 'disadvantage' 
        ? '(DIS) ' 
        : '';
    
    // Build rolls display for adv/disadv
    const rollsDisplay = currentRoll.allRolls 
      ? `[${currentRoll.allRolls.join(', ')}] → ${currentRoll.rawRoll}`
      : currentRoll.rawRoll.toString();
    
    if (currentRoll.label) {
      if (currentRoll.modifier !== 0) {
        text = `${modePrefix}${currentRoll.label}: ${rollsDisplay} ${currentRoll.modifier >= 0 ? '+' : ''}${currentRoll.modifier} = ${currentRoll.result}`;
      } else {
        text = `${modePrefix}${currentRoll.label}: ${rollsDisplay} (${currentRoll.die})`;
      }
    } else {
      text = `${modePrefix}${currentRoll.die}: ${currentRoll.result}`;
    }
    copyToClipboard(text, 'roll-result');
  }, [currentRoll, copyToClipboard]);

  // Alignment drift tracking
  const { driftPosition, historyCount, logPromptUsage } = useAlignmentDrift();
  const [alignmentTarget, setAlignmentTarget] = useState<AlignmentScoreType | null>(null);

  // Handle AI prompt selection
  const handlePromptSelect = (prompt: AIPromptTemplate) => {
    logPromptUsage(prompt.id);
    setSelectedPrompt(prompt);
    setPromptSheetOpen(true);
  };

  // Copy formatted prompt
  const copyPrompt = useCallback(() => {
    if (!selectedPrompt || !currentRoll) return;
    const formatted = formatPromptWithRoll(selectedPrompt.prompt, currentRoll.result);
    copyToClipboard(formatted, `prompt-${selectedPrompt.id}`);
    toast({
      title: 'Prompt Copied!',
      description: `"${selectedPrompt.name}" prompt copied with roll ${currentRoll.result}`,
      className: 'border-primary bg-primary/10',
    });
    setPromptSheetOpen(false);
  }, [selectedPrompt, currentRoll, copyToClipboard, toast]);

  // Check if roll is critical (based on raw d20 roll, not total)
  const isCritical = currentRoll?.die === 'd20' && currentRoll?.rawRoll === 20;
  const isFumble = currentRoll?.die === 'd20' && currentRoll?.rawRoll === 1;
  
  // Roll quality label for non-crit/fumble d20 rolls
  const d20Quality = currentRoll?.die === 'd20' && currentRoll?.rawRoll
    ? getD20RollQuality([currentRoll.rawRoll])
    : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-cinzel font-bold text-lg">Dice Roller</h1>
          <p className="text-xs text-muted-foreground">Roll dice & generate AI prompts</p>
        </div>
        <motion.div
          animate={isRolling ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.3, repeat: isRolling ? Infinity : 0, ease: 'linear' }}
        >
          <Dices className="w-6 h-6 text-primary" />
        </motion.div>
      </header>

      {/* Current Roll Display */}
      <div className="p-4 border-b border-border bg-gradient-to-b from-card/80 to-transparent">
        <div className="flex flex-col items-center gap-2">
            {currentRoll ? (
              <>
                <motion.div
                  animate={isRolling ? { 
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0],
                  } : {}}
                  transition={{ duration: 0.1, repeat: isRolling ? Infinity : 0 }}
                  className={cn(
                    'text-6xl font-cinzel font-bold tabular-nums',
                    isCritical && 'text-tier-maxed animate-pulse',
                    isFumble && 'text-destructive',
                    !isCritical && !isFumble && DICE_CONFIG[currentRoll.die].color,
                  )}
                >
                  {currentRoll.result}
                </motion.div>
                {currentRoll.label && (
                  <Badge variant="outline" className="font-cinzel">
                    {currentRoll.label}
                  </Badge>
                )}
                <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                  {/* Show advantage/disadvantage rolls */}
                  {currentRoll.allRolls && currentRoll.allRolls.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        'font-mono px-2 py-0.5 rounded',
                        currentRoll.rollMode === 'advantage' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {currentRoll.rollMode === 'advantage' ? 'ADV' : 'DIS'}
                      </span>
                      <span className="font-mono">
                        {currentRoll.allRolls.map((r, i) => (
                          <span key={i} className={cn(
                            r === currentRoll.rawRoll ? 'text-foreground font-bold' : 'text-muted-foreground/50 line-through'
                          )}>
                            {i > 0 && ' / '}{r}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {/* Show breakdown: raw roll + modifier = total */}
                  {currentRoll.modifier !== 0 ? (
                    <span className="font-mono">
                      ({currentRoll.rawRoll}) {currentRoll.modifier >= 0 ? '+' : ''}{currentRoll.modifier} = {currentRoll.result}
                    </span>
                  ) : (
                    !currentRoll.allRolls && <span>{currentRoll.die.toUpperCase()}: {currentRoll.rawRoll}</span>
                  )}
                </div>
                {isCritical && <span className="text-tier-maxed font-bold text-sm">✦ NATURAL 20! ✦</span>}
                {isFumble && <span className="text-destructive font-bold text-sm">✗ NATURAL 1 ✗</span>}
                {!isCritical && !isFumble && d20Quality && !isRolling && (
                  <span className={cn(
                    "font-bold text-xs uppercase tracking-wider",
                    d20Quality.tier === 'excellent' ? "text-amber-300" 
                    : d20Quality.tier === 'strong' ? "text-emerald-400"
                    : d20Quality.tier === 'average' ? "text-muted-foreground"
                    : "text-red-400/70"
                  )}>
                    {d20Quality.label}
                  </span>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyRollResult}
                    className="gap-2"
                    disabled={isRolling}
                  >
                    {copiedId === 'roll-result' ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Result
                      </>
                    )}
                  </Button>
                  {onShareToParty && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!currentRoll) return;
                        const label = currentRoll.label || currentRoll.die.toUpperCase();
                        const expression = currentRoll.isCustom
                          ? currentRoll.customBreakdown || currentRoll.die
                          : currentRoll.modifier !== 0
                            ? `${currentRoll.die}${currentRoll.modifier >= 0 ? '+' : ''}${currentRoll.modifier}`
                            : currentRoll.die;
                        onShareToParty(label, expression, currentRoll.result, {
                          rawRoll: currentRoll.rawRoll,
                          allRolls: currentRoll.allRolls,
                          rollMode: currentRoll.rollMode,
                        });
                      }}
                      className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                      disabled={isRolling}
                    >
                      <Users className="w-4 h-4" />
                      Share
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Dices className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Tap a die to roll</p>
              </div>
            )}
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="dice" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-5 mx-4 mt-4 shrink-0">
          <TabsTrigger value="dice" className="gap-1 text-xs">
            <Dices className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dice</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1 text-xs">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="saves" className="gap-1 text-xs">
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Saves</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1 text-xs">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI DM</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tools</span>
          </TabsTrigger>
        </TabsList>

        {/* Dice Tab */}
        <TabsContent value="dice" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pb-8">
            {/* Roll Mode Toggle for d20 */}
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
              <span className="text-xs text-muted-foreground mr-2">d20 Mode:</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => { triggerHaptic('light'); setRollMode('normal'); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1',
                    rollMode === 'normal' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-card/50 text-muted-foreground hover:bg-card'
                  )}
                >
                  <Equal className="w-3 h-3" />
                  Normal
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setRollMode('advantage'); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1 border-x border-border',
                    rollMode === 'advantage' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-card/50 text-muted-foreground hover:bg-card'
                  )}
                >
                  <ChevronUp className="w-3 h-3" />
                  Adv
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setRollMode('disadvantage'); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1',
                    rollMode === 'disadvantage' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-card/50 text-muted-foreground hover:bg-card'
                  )}
                >
                  <ChevronDown className="w-3 h-3" />
                  Dis
                </button>
              </div>
            </div>

            {/* Initiative Roll Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
              const dexMod = abilityModifiers.dex;
                const initLabel = isEmpyreanMode() ? `⚡ Combat Reflexes (${getAbilityScoreDisplay('dex').abbr})` : `⚡ Initiative (DEX)`;
                rollDice('d20', initLabel, dexMod, true);
              }}
              disabled={isRolling}
              className={cn(
                'w-full flex items-center justify-center gap-3 py-3 rounded-xl',
                'bg-yellow-500/10 border-2 border-yellow-500/30',
                'hover:bg-yellow-500/20 hover:border-yellow-500/50',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="font-cinzel font-bold text-yellow-400">
                Roll Initiative
              </span>
              <span className="text-xs text-yellow-400/60 font-mono">
                (d20{abilityModifiers.dex >= 0 ? '+' : ''}{abilityModifiers.dex})
              </span>
            </motion.button>

            <div className="grid grid-cols-4 gap-3">
              {DICE_ORDER.map((die) => {
                const config = DICE_CONFIG[die];
                const isD20 = die === 'd20';
                return (
                  <motion.button
                    key={die}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => rollDice(die, undefined, 0, isD20)}
                    disabled={isRolling}
                    className={cn(
                      'aspect-square rounded-xl border-2 border-border bg-card/50',
                      'flex flex-col items-center justify-center gap-1',
                      'hover:bg-card hover:border-primary/50 transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      config.color,
                      // Highlight d20 when adv/disadv is active
                      isD20 && rollMode === 'advantage' && 'border-green-500/50 bg-green-500/10',
                      isD20 && rollMode === 'disadvantage' && 'border-red-500/50 bg-red-500/10',
                    )}
                  >
                    <span className="text-2xl font-cinzel font-bold uppercase">{die}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isD20 && rollMode !== 'normal' 
                        ? (rollMode === 'advantage' ? '2d20 ↑' : '2d20 ↓')
                        : `1-${config.sides}`
                      }
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Custom Dice Expression */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-card/30">
              <h3 className="text-xs font-cinzel text-muted-foreground uppercase tracking-wider">
                Custom Expression
              </h3>
              
              {/* Input and Roll Button */}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="e.g. 2d6+4 or 4d8+2d6"
                  value={customExpression}
                  onChange={(e) => setCustomExpression(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      rollCustomExpression();
                    }
                  }}
                  className="flex-1 font-mono text-sm"
                  disabled={isRolling}
                />
                <Button
                  onClick={rollCustomExpression}
                  disabled={isRolling || !customExpression.trim()}
                  size="icon"
                  className="shrink-0"
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Quick Expression Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EXPRESSIONS.map((expr) => (
                  <button
                    key={expr}
                    onClick={() => {
                      setCustomExpression(expr);
                      triggerHaptic('light');
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-mono transition-all',
                      'bg-muted hover:bg-muted/80 text-foreground',
                      customExpression === expr && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {expr}
                  </button>
                ))}
              </div>
              
              {/* Custom Result Display */}
              <AnimatePresence mode="wait">
                {customResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded-lg bg-primary/10 border border-primary/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-cinzel font-bold text-primary">
                            {customResult.total}
                          </span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {customResult.expression}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                          {customResult.breakdown} = {customResult.total}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const text = `${customResult.expression}: ${customResult.breakdown} = ${customResult.total}`;
                          navigator.clipboard.writeText(text);
                          triggerHaptic('light');
                          toast({
                            title: 'Copied!',
                            description: text,
                            className: 'border-primary bg-primary/10',
                          });
                        }}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Roll History */}
            {rollHistory.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-cinzel text-muted-foreground uppercase tracking-wider">
                  History
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rollHistory.slice(0, 10).map((roll) => (
                    <Badge
                      key={roll.timestamp}
                      variant="outline"
                      className={cn(
                        'font-mono text-xs',
                        roll.die === 'd20' && roll.rawRoll === 20 && !roll.isCustom && 'border-tier-maxed text-tier-maxed',
                        roll.die === 'd20' && roll.rawRoll === 1 && !roll.isCustom && 'border-destructive text-destructive',
                        roll.isCustom && 'border-primary/50 text-primary',
                      )}
                    >
                      {roll.isCustom 
                        ? `${roll.label?.replace('Custom: ', '')}=${roll.result}`
                        : roll.modifier !== 0 
                          ? `${roll.rawRoll}${roll.modifier >= 0 ? '+' : ''}${roll.modifier}=${roll.result}`
                          : `${roll.die}:${roll.result}`
                      }
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pb-8">
            {/* Modifiers Panel */}
            <Collapsible open={modifiersOpen} onOpenChange={setModifiersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    <span className="font-medium">Modifiers</span>
                  </span>
                  <Badge variant="secondary">Prof +{proficiencyBonus}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {/* Proficiency Bonus */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                  <span className="text-sm font-medium">Proficiency Bonus</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        triggerHaptic('light');
                        setProficiencyBonus(p => Math.max(2, p - 1));
                      }}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-bold text-primary">+{proficiencyBonus}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        triggerHaptic('light');
                        setProficiencyBonus(p => Math.min(6, p + 1));
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Ability Modifiers */}
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ABILITY_SCORES) as AbilityScore[]).map((ability) => {
                    const config = getAbilityScoreDisplay(ability);
                    const mod = abilityModifiers[ability];
                    return (
                      <div
                        key={ability}
                        className="flex flex-col items-center p-2 rounded-lg border border-border bg-card/50"
                      >
                        <span className={cn('text-xs font-bold', config.color)}>{config.abbr}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateModifier(ability, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className={cn('w-6 text-center text-sm font-bold', mod >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {mod >= 0 ? `+${mod}` : mod}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateModifier(ability, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Set Button */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setQuickSetOpen(true)}
                >
                  <Wand2 className="w-4 h-4" />
                  Quick Set (Standard Array / Point Buy)
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Roll Mode Indicator */}
            <div className="flex items-center justify-center">
              <button
                onClick={cycleRollMode}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full border transition-all',
                  rollMode === 'normal' && 'border-border bg-card/50 text-muted-foreground',
                  rollMode === 'advantage' && 'border-green-500 bg-green-500/20 text-green-400',
                  rollMode === 'disadvantage' && 'border-red-500 bg-red-500/20 text-red-400',
                )}
              >
                {rollMode === 'normal' && <Equal className="w-4 h-4" />}
                {rollMode === 'advantage' && <ChevronUp className="w-4 h-4" />}
                {rollMode === 'disadvantage' && <ChevronDown className="w-4 h-4" />}
                <span className="text-sm font-medium capitalize">
                  {rollMode === 'normal' ? 'Normal Roll' : rollMode}
                </span>
                <span className="text-xs opacity-60">(tap to cycle)</span>
              </button>
            </div>

            {/* Skills List */}
            <div className="grid grid-cols-1 gap-2">
              {getSkillsForDisplay().map((skill) => {
                const abilityConfig = getAbilityScoreDisplay(skill.ability);
                const abilityMod = abilityModifiers[skill.ability];
                const isProficient = proficientSkills.has(skill.id);
                const hasExpertise = expertiseSkills.has(skill.id);
                const profMultiplier = hasExpertise ? 2 : (isProficient ? 1 : 0);
                const profBonus = proficiencyBonus * profMultiplier;
                const totalMod = abilityMod + profBonus;
                return (
                  <div
                    key={skill.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border bg-card/50',
                      hasExpertise ? 'border-yellow-500/50' : isProficient ? 'border-primary/50' : 'border-border',
                    )}
                  >
                    {/* Proficiency Toggle */}
                    <button
                      onClick={() => toggleSkillProficiency(skill.id)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        isProficient 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-muted-foreground/50 hover:border-primary/50',
                      )}
                      aria-label={isProficient ? 'Remove proficiency' : 'Add proficiency'}
                    >
                      {isProficient && <Check className="w-3 h-3" />}
                    </button>

                    {/* Expertise Toggle (only visible if proficient) */}
                    <button
                      onClick={() => toggleExpertise(skill.id)}
                      disabled={!isProficient}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-all',
                        hasExpertise 
                          ? 'bg-yellow-500 border-yellow-500 text-yellow-950' 
                          : isProficient
                            ? 'border-yellow-500/50 text-yellow-500/50 hover:border-yellow-500 hover:text-yellow-500'
                            : 'border-muted-foreground/20 text-muted-foreground/20 cursor-not-allowed',
                      )}
                      aria-label={hasExpertise ? 'Remove expertise' : 'Add expertise'}
                      title={isProficient ? (hasExpertise ? 'Remove expertise (×2 proficiency)' : 'Add expertise (×2 proficiency)') : 'Must be proficient first'}
                    >
                      ×2
                    </button>

                    {/* Roll Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => rollSkill(skill.id, skill.name, skill.ability)}
                      disabled={isRolling}
                      className="flex-1 flex items-center gap-2 text-left disabled:opacity-50"
                    >
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', abilityConfig.color)}>
                        {abilityConfig.abbr}
                      </Badge>
                      <span className="text-sm font-medium flex-1 truncate">{skill.name}</span>
                      {hasExpertise && (
                        <Badge variant="outline" className="text-[9px] shrink-0 border-yellow-500/50 text-yellow-500">
                          EXP
                        </Badge>
                      )}
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        totalMod >= 0 ? 'text-green-400' : 'text-red-400',
                      )}>
                        {totalMod >= 0 ? `+${totalMod}` : totalMod}
                      </span>
                    </motion.button>
                  </div>
                );
              })}
            </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Saves Tab */}
        <TabsContent value="saves" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pb-8">
            {/* Roll Mode Indicator */}
            <div className="flex items-center justify-center">
              <button
                onClick={cycleRollMode}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full border transition-all',
                  rollMode === 'normal' && 'border-border bg-card/50 text-muted-foreground',
                  rollMode === 'advantage' && 'border-green-500 bg-green-500/20 text-green-400',
                  rollMode === 'disadvantage' && 'border-red-500 bg-red-500/20 text-red-400',
                )}
              >
                {rollMode === 'normal' && <Equal className="w-4 h-4" />}
                {rollMode === 'advantage' && <ChevronUp className="w-4 h-4" />}
                {rollMode === 'disadvantage' && <ChevronDown className="w-4 h-4" />}
                <span className="text-sm font-medium capitalize">
                  {rollMode === 'normal' ? 'Normal Roll' : rollMode}
                </span>
                <span className="text-xs opacity-60">(tap to cycle)</span>
              </button>
            </div>

            {/* Info about modifiers */}
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-xs text-muted-foreground">
                ● = proficiency • ×2 = expertise (Skills tab) • Set modifiers in Skills tab
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ABILITY_SCORES) as AbilityScore[]).map((ability) => {
                const config = getAbilityScoreDisplay(ability);
                const abilityMod = abilityModifiers[ability];
                const isProficient = proficientSaves.has(ability);
                const totalMod = abilityMod + (isProficient ? proficiencyBonus : 0);
                return (
                  <div
                    key={ability}
                    className={cn(
                      'p-3 rounded-xl border-2 bg-card/50 flex flex-col items-center gap-2',
                      isProficient ? 'border-primary/50' : 'border-border',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Proficiency Toggle */}
                      <button
                        onClick={() => toggleSaveProficiency(ability)}
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          isProficient 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground/50 hover:border-primary/50',
                        )}
                        aria-label={isProficient ? 'Remove save proficiency' : 'Add save proficiency'}
                      >
                        {isProficient && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </button>
                      <span className={cn('text-xl font-cinzel font-bold', config.color)}>
                        {config.abbr}
                      </span>
                    </div>
                    
                    <span className="text-[10px] text-muted-foreground">{config.name}</span>
                    
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => rollSave(ability)}
                      disabled={isRolling}
                      className={cn(
                        'w-full py-2 rounded-lg border border-border bg-background/50',
                        'hover:bg-background hover:border-primary/30 transition-all',
                        'disabled:opacity-50 flex items-center justify-center gap-2',
                      )}
                    >
                      <Badge variant="outline" className="text-[10px]">Save</Badge>
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        totalMod >= 0 ? 'text-green-400' : 'text-red-400',
                      )}>
                        {totalMod >= 0 ? `+${totalMod}` : totalMod}
                      </span>
                    </motion.button>
                  </div>
                );
              })}
            </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* AI Prompts Tab */}
        <TabsContent value="prompts" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pb-8">
            {!currentRoll && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                <p className="text-sm text-muted-foreground">
                  Roll a die first, then select a prompt to generate AI DM text
                </p>
              </div>
            )}

            {/* Alignment drift banner */}
            {historyCount > 0 && !alignmentTarget && (
              <AlignmentBanner
                alignmentTarget={driftPosition}
                onApply={(target) => setAlignmentTarget(target)}
                onDismiss={() => {}}
              />
            )}

            {/* Combat Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Swords className="w-3.5 h-3.5 text-red-400" />
                Combat
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {(alignmentTarget ? sortByAlignmentProximity(getAIDMPromptsForDisplay().filter(p => p.category === 'combat'), alignmentTarget) : getAIDMPromptsForDisplay().filter(p => p.category === 'combat')).map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Exploration Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                Exploration
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {(alignmentTarget ? sortByAlignmentProximity(getAIDMPromptsForDisplay().filter(p => p.category === 'exploration'), alignmentTarget) : getAIDMPromptsForDisplay().filter(p => p.category === 'exploration')).map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Social Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-pink-400" />
                Social
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {(alignmentTarget ? sortByAlignmentProximity(getAIDMPromptsForDisplay().filter(p => p.category === 'social'), alignmentTarget) : getAIDMPromptsForDisplay().filter(p => p.category === 'social')).map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Utility Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                Utility
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {(alignmentTarget ? sortByAlignmentProximity(getAIDMPromptsForDisplay().filter(p => p.category === 'utility'), alignmentTarget) : getAIDMPromptsForDisplay().filter(p => p.category === 'utility')).map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-6 pb-8">
              {/* Dice Odds Widget */}
              <DiceOddsWidget value={diceOddsMode} onChange={handleDiceOddsChange} />
              
              {/* Info note */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground text-center">
                  These settings sync with your character's Dice Tools in Settings
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Prompt Detail Sheet */}
      <Sheet open={promptSheetOpen} onOpenChange={setPromptSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader className="mb-4">
            <SheetTitle className="font-cinzel flex items-center gap-2">
              {selectedPrompt?.name}
              {currentRoll && (
                <Badge variant="outline" className="ml-2">
                  Roll: {currentRoll.result}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedPrompt && currentRoll && (
            <div className="space-y-4">
              <ScrollArea className="h-[200px] rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm whitespace-pre-wrap font-body">
                  {formatPromptWithRoll(selectedPrompt.prompt, currentRoll.result)}
                </pre>
              </ScrollArea>

              <Button
                onClick={copyPrompt}
                className="w-full gap-2"
                size="lg"
              >
                {copiedId === `prompt-${selectedPrompt.id}` ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Prompt
                  </>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Quick Set Sheet */}
      <Sheet open={quickSetOpen} onOpenChange={(open) => {
        setQuickSetOpen(open);
        if (!open) {
          setSelectedPreset(null);
          setScoreAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
        }
      }}>
        <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] rounded-t-xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader className="mb-4">
            <SheetTitle className="font-cinzel flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Quick Set Ability Scores
            </SheetTitle>
            <SheetDescription>
              Choose a preset and assign scores to abilities
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(85vh-180px)]">
            <div className="space-y-4 pr-4">
              {/* Preset Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Select Preset</h3>
                <div className="grid grid-cols-1 gap-2">
                  {ABILITY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        selectedPreset?.id === preset.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card/50 hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{preset.name}</p>
                          <p className="text-xs text-muted-foreground">{preset.description}</p>
                        </div>
                        <div className="flex gap-1">
                          {preset.scores.map((score, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">
                              {score}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Assignment */}
              {selectedPreset && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Assign Scores to Abilities</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={autoAssignInOrder}
                      className="gap-1 text-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Auto-assign (STR→CHA)
                    </Button>
                  </div>

                  {/* Available Scores */}
                  <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-xs text-muted-foreground w-full text-center mb-1">Available Scores</span>
                    {selectedPreset.scores.map((score, i) => {
                      const isAssigned = Object.values(scoreAssignments).includes(score);
                      // Count how many times this score appears in the preset
                      const countInPreset = selectedPreset.scores.filter(s => s === score).length;
                      // Count how many times this score is assigned
                      const countAssigned = Object.values(scoreAssignments).filter(s => s === score).length;
                      // Check if this specific instance is assigned
                      const instancesAssigned = selectedPreset.scores.slice(0, i + 1).filter(s => s === score).length;
                      const thisInstanceAssigned = instancesAssigned <= countAssigned;
                      
                      return (
                        <Badge
                          key={i}
                          variant={thisInstanceAssigned ? 'secondary' : 'default'}
                          className={cn(
                            'text-lg font-mono px-3 py-1',
                            thisInstanceAssigned && 'opacity-40 line-through'
                          )}
                        >
                          {score}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Ability Assignment Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {ABILITY_ORDER.map((ability) => {
                      const config = ABILITY_SCORES[ability];
                      const assignedScore = scoreAssignments[ability];
                      const modifier = assignedScore !== null ? scoreToModifier(assignedScore) : null;
                      
                      return (
                        <div
                          key={ability}
                          className={cn(
                            'p-3 rounded-lg border-2 transition-all',
                            assignedScore !== null
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card/50'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn('text-sm font-bold', config.color)}>{config.name}</span>
                            {assignedScore !== null && (
                              <Badge variant="outline" className={cn(
                                'font-mono',
                                modifier !== null && modifier >= 0 ? 'text-green-400' : 'text-red-400'
                              )}>
                                {modifier !== null && modifier >= 0 ? `+${modifier}` : modifier}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {selectedPreset.scores.filter((v, i, a) => a.indexOf(v) === i).map((score) => {
                              const isThisScoreAssignedHere = scoreAssignments[ability] === score;
                              const isScoreUsedElsewhere = Object.entries(scoreAssignments).some(
                                ([key, val]) => key !== ability && val === score
                              );
                              // Check if we have duplicate scores and one is still available
                              const scoreCountInPreset = selectedPreset.scores.filter(s => s === score).length;
                              const scoreCountAssigned = Object.values(scoreAssignments).filter(s => s === score).length;
                              const hasAvailableDupe = scoreCountInPreset > scoreCountAssigned;
                              
                              const isDisabled = isScoreUsedElsewhere && !hasAvailableDupe && !isThisScoreAssignedHere;
                              
                              return (
                                <button
                                  key={score}
                                  onClick={() => !isDisabled && assignScoreToAbility(ability, score)}
                                  disabled={isDisabled}
                                  className={cn(
                                    'px-2 py-1 rounded text-sm font-mono transition-all',
                                    isThisScoreAssignedHere
                                      ? 'bg-primary text-primary-foreground'
                                      : isDisabled
                                        ? 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                                        : 'bg-muted hover:bg-muted/80 text-foreground'
                                  )}
                                >
                                  {score}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Apply Button */}
                  <Button
                    onClick={applyQuickSet}
                    className="w-full gap-2"
                    size="lg"
                    disabled={!ABILITY_ORDER.every(ability => scoreAssignments[ability] !== null)}
                  >
                    <Check className="w-5 h-5" />
                    Apply Modifiers
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Prompt Button Component
interface PromptButtonProps {
  prompt: AIPromptTemplate;
  onClick: () => void;
  disabled?: boolean;
  currentRoll?: number;
}

function PromptButton({ prompt, onClick, disabled, currentRoll }: PromptButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-3 rounded-lg border border-border bg-card/50',
        'flex items-center gap-3 text-left',
        'hover:bg-card hover:border-primary/30 transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <div className={cn('w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0', prompt.color)}>
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm">{prompt.name}</p>
          <AlignmentBadge promptId={prompt.id} />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {disabled ? 'Roll a die first' : `Generate with roll ${currentRoll}`}
        </p>
      </div>
      <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
    </motion.button>
  );
}
