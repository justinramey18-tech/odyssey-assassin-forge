import { X, Star, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  CharacterEquipment, 
  EquipmentSlotType, 
  EquipmentItem, 
  rarityConfig,
  equipmentSlotDefinitions,
} from '@/lib/inventory/types';
import { getIconByName } from '@/lib/iconUtils';
import { GearImageUpload } from './GearImageUpload';
import { getGearImage } from '@/lib/inventory/gearImages';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EquipmentCategory } from './EquipmentTypeCard';

interface GearTypePopupProps {
  isOpen: boolean;
  onClose: () => void;
  category: {
    category: EquipmentCategory;
    label: string;
    icon: string;
    slotTypes: EquipmentSlotType[];
  };
  equipment: CharacterEquipment;
  onEquipItem: (slotType: EquipmentSlotType, item: EquipmentItem) => void;
  onUnequipItem: (slotType: EquipmentSlotType) => void;
  onItemInfo: (item: EquipmentItem, slotType: EquipmentSlotType) => void;
}

export function GearTypePopup({
  isOpen,
  onClose,
  category,
  equipment,
  onEquipItem,
  onUnequipItem,
  onItemInfo,
}: GearTypePopupProps) {
  if (!isOpen) return null;

  const IconComponent = getIconByName(category.icon);

  // Get all items that can be equipped in this category's slots
  const availableItems = equipment.inventory.filter(item => 
    category.slotTypes.includes(item.slotType)
  );

  // Group slots by their definitions
  const slotDefs = equipmentSlotDefinitions.filter(def => 
    category.slotTypes.includes(def.type)
  );

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-2 h-2 fill-current" />
    ));
  };

  const renderItemCard = (
    item: EquipmentItem | null, 
    slotType: EquipmentSlotType,
    slotLabel: string,
    isEquipped: boolean
  ) => {
    const rarity = item ? rarityConfig[item.rarity] : null;
    const ItemIcon = item ? getIconByName(item.icon) : null;
    const customImage = item ? getGearImage(item.id) : null;

    return (
      <div
        key={`${slotType}-${item?.id || 'empty'}`}
        className={cn(
          'relative rounded-lg border-2 p-3 transition-all',
          isEquipped && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          item 
            ? `bg-card ${rarity?.borderClass || 'border-border'}`
            : 'bg-muted/30 border-dashed border-muted-foreground/30'
        )}
        onClick={() => item && onItemInfo(item, slotType)}
      >
        {/* Slot Label */}
        {isEquipped && (
          <div className="absolute -top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded">
            {slotLabel}
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Item Icon / Image */}
          <div className={cn(
            'w-14 h-14 rounded-lg flex items-center justify-center border overflow-hidden',
            rarity?.borderClass?.replace('border-l-', 'border-') || 'border-border',
          )}>
            {customImage ? (
              <img src={customImage} alt={item?.name} className="w-full h-full object-cover" />
            ) : item && ItemIcon ? (
              <ItemIcon className={cn('w-8 h-8', rarity?.color)} />
            ) : (
              <div className="text-muted-foreground/50 text-xs text-center">Empty</div>
            )}
          </div>

          {/* Item Details */}
          <div className="flex-1 min-w-0">
            {item ? (
              <>
                <h4 className={cn('font-semibold text-sm truncate', rarity?.color)}>
                  {item.name}
                </h4>
                
                {/* Stats */}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {item.stats.ac && <span>🛡️ +{item.stats.ac}</span>}
                  {item.stats.damage && <span>⚔️ {item.stats.damage}</span>}
                </div>

                {/* Rarity */}
                <div className={cn('flex items-center gap-1 mt-1', rarity?.color)}>
                  {rarity && renderStars(rarity.stars)}
                  <span className="text-xs">{rarity?.label}</span>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No item equipped</span>
            )}
          </div>

          {/* Image Upload (for equipped items) */}
          {isEquipped && item && (
            <GearImageUpload
              itemId={item.id}
              size="sm"
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Actions */}
        {isEquipped && item && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onUnequipItem(slotType);
            }}
          >
            Unequip
          </Button>
        )}

        {!isEquipped && item && (
          <Button
            variant="default"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onEquipItem(slotType, item);
            }}
          >
            Equip to {slotLabel}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] bg-background rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <IconComponent className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">{category.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="max-h-[calc(85vh-60px)]">
          <div className="p-4 space-y-6">
            {/* Equipped Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                Currently Equipped
              </h3>
              <div className="space-y-3">
                {slotDefs.map(slot => {
                  const equippedItem = equipment.slots[slot.type];
                  return renderItemCard(equippedItem, slot.type, slot.label, true);
                })}
              </div>
            </div>

            {/* Available in Inventory Section */}
            {availableItems.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                  Available in Inventory ({availableItems.length})
                </h3>
                <div className="space-y-3">
                  {availableItems.map(item => {
                    // Find the first available slot for this item
                    const slotDef = slotDefs.find(s => s.type === item.slotType);
                    if (!slotDef) return null;
                    return renderItemCard(item, item.slotType, slotDef.label, false);
                  })}
                </div>
              </div>
            )}

            {availableItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No items in inventory for this category</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
