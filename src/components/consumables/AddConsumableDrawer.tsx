import { useState } from 'react';
import { 
  Package,
  Plus,
  Check,
  ChevronDown,
  Skull,
  FlaskConical,
  ScrollText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Consumable, 
  rarityConfig
} from '@/lib/consumables/types';
import { potions } from '@/lib/consumables/potions';
import { poisons } from '@/lib/consumables/poisons';
import { scrolls } from '@/lib/consumables/scrolls';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerTrigger 
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AddConsumableDrawerProps {
  onAddItem: (consumable: Consumable, quantity: number) => void;
  getItemCount: (id: string) => number;
}

interface ConsumableItemProps {
  consumable: Consumable;
  onAdd: (consumable: Consumable) => void;
  currentCount: number;
  justAdded: boolean;
}

function ConsumableItem({ consumable, onAdd, currentCount, justAdded }: ConsumableItemProps) {
  const rarity = rarityConfig[consumable.rarity];
  const ItemIcon = getIconByName(consumable.icon);
  
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all',
        'bg-card hover:bg-card/80',
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd(consumable);
          }}
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
}

interface CategoryDropdownProps {
  label: string;
  icon: React.ReactNode;
  items: Consumable[];
  colorClass: string;
  onAddItem: (consumable: Consumable) => void;
  getItemCount: (id: string) => number;
  recentlyAdded: Set<string>;
}

function CategoryDropdown({ 
  label, 
  icon, 
  items, 
  colorClass,
  onAddItem, 
  getItemCount, 
  recentlyAdded 
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between h-14 text-lg font-semibold',
            'border-2 hover:bg-accent/50',
            colorClass
          )}
        >
          <span className="flex items-center gap-3">
            {icon}
            {label}
            <Badge variant="secondary" className="ml-2">
              {items.length}
            </Badge>
          </span>
          <ChevronDown className={cn(
            'w-5 h-5 transition-transform',
            open && 'rotate-180'
          )} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-[calc(100vw-2rem)] max-w-md p-0 bg-background border-2"
        align="center"
        sideOffset={8}
      >
        <ScrollArea className="h-[50vh] max-h-[400px]">
          <div className="p-3 space-y-2">
            {items.map(consumable => (
              <ConsumableItem
                key={consumable.id}
                consumable={consumable}
                onAdd={onAddItem}
                currentCount={getItemCount(consumable.id)}
                justAdded={recentlyAdded.has(consumable.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddConsumableDrawer({ onAddItem, getItemCount }: AddConsumableDrawerProps) {
  const [open, setOpen] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  
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
      
      <DrawerContent className="h-[100dvh] max-h-[100dvh] flex flex-col">
        <DrawerHeader className="border-b border-border/50 pb-4 shrink-0">
          <DrawerTitle className="flex items-center gap-2 text-xl">
            <Package className="w-6 h-6" />
            Add Consumables
          </DrawerTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a category to browse items
          </p>
        </DrawerHeader>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4 max-w-md mx-auto">
            {/* Potions Dropdown */}
            <CategoryDropdown
              label="Potions"
              icon={<FlaskConical className="w-6 h-6 text-blue-400" />}
              items={potions}
              colorClass="border-blue-500/50 hover:border-blue-500"
              onAddItem={handleAdd}
              getItemCount={getItemCount}
              recentlyAdded={recentlyAdded}
            />
            
            {/* Poisons Dropdown */}
            <CategoryDropdown
              label="Poisons"
              icon={<Skull className="w-6 h-6 text-green-400" />}
              items={poisons}
              colorClass="border-green-500/50 hover:border-green-500"
              onAddItem={handleAdd}
              getItemCount={getItemCount}
              recentlyAdded={recentlyAdded}
            />
            
            {/* Scrolls Dropdown */}
            <CategoryDropdown
              label="Scrolls"
              icon={<ScrollText className="w-6 h-6 text-amber-400" />}
              items={scrolls}
              colorClass="border-amber-500/50 hover:border-amber-500"
              onAddItem={handleAdd}
              getItemCount={getItemCount}
              recentlyAdded={recentlyAdded}
            />
          </div>
        </div>
        
        {/* Close button at bottom */}
        <div className="shrink-0 p-4 border-t border-border/50">
          <Button 
            variant="secondary" 
            className="w-full max-w-md mx-auto block"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
