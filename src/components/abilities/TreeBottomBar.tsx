import { AbilityTree } from '@/lib/types';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { cn } from '@/lib/utils';

interface TreeBottomBarProps {
  selected: AbilityTree;
  onChange: (tree: AbilityTree) => void;
  pointsByTree: Record<AbilityTree, number>;
}

const TREE_ORDER: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

export function TreeBottomBar({ selected, onChange, pointsByTree }: TreeBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-around py-3 px-2">
        {TREE_ORDER.map((tree) => {
          const config = TREE_VISUAL_CONFIG[tree];
          const Icon = config.icon;
          const isActive = selected === tree;
          const points = pointsByTree[tree];
          
          return (
            <button
              key={tree}
              onClick={() => onChange(tree)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all',
                'min-w-[90px]',
                isActive 
                  ? 'bg-muted/50' 
                  : 'hover:bg-muted/30'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? `text-${config.primary}` : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'font-display text-sm uppercase tracking-wider transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {config.name}
                </span>
              </div>
              <span className={cn(
                'text-xs transition-colors',
                isActive ? `text-${config.primary}` : 'text-muted-foreground'
              )}>
                {points} pts
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
