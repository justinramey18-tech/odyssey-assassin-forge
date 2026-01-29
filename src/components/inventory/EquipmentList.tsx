import { CharacterEquipment, equipmentSlotDefinitions, EquipmentSlotType, EquipmentItem } from '@/lib/inventory/index';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { Separator } from '@/components/ui/separator';

interface EquipmentListProps {
  equipment: CharacterEquipment;
  highlightedSlot?: EquipmentSlotType | null;
  onSlotTap: (slotType: EquipmentSlotType) => void;
  onSlotLongPress: (slotType: EquipmentSlotType) => void;
  onUnequip: (slotType: EquipmentSlotType) => void;
  onSwap: (slotType: EquipmentSlotType) => void;
  onInfoTap: (slotType: EquipmentSlotType, item: EquipmentItem | null) => void;
  onSlotHover?: (slotType: EquipmentSlotType | null) => void;
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
}: EquipmentListProps) {
  const armorSlots = equipmentSlotDefinitions.filter(s => s.category === 'armor');
  const weaponSlots = equipmentSlotDefinitions.filter(s => s.category === 'weapons');
  const accessorySlots = equipmentSlotDefinitions.filter(s => s.category === 'accessories');

  const renderSlots = (slots: typeof equipmentSlotDefinitions) => (
    <div className="space-y-3">
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
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Armor Section */}
      {renderSlots(armorSlots)}

      {/* Weapons Divider */}
      <div className="flex items-center gap-3 py-2">
        <Separator className="flex-1" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Weapons
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Weapons Section */}
      {renderSlots(weaponSlots)}

      {/* Accessories Divider */}
      <div className="flex items-center gap-3 py-2">
        <Separator className="flex-1" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Accessories
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Accessories Section */}
      {renderSlots(accessorySlots)}
    </div>
  );
}
