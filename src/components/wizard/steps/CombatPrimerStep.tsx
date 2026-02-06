// Combat Primer Step - Introduces new players to combat mechanics

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Swords, 
  Zap, 
  Shield, 
  Footprints,
  Crosshair,
  Wand2,
  Backpack,
  FileText,
  Check,
  X,
  Lightbulb,
  Target,
  Eye,
  Users,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { WizardState, StepValidation } from '../types';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import wizardBackground from '@/assets/wizard-background.jpg';

interface CombatPrimerStepProps {
  state: WizardState;
  validation?: StepValidation;
}

// Action economy data
const ACTION_ECONOMY = [
  { 
    id: 'action', 
    label: 'ACTION', 
    icon: Swords, 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    description: 'Your main activity each turn',
    examples: 'Attack, Dash, Dodge, Use Object, Cast spell',
  },
  { 
    id: 'bonus', 
    label: 'BONUS', 
    icon: Zap, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    description: 'Quick supplementary actions',
    examples: 'Cunning Action (Hide/Dash/Disengage), Two-Weapon Fighting',
  },
  { 
    id: 'reaction', 
    label: 'REACT', 
    icon: Shield, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    description: 'Triggered responses (1/round)',
    examples: 'Opportunity Attack, Uncanny Dodge, Shield spell',
  },
  { 
    id: 'movement', 
    label: 'MOVE', 
    icon: Footprints, 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    description: '30ft per turn (typical)',
    examples: 'Split before/after actions, difficult terrain costs 2x',
  },
];

// Combat tab data
const COMBAT_TABS = [
  { id: 'combat', label: 'COMBAT', icon: Crosshair, color: 'text-red-400', description: 'Weapon attacks, stealth abilities, target tracker' },
  { id: 'actions', label: 'ACTIONS', icon: Zap, color: 'text-amber-400', description: 'All unlocked abilities with action type filters' },
  { id: 'magic', label: 'MAGIC', icon: Wand2, color: 'text-indigo-400', description: 'Spells, spell slots, concentration tracking' },
  { id: 'items', label: 'ITEMS', icon: Backpack, color: 'text-green-400', description: 'Consumables, potions, poisons, scrolls' },
  { id: 'log', label: 'LOG', icon: FileText, color: 'text-primary', description: 'Combat history with AI DM prompts' },
];

// Assassin abilities data
const ASSASSIN_ABILITIES = [
  { name: 'Sneak Attack', level: '1+', trigger: 'Hit with finesse/ranged + advantage or ally adjacent', effect: '+Xd6 damage' },
  { name: 'Cunning Action', level: '2+', trigger: 'Bonus action', effect: 'Dash, Disengage, or Hide' },
  { name: 'Uncanny Dodge', level: '5+', trigger: 'Reaction when hit', effect: 'Halve damage from one attack' },
  { name: 'Evasion', level: '7+', trigger: 'DEX save for half damage', effect: 'No damage on success' },
  { name: 'Assassinate', level: '3+', trigger: 'Target surprised + advantage', effect: 'Auto-crit on hit' },
];

// Calculate sneak attack dice based on level
function getSneakAttackDice(level: number): string {
  const dice = Math.ceil(level / 2);
  return `+${dice}d6`;
}

export function CombatPrimerStep({ state, validation }: CombatPrimerStepProps) {
  // Interactive Sneak Attack demo state
  const [hasAdvantage, setHasAdvantage] = useState(false);
  const [allyNearby, setAllyNearby] = useState(false);
  const [usingFinesseRanged, setUsingFinesseRanged] = useState(true);
  const [hasDisadvantage, setHasDisadvantage] = useState(false);

  // Calculate sneak attack eligibility
  const sneakAttackResult = useMemo(() => {
    if (!usingFinesseRanged) {
      return { eligible: false, reason: 'Need Finesse or Ranged weapon' };
    }
    if (hasDisadvantage) {
      return { eligible: false, reason: 'Disadvantage blocks Sneak Attack' };
    }
    if (hasAdvantage) {
      return { eligible: true, reason: 'Advantage grants Sneak Attack' };
    }
    if (allyNearby) {
      return { eligible: true, reason: 'Ally adjacent enables Sneak Attack' };
    }
    return { eligible: false, reason: 'Need advantage or ally within 5ft' };
  }, [hasAdvantage, allyNearby, usingFinesseRanged, hasDisadvantage]);

  const sneakAttackDamage = getSneakAttackDice(state.level);

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      <div className="fixed inset-0 bg-background/70 -z-10" />

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/20 border border-red-500/30 mb-3">
            <Swords className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Combat Basics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Master the art of tactical combat
          </p>
        </motion.div>

        {/* Accordion Sections */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Accordion type="multiple" defaultValue={['action-economy', 'sneak-attack']} className="space-y-3">
            
            {/* Section 1: Action Economy */}
            <AccordionItem value="action-economy" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Action Economy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Each turn, you have these resources to spend:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_ECONOMY.map((item) => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        item.bgColor,
                        item.borderColor,
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <item.icon className={cn("w-4 h-4", item.color)} />
                        <span className={cn("text-xs font-bold", item.color)}>{item.label}</span>
                      </div>
                      <p className="text-[10px] text-foreground/80">{item.description}</p>
                      <p className="text-[9px] text-muted-foreground mt-1 italic">{item.examples}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Sneak Attack Rules */}
            <AccordionItem value="sneak-attack" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Sneak Attack Rules</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Toggle conditions to see when Sneak Attack triggers:
                </p>
                
                {/* Interactive Demo */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="finesse" 
                      checked={usingFinesseRanged}
                      onCheckedChange={(checked) => setUsingFinesseRanged(checked as boolean)}
                    />
                    <Label htmlFor="finesse" className="text-xs cursor-pointer">
                      Using Finesse or Ranged weapon
                    </Label>
                  </div>
                  
                  <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium">AND one of:</p>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="advantage" 
                        checked={hasAdvantage}
                        onCheckedChange={(checked) => setHasAdvantage(checked as boolean)}
                      />
                      <Label htmlFor="advantage" className="text-xs cursor-pointer">
                        Have Advantage (Hidden, Target Surprised)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="ally" 
                        checked={allyNearby}
                        onCheckedChange={(checked) => setAllyNearby(checked as boolean)}
                      />
                      <Label htmlFor="ally" className="text-xs cursor-pointer">
                        Ally within 5ft of target
                      </Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="disadvantage" 
                      checked={hasDisadvantage}
                      onCheckedChange={(checked) => setHasDisadvantage(checked as boolean)}
                    />
                    <Label htmlFor="disadvantage" className="text-xs cursor-pointer text-red-400">
                      Have Disadvantage (blocks Sneak Attack)
                    </Label>
                  </div>
                </div>

                {/* Result Indicator */}
                <div className={cn(
                  "p-3 rounded-lg border flex items-center gap-3",
                  sneakAttackResult.eligible 
                    ? "bg-green-500/20 border-green-500/30" 
                    : "bg-red-500/20 border-red-500/30"
                )}>
                  {sneakAttackResult.eligible ? (
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div>
                    <p className={cn(
                      "text-sm font-bold",
                      sneakAttackResult.eligible ? "text-green-400" : "text-red-400"
                    )}>
                      {sneakAttackResult.eligible ? 'SNEAK ATTACK ELIGIBLE' : 'NOT ELIGIBLE'}
                    </p>
                    <p className="text-[10px] text-foreground/70">{sneakAttackResult.reason}</p>
                  </div>
                  {sneakAttackResult.eligible && (
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted-foreground">Damage</p>
                      <p className="text-sm font-bold text-green-400">{sneakAttackDamage}</p>
                    </div>
                  )}
                </div>

                {/* Level info */}
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  At level {state.level}, Sneak Attack adds {sneakAttackDamage} damage
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Combat Tab Navigation */}
            <AccordionItem value="tabs" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Combat Tab Navigation</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  The Combat screen has 5 tabs:
                </p>
                <div className="space-y-2">
                  {COMBAT_TABS.map((tab) => (
                    <div 
                      key={tab.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border"
                    >
                      <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center">
                        <tab.icon className={cn("w-4 h-4", tab.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold", tab.color)}>{tab.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{tab.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
                  Swipe left/right or tap the bottom nav to switch tabs
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4: Tactical Conditions */}
            <AccordionItem value="conditions" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Tactical Conditions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Toggle these in combat to affect your rolls:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400 font-bold">Hidden</span>
                    <p className="text-muted-foreground">Advantage on attack</p>
                  </div>
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <span className="text-amber-400 font-bold">Ally Adjacent</span>
                    <p className="text-muted-foreground">Enables Sneak Attack</p>
                  </div>
                  <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                    <span className="text-purple-400 font-bold">Target Surprised</span>
                    <p className="text-muted-foreground">Auto-crit (Assassinate)</p>
                  </div>
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 font-bold">Disadvantage</span>
                    <p className="text-muted-foreground">Blocks Sneak Attack</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 5: Assassin Abilities */}
            <AccordionItem value="abilities" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Assassin Abilities</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Key features that unlock as you level:
                </p>
                <div className="space-y-2">
                  {ASSASSIN_ABILITIES.map((ability) => (
                    <div 
                      key={ability.name}
                      className={cn(
                        "p-2 rounded-lg border",
                        state.level >= parseInt(ability.level) 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-muted/30 border-border opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">{ability.name}</span>
                        <span className="text-[10px] text-muted-foreground">Lv {ability.level}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{ability.trigger}</p>
                      <p className="text-[10px] text-primary font-medium">{ability.effect}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6: Turn Wizard */}
            <AccordionItem value="turn-wizard" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Turn Wizard AI</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 mb-3">
                  <p className="text-xs text-foreground">
                    Not sure what to do? The <strong>Turn Wizard</strong> analyzes your situation and suggests optimal actions!
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                    <Target className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-xs font-bold text-green-400">Strike from Shadows!</p>
                      <p className="text-[10px] text-muted-foreground">You have advantage - use Sneak Attack</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-amber-400">Hide First</p>
                      <p className="text-[10px] text-muted-foreground">Cunning Action for advantage</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <div>
                      <p className="text-xs font-bold text-red-400">Critical HP!</p>
                      <p className="text-[10px] text-muted-foreground">Consider Disengage to escape</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 7: Combat Log & AI */}
            <AccordionItem value="combat-log" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">AI DM Integration</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Every combat action generates rich AI DM prompts:
                </p>
                <ul className="space-y-1 text-[10px] text-foreground/80 mb-3">
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-400" />
                    Weapon attacks with hit rolls and damage
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-400" />
                    Abilities used with tier and effects
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-400" />
                    Spells cast with slot level
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-400" />
                    Items consumed and reactions triggered
                  </li>
                </ul>
                <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-[10px] text-indigo-400 font-medium">
                    💡 Use "AI Synthesize" to combine all actions into a unified narrative summary!
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 8: Reactions */}
            <AccordionItem value="reactions" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Reactions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Use your reaction when triggered by enemy actions:
                </p>
                <div className="space-y-2 text-[10px]">
                  <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-cyan-400">Opportunity Attack</span>
                      <span className="text-muted-foreground">Lv 1+</span>
                    </div>
                    <p className="text-muted-foreground">Enemy leaves your reach → One melee attack</p>
                  </div>
                  <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-cyan-400">Uncanny Dodge</span>
                      <span className="text-muted-foreground">Lv 5+</span>
                    </div>
                    <p className="text-muted-foreground">You're hit by visible attacker → Halve damage</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 9: Target Tracker */}
            <AccordionItem value="targets" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Target Tracker</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Track enemies you're fighting for richer AI prompts:
                </p>
                <ul className="space-y-1 text-[10px] text-foreground/80">
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Add enemies with Name, HP, AC, creature type
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Apply conditions (Poisoned, Prone, etc.)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Track damage dealt and remaining HP
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-primary" />
                    Auto-populated from Chronicle Sync
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* Section 10: End Turn */}
            <AccordionItem value="end-turn" className="parchment-bg rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Turn Cycle</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</span>
                    <span className="text-foreground">Start of Turn: Resources reset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</span>
                    <span className="text-foreground">Take Actions: Use Action, Bonus, Movement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</span>
                    <span className="text-foreground">Reactions: Available on enemy turns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">4</span>
                    <span className="text-foreground">End Turn: Tap END (hold for AI summary)</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </motion.div>
      </div>
    </div>
  );
}
