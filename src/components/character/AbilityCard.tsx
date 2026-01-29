import { useState } from 'react';
import { Ability } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Minus, Lock, Info, HelpCircle, Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2, Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart, Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain, Dices } from 'lucide-react';
import { AbilityDetailModal } from './AbilityDetailModal';
import { DiceRollModal } from './DiceRollModal';
import { rollDice, getAbilityDice, DiceRoll } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';

// Icon map for dynamic icon rendering
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2,
  Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart,
  Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain,
  HelpCircle,
};

interface AbilityCardProps {
  ability: Ability;
  currentTier: 0 | 1 | 2 | 3;
  canUpgrade: boolean;
  characterLevel: number;
  characterName: string;
  onUpgrade: () => void;
  onDowngrade: () => void;
}

const actionTypeLabels = {
  action: 'Action',
  bonus_action: 'Bonus Action',
  reaction: 'Reaction',
  passive: 'Passive',
};

export function AbilityCard({
  ability,
  currentTier,
  canUpgrade,
  characterLevel,
  characterName,
  onUpgrade,
  onDowngrade,
}: AbilityCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [currentRoll, setCurrentRoll] = useState<DiceRoll | null>(null);
  const [currentRPPrompt, setCurrentRPPrompt] = useState('');

  const isLocked = currentTier === 0;
  const isMaxed = currentTier === 3;
  const levelLocked = ability.minLevel && characterLevel < ability.minLevel;

  // Get the icon component dynamically
  const IconComponent = iconMap[ability.icon] || HelpCircle;

  // Get current effect description
  const currentEffect = currentTier > 0
    ? ability.tierEffects.find(e => e.tier === currentTier)?.description
    : ability.tierEffects[0].description;

  // Tree-specific styling
  const treeStyles = {
    hunter: {
      border: 'border-hunter/30',
      bg: 'bg-hunter-dim/10',
      glow: 'border-hunter glow-hunter',
      icon: 'text-hunter-glow',
    },
    warrior: {
      border: 'border-warrior/30',
      bg: 'bg-warrior-dim/10',
      glow: 'border-warrior glow-warrior',
      icon: 'text-warrior-glow',
    },
    assassin: {
      border: 'border-assassin/30',
      bg: 'bg-assassin-dim/10',
      glow: 'border-assassin glow-assassin',
      icon: 'text-assassin-glow',
    },
  };

  const styles = treeStyles[ability.tree];

  const handleCardClick = () => {
    // If unlocked and NOT passive, trigger dice roll
    if (!isLocked && ability.type !== 'passive') {
      performDiceRoll();
    } else {
      // Passive or locked abilities show detail modal
      setShowModal(true);
    }
  };

  const performDiceRoll = () => {
    const tier = currentTier as 1 | 2 | 3;
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, tier, roll, characterName);
    
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
    setShowDiceModal(true);
  };

  const handleReroll = () => {
    const tier = currentTier as 1 | 2 | 3;
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, tier, roll, characterName);
    
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
  };

  return (
    <>
      <div
        className={cn(
          'rounded-lg border p-3 transition-all duration-300 cursor-pointer hover:bg-background/30',
          isLocked ? 'border-border/50 bg-background/20 opacity-70' : styles.border,
          !isLocked && styles.bg,
          isMaxed && styles.glow
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
            isLocked ? 'bg-muted' : styles.bg
          )}>
            {levelLocked ? (
              <Lock className="w-4 h-4 text-muted-foreground" />
            ) : (
              <IconComponent className={cn('w-4 h-4', isLocked ? 'text-muted-foreground' : styles.icon)} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className={cn(
                'font-display font-semibold text-sm',
                isLocked ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {ability.name}
              </h5>
              
              {/* Tier Indicators */}
              <div className="flex gap-1">
                {[1, 2, 3].map(tier => (
                  <div
                    key={tier}
                    className={cn(
                      'tier-dot',
                      tier <= currentTier
                        ? (isMaxed ? 'tier-dot-maxed' : 'tier-dot-active')
                        : 'tier-dot-locked'
                    )}
                  />
                ))}
              </div>

              {/* Badges */}
              {ability.type === 'passive' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-body">
                  Passive
                </Badge>
              )}
              {levelLocked && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-body">
                  Lv.{ability.minLevel}+
                </Badge>
              )}
            </div>

            {/* Action Type */}
            {!isLocked && (
              <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wide mt-0.5">
                {actionTypeLabels[ability.actionType]}
              </p>
            )}

            {/* Effect Description */}
            <p className={cn(
              'text-xs mt-1 line-clamp-2 font-body',
              isLocked ? 'text-muted-foreground/70' : 'text-foreground/80'
            )}>
              {isLocked ? `Unlock: ${currentEffect}` : currentEffect}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {!levelLocked && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    'h-7 w-7',
                    canUpgrade ? 'text-primary hover:text-primary hover:bg-primary/20' : 'text-muted-foreground'
                  )}
                  disabled={!canUpgrade}
                  onClick={onUpgrade}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {currentTier > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                    onClick={onDowngrade}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowModal(true)}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AbilityDetailModal
        ability={ability}
        currentTier={currentTier}
        open={showModal}
        onOpenChange={setShowModal}
      />

      {currentRoll && currentTier > 0 && (
        <DiceRollModal
          ability={ability}
          tier={currentTier as 1 | 2 | 3}
          roll={currentRoll}
          rpPrompt={currentRPPrompt}
          open={showDiceModal}
          onOpenChange={setShowDiceModal}
          onReroll={handleReroll}
        />
      )}
    </>
  );
}
