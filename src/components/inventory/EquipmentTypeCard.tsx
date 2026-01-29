import { cn } from '@/lib/utils';
import { EquipmentSlotType, equipmentSlotDefinitions, rarityConfig, EquipmentItem } from '@/lib/inventory/types';
import { getIconByName } from '@/lib/iconUtils';
import { getGearImage } from '@/lib/inventory/gearImages';

export type EquipmentCategory = 
  | 'head' 
  | 'chest' 
  | 'arms' 
  | 'waist' 
  | 'legs' 
  | 'weapons'
  | 'accessories';

interface EquipmentTypeCardProps {
  category: EquipmentCategory;
  label: string;
  icon: string;
  equippedItems: (EquipmentItem | null)[];
  onClick: () => void;
  className?: string;
}

export function EquipmentTypeCard({
  category,
  label,
  icon,
  equippedItems,
  onClick,
  className,
}: EquipmentTypeCardProps) {
  const IconComponent = getIconByName(icon);
  
  // Get the highest rarity item for visual styling
  const highestRarityItem = equippedItems
    .filter(Boolean)
    .sort((a, b) => {
      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'];
      return rarityOrder.indexOf(b!.rarity) - rarityOrder.indexOf(a!.rarity);
    })[0];

  const rarity = highestRarityItem ? rarityConfig[highestRarityItem.rarity] : null;
  const equippedCount = equippedItems.filter(Boolean).length;
  const totalSlots = equippedItems.length;

  // Try to get a custom image from any equipped item
  const customImage = equippedItems
    .filter(Boolean)
    .map(item => getGearImage(item!.id))
    .find(img => img !== null);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center p-3 rounded-xl',
        'border-2 transition-all duration-200',
        'hover:scale-105 hover:shadow-lg active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        rarity 
          ? `bg-gradient-to-br from-card to-muted/50 ${rarity.borderClass.replace('border-l-', 'border-')}`
          : 'bg-muted/30 border-dashed border-muted-foreground/30',
        className
      )}
    >
      {/* Custom Image Background */}
      {customImage && (
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <img
            src={customImage}
            alt={label}
            className="w-full h-full object-cover object-center opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          rarity ? `bg-${rarity.color.replace('text-', '')}/20` : 'bg-muted/50',
        )}>
          <IconComponent className={cn('w-6 h-6', rarity?.color || 'text-muted-foreground')} />
        </div>

        {/* Label */}
        <span className={cn(
          'text-xs font-bold uppercase tracking-wide',
          rarity?.color || 'text-muted-foreground'
        )}>
          {label}
        </span>

        {/* Equipped Count */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalSlots }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                i < equippedCount 
                  ? rarity?.color.replace('text-', 'bg-') || 'bg-primary'
                  : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>

      {/* Rarity glow effect */}
      {highestRarityItem?.rarity === 'legendary' && (
        <div className="absolute inset-0 rounded-xl bg-amber-400/10 animate-pulse pointer-events-none" />
      )}
      {highestRarityItem?.rarity === 'artifact' && (
        <div className="absolute inset-0 rounded-xl bg-orange-500/10 animate-pulse pointer-events-none" />
      )}
    </button>
  );
}

// Category definitions for the grid
export const equipmentCategories: { 
  category: EquipmentCategory; 
  label: string; 
  icon: string; 
  slotTypes: EquipmentSlotType[] 
}[] = [
  { category: 'head', label: 'Head', icon: 'Crown', slotTypes: ['head'] },
  { category: 'chest', label: 'Chest', icon: 'Shield', slotTypes: ['chest'] },
  { category: 'arms', label: 'Arms', icon: 'Hand', slotTypes: ['arms'] },
  { category: 'waist', label: 'Waist', icon: 'CircleDot', slotTypes: ['waist'] },
  { category: 'legs', label: 'Legs', icon: 'Footprints', slotTypes: ['legs'] },
  { category: 'weapons', label: 'Weapons', icon: 'Sword', slotTypes: ['primary_weapon', 'secondary_weapon', 'ranged_weapon'] },
  { category: 'accessories', label: 'Jewelry', icon: 'Gem', slotTypes: ['amulet', 'ring1', 'ring2'] },
];
