import { CharacterEquipment, equipmentSlotDefinitions, EquipmentSlotType, EquipmentItem } from '@/lib/inventory/index';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ViewMode } from './InventoryScreen';

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
}: EquipmentListProps) {
  const isCompact = viewMode === 'compact';
  const armorSlots = equipmentSlotDefinitions.filter(s => s.category === 'armor');
  const weaponSlots = equipmentSlotDefinitions.filter(s => s.category === 'weapons');
  const accessorySlots = equipmentSlotDefinitions.filter(s => s.category === 'accessories');

  const renderSlots = (slots: typeof equipmentSlotDefinitions) => (
    <div className={cn("space-y-1.5", !isCompact && "space-y-3")}>
      {slots.map(slot => (
        <div
          key={slot.type}
          onMouseEnter={() => onSlotHover?.(slot.type)}
          onMouseLeave={() => onSlotHover?.(null)}
        >
          <EquipmentSlotCard
            slotType={slot.type}
            label={slot.label}
            icon={slot.icon}
            item={equipment.slots[slot.type]}
            isHighlighted={highlightedSlot === slot.type}
            onTap={() => onSlotTap(slot.type)}
            onLongPress={() => onSlotLongPress(slot.type)}
            onSwipeLeft={() => onUnequip(slot.type)}
            onSwipeRight={() => onSwap(slot.type)}
            onInfoTap={() => onInfoTap(slot.type, equipment.slots[slot.type])}
            viewMode={viewMode}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn("pb-2", isCompact ? "space-y-2" : "space-y-4")}>
      {/* Armor Section */}
      {renderSlots(armorSlots)}

      {/* Weapons Divider */}
      <div className={cn("flex items-center", isCompact ? "gap-2 py-1" : "gap-3 py-2")}>
        <Separator className="flex-1" />
        <span className={cn("font-bold uppercase tracking-wider text-muted-foreground", isCompact ? "text-[10px]" : "text-xs")}>
          Weapons
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Weapons Section */}
      {renderSlots(weaponSlots)}

      {/* Accessories Divider */}
      <div className={cn("flex items-center", isCompact ? "gap-2 py-1" : "gap-3 py-2")}>
        <Separator className="flex-1" />
        <span className={cn("font-bold uppercase tracking-wider text-muted-foreground", isCompact ? "text-[10px]" : "text-xs")}>
          Accessories
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Accessories Section */}
      {renderSlots(accessorySlots)}
    </div>
  );
}
