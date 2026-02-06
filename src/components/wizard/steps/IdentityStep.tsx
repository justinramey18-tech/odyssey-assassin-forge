import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { getAbilityPointsForLevel } from '@/lib/types';
import { Skull, User, Shield, Swords, Crosshair, Ghost, Flame, Zap, Moon, Sun, Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import wizardBackground from '@/assets/wizard-background.jpg';
import { WizardState, PortraitIcon, PORTRAIT_ICONS } from '../types';

interface IdentityStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'name' | 'level' | 'portraitIcon'>>) => void;
}

// Icon component map
const ICON_COMPONENTS: Record<PortraitIcon, React.ComponentType<{ className?: string }>> = {
  Skull,
  User,
  Shield,
  Sword: Swords,
  Crosshair,
  Ghost,
  Flame,
  Zap,
  Moon,
  Sun,
  Star,
  Crown,
};

export function IdentityStep({ state, onUpdate }: IdentityStepProps) {
  const [nameError, setNameError] = useState<string | null>(null);
  
  const abilityPoints = getAbilityPointsForLevel(state.level);

  const handleNameChange = (value: string) => {
    // Validate name (2-30 chars, alphanumeric + apostrophe/hyphen/space)
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
    } else if (trimmed.length > 30) {
      setNameError('Name must be 30 characters or less');
    } else if (trimmed && !/^[a-zA-Z][a-zA-Z0-9\s'-]*$/.test(trimmed)) {
      setNameError('Name can only contain letters, numbers, spaces, apostrophes, and hyphens');
    } else {
      setNameError(null);
    }
    onUpdate({ name: value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Wizard Background Image */}
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
            Character Identity
          </p>
        </div>

        {/* Form Card */}
        <div className="parchment-bg rounded-lg border border-border p-6 space-y-6">
          {/* Character Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              Character Name
            </Label>
            <Input
              id="name"
              type="text"
              value={state.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your assassin's name..."
              className={cn(
                "bg-background/50 border-border focus:border-primary font-body",
                nameError && "border-destructive focus:border-destructive"
              )}
              maxLength={30}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Level Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
                Level
              </Label>
              <span className="text-2xl font-display font-bold text-primary">
                {state.level}
              </span>
            </div>
            <Slider
              value={[state.level]}
              onValueChange={(vals) => onUpdate({ level: vals[0] })}
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

          {/* Portrait Icon Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              Portrait Icon
            </Label>
            <div className="grid grid-cols-6 gap-2">
              {PORTRAIT_ICONS.map((iconName) => {
                const IconComponent = ICON_COMPONENTS[iconName];
                const isSelected = state.portraitIcon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => onUpdate({ portraitIcon: iconName })}
                    className={cn(
                      "aspect-square rounded-lg border-2 flex items-center justify-center transition-all",
                      isSelected 
                        ? "border-primary bg-primary/20 text-primary scale-110" 
                        : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats Preview */}
          <div className="bg-background/30 rounded-md p-4 border border-border/50">
            <div className="text-center">
              <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-1">
                Ability Points at Level {state.level}
              </p>
              <p className="text-3xl font-display font-bold text-primary glow-gold">
                {abilityPoints}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-body">
                For skill trees
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
