import { useMemo, useRef } from 'react';
import { Ability, CharacterAbility, AbilityTree } from '@/lib/types';
import { ABILITY_TREE_LAYOUT, getNodePosition, getTreeAbilities } from '@/lib/abilityTrees/layout';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { AbilityNode } from './AbilityNode';
import { ConnectionLines } from './ConnectionLine';
import { cn } from '@/lib/utils';

interface TreeColumnProps {
  tree: AbilityTree;
  abilities: Ability[];
  characterAbilities: CharacterAbility[];
  selectedAbilityId: string | null;
  isMobile: boolean;
  pointsInvested: number;
  onSelectAbility: (id: string) => void;
}

export function TreeColumn({
  tree,
  abilities,
  characterAbilities,
  selectedAbilityId,
  isMobile,
  pointsInvested,
  onSelectAbility,
}: TreeColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const treeConfig = TREE_VISUAL_CONFIG[tree];
  const Icon = treeConfig.icon;
  
  // Calculate container dimensions
  const containerWidth = isMobile ? 280 : 320;
  const tierSpacing = isMobile ? 100 : 120;
  const padding = isMobile ? 40 : 60;
  const containerHeight = 5 * tierSpacing + padding * 2;
  
  // Get abilities for this tree
  const treeAbilityIds = useMemo(() => getTreeAbilities(tree), [tree]);
  
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
  
  // Derive connections from prerequisite relationships
  const connections = useMemo(() => {
    const conns: Array<{ from: string; to: string }> = [];
    
    treeAbilityIds.forEach(abilityId => {
      const ability = abilities.find(a => a.id === abilityId);
      if (ability?.prerequisite) {
        conns.push({
          from: ability.prerequisite.abilityId,
          to: abilityId,
        });
      }
    });
    
    // Add visual connections for tier progression (center column abilities)
    const centerAbilities = treeAbilityIds.filter(id => {
      const layout = ABILITY_TREE_LAYOUT[id];
      return layout?.column === 1;
    });
    
    for (let i = 0; i < centerAbilities.length - 1; i++) {
      // Only add if no existing prerequisite connection
      const alreadyConnected = conns.some(
        c => c.from === centerAbilities[i] && c.to === centerAbilities[i + 1]
      );
      if (!alreadyConnected) {
        conns.push({
          from: centerAbilities[i],
          to: centerAbilities[i + 1],
        });
      }
    }
    
    return conns;
  }, [treeAbilityIds, abilities]);
  
  // Check if an ability is locked based on prerequisites and level
  const isAbilityLocked = (ability: Ability): boolean => {
    if (!ability.prerequisite) return false;
    
    const prereqTier = unlockedAbilities.get(ability.prerequisite.abilityId) || 0;
    return prereqTier < ability.prerequisite.tier;
  };
  
  // Check if an ability is available to unlock
  const isAbilityAvailable = (ability: Ability): boolean => {
    const currentTier = unlockedAbilities.get(ability.id) || 0;
    if (currentTier >= 3) return false; // Already maxed
    
    return !isAbilityLocked(ability);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative flex flex-col',
        isMobile ? 'w-full' : 'flex-1 min-w-[300px]'
      )}
    >
      {/* Tree Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        `border-${treeConfig.primary}/20`,
        `bg-gradient-to-r ${treeConfig.gradient}`
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            `bg-${treeConfig.primary}/20`
          )}>
            <Icon className={cn('w-5 h-5', `text-${treeConfig.primary}`)} />
          </div>
          <div>
            <h3 className={cn('font-bold text-lg', `text-${treeConfig.primary}-foreground`)}>
              {treeConfig.name}
            </h3>
            <p className="text-xs text-muted-foreground">{treeConfig.subtitle}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className={cn('font-bold', `text-${treeConfig.primary}`)}>
            {pointsInvested}
          </span>
          {' pts'}
        </div>
      </div>
      
      {/* Ability Tree Container */}
      <div 
        className="relative flex-1 overflow-y-auto"
        style={{ minHeight: containerHeight }}
      >
        {/* Connection Lines SVG */}
        <ConnectionLines
          tree={tree}
          connections={connections}
          unlockedAbilities={unlockedAbilities}
          isMobile={isMobile}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
        
        {/* Ability Nodes */}
        {treeAbilityIds.map(abilityId => {
          const ability = abilities.find(a => a.id === abilityId);
          const layout = ABILITY_TREE_LAYOUT[abilityId];
          
          if (!ability || !layout) return null;
          
          const position = getNodePosition(tree, layout.tier, layout.column, isMobile, containerWidth);
          const currentTier = (unlockedAbilities.get(abilityId) || 0) as 0 | 1 | 2 | 3;
          const isLocked = isAbilityLocked(ability);
          const isAvailable = isAbilityAvailable(ability);
          
          const nodeSize = isMobile ? 64 : 80;
          
          return (
            <div
              key={abilityId}
              className="absolute z-10"
              style={{
                left: position.x - nodeSize / 2,
                top: position.y - nodeSize / 2,
              }}
            >
              <AbilityNode
                ability={ability}
                currentTier={currentTier}
                isLocked={isLocked}
                isAvailable={isAvailable}
                isSelected={selectedAbilityId === abilityId}
                isMobile={isMobile}
                onSelect={() => onSelectAbility(abilityId)}
              />
              
              {/* Ability name tooltip */}
              <div className={cn(
                'absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap',
                'text-xs text-muted-foreground mt-1',
                isMobile ? 'max-w-[80px] truncate' : ''
              )}
              style={{ top: nodeSize + 4 }}
              >
                {ability.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
