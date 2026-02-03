import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Beaker,
  Skull,
  ScrollText,
  Plus,
  Minus,
  Copy,
  Check,
  Sparkles,
  PackageOpen,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useConsumables } from '@/hooks/use-consumables';
import { useToast } from '@/hooks/use-toast';
import { 
  Consumable, 
  InventoryItem, 
  rarityConfig, 
  typeConfig,
  ConsumableType,
} from '@/lib/consumables/types';
import { generateConsumablePrompt } from '@/lib/consumables/prompts';

// Icon mapping for consumable types
const TYPE_ICONS: Record<ConsumableType, React.ElementType> = {
  potion: Beaker,
  poison: Skull,
  scroll: ScrollText,
};

interface MobileItemsGridProps {
  onAddToTurn: (actionType: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onNavigateToConsumables?: () => void;
}

export function MobileItemsGrid({ onAddToTurn, onNavigateToConsumables }: MobileItemsGridProps) {
  const { toast } = useToast();
  const { inventory, useItem, setItemQuantity, isLoaded } = useConsumables();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<ConsumableType | 'all'>('all');
  const [copied, setCopied] = useState(false);

  // Filter inventory by type
  const filteredInventory = useMemo(() => {
    if (activeFilter === 'all') return inventory;
    return inventory.filter(item => item.consumable.type === activeFilter);
  }, [inventory, activeFilter]);

  // Count by type
  const typeCounts = useMemo(() => ({
    potion: inventory.filter(i => i.consumable.type === 'potion').reduce((s, i) => s + i.quantity, 0),
    poison: inventory.filter(i => i.consumable.type === 'poison').reduce((s, i) => s + i.quantity, 0),
    scroll: inventory.filter(i => i.consumable.type === 'scroll').reduce((s, i) => s + i.quantity, 0),
  }), [inventory]);

  // Get action type for consumable
  const getActionType = (consumable: Consumable): 'action' | 'bonus' => {
    // Potions are typically bonus actions, poisons apply as bonus, scrolls are actions
    if (consumable.type === 'potion') return 'bonus';
    if (consumable.type === 'poison') return 'bonus';
    return 'action';
  };

  // Handle using an item
  const handleUseItem = (item: InventoryItem) => {
    const success = useItem(item.consumable.id, 1);
    if (success) {
      const actionType = getActionType(item.consumable);
      onAddToTurn(actionType, `Use ${item.consumable.name}`);
      toast({
        title: `${item.consumable.name} Used`,
        description: item.consumable.effect,
        className: "border-cyan-500/50 bg-cyan-500/10",
      });
      // Update selected item quantity
      setSelectedItem(prev => 
        prev ? { ...prev, quantity: prev.quantity - 1 } : null
      );
    }
  };

  // Copy AI DM prompt
  const handleCopyPrompt = async (consumable: Consumable) => {
    const prompt = generateConsumablePrompt(consumable);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Prompt Copied",
      description: `${consumable.name} prompt ready for AI DM`,
      duration: 2000,
    });
  };

  // Update quantity for selected item
  const handleQuantityChange = (delta: number) => {
    if (!selectedItem) return;
    const newQuantity = selectedItem.quantity + delta;
    if (newQuantity <= 0) {
      setItemQuantity(selectedItem.consumable.id, 0);
      setSelectedItem(null);
    } else {
      setItemQuantity(selectedItem.consumable.id, newQuantity);
      setSelectedItem({ ...selectedItem, quantity: newQuantity });
    }
  };

  // Get current quantity from inventory (for real-time sync)
  const getCurrentQuantity = (consumableId: string): number => {
    const item = inventory.find(i => i.consumable.id === consumableId);
    return item?.quantity ?? 0;
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-24 space-y-4">
        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterPill
            label="All"
            count={inventory.reduce((s, i) => s + i.quantity, 0)}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <FilterPill
            label="Potions"
            count={typeCounts.potion}
            active={activeFilter === 'potion'}
            onClick={() => setActiveFilter('potion')}
            color="rose"
            icon={Beaker}
          />
          <FilterPill
            label="Poisons"
            count={typeCounts.poison}
            active={activeFilter === 'poison'}
            onClick={() => setActiveFilter('poison')}
            color="green"
            icon={Skull}
          />
          <FilterPill
            label="Scrolls"
            count={typeCounts.scroll}
            active={activeFilter === 'scroll'}
            onClick={() => setActiveFilter('scroll')}
            color="sky"
            icon={ScrollText}
          />
        </div>

        {/* Items Grid */}
        {filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <PackageOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No items in inventory</p>
            <p className="text-[11px] text-cyan-400 mt-2 italic">
              "Add consumables from the Consumables tab, genius."
            </p>
            {onNavigateToConsumables && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={onNavigateToConsumables}
              >
                <Plus className="w-4 h-4" />
                Go to Consumables
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredInventory.map(item => {
              const Icon = TYPE_ICONS[item.consumable.type];
              const rarity = rarityConfig[item.consumable.rarity];
              const typeConf = typeConfig[item.consumable.type];
              
              return (
                <button
                  key={item.consumable.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "flex flex-col items-center p-4 bg-card border border-l-4 rounded-xl transition-all active:scale-[0.98]",
                    rarity.borderColor,
                    item.quantity === 0 && "opacity-40"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-2",
                    typeConf.bgColor,
                    typeConf.color
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-center line-clamp-2">
                    {item.consumable.name}
                  </span>
                  
                  {/* Rarity badge */}
                  <Badge 
                    variant="outline" 
                    className={cn("text-[9px] mt-1", rarity.color, rarity.borderColor)}
                  >
                    {rarity.label}
                  </Badge>
                  
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newQty = item.quantity - 1;
                        setItemQuantity(item.consumable.id, newQty);
                      }}
                      disabled={item.quantity === 0}
                      className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95 disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemQuantity(item.consumable.id, item.quantity + 1);
                      }}
                      className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          
          {selectedItem && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-4">
                  {(() => {
                    const Icon = TYPE_ICONS[selectedItem.consumable.type];
                    const typeConf = typeConfig[selectedItem.consumable.type];
                    return (
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center",
                        typeConf.bgColor,
                        typeConf.color
                      )}>
                        <Icon className="w-8 h-8" />
                      </div>
                    );
                  })()}
                  <div>
                    <SheetTitle className="text-xl">{selectedItem.consumable.name}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]", 
                          rarityConfig[selectedItem.consumable.rarity].color,
                          rarityConfig[selectedItem.consumable.rarity].borderColor
                        )}
                      >
                        {rarityConfig[selectedItem.consumable.rarity].label}
                      </Badge>
                      <span>×{getCurrentQuantity(selectedItem.consumable.id)}</span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Effect */}
                <div className="p-3 bg-muted/10 rounded-lg border border-muted/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">EFFECT</div>
                  <p className="text-sm">{selectedItem.consumable.effect}</p>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 p-3 bg-muted/10 rounded-lg border border-muted/20">
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">DURATION</div>
                    <p className="text-sm">{selectedItem.consumable.duration}</p>
                  </div>
                  <div className="p-3 bg-muted/10 rounded-lg border border-muted/20">
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">USAGE</div>
                    <p className="text-sm capitalize">{selectedItem.consumable.usageType}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground italic">
                  {selectedItem.consumable.description}
                </p>

                {/* Action type badge */}
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-xs",
                    getActionType(selectedItem.consumable) === 'bonus'
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-red-500/20 text-red-300 border-red-500/50"
                  )}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {getActionType(selectedItem.consumable) === 'bonus' ? 'BONUS ACTION' : 'ACTION'}
                  </Badge>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-center gap-4 py-4">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={getCurrentQuantity(selectedItem.consumable.id) === 0}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <span className="text-4xl font-mono font-bold w-16 text-center">
                    {getCurrentQuantity(selectedItem.consumable.id)}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUseItem(selectedItem)}
                    disabled={getCurrentQuantity(selectedItem.consumable.id) === 0}
                    className="flex-1 h-14 text-lg bg-cyan-600 hover:bg-cyan-500"
                  >
                    Use {selectedItem.consumable.name.split(' ')[0]}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyPrompt(selectedItem.consumable)}
                    className="h-14 w-14 border-muted/40"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// Filter pill component
function FilterPill({
  label,
  count,
  active,
  onClick,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: React.ElementType;
}) {
  const colorClasses: Record<string, { active: string; inactive: string }> = {
    rose: { active: 'bg-rose-500/20 border-rose-500/50 text-rose-300', inactive: 'text-rose-400' },
    green: { active: 'bg-green-500/20 border-green-500/50 text-green-300', inactive: 'text-green-400' },
    sky: { active: 'bg-sky-500/20 border-sky-500/50 text-sky-300', inactive: 'text-sky-400' },
    slate: { active: 'bg-slate-500/20 border-slate-500/50 text-slate-300', inactive: 'text-slate-400' },
  };

  const classes = colorClasses[color || 'slate'] || colorClasses.slate;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-mono whitespace-nowrap transition-all border",
        active ? classes.active : "bg-muted/10 border-muted/20 text-muted-foreground"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      {count > 0 && (
        <span className={cn(
          "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
          active ? "bg-white/10" : "bg-muted/30"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
