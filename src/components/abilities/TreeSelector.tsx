import { AbilityTree } from '@/lib/types';
import { TREE_VISUAL_CONFIG, HOMEBREW_VISUAL_CONFIG, SelectedTreeTab } from '@/lib/abilityTrees/colors';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TreeSelectorProps {
  selected: SelectedTreeTab;
  onChange: (tree: SelectedTreeTab) => void;
  pointsByTree: Record<AbilityTree, number>;
  homebrewCount?: number;
}

const TREE_ORDER: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

export function TreeSelector({ selected, onChange, pointsByTree, homebrewCount = 0 }: TreeSelectorProps) {
  const showHomebrew = homebrewCount > 0;
  const allTabs: SelectedTreeTab[] = showHomebrew 
    ? [...TREE_ORDER, 'homebrew'] 
    : [...TREE_ORDER];

  return (
    <div className="w-full">
      <Tabs value={selected} onValueChange={(v) => onChange(v as SelectedTreeTab)} className="w-full">
        <TabsList className={cn(
          'w-full h-14 bg-background/50',
          showHomebrew ? 'grid grid-cols-4' : 'grid grid-cols-3'
        )}>
          {TREE_ORDER.map(tree => {
            const config = TREE_VISUAL_CONFIG[tree];
            const Icon = config.icon;
            const points = pointsByTree[tree];
            
            return (
              <TabsTrigger
                key={tree}
                value={tree}
                className={cn(
                  'flex flex-col gap-0.5 h-full rounded-lg transition-all',
                  `data-[state=active]:bg-${config.primary}/20`,
                  `data-[state=active]:text-${config.primary}-foreground`,
                  'data-[state=active]:shadow-sm'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn(
                    'w-5 h-5',
                    `group-data-[state=active]:text-${config.primary}`
                  )} />
                  <span className="text-xs font-medium">{config.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {points} pts
                </span>
              </TabsTrigger>
            );
          })}
          
          {showHomebrew && (
            <TabsTrigger
              value="homebrew"
              className={cn(
                'flex flex-col gap-0.5 h-full rounded-lg transition-all',
                'data-[state=active]:bg-homebrew/20',
                'data-[state=active]:text-homebrew-foreground',
                'data-[state=active]:shadow-sm'
              )}
            >
              <div className="flex items-center gap-1.5">
                <HOMEBREW_VISUAL_CONFIG.icon className="w-5 h-5" />
                <span className="text-xs font-medium">Homebrew</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {homebrewCount}
              </span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      
      {/* Swipe indicator dots */}
      <div className="flex justify-center gap-2 mt-2">
        {allTabs.map(tab => (
          <div
            key={tab}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              selected === tab 
                ? tab === 'homebrew'
                  ? 'bg-homebrew'
                  : `bg-${TREE_VISUAL_CONFIG[tab as AbilityTree].primary}` 
                : 'bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );
}
