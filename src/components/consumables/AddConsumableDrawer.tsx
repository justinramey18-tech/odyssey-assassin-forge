import { useState } from 'react';
import { 
  Package,
  Search,
  Plus,
  Check,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Consumable, 
  ConsumableType,
  rarityConfig, 
  typeConfig 
} from '@/lib/consumables/types';
import { allConsumables } from '@/lib/consumables';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerTrigger 
} from '@/components/ui/drawer';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';

interface AddConsumableDrawerProps {
  onAddItem: (consumable: Consumable, quantity: number) => void;
  getItemCount: (id: string) => number;
}

export function AddConsumableDrawer({ onAddItem, getItemCount }: AddConsumableDrawerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ConsumableType | 'all'>('all');
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  
  const filteredItems = allConsumables.filter(item => {
    const matchesSearch = search === '' || 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.effect.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });
  
  const handleAdd = (consumable: Consumable) => {
    onAddItem(consumable, 1);
    setRecentlyAdded(prev => new Set(prev).add(consumable.id));
    toast.success(`Added ${consumable.name} to inventory`);
    setTimeout(() => {
      setRecentlyAdded(prev => {
        const next = new Set(prev);
        next.delete(consumable.id);
        return next;
      });
    }, 1500);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Items
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="border-b border-border/50 pb-4 shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Add Consumables
          </DrawerTitle>
          
          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search potions, poisons, scrolls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Type Filter */}
          <ToggleGroup 
            type="single" 
            value={typeFilter}
            onValueChange={(v) => setTypeFilter((v || 'all') as ConsumableType | 'all')}
            className="justify-start mt-3"
          >
            <ToggleGroupItem value="all" size="sm" className="text-xs">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="potion" size="sm" className="text-xs gap-1">
              <span className={typeConfig.potion.color}>⚗️</span> Potions
            </ToggleGroupItem>
            <ToggleGroupItem value="poison" size="sm" className="text-xs gap-1">
              <span className={typeConfig.poison.color}>☠️</span> Poisons
            </ToggleGroupItem>
            <ToggleGroupItem value="scroll" size="sm" className="text-xs gap-1">
              <span className={typeConfig.scroll.color}>📜</span> Scrolls
            </ToggleGroupItem>
          </ToggleGroup>
        </DrawerHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(85vh-200px)]">
            <div className="p-4 grid gap-2">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Filter className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No items match your search</p>
              </div>
            ) : (
              filteredItems.map(consumable => {
                const rarity = rarityConfig[consumable.rarity];
                const ItemIcon = getIconByName(consumable.icon);
                const currentCount = getItemCount(consumable.id);
                const justAdded = recentlyAdded.has(consumable.id);
                
                return (
                  <div
                    key={consumable.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      'bg-card/50 hover:bg-card',
                      rarity.borderColor,
                      justAdded && 'bg-green-500/20 border-green-500/50'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      rarity.bgColor
                    )}>
                      <ItemIcon className={cn('w-5 h-5', rarity.color)} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('font-medium text-sm truncate', rarity.color)}>
                          {consumable.name}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={cn('text-[10px] shrink-0', rarity.color, rarity.borderColor)}
                        >
                          {rarity.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {consumable.effect}
                      </p>
                    </div>
                    
                    {/* Current Count & Add Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {currentCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          ×{currentCount}
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant={justAdded ? 'default' : 'outline'}
                        className={cn(
                          'h-8 w-8',
                          justAdded && 'bg-green-500 hover:bg-green-600'
                        )}
                        onClick={() => handleAdd(consumable)}
                      >
                        {justAdded ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
