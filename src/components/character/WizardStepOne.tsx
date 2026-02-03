import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getAbilityPointsForLevel } from '@/lib/types';
import { DiceOddsMode, loadDiceOddsMode } from '@/lib/diceOdds';
import { DiceOddsWidget } from '@/components/settings/DiceOddsWidget';
import { calculateMaxHP, getHPBreakdown } from '@/lib/hpCalculation';
import { Skull, ChevronRight, Settings, Heart, Info } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import wizardBackground from '@/assets/wizard-background.jpg';

interface WizardStepOneProps {
  initialName: string;
  initialLevel: number;
  initialConstitution?: number;
  onComplete: (name: string, level: number, constitution: number) => void;
}

export function WizardStepOne({ initialName, initialLevel, initialConstitution = 10, onComplete }: WizardStepOneProps) {
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(initialLevel);
  const [constitution, setConstitution] = useState(initialConstitution);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>('fair');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setDiceOddsMode(loadDiceOddsMode());
  }, []);

  const abilityPoints = getAbilityPointsForLevel(level);
  
  // Calculate CON modifier and HP
  const constitutionModifier = useMemo(() => Math.floor((constitution - 10) / 2), [constitution]);
  const hpBreakdown = useMemo(() => getHPBreakdown(level, constitutionModifier, 0), [level, constitutionModifier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim(), level, constitution);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Wizard Background Image - highly visible */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      {/* Light tint overlay for readability */}
      <div className="fixed inset-0 bg-background/40 -z-10" />
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-card border-2 border-primary/50 mb-4 glow-gold">
            <Skull className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-wide">
            ODYSSEY
          </h1>
          <p className="text-lg text-primary font-display tracking-widest mt-1">
            ASSASSIN
          </p>
          <p className="text-sm text-muted-foreground mt-2 font-body">
            Character Builder
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="parchment-bg rounded-lg border border-border p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              Character Name
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your assassin's name..."
              className="bg-background/50 border-border focus:border-primary font-body"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
                Level
              </Label>
              <span className="text-2xl font-display font-bold text-primary">
                {level}
              </span>
            </div>
            <Slider
              value={[level]}
              onValueChange={(vals) => setLevel(vals[0])}
              min={1}
              max={20}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-body">
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
            </div>
          </div>

          {/* Constitution Score */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
                Constitution
              </Label>
              <span className="text-2xl font-display font-bold text-primary">
                {constitution}
                <span className="text-sm text-muted-foreground ml-2">
                  ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier})
                </span>
              </span>
            </div>
            <Slider
              value={[constitution]}
              onValueChange={(vals) => setConstitution(vals[0])}
              min={3}
              max={20}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-body">
              <span>3</span>
              <span>8</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
            </div>
          </div>

          {/* Stats Preview Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ability Points */}
            <div className="bg-background/30 rounded-md p-4 border border-border/50">
              <div className="text-center">
                <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-1">
                  Ability Points
                </p>
                <p className="text-3xl font-display font-bold text-primary glow-gold">
                  {abilityPoints}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 font-body">
                  For skill trees
                </p>
              </div>
            </div>

            {/* Starting HP */}
            <div className="bg-background/30 rounded-md p-4 border border-border/50">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Heart className="w-3 h-3 text-destructive" />
                  <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                    Starting HP
                  </p>
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
                <p className="text-3xl font-display font-bold text-destructive">
                  {hpBreakdown.totalHP}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 font-body">
                  Hit Points
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Settings Collapsible */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="font-display text-xs uppercase tracking-wider">Advanced Settings</span>
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {/* Dice Odds Widget */}
              <DiceOddsWidget 
                value={diceOddsMode} 
                onChange={setDiceOddsMode} 
              />
            </CollapsibleContent>
          </Collapsible>

          <Button
            type="submit"
            className="w-full font-display uppercase tracking-wider"
            size="lg"
            disabled={!name.trim()}
          >
            Continue to Abilities
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
