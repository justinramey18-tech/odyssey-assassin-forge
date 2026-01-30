import { useMemo } from 'react';
import { AbilityTree } from '@/lib/types';
import { ABILITY_TREE_LAYOUT, getNodePosition, getConnectionPath } from '@/lib/abilityTrees/layout';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { cn } from '@/lib/utils';

interface ConnectionLineProps {
  fromId: string;
  toId: string;
  isActive: boolean; // Both abilities unlocked
  tree: AbilityTree;
  isMobile: boolean;
  containerWidth: number;
}

export function ConnectionLine({
  fromId,
  toId,
  isActive,
  tree,
  isMobile,
  containerWidth,
}: ConnectionLineProps) {
  const treeConfig = TREE_VISUAL_CONFIG[tree];
  
  const pathData = useMemo(() => {
    const fromLayout = ABILITY_TREE_LAYOUT[fromId];
    const toLayout = ABILITY_TREE_LAYOUT[toId];
    
    if (!fromLayout || !toLayout) return null;
    
    const from = getNodePosition(tree, fromLayout.tier, fromLayout.column, isMobile, containerWidth);
    const to = getNodePosition(tree, toLayout.tier, toLayout.column, isMobile, containerWidth);
    
    return getConnectionPath(from, to, isMobile);
  }, [fromId, toId, tree, isMobile, containerWidth]);

  if (!pathData) return null;

  return (
    <path
      d={pathData}
      fill="none"
      className={cn(
        'transition-all duration-300',
        isActive 
          ? `stroke-${treeConfig.glow}` 
          : 'stroke-muted-foreground/30'
      )}
      strokeWidth={isActive ? 3 : 2}
      strokeDasharray={isActive ? undefined : '4 4'}
      strokeLinecap="round"
      style={isActive && !isMobile ? {
        animation: 'connection-flow 1s linear infinite',
        strokeDasharray: '4 4',
      } : undefined}
    />
  );
}

interface ConnectionLinesProps {
  tree: AbilityTree;
  connections: Array<{ from: string; to: string }>;
  unlockedAbilities: Map<string, number>; // abilityId -> tier
  isMobile: boolean;
  containerWidth: number;
  containerHeight: number;
}

export function ConnectionLines({
  tree,
  connections,
  unlockedAbilities,
  isMobile,
  containerWidth,
  containerHeight,
}: ConnectionLinesProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0"
      width={containerWidth}
      height={containerHeight}
    >
      {connections.map(({ from, to }) => {
        const isActive = (unlockedAbilities.get(from) || 0) > 0 && 
                         (unlockedAbilities.get(to) || 0) > 0;
        
        return (
          <ConnectionLine
            key={`${from}-${to}`}
            fromId={from}
            toId={to}
            isActive={isActive}
            tree={tree}
            isMobile={isMobile}
            containerWidth={containerWidth}
          />
        );
      })}
    </svg>
  );
}
