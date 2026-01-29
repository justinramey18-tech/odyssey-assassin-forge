import { Package, Star, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, EquipmentSlotType, rarityConfig, equipmentSlotDefinitions } from '@/lib/inventory/index';
import { Achievement } from '@/lib/achievements';
import { getIconByName } from '@/lib/iconUtils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: EquipmentItem[];
  slotType: EquipmentSlotType | null;
  onSelectItem: (item: EquipmentItem) => void;
  // Gear lock support
  isItemLocked?: (item: EquipmentItem) => boolean;
  getItemLockInfo?: (item: EquipmentItem) => {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  };
}

export function InventoryDrawer({
  isOpen,
  onClose,
  inventory,
  slotType,
  onSelectItem,
  isItemLocked,
  getItemLockInfo,
}: InventoryDrawerProps) {
  // Filter inventory to show only compatible items
  const compatibleItems = slotType 
    ? inventory.filter(item => {
        // Handle ring slots - both ring1 and ring2 can use any ring
        if (slotType === 'ring1' || slotType === 'ring2') {
          return item.slotType === 'ring1' || item.slotType === 'ring2';
        }
        return item.slotType === slotType;
      })
    : inventory;

  const slotDef = slotType ? equipmentSlotDefinitions.find(s => s.type === slotType) : null;

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-2.5 h-2.5 fill-current" />
    ));
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="border-b border-border/50">
          <DrawerTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {slotType ? `Select ${slotDef?.label || 'Item'}` : 'Inventory'}
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          {compatibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No compatible items in inventory</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {compatibleItems.map(item => {
                const rarity = rarityConfig[item.rarity];
                const ItemIcon = getIconByName(item.icon);
                const locked = isItemLocked ? isItemLocked(item) : false;
                const lockInfo = getItemLockInfo ? getItemLockInfo(item) : undefined;

                return (
                  <button
                    key={item.id}
                    onClick={() => !locked && onSelectItem(item)}
                    disabled={locked}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all relative",
                      locked 
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-muted/50 active:scale-[0.98]",
                      `border-l-4 ${rarity.borderClass}`
                    )}
                  >
                    {/* Locked Overlay */}
                    {locked && (
                      <div className="absolute inset-0 z-10 flex items-center justify-end pr-4 bg-background/40 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-500">
                          <Lock className="w-4 h-4" />
                          {lockInfo?.achievement && (
                            <span className="text-xs">
                              {lockInfo.currentValue}/{lockInfo.requiredValue}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Item Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center border",
                      rarity.borderClass.replace('border-l-', 'border-'),
                      item.rarity === 'legendary' && "bg-amber-400/10",
                      item.rarity === 'epic' && "bg-purple-400/10",
                      item.rarity === 'rare' && "bg-blue-400/10",
                    )}>
                      <ItemIcon className={cn("w-6 h-6", rarity.color)} />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className={cn("font-semibold text-sm truncate", rarity.color)}>
                        {item.name}
                      </h4>
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.stats.ac && (
                          <span className="text-xs text-muted-foreground">
                            🛡️ +{item.stats.ac}
                          </span>
                        )}
                        {item.stats.damage && (
                          <span className="text-xs text-muted-foreground">
                            ⚔️ {item.stats.damage}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <div className={cn("flex items-center gap-0.5", rarity.color)}>
                          {renderStars(rarity.stars)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Lv {item.level}
                        </span>
                        {locked && lockInfo?.achievement && (
                          <span className="text-[10px] text-amber-500 truncate">
                            {lockInfo.achievement.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
