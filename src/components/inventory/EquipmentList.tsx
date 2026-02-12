import { useState, useCallback } from 'react';
import { CharacterEquipment, equipmentSlotDefinitions, EquipmentSlotType, EquipmentItem, rarityConfig } from '@/lib/inventory/index';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Achievement } from '@/lib/achievements';
import type { ViewMode } from './InventoryScreen';
import type { EquipmentImages } from '@/hooks/use-equipment-images';
import { getIconByName } from '@/lib/iconUtils';
import { SlotDrawer } from './SlotDrawer';

interface EquipmentListProps {
  equipment: CharacterEquipment;
  highlightedSlot?: EquipmentSlotType | null;
  onSlotTap: (slotType: EquipmentSlotType) => void;
  onSlotLongPress: (slotType: EquipmentSlotType) => void;
  onUnequip: (slotType: EquipmentSlotType) => void;
  onSwap: (slotType: EquipmentSlotType) => void;
  onInfoTap: (slotType: EquipmentSlotType, item: EquipmentItem | null) => void;
  onSlotHover?: (slotType: EquipmentSlotType | null) => void;
  viewMode?: ViewMode;
  isItemLocked?: (item: EquipmentItem) => boolean;
  getItemLockInfo?: (item: EquipmentItem) => {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  };
  equipmentImages?: EquipmentImages;
  onImageUpload?: (slotType: EquipmentSlotType, file: File) => void;
  onImageClear?: (slotType: EquipmentSlotType) => void;
}

export function EquipmentList({
  equipment,
  highlightedSlot,
  onSlotTap,
  onSlotLongPress,
  onUnequip,
  onSwap,
  onInfoTap,
  onSlotHover,
  viewMode = 'compact',
  isItemLocked,
  getItemLockInfo,
  equipmentImages,
  onImageUpload,
  onImageClear,
}: EquipmentListProps) {
  const [openSlot, setOpenSlot] = useState<EquipmentSlotType | null>(null);

  const armorSlots = equipmentSlotDefinitions.filter(s => s.category === 'armor');
  const weaponSlots = equipmentSlotDefinitions.filter(s => s.category === 'weapons');
  const accessorySlots = equipmentSlotDefinitions.filter(s => s.category === 'accessories');

  const handleTabClick = useCallback((slotType: EquipmentSlotType) => {
    setOpenSlot(slotType);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setOpenSlot(null);
  }, []);

  const renderTab = (slot: typeof equipmentSlotDefinitions[0]) => {
    const item = equipment.slots[slot.type];
    const rarity = item ? rarityConfig[item.rarity] : null;
    const IconComponent = getIconByName(slot.icon);
    const isActive = openSlot === slot.type;

    // Rarity dot color
    const dotColor = rarity
      ? rarity.color.replace('text-', 'bg-').replace('muted-foreground', 'muted-foreground/60')
      : '';

    return (
      <button
        key={slot.type}
        onClick={() => handleTabClick(slot.type)}
        onMouseEnter={() => onSlotHover?.(slot.type)}
        onMouseLeave={() => onSlotHover?.(null)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg transition-all duration-150 text-left min-h-[48px]",
          "hover:bg-muted/30 active:scale-[0.98]",
          isActive && "bg-muted/40 ring-1 ring-primary/30",
          highlightedSlot === slot.type && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          !item && "opacity-60",
        )}
      >
        {/* Rarity indicator dot */}
        <div className={cn(
          "w-1.5 h-8 rounded-full shrink-0",
          item ? dotColor : "bg-muted-foreground/20",
        )} />

        {/* Slot icon */}
        <IconComponent className={cn(
          "w-4 h-4 shrink-0",
          item ? "text-foreground" : "text-muted-foreground/60",
        )} />

        {/* Label & item name */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
            {slot.label}
          </p>
          <p className={cn(
            "text-xs truncate leading-tight mt-0.5",
            item ? (rarity?.color || "text-foreground") : "text-muted-foreground/50 italic",
          )}>
            {item ? item.name : 'Empty'}
          </p>
        </div>
      </button>
    );
  };

  const renderCategoryTabs = (slots: typeof equipmentSlotDefinitions) => (
    <div className="space-y-0.5">
      {slots.map(slot => renderTab(slot))}
    </div>
  );

  // Active slot drawer
  const activeSlotDef = openSlot
    ? equipmentSlotDefinitions.find(s => s.type === openSlot)
    : null;
  const activeItem = openSlot ? equipment.slots[openSlot] : null;
  const activeLocked = activeItem && isItemLocked ? isItemLocked(activeItem) : false;
  const activeLockInfo = activeItem && getItemLockInfo ? getItemLockInfo(activeItem) : undefined;

  return (
    <div className="pb-2 space-y-1">
      {/* Armor Tabs */}
      {renderCategoryTabs(armorSlots)}

      {/* Weapons Divider */}
      <div className="flex items-center gap-2 py-1.5">
        <Separator className="flex-1" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Weapons
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Weapon Tabs */}
      {renderCategoryTabs(weaponSlots)}

      {/* Accessories Divider */}
      <div className="flex items-center gap-2 py-1.5">
        <Separator className="flex-1" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Accessories
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Accessory Tabs */}
      {renderCategoryTabs(accessorySlots)}

      {/* Slot Drawer */}
      {activeSlotDef && openSlot && (
        <SlotDrawer
          open={!!openSlot}
          onOpenChange={(open) => { if (!open) handleDrawerClose(); }}
          slotType={openSlot}
          label={activeSlotDef.label}
          icon={activeSlotDef.icon}
          item={activeItem}
          isLocked={activeLocked}
          lockInfo={activeLockInfo}
          onTap={() => { handleDrawerClose(); onSlotTap(openSlot); }}
          onLongPress={() => onSlotLongPress(openSlot)}
          onUnequip={() => { handleDrawerClose(); onUnequip(openSlot); }}
          onSwap={() => { handleDrawerClose(); onSwap(openSlot); }}
          onInfoTap={() => onInfoTap(openSlot, activeItem)}
          viewMode={viewMode}
          customImage={equipmentImages?.[openSlot]}
          onImageUpload={(file) => onImageUpload?.(openSlot, file)}
          onImageClear={() => onImageClear?.(openSlot)}
        />
      )}
    </div>
  );
}
