import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getAbilityPointsForLevel } from '@/lib/types';
import { Skull, ChevronRight } from 'lucide-react';

interface WizardStepOneProps {
  initialName: string;
  initialLevel: number;
  onComplete: (name: string, level: number) => void;
}

export function WizardStepOne({ initialName, initialLevel, onComplete }: WizardStepOneProps) {
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(initialLevel);

  const abilityPoints = getAbilityPointsForLevel(level);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim(), level);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
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

          {/* Points Preview */}
          <div className="bg-background/30 rounded-md p-4 border border-border/50">
            <div className="text-center">
              <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-1">
                Available Ability Points
              </p>
              <p className="text-4xl font-display font-bold text-primary glow-gold">
                {abilityPoints}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-body">
                To allocate across Hunter, Warrior & Assassin trees
              </p>
            </div>
          </div>

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
