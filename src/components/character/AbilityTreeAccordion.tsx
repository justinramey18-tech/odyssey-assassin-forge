import { Ability, AbilityTree } from '@/lib/types';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AbilityCard } from './AbilityCard';
import { Target, Sword, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AbilityTreeAccordionProps {
  tree: AbilityTree;
  abilities: Ability[];
  pointsInTree: number;
  characterLevel: number;
  getAbilityTier: (abilityId: string) => 0 | 1 | 2 | 3;
  canUpgrade: (abilityId: string) => boolean;
  onUpgrade: (abilityId: string) => void;
  onDowngrade: (abilityId: string) => void;
}

const treeConfig = {
  hunter: {
    name: 'Hunter',
    icon: Target,
    emoji: '🏹',
    description: 'Ranged combat & awareness',
    borderClass: 'border-hunter/50',
    bgClass: 'bg-hunter-dim/20',
    glowClass: 'glow-hunter',
    textClass: 'text-hunter-foreground',
    accentClass: 'text-hunter-glow',
  },
  warrior: {
    name: 'Warrior',
    icon: Sword,
    emoji: '⚔️',
    description: 'Melee combat & defense',
    borderClass: 'border-warrior/50',
    bgClass: 'bg-warrior-dim/20',
    glowClass: 'glow-warrior',
    textClass: 'text-warrior-foreground',
    accentClass: 'text-warrior-glow',
  },
  assassin: {
    name: 'Assassin',
    icon: Skull,
    emoji: '🗡️',
    description: 'Stealth & critical strikes',
    borderClass: 'border-assassin/50',
    bgClass: 'bg-assassin-dim/20',
    glowClass: 'glow-assassin',
    textClass: 'text-assassin-foreground',
    accentClass: 'text-assassin-glow',
  },
};

export function AbilityTreeAccordion({
  tree,
  abilities,
  pointsInTree,
  characterLevel,
  getAbilityTier,
  canUpgrade,
  onUpgrade,
  onDowngrade,
}: AbilityTreeAccordionProps) {
  const config = treeConfig[tree];
  const Icon = config.icon;

  const activeAbilities = abilities.filter(a => a.type === 'active');
  const passiveAbilities = abilities.filter(a => a.type === 'passive');

  return (
    <AccordionItem
      value={tree}
      className={cn(
        'rounded-lg border-2 overflow-hidden transition-all duration-300',
        config.borderClass,
        config.bgClass
      )}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-background/20">
        <div className="flex items-center gap-3 w-full">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center border-2',
            config.borderClass,
            config.bgClass,
            pointsInTree > 0 && config.glowClass
          )}>
            <Icon className={cn('w-5 h-5', config.accentClass)} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-lg font-display font-semibold text-foreground">
                {config.emoji} {config.name}
              </span>
              {pointsInTree > 0 && (
                <span className={cn(
                  'text-sm font-body px-2 py-0.5 rounded-full',
                  config.bgClass,
                  config.accentClass
                )}>
                  {pointsInTree} pts
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-body">
              {config.description}
            </p>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        {/* Active Abilities */}
        <div className="mb-4">
          <h4 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            Active Abilities
            <span className="h-px flex-1 bg-border" />
          </h4>
          <div className="space-y-2">
            {activeAbilities.map(ability => (
              <AbilityCard
                key={ability.id}
                ability={ability}
                currentTier={getAbilityTier(ability.id)}
                canUpgrade={canUpgrade(ability.id)}
                characterLevel={characterLevel}
                onUpgrade={() => onUpgrade(ability.id)}
                onDowngrade={() => onDowngrade(ability.id)}
              />
            ))}
          </div>
        </div>

        {/* Passive Abilities */}
        <div>
          <h4 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            Passive Abilities
            <span className="h-px flex-1 bg-border" />
          </h4>
          <div className="space-y-2">
            {passiveAbilities.map(ability => (
              <AbilityCard
                key={ability.id}
                ability={ability}
                currentTier={getAbilityTier(ability.id)}
                canUpgrade={canUpgrade(ability.id)}
                characterLevel={characterLevel}
                onUpgrade={() => onUpgrade(ability.id)}
                onDowngrade={() => onDowngrade(ability.id)}
              />
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
