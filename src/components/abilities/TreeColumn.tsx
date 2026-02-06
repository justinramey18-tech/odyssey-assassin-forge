import { useMemo, useRef, useCallback } from 'react';
import { Ability, CharacterAbility, AbilityTree } from '@/lib/types';
import { ABILITY_TREE_LAYOUT, TIER_LABELS, getNodePosition, getTierSeparatorY, getTreeAbilities } from '@/lib/abilityTrees/layout';
import { TREE_VISUAL_CONFIG, getTreeColor } from '@/lib/abilityTrees/colors';
import { getAbilityAccessibility, getTreeConnections } from '@/lib/abilityTrees/accessibility';
import { getTreeBackground, getTreeFallbackGradient } from '@/lib/abilityTrees/backgrounds';
import { AbilityNode } from './AbilityNode';
import { ConnectionLines } from './ConnectionLine';
import { TierSeparator } from './TierSeparator';
import { HomebrewAbility } from '@/lib/abilityCustomization/types';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface TreeColumnProps {
  tree: AbilityTree;
  abilities: Ability[];
  characterAbilities: CharacterAbility[];
  selectedAbilityId: string | null;
  isMobile: boolean;
  pointsInvested: number;
  abilityImages?: Record<string, string>;
  homebrewAbilities?: HomebrewAbility[];
  onSelectAbility: (id: string) => void;
}

export function TreeColumn({
  tree,
  abilities,
  characterAbilities,
  selectedAbilityId,
  isMobile,
  pointsInvested,
  abilityImages = {},
  homebrewAbilities = [],
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
  
  // Filter homebrew abilities for this tree
  const treeHomebrewAbilities = useMemo(() => 
    homebrewAbilities.filter(h => h.tree === tree),
    [homebrewAbilities, tree]
  );
  
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
  
  // Get connections from parent-child relationships (AC Odyssey style)
  const connections = useMemo(() => getTreeConnections(tree), [tree]);
  
  // Get accessibility for an ability using AC Odyssey logic
  const getAccessibility = useCallback((abilityId: string) => {
    return getAbilityAccessibility(abilityId, unlockedAbilities);
  }, [unlockedAbilities]);
  
  // Tier separators (between tiers 2-5 and their lower neighbors)
  const tierSeparators = useMemo(() => 
    [2, 3, 4, 5].map(tier => ({
      tier,
      label: TIER_LABELS[tier],
      yPosition: getTierSeparatorY(tier, isMobile),
    })),
    [isMobile]
  );
  
  // Calculate homebrew section height
  const homebrewSectionHeight = treeHomebrewAbilities.length > 0 
    ? (isMobile ? 120 : 140) 
    : 0;

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative flex flex-col',
        isMobile ? 'w-full' : 'flex-1 min-w-[300px]'
      )}
    >
      {/* Homebrew Section - Above the main tree */}
      {treeHomebrewAbilities.length > 0 && (
        <div className={cn(
          'relative z-20 border-b',
          `border-${treeConfig.primary}/30`,
          'bg-gradient-to-b from-primary/5 to-transparent'
        )}>
          {/* Homebrew Header */}
          <div className="flex items-center justify-center gap-2 py-2 px-4">
            <Sparkles className={cn('w-4 h-4', `text-${treeConfig.primary}`)} />
            <span className={cn(
              'text-xs font-semibold uppercase tracking-widest',
              `text-${treeConfig.primary}`
            )}>
              Homebrew
            </span>
            <Sparkles className={cn('w-4 h-4', `text-${treeConfig.primary}`)} />
          </div>
          
          {/* Homebrew Nodes Grid */}
          <div className={cn(
            'flex flex-wrap justify-center gap-3 px-4 pb-4',
            isMobile ? 'gap-2' : 'gap-4'
          )}>
            {treeHomebrewAbilities.map((homebrew) => {
              const currentTier = (unlockedAbilities.get(homebrew.id) || 0) as 0 | 1 | 2 | 3;
              const nodeSize = isMobile ? 56 : 68;
              
              // Convert homebrew to ability format for AbilityNode
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
                    {/* Homebrew indicator glow */}
                    <div className={cn(
                      'absolute -inset-1 rounded-full opacity-50 blur-sm',
                      'bg-gradient-to-br from-primary/40 to-primary/20'
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
      )}
      
      {/* Ability Tree Container */}
      <div 
        className="relative flex-1 overflow-y-auto"
        style={{ minHeight: containerHeight }}
      >
        {/* Background Image Layer */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 opacity-40"
          style={{ 
            backgroundImage: `url(${getTreeBackground(tree)})`,
            background: getTreeFallbackGradient(tree),
          }}
        />
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 opacity-40"
          style={{ backgroundImage: `url(${getTreeBackground(tree)})` }}
        />
        {/* Gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40 z-0" />
        {/* Connection Lines SVG */}
        <ConnectionLines
          tree={tree}
          connections={connections}
          unlockedAbilities={unlockedAbilities}
          isMobile={isMobile}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
        
        {/* Tier Separators */}
        {tierSeparators.map(({ tier, label, yPosition }) => (
          <TierSeparator
            key={`sep-${tier}`}
            label={label}
            yPosition={yPosition}
            treeColor={getTreeColor(tree)}
            isMobile={isMobile}
          />
        ))}
        
        {/* Ability Nodes */}
        {treeAbilityIds.map(abilityId => {
          const ability = abilities.find(a => a.id === abilityId);
          const layout = ABILITY_TREE_LAYOUT[abilityId];
          
          if (!ability || !layout) return null;
          
          const position = getNodePosition(tree, layout.tier, layout.column, isMobile, containerWidth);
          const currentTier = (unlockedAbilities.get(abilityId) || 0) as 0 | 1 | 2 | 3;
          const accessibility = getAccessibility(abilityId);
          
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
                isAccessible={accessibility.isAccessible}
                isSelected={selectedAbilityId === abilityId}
                isMobile={isMobile}
                customImage={abilityImages[abilityId]}
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
      
      {/* Tree Header - At Bottom */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-t',
        `border-${treeConfig.primary}/20`,
        `bg-gradient-to-t ${treeConfig.gradient}`
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
    </div>
  );
}
