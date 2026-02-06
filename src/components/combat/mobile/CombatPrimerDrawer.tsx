// Combat Primer Drawer - Standalone reference for combat mechanics
// Reusable content from the wizard step, accessible from Combat tab

import { useState, useMemo } from 'react';
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
  RotateCcw,
  ChevronDown,
  Lightbulb,
  Compass,
  HelpCircle,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    examples: 'Attack, Dash, Dodge, Cast spell',
  },
  { 
    id: 'bonus', 
    label: 'BONUS', 
    icon: Zap, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    description: 'Quick supplementary actions',
    examples: 'Cunning Action, Two-Weapon Fighting',
  },
  { 
    id: 'reaction', 
    label: 'REACT', 
    icon: Shield, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    description: 'Triggered responses (1/round)',
    examples: 'Opportunity Attack, Uncanny Dodge',
  },
  { 
    id: 'movement', 
    label: 'MOVE', 
    icon: Footprints, 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    description: '30ft per turn (typical)',
    examples: 'Split before/after actions',
  },
];

// Combat tab data
const COMBAT_TABS = [
  { id: 'combat', label: 'COMBAT', icon: Crosshair, color: 'text-red-400', description: 'Weapon attacks, stealth abilities' },
  { id: 'actions', label: 'ACTIONS', icon: Zap, color: 'text-amber-400', description: 'All abilities with action filters' },
  { id: 'magic', label: 'MAGIC', icon: Wand2, color: 'text-indigo-400', description: 'Spells and spell slots' },
  { id: 'items', label: 'ITEMS', icon: Backpack, color: 'text-green-400', description: 'Consumables and potions' },
  { id: 'log', label: 'LOG', icon: FileText, color: 'text-primary', description: 'Combat history with AI prompts' },
];

// Assassin abilities data
const ASSASSIN_ABILITIES = [
  { name: 'Sneak Attack', level: 1, trigger: 'Finesse/ranged + advantage or ally adjacent', effect: '+Xd6 damage' },
  { name: 'Cunning Action', level: 2, trigger: 'Bonus action', effect: 'Dash, Disengage, or Hide' },
  { name: 'Uncanny Dodge', level: 5, trigger: 'Reaction when hit', effect: 'Halve damage' },
  { name: 'Evasion', level: 7, trigger: 'DEX save for half', effect: 'No damage on success' },
  { name: 'Assassinate', level: 3, trigger: 'Surprised + advantage', effect: 'Auto-crit' },
];

function getSneakAttackDice(level: number): string {
  const dice = Math.ceil(level / 2);
  return `+${dice}d6`;
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

  const sneakAttackDamage = getSneakAttackDice(characterLevel);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mt-2 mb-1" />
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center justify-center gap-2 font-cinzel text-primary">
            <Swords className="w-5 h-5" />
            Combat Quick Reference
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-4 pb-6">
          <Accordion type="multiple" defaultValue={['action-economy', 'sneak-attack']} className="space-y-3">
            
            {/* Action Economy */}
            <AccordionItem value="action-economy" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Action Economy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_ECONOMY.map((item) => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-2 rounded-lg border",
                        item.bgColor,
                        item.borderColor,
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                        <span className={cn("text-[10px] font-bold", item.color)}>{item.label}</span>
                      </div>
                      <p className="text-[9px] text-foreground/80">{item.description}</p>
                      <p className="text-[8px] text-muted-foreground mt-0.5 italic">{item.examples}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sneak Attack Rules */}
            <AccordionItem value="sneak-attack" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Sneak Attack Rules</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-[10px] text-muted-foreground mb-2">
                  Toggle to check eligibility:
                </p>
                
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="primer-finesse" 
                      checked={usingFinesseRanged}
                      onCheckedChange={(checked) => setUsingFinesseRanged(checked as boolean)}
                    />
                    <Label htmlFor="primer-finesse" className="text-[10px] cursor-pointer">
                      Using Finesse/Ranged weapon
                    </Label>
                  </div>
                  
                  <div className="pl-3 border-l-2 border-primary/30 space-y-1.5">
                    <p className="text-[9px] text-muted-foreground font-medium">AND one of:</p>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="primer-advantage" 
                        checked={hasAdvantage}
                        onCheckedChange={(checked) => setHasAdvantage(checked as boolean)}
                      />
                      <Label htmlFor="primer-advantage" className="text-[10px] cursor-pointer">
                        Have Advantage
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="primer-ally" 
                        checked={allyNearby}
                        onCheckedChange={(checked) => setAllyNearby(checked as boolean)}
                      />
                      <Label htmlFor="primer-ally" className="text-[10px] cursor-pointer">
                        Ally within 5ft of target
                      </Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="primer-disadvantage" 
                      checked={hasDisadvantage}
                      onCheckedChange={(checked) => setHasDisadvantage(checked as boolean)}
                    />
                    <Label htmlFor="primer-disadvantage" className="text-[10px] cursor-pointer text-red-400">
                      Have Disadvantage (blocks it)
                    </Label>
                  </div>
                </div>

                {/* Result */}
                <div className={cn(
                  "p-2 rounded-lg border flex items-center gap-2",
                  sneakAttackResult.eligible 
                    ? "bg-green-500/20 border-green-500/30" 
                    : "bg-red-500/20 border-red-500/30"
                )}>
                  {sneakAttackResult.eligible ? (
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      "text-[10px] font-bold",
                      sneakAttackResult.eligible ? "text-green-400" : "text-red-400"
                    )}>
                      {sneakAttackResult.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                    </p>
                    <p className="text-[9px] text-foreground/70">{sneakAttackResult.reason}</p>
                  </div>
                  {sneakAttackResult.eligible && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-green-400">{sneakAttackDamage}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Combat Tabs */}
            <AccordionItem value="tabs" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Tab Navigation</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {COMBAT_TABS.map((tab) => (
                    <div 
                      key={tab.id}
                      className="flex items-center gap-2 p-1.5 rounded bg-background/50"
                    >
                      <tab.icon className={cn("w-3.5 h-3.5", tab.color)} />
                      <span className={cn("text-[10px] font-bold", tab.color)}>{tab.label}</span>
                      <span className="text-[9px] text-muted-foreground">— {tab.description}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tactical Conditions */}
            <AccordionItem value="conditions" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Tactical Conditions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                  <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400 font-bold">Hidden</span>
                    <p className="text-muted-foreground">Advantage on attack</p>
                  </div>
                  <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                    <span className="text-amber-400 font-bold">Ally Adjacent</span>
                    <p className="text-muted-foreground">Enables Sneak Attack</p>
                  </div>
                  <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                    <span className="text-purple-400 font-bold">Surprised</span>
                    <p className="text-muted-foreground">Auto-crit</p>
                  </div>
                  <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 font-bold">Disadvantage</span>
                    <p className="text-muted-foreground">Blocks Sneak Attack</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Assassin Abilities */}
            <AccordionItem value="abilities" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Assassin Abilities</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {ASSASSIN_ABILITIES.map((ability) => (
                    <div 
                      key={ability.name}
                      className={cn(
                        "p-1.5 rounded border",
                        characterLevel >= ability.level 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-muted/30 border-border opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold">{ability.name}</span>
                        <span className="text-[9px] text-muted-foreground">Lv{ability.level}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{ability.trigger}</p>
                      <p className="text-[9px] text-primary">{ability.effect}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Turn Wizard */}
            <AccordionItem value="turn-wizard" className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">Turn Wizard AI</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-[10px] text-foreground mb-2">
                    The Turn Wizard suggests optimal actions:
                  </p>
                  <ul className="text-[9px] text-muted-foreground space-y-1">
                    <li>• Detects if you're hidden → suggests Sneak Attack</li>
                    <li>• Warns when HP is low → suggests Hide/Disengage</li>
                    <li>• Reminds about unused actions</li>
                    <li>• Shows ready reactions</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
