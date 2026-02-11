import { AbilityTree } from '@/lib/types';
import { TREE_VISUAL_CONFIG, HOMEBREW_VISUAL_CONFIG, SelectedTreeTab } from '@/lib/abilityTrees/colors';
import { cn } from '@/lib/utils';

interface TreeBottomBarProps {
  selected: SelectedTreeTab;
  onChange: (tree: SelectedTreeTab) => void;
  pointsByTree: Record<AbilityTree, number>;
  homebrewCount?: number;
}

const TREE_ORDER: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

export function TreeBottomBar({ selected, onChange, pointsByTree, homebrewCount = 0 }: TreeBottomBarProps) {
  if (homebrewCount === 0 && selected === 'homebrew') {
    // Shouldn't happen, but fallback
    onChange('hunter');
  }

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
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
                'min-w-[72px]',
                isActive 
                  ? 'bg-muted/50' 
                  : 'hover:bg-muted/30'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn(
                  'w-4 h-4 transition-colors',
                  isActive ? `text-${config.primary}` : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'font-display text-[11px] uppercase tracking-wider transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {config.name}
                </span>
              </div>
              <span className={cn(
                'text-[10px] transition-colors',
                isActive ? `text-${config.primary}` : 'text-muted-foreground'
              )}>
                {points} pts
              </span>
            </button>
          );
        })}

        {/* Homebrew tab - conditional */}
        {homebrewCount > 0 && (() => {
          const config = HOMEBREW_VISUAL_CONFIG;
          const Icon = config.icon;
          const isActive = selected === 'homebrew';

          return (
            <button
              onClick={() => onChange('homebrew')}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
                'min-w-[72px]',
                isActive 
                  ? 'bg-muted/50' 
                  : 'hover:bg-muted/30'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn(
                  'w-4 h-4 transition-colors',
                  isActive ? 'text-homebrew' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'font-display text-[11px] uppercase tracking-wider transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {config.name}
                </span>
              </div>
              <span className={cn(
                'text-[10px] transition-colors',
                isActive ? 'text-homebrew' : 'text-muted-foreground'
              )}>
                {homebrewCount}
              </span>
            </button>
          );
        })()}
      </div>
    </div>
  );
}
