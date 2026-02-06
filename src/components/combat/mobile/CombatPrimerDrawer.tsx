// Combat Primer Drawer - Mobile-first scrollable reference for combat mechanics

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
  Target,
  Eye,
  Compass,
  Sparkles,
  Users,
  Moon,
  AlertTriangle,
  Play,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CombatPrimerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterLevel?: number;
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
    examples: ['Attack', 'Dash', 'Dodge', 'Cast a spell'],
  },
  { 
    id: 'bonus', 
    label: 'BONUS ACTION', 
    icon: Zap, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    description: 'Quick supplementary actions',
    examples: ['Cunning Action', 'Two-Weapon Fighting', 'Some spells'],
  },
  { 
    id: 'reaction', 
    label: 'REACTION', 
    icon: Shield, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    description: 'Triggered responses (1 per round)',
    examples: ['Opportunity Attack', 'Uncanny Dodge', 'Shield spell'],
  },
  { 
    id: 'movement', 
    label: 'MOVEMENT', 
    icon: Footprints, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    description: '30 feet per turn (typical)',
    examples: ['Split before/after actions', 'Difficult terrain = 2x cost'],
  },
];

// Combat tab data
const COMBAT_TABS = [
  { id: 'combat', label: 'COMBAT', icon: Crosshair, color: 'text-red-400', bgColor: 'bg-red-500/10', description: 'Weapon attacks and stealth abilities' },
  { id: 'actions', label: 'ACTIONS', icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/10', description: 'All abilities with action type filters' },
  { id: 'magic', label: 'MAGIC', icon: Wand2, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', description: 'Spells and spell slot tracking' },
  { id: 'items', label: 'ITEMS', icon: Backpack, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', description: 'Consumables, potions, scrolls' },
  { id: 'log', label: 'LOG', icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10', description: 'Combat history with AI prompts' },
];

// Tactical conditions
const TACTICAL_CONDITIONS = [
  { label: 'Hidden', effect: 'Advantage on your attack', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Eye },
  { label: 'Ally Adjacent', effect: 'Enables Sneak Attack', color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: Users },
  { label: 'Target Surprised', effect: 'Auto-crit (Assassinate)', color: 'text-purple-400', bgColor: 'bg-purple-500/10', icon: Sparkles },
  { label: 'In Darkness', effect: 'Can attempt to Hide', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', icon: Moon },
  { label: 'Disadvantage', effect: 'Blocks Sneak Attack!', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: AlertTriangle },
];

// Assassin abilities data
const ASSASSIN_ABILITIES = [
  { name: 'Sneak Attack', level: 1, description: 'Extra damage when you have advantage or ally is adjacent to target', effect: '+Xd6 damage (scales with level)' },
  { name: 'Cunning Action', level: 2, description: 'Use Dash, Disengage, or Hide as a bonus action', effect: 'Free up your action for attacks' },
  { name: 'Assassinate', level: 3, description: 'Advantage vs enemies that haven\'t acted yet', effect: 'Auto-critical on surprised targets' },
  { name: 'Uncanny Dodge', level: 5, description: 'When hit by a visible attacker, use reaction', effect: 'Halve the damage you take' },
  { name: 'Evasion', level: 7, description: 'DEX saves that deal half damage on success', effect: 'Take no damage on success, half on fail' },
];

function getSneakAttackDice(level: number): string {
  const dice = Math.ceil(level / 2);
  return `${dice}d6`;
}

export function CombatPrimerDrawer({ 
  open, 
  onOpenChange, 
  characterLevel = 1 
}: CombatPrimerDrawerProps) {
  // Interactive Sneak Attack demo state
  const [hasAdvantage, setHasAdvantage] = useState(false);
  const [allyNearby, setAllyNearby] = useState(false);
  const [usingFinesseRanged, setUsingFinesseRanged] = useState(true);
  const [hasDisadvantage, setHasDisadvantage] = useState(false);

  const sneakAttackResult = useMemo(() => {
    if (!usingFinesseRanged) {
      return { eligible: false, reason: 'You need a Finesse or Ranged weapon' };
    }
    if (hasDisadvantage) {
      return { eligible: false, reason: 'Disadvantage blocks Sneak Attack' };
    }
    if (hasAdvantage) {
      return { eligible: true, reason: 'Advantage qualifies you!' };
    }
    if (allyNearby) {
      return { eligible: true, reason: 'Ally adjacent qualifies you!' };
    }
    return { eligible: false, reason: 'Need advantage OR ally within 5ft of target' };
  }, [hasAdvantage, allyNearby, usingFinesseRanged, hasDisadvantage]);

  const sneakAttackDamage = getSneakAttackDice(characterLevel);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-2" />
        
        {/* Fixed Header */}
        <DrawerHeader className="pb-3 border-b border-border/50">
          <DrawerTitle className="flex items-center justify-center gap-2 font-cinzel text-lg text-primary">
            <Swords className="w-5 h-5" />
            Combat Guide
          </DrawerTitle>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Scroll to learn the basics
          </p>
        </DrawerHeader>
        
        {/* Scrollable Content */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Section 1: Action Economy */}
          <section>
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              Your Turn Resources
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Each turn you have these resources to spend:
            </p>
            <div className="space-y-3">
              {ACTION_ECONOMY.map((item, index) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-4 rounded-xl border-2",
                    item.bgColor,
                    item.borderColor,
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", item.bgColor)}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <div>
                      <span className={cn("text-sm font-bold", item.color)}>{item.label}</span>
                      <p className="text-xs text-foreground/80">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.examples.map((example) => (
                      <span 
                        key={example}
                        className="text-xs px-2 py-1 rounded-full bg-background/50 text-muted-foreground"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Section 2: Sneak Attack */}
          <section>
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Sneak Attack
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your most powerful damage ability. At level {characterLevel}, it adds <span className="text-primary font-bold">+{sneakAttackDamage}</span> damage.
            </p>
            
            {/* Interactive Demo */}
            <div className="bg-card/80 rounded-xl border border-border p-4 space-y-4">
              <p className="text-xs font-medium text-foreground">
                Try it! Toggle conditions to check eligibility:
              </p>
              
              {/* Weapon requirement */}
              <label className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border active:bg-background/80 cursor-pointer">
                <Checkbox 
                  id="mobile-finesse" 
                  checked={usingFinesseRanged}
                  onCheckedChange={(checked) => setUsingFinesseRanged(checked as boolean)}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">Using Finesse or Ranged weapon</span>
                  <p className="text-xs text-muted-foreground">Daggers, rapiers, shortbows, etc.</p>
                </div>
              </label>
              
              {/* Qualifier section */}
              <div className="pl-3 border-l-2 border-primary/40 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Plus ONE of these:
                </p>
                
                <label className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border active:bg-background/80 cursor-pointer">
                  <Checkbox 
                    id="mobile-advantage" 
                    checked={hasAdvantage}
                    onCheckedChange={(checked) => setHasAdvantage(checked as boolean)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Have Advantage</span>
                    <p className="text-xs text-muted-foreground">Hidden, target surprised, etc.</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border active:bg-background/80 cursor-pointer">
                  <Checkbox 
                    id="mobile-ally" 
                    checked={allyNearby}
                    onCheckedChange={(checked) => setAllyNearby(checked as boolean)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Ally within 5ft of target</span>
                    <p className="text-xs text-muted-foreground">Ally must not be incapacitated</p>
                  </div>
                </label>
              </div>
              
              {/* Blocker */}
              <label className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 active:bg-red-500/20 cursor-pointer">
                <Checkbox 
                  id="mobile-disadvantage" 
                  checked={hasDisadvantage}
                  onCheckedChange={(checked) => setHasDisadvantage(checked as boolean)}
                  className="w-5 h-5 border-red-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-red-400">Have Disadvantage</span>
                  <p className="text-xs text-red-400/70">This BLOCKS Sneak Attack!</p>
                </div>
              </label>

              {/* Result */}
              <div className={cn(
                "p-4 rounded-xl border-2 flex items-center gap-3 transition-all",
                sneakAttackResult.eligible 
                  ? "bg-emerald-500/20 border-emerald-500/50" 
                  : "bg-red-500/20 border-red-500/50"
              )}>
                {sneakAttackResult.eligible ? (
                  <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className={cn(
                    "text-base font-bold",
                    sneakAttackResult.eligible ? "text-emerald-400" : "text-red-400"
                  )}>
                    {sneakAttackResult.eligible ? 'Sneak Attack!' : 'Not Eligible'}
                  </p>
                  <p className="text-xs text-foreground/70">{sneakAttackResult.reason}</p>
                </div>
                {sneakAttackResult.eligible && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Bonus</p>
                    <p className="text-lg font-bold text-emerald-400">+{sneakAttackDamage}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Tactical Conditions */}
          <section>
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Tactical Conditions
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Toggle these in combat to affect your rolls and damage:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {TACTICAL_CONDITIONS.map((condition) => (
                <div 
                  key={condition.label}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    condition.bgColor,
                    "border-border"
                  )}
                >
                  <condition.icon className={cn("w-5 h-5 shrink-0", condition.color)} />
                  <div className="flex-1">
                    <span className={cn("text-sm font-bold", condition.color)}>{condition.label}</span>
                    <p className="text-xs text-muted-foreground">{condition.effect}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Combat Tabs */}
          <section>
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-primary" />
              Navigation Tabs
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use the bottom navigation to switch between these tabs:
            </p>
            <div className="space-y-2">
              {COMBAT_TABS.map((tab) => (
                <div 
                  key={tab.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    tab.bgColor,
                    "border border-border"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center">
                    <tab.icon className={cn("w-5 h-5", tab.color)} />
                  </div>
                  <div className="flex-1">
                    <span className={cn("text-sm font-bold", tab.color)}>{tab.label}</span>
                    <p className="text-xs text-muted-foreground">{tab.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Assassin Abilities */}
          <section>
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              Your Abilities
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Key features that unlock as you level up:
            </p>
            <div className="space-y-3">
              {ASSASSIN_ABILITIES.map((ability) => {
                const isUnlocked = characterLevel >= ability.level;
                return (
                  <div 
                    key={ability.name}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      isUnlocked 
                        ? "bg-primary/10 border-primary/40" 
                        : "bg-muted/20 border-border opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-bold",
                        isUnlocked ? "text-primary" : "text-muted-foreground"
                      )}>
                        {ability.name}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        isUnlocked 
                          ? "bg-primary/20 text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        Level {ability.level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{ability.description}</p>
                    <p className={cn(
                      "text-xs font-medium",
                      isUnlocked ? "text-primary" : "text-muted-foreground"
                    )}>
                      → {ability.effect}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 6: Turn Wizard */}
          <section className="pb-8">
            <h3 className="font-cinzel font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              Turn Wizard AI
            </h3>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border-2 border-primary/30 p-4">
              <p className="text-sm text-foreground mb-3">
                Not sure what to do? The <span className="font-bold text-primary">Turn Wizard</span> suggests optimal actions based on your situation:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Detects if you're hidden → suggests Sneak Attack</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Warns when HP is low → suggests Hide or Disengage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Reminds about unused actions and abilities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Shows ready reactions you can trigger</span>
                </li>
              </ul>
            </div>
          </section>

        </div>
      </DrawerContent>
    </Drawer>
  );
}
