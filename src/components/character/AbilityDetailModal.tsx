import { Ability } from '@/lib/types';
import { getAbilityById } from '@/lib/abilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Lock, Zap, Clock, RotateCcw, HelpCircle, Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2, Flame, ShieldOff, Megaphone, Swords, Sword, Shield, Heart, Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain } from 'lucide-react';

// Icon map for dynamic icon rendering
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2,
  Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart,
  Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain,
  HelpCircle, Check, Lock, Clock, RotateCcw,
};


interface AbilityDetailModalProps {
  ability: Ability;
  currentTier: 0 | 1 | 2 | 3;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionTypeConfig = {
  action: { label: 'Action', icon: Zap },
  bonus_action: { label: 'Bonus Action', icon: Zap },
  reaction: { label: 'Reaction', icon: RotateCcw },
  passive: { label: 'Passive', icon: Check },
};

const usageTypeConfig = {
  at_will: { label: 'At Will', icon: null },
  short_rest: { label: 'Short Rest', icon: Clock },
  long_rest: { label: 'Long Rest', icon: Clock },
};

const treeConfig = {
  hunter: {
    label: 'Hunter Tree',
    bgClass: 'bg-hunter-dim/30',
    borderClass: 'border-hunter/50',
    glowClass: 'text-hunter-glow',
  },
  warrior: {
    label: 'Warrior Tree',
    bgClass: 'bg-warrior-dim/30',
    borderClass: 'border-warrior/50',
    glowClass: 'text-warrior-glow',
  },
  assassin: {
    label: 'Assassin Tree',
    bgClass: 'bg-assassin-dim/30',
    borderClass: 'border-assassin/50',
    glowClass: 'text-assassin-glow',
  },
};

export function AbilityDetailModal({
  ability,
  currentTier,
  open,
  onOpenChange,
}: AbilityDetailModalProps) {
  const IconComponent = iconMap[ability.icon] || HelpCircle;
  const tree = treeConfig[ability.tree];
  const actionType = actionTypeConfig[ability.actionType];
  const usageType = usageTypeConfig[ability.usageType];
  const ActionIcon = actionType.icon;
  const UsageIcon = usageType.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'max-w-md border-2',
        tree.borderClass,
        tree.bgClass
      )}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center border',
              tree.borderClass,
              tree.bgClass
            )}>
              <IconComponent className={cn('w-6 h-6', tree.glowClass)} />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">{ability.name}</DialogTitle>
              <DialogDescription className="text-xs font-body">
                {tree.label}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tier Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-body">Tier:</span>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(tier => (
              <div
                key={tier}
                className={cn(
                  'w-3 h-3 rounded-full transition-all',
                  tier <= currentTier
                    ? (currentTier === 3 ? 'tier-dot-maxed' : 'tier-dot-active')
                    : 'tier-dot-locked'
                )}
              />
            ))}
          </div>
          <span className={cn(
            'text-sm font-display font-semibold ml-1',
            currentTier === 3 ? 'text-tier-maxed' : 'text-foreground'
          )}>
            {currentTier}/3
            {currentTier === 3 && ' [MAXED]'}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="font-body flex items-center gap-1">
            <ActionIcon className="w-3 h-3" />
            {actionType.label}
          </Badge>
          {UsageIcon && (
            <Badge variant="outline" className="font-body flex items-center gap-1">
              <UsageIcon className="w-3 h-3" />
              {usageType.label}
            </Badge>
          )}
          {ability.type === 'passive' && (
            <Badge variant="outline" className="font-body">
              Passive
            </Badge>
          )}
          {ability.minLevel && (
            <Badge variant="secondary" className="font-body">
              Level {ability.minLevel}+
            </Badge>
          )}
        </div>

        {/* Tier Effects */}
        <div className="space-y-3 mt-2">
          {ability.tierEffects.map((effect) => {
            const isUnlocked = effect.tier <= currentTier;
            const isCurrent = effect.tier === currentTier;

            return (
              <div
                key={effect.tier}
                className={cn(
                  'rounded-md p-3 border transition-all',
                  isUnlocked
                    ? isCurrent
                      ? `${tree.borderClass} ${tree.bgClass}`
                      : 'border-border/50 bg-background/30'
                    : 'border-border/30 bg-background/10 opacity-50'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-xs font-display font-semibold uppercase tracking-wider',
                    isUnlocked ? tree.glowClass : 'text-muted-foreground'
                  )}>
                    Tier {effect.tier}
                  </span>
                  {isUnlocked ? (
                    <Check className={cn('w-3 h-3', tree.glowClass)} />
                  ) : (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <p className={cn(
                  'text-sm font-body',
                  isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {effect.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Synergies */}
        {ability.synergies && ability.synergies.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              Synergies
            </p>
            <div className="flex flex-wrap gap-1">
              {ability.synergies.map(synId => {
                const synAbility = getAbilityById(synId);
                if (!synAbility) return null;
                return (
                  <Badge key={synId} variant="outline" className="text-xs font-body">
                    {synAbility.name}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
