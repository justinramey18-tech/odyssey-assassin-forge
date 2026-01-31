import { AbilityTree } from '@/lib/types';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TreeSelectorProps {
  selected: AbilityTree;
  onChange: (tree: AbilityTree) => void;
  pointsByTree: Record<AbilityTree, number>;
}

const TREE_ORDER: AbilityTree[] = ['hunter', 'warrior', 'assassin'];

export function TreeSelector({ selected, onChange, pointsByTree }: TreeSelectorProps) {
  return (
    <div className="w-full">
      <Tabs value={selected} onValueChange={(v) => onChange(v as AbilityTree)} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-14 bg-background/50">
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
        </TabsList>
      </Tabs>
      
      {/* Swipe indicator dots */}
      <div className="flex justify-center gap-2 mt-2">
        {TREE_ORDER.map(tree => (
          <div
            key={tree}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              selected === tree 
                ? `bg-${TREE_VISUAL_CONFIG[tree].primary}` 
                : 'bg-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );
}
