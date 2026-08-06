// Backpack — unequipped gear with a direct Equip / Swap action
import { useMemo } from 'react';
import { EquipmentItem, EquipmentSlotType, equipmentSlotDefinitions, rarityConfig, CharacterEquipment } from '@/lib/inventory/index';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Backpack } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackpackListProps {
  equipment: CharacterEquipment;
  /** Full inventory list (may include homebrew items merged in). */
  inventory: EquipmentItem[];
  onEquipItem: (item: EquipmentItem) => void;
  onItemTap?: (item: EquipmentItem) => void;
  isItemLocked?: (item: EquipmentItem) => boolean;
}

function slotLabel(slotType: EquipmentSlotType): string {
  return equipmentSlotDefinitions.find(s => s.type === slotType)?.label ?? slotType;
}

/** Which slot this item would go into, and what it would replace. */
export function resolveTargetSlot(
  item: EquipmentItem,
  slots: CharacterEquipment['slots'],
): { slot: EquipmentSlotType; replacing: EquipmentItem | null } {
  if (item.slotType === 'ring1' || item.slotType === 'ring2') {
    if (!slots.ring1) return { slot: 'ring1', replacing: null };
    if (!slots.ring2) return { slot: 'ring2', replacing: null };
    return { slot: 'ring1', replacing: slots.ring1 };
  }
  return { slot: item.slotType, replacing: slots[item.slotType] ?? null };
}

export function BackpackList({ equipment, inventory, onEquipItem, onItemTap, isItemLocked }: BackpackListProps) {
  const equippedIds = useMemo(
    () => new Set(Object.values(equipment.slots).filter(Boolean).map(i => (i as EquipmentItem).id)),
    [equipment.slots],
  );

  const items = useMemo(
    () => inventory.filter(i => !equippedIds.has(i.id)),
    [inventory, equippedIds],
  );

  return (
    <div className="pt-2 pb-4">
      <div className="flex items-center gap-2 py-1.5">
        <Separator className="flex-1" />
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Backpack className="w-3 h-3" />
          Backpack {items.length > 0 && `(${items.length})`}
        </span>
        <Separator className="flex-1" />
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic text-center py-4">
          No unequipped gear. Loot awarded by the DM lands here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const rarity = rarityConfig[item.rarity];
            const { replacing } = resolveTargetSlot(item, equipment.slots);
            const locked = isItemLocked?.(item) ?? false;
            return (
              <div
                key={item.id}
                onClick={() => onItemTap?.(item)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/40 min-h-[56px]',
                  onItemTap && 'cursor-pointer active:scale-[0.99] transition-transform',
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={cn('w-1.5 h-8 rounded-full shrink-0', rarity.color.replace('text-', 'bg-'))} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium truncate leading-tight', rarity.color)}>{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mt-1">
                    {slotLabel(item.slotType)}
                    {replacing ? ` · replaces ${replacing.name}` : ' · slot free'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={replacing ? 'outline' : 'default'}
                  className="h-9 px-3 shrink-0"
                  disabled={locked}
                  style={{ touchAction: 'manipulation' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEquipItem(item);
                  }}
                >
                  {locked ? 'Locked' : replacing ? 'Swap' : 'Equip'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
