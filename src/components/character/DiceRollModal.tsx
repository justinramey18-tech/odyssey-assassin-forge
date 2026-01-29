import { useState } from 'react';
import { Ability } from '@/lib/types';
import { DiceRoll, formatRollResult } from '@/lib/diceRoller';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Copy, Check, Dices } from 'lucide-react';

interface DiceRollModalProps {
  ability?: Ability;
  tier: 1 | 2 | 3;
  roll: DiceRoll;
  rpPrompt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReroll?: () => void;
}

const treeConfig = {
  hunter: {
    bgClass: 'bg-hunter-dim/30',
    borderClass: 'border-hunter/50',
    glowClass: 'text-hunter-glow',
    accentClass: 'bg-hunter/20 border-hunter/30',
  },
  warrior: {
    bgClass: 'bg-warrior-dim/30',
    borderClass: 'border-warrior/50',
    glowClass: 'text-warrior-glow',
    accentClass: 'bg-warrior/20 border-warrior/30',
  },
  assassin: {
    bgClass: 'bg-assassin-dim/30',
    borderClass: 'border-assassin/50',
    glowClass: 'text-assassin-glow',
    accentClass: 'bg-assassin/20 border-assassin/30',
  },
};

export function DiceRollModal({
  ability,
  tier,
  roll,
  rpPrompt,
  open,
  onOpenChange,
  onReroll,
}: DiceRollModalProps) {
  const [copied, setCopied] = useState(false);
  
  // Default to neutral styling for generic combat rolls
  const tree = ability ? treeConfig[ability.tree] : {
    bgClass: 'bg-red-900/20',
    borderClass: 'border-red-500/50',
    glowClass: 'text-red-400',
    accentClass: 'bg-red-900/20 border-red-500/30',
  };

  const isCritical = roll.rolls.includes(parseInt(roll.die.slice(1)));
  const isFumble = roll.rolls.every(r => r === 1);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rpPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'max-w-2xl border-2',
        tree.borderClass,
        tree.bgClass
      )}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            <Dices className={cn('w-6 h-6', tree.glowClass)} />
            {ability ? `${ability.name} — Dice Roll` : 'Combat Roll'}
          </DialogTitle>
        </DialogHeader>

        {/* Roll Result Display */}
        <div className={cn(
          'rounded-lg border p-4 text-center',
          tree.accentClass
        )}>
          <div className="text-sm text-muted-foreground font-body mb-1">
            Rolling {roll.count}{roll.die}{ability ? ` for Tier ${tier}` : ''}
          </div>
          <div className={cn(
            'text-4xl font-display font-bold',
            isCritical ? 'text-tier-maxed animate-pulse' : isFumble ? 'text-destructive' : tree.glowClass
          )}>
            {roll.total}
          </div>
          <div className="text-sm font-body text-muted-foreground mt-1">
            [{roll.rolls.join(' + ')}]{roll.modifier !== 0 ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''}
          </div>
          {isCritical && (
            <div className="text-tier-maxed font-display text-sm mt-2 uppercase tracking-wider">
              ✦ Critical Success! ✦
            </div>
          )}
          {isFumble && (
            <div className="text-destructive font-display text-sm mt-2 uppercase tracking-wider">
              ✗ Critical Failure ✗
            </div>
          )}
        </div>

        {/* RP Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display uppercase tracking-wider text-muted-foreground">
              AI DM Prompt
            </span>
            <div className="flex gap-2">
              {onReroll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReroll}
                  className="gap-1"
                >
                  <Dices className="w-4 h-4" />
                  Reroll
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border border-border/50 bg-background/50 p-4">
            <pre className="text-sm font-body whitespace-pre-wrap text-foreground/90">
              {rpPrompt}
            </pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
