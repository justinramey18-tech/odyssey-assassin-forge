import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  GameModeSettings, 
  HonestModeRules, 
  getAllRuleKeys, 
  getRuleDescription,
} from '@/lib/gameModes';
import { DICE_ODDS_CONFIGS, DiceOddsMode } from '@/lib/diceOdds';
import { WizardState, XP_PRESETS, XPPreset } from '../types';
import { cn } from '@/lib/utils';
import { 
  Infinity, 
  Shield, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Rocket, 
  Mountain, 
  Milestone,
  Dices,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import wizardBackground from '@/assets/wizard-background.jpg';

interface GameModeStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'gameMode' | 'honestModeRules' | 'xpPreset' | 'diceOddsMode'>>) => void;
}

const XP_PRESET_ICONS: Record<XPPreset, React.ComponentType<{ className?: string }>> = {
  standard: Zap,
  fastTrack: Rocket,
  epicJourney: Mountain,
  milestone: Milestone,
};

export function GameModeStep({ state, onUpdate }: GameModeStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleModeChange = (mode: 'honest' | 'infinityPool') => {
    onUpdate({ gameMode: mode });
  };

  const handleRuleChange = (rule: keyof HonestModeRules, enabled: boolean) => {
    onUpdate({
      honestModeRules: {
        ...state.honestModeRules,
        [rule]: enabled,
      },
    });
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
          <h2 className="text-2xl font-display font-bold text-foreground">Game Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose your play style and progression rules</p>
        </div>

        <div className="parchment-bg rounded-lg border border-border p-4 space-y-6">
          {/* Game Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              Play Style
            </Label>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Infinity Pool Mode */}
              <button
                type="button"
                onClick={() => handleModeChange('infinityPool')}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  state.gameMode === 'infinityPool'
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/50 hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Infinity className="w-5 h-5 text-primary" />
                  <span className="font-display font-bold text-foreground">Infinity Pool</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full sandbox access. All features unlocked. Perfect for experimentation.
                </p>
              </button>

              {/* Honest Mode */}
              <button
                type="button"
                onClick={() => handleModeChange('honest')}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  state.gameMode === 'honest'
                    ? "border-accent bg-accent/10"
                    : "border-border bg-background/50 hover:border-accent/50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-accent" />
                  <span className="font-display font-bold text-foreground">Honest Mode</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Authentic progression. Restrictions enforce immersive gameplay.
                </p>
              </button>
            </div>
          </div>

          {/* XP Preset Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              XP Progression
            </Label>
            
            <RadioGroup
              value={state.xpPreset}
              onValueChange={(v) => onUpdate({ xpPreset: v as XPPreset })}
              className="grid grid-cols-2 gap-2"
            >
              {Object.entries(XP_PRESETS).map(([key, config]) => {
                const Icon = XP_PRESET_ICONS[key as XPPreset];
                return (
                  <div key={key}>
                    <RadioGroupItem value={key} id={`xp-${key}`} className="sr-only" />
                    <Label
                      htmlFor={`xp-${key}`}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                        state.xpPreset === key
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/50 hover:border-primary/50"
                      )}
                    >
                      <Icon className={cn(
                        "w-4 h-4",
                        state.xpPreset === key ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className="text-sm font-display font-semibold text-foreground">{config.label}</p>
                        <p className="text-[10px] text-muted-foreground">{config.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Dice Odds Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Dices className="w-4 h-4" />
              Dice Odds
            </Label>
            
            <RadioGroup
              value={state.diceOddsMode}
              onValueChange={(v) => onUpdate({ diceOddsMode: v as DiceOddsMode })}
              className="space-y-2"
            >
              {Object.entries(DICE_ODDS_CONFIGS).map(([key, config]) => (
                <div key={key}>
                  <RadioGroupItem value={key} id={`dice-${key}`} className="sr-only" />
                  <Label
                    htmlFor={`dice-${key}`}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      state.diceOddsMode === key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50 hover:border-primary/50"
                    )}
                  >
                    <div>
                      <p className="text-sm font-display font-semibold text-foreground">{config.label}</p>
                      <p className="text-[10px] text-muted-foreground">{config.description}</p>
                    </div>
                    <span className="text-[10px] text-primary/70 italic max-w-[120px] text-right">
                      {config.deadpoolQuote}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Advanced Settings (Honest Mode Rules) */}
          {state.gameMode === 'honest' && (
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="text-sm font-display">Honest Mode Rules</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                {getAllRuleKeys().map((rule) => {
                  const { label, description } = getRuleDescription(rule);
                  return (
                    <div
                      key={rule}
                      className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background/30"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-display text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        checked={state.honestModeRules[rule]}
                        onCheckedChange={(checked) => handleRuleChange(rule, checked)}
                      />
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}
