import { useState, useCallback, useRef } from 'react';
import { CharacterEquipment, equipmentSlotDefinitions, EquipmentSlotType, EquipmentItem, rarityConfig } from '@/lib/inventory/index';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Achievement } from '@/lib/achievements';
import type { ViewMode } from './InventoryScreen';
import type { EquipmentImages } from '@/hooks/use-equipment-images';
import { getIconByName } from '@/lib/iconUtils';
import { ImagePlus } from 'lucide-react';

interface SlotThumbnailProps {
  slotType: EquipmentSlotType;
  customImage?: string;
  onImageUpload?: (slotType: EquipmentSlotType, file: File) => void;
}

function SlotThumbnail({ slotType, customImage, onImageUpload }: SlotThumbnailProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="relative w-12 h-12 rounded-md shrink-0 overflow-hidden bg-muted/40 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        fileInputRef.current?.click();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImageUpload?.(slotType, file);
            e.target.value = '';
          }
        }}
      />
      {customImage ? (
        <img src={customImage} alt="" className="w-full h-full object-cover" />
      ) : null}
      <div className="absolute bottom-0.5 right-0.5 bg-background/70 rounded p-0.5">
        <ImagePlus className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
}

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
  const armorSlots = equipmentSlotDefinitions.filter(s => s.category === 'armor');
  const weaponSlots = equipmentSlotDefinitions.filter(s => s.category === 'weapons');
  const accessorySlots = equipmentSlotDefinitions.filter(s => s.category === 'accessories');

  const renderTab = (slot: typeof equipmentSlotDefinitions[0]) => {
    const item = equipment.slots[slot.type];
    const rarity = item ? rarityConfig[item.rarity] : null;
    const IconComponent = getIconByName(slot.icon);
    const isActive = false;

    // Rarity dot color
    const dotColor = rarity
      ? rarity.color.replace('text-', 'bg-').replace('muted-foreground', 'muted-foreground/60')
      : '';

    return (
      <button
        key={slot.type}
        onClick={() => onSlotTap(slot.type)}
        onMouseEnter={() => onSlotHover?.(slot.type)}
        onMouseLeave={() => onSlotHover?.(null)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg transition-all duration-150 text-left min-h-[72px]",
          "hover:bg-muted/30 active:scale-[0.98]",
          isActive && "bg-muted/40 ring-1 ring-primary/30",
          highlightedSlot === slot.type && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          !item && "opacity-60",
        )}
      >
        {/* Slot thumbnail */}
        <SlotThumbnail slotType={slot.type} customImage={equipmentImages?.[slot.type]} onImageUpload={onImageUpload} />

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
    </div>
  );
}
