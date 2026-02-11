import { useMemo } from 'react';
import { Ability, CharacterAbility } from '@/lib/types';
import { HOMEBREW_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { HomebrewAbility } from '@/lib/abilityCustomization/types';
import { AbilityNode } from './AbilityNode';
import { cn } from '@/lib/utils';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HomebrewTreeColumnProps {
  characterAbilities: CharacterAbility[];
  selectedAbilityId: string | null;
  isMobile: boolean;
  abilityImages?: Record<string, string>;
  homebrewAbilities: HomebrewAbility[];
  onSelectAbility: (id: string) => void;
  onCreateNew: () => void;
}

export function HomebrewTreeColumn({
  characterAbilities,
  selectedAbilityId,
  isMobile,
  abilityImages = {},
  homebrewAbilities,
  onSelectAbility,
  onCreateNew,
}: HomebrewTreeColumnProps) {
  const config = HOMEBREW_VISUAL_CONFIG;

  // Create unlocked abilities map
  const unlockedAbilities = useMemo(() => {
    const map = new Map<string, number>();
    characterAbilities.forEach(ca => {
      if (ca.currentTier > 0) {
        map.set(ca.abilityId, ca.currentTier);
      }
    });
    return map;
  }, [characterAbilities]);

  // Group homebrew abilities by their assigned tree for visual organization
  const groupedAbilities = useMemo(() => {
    const groups: Record<string, HomebrewAbility[]> = {
      hunter: [],
      warrior: [],
      assassin: [],
    };
    homebrewAbilities.forEach(h => {
      if (groups[h.tree]) {
        groups[h.tree].push(h);
      }
    });
    return groups;
  }, [homebrewAbilities]);

  const treeLabels: Record<string, string> = {
    hunter: '🏹 Hunter',
    warrior: '⚔️ Warrior',
    assassin: '🗡️ Assassin',
  };

  return (
    <div className={cn(
      'relative flex flex-col',
      isMobile ? 'w-full' : 'flex-1 min-w-[300px]'
    )}>
      {/* Background */}
      <div className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(180deg, hsl(40 30% 10%) 0%, hsl(40 20% 5%) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40 z-0" />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 p-4 gap-6">
        {/* Create Button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={onCreateNew}
            className={cn(
              'gap-2 border-homebrew/50 text-homebrew',
              'hover:bg-homebrew/10 bg-homebrew/5'
            )}
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            Create Homebrew Ability
          </Button>
        </div>

        {/* Abilities grouped by tree origin */}
        {(['hunter', 'warrior', 'assassin'] as const).map(tree => {
          const abilities = groupedAbilities[tree];
          if (abilities.length === 0) return null;

          return (
            <div key={tree} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-homebrew/70">
                  {treeLabels[tree]}
                </span>
                <div className="flex-1 h-px bg-homebrew/20" />
                <span className="text-xs text-muted-foreground">{abilities.length}</span>
              </div>

              {/* Nodes Grid - mimics tree layout */}
              <div className={cn(
                'flex flex-wrap justify-center gap-4',
                isMobile ? 'gap-3' : 'gap-5'
              )}>
                {abilities.map((homebrew) => {
                  const currentTier = (unlockedAbilities.get(homebrew.id) || 0) as 0 | 1 | 2 | 3;
                  const nodeSize = isMobile ? 56 : 68;

                  const homebrewAsAbility: Ability = {
                    id: homebrew.id,
                    name: homebrew.name,
                    tree: homebrew.tree,
                    icon: homebrew.icon,
                    type: homebrew.type,
                    actionType: homebrew.actionType,
                    usageType: homebrew.usageType,
                    tierEffects: homebrew.tierEffects,
                    minLevel: homebrew.minLevel,
                    prerequisite: homebrew.prerequisite,
                  };

                  return (
                    <div key={homebrew.id} className="flex flex-col items-center">
                      <div className="relative">
                        {/* Gold homebrew glow */}
                        <div className={cn(
                          'absolute -inset-1 rounded-full opacity-40 blur-sm',
                          'bg-gradient-to-br from-homebrew/40 to-homebrew/20'
                        )} />
                        <AbilityNode
                          ability={homebrewAsAbility}
                          currentTier={currentTier}
                          isAccessible={true}
                          isSelected={selectedAbilityId === homebrew.id}
                          isMobile={isMobile}
                          customImage={abilityImages[homebrew.id]}
                          isHomebrew
                          onSelect={() => onSelectAbility(homebrew.id)}
                        />
                      </div>
                      <div className={cn(
                        'text-center whitespace-nowrap mt-1',
                        'text-xs text-muted-foreground',
                        isMobile ? 'max-w-[70px] truncate' : 'max-w-[80px] truncate'
                      )}>
                        {homebrew.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {homebrewAbilities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Sparkles className="w-10 h-10 text-homebrew/40" />
            <p className="text-sm text-muted-foreground">No homebrew abilities yet</p>
            <p className="text-xs text-muted-foreground/70">Create your first custom ability above</p>
          </div>
        )}
      </div>

      {/* Tree Header - At Bottom */}
      <div className={cn(
        'relative z-10 flex items-center justify-between px-4 py-3 border-t',
        'border-homebrew/20',
        `bg-gradient-to-t ${config.gradient}`
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-homebrew/20'
          )}>
            <Sparkles className="w-5 h-5 text-homebrew" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-homebrew-foreground">
              {config.name}
            </h3>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-bold text-homebrew">
            {homebrewAbilities.length}
          </span>
          {' abilities'}
        </div>
      </div>
    </div>
  );
}
