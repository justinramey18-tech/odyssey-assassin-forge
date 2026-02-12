import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EquipmentSlotType, EquipmentItem, rarityConfig } from '@/lib/inventory/types';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { Achievement } from '@/lib/achievements';
import type { ViewMode } from './InventoryScreen';
import type { EquipmentImages } from '@/hooks/use-equipment-images';

interface SlotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotType: EquipmentSlotType;
  label: string;
  icon: string;
  item: EquipmentItem | null;
  isLocked?: boolean;
  lockInfo?: {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  };
  onTap: () => void;
  onLongPress: () => void;
  onUnequip: () => void;
  onSwap: () => void;
  onInfoTap: () => void;
  viewMode?: ViewMode;
  customImage?: string | null;
  onImageUpload?: (file: File) => void;
  onImageClear?: () => void;
}

export function SlotDrawer({
  open,
  onOpenChange,
  slotType,
  label,
  icon,
  item,
  isLocked = false,
  lockInfo,
  onTap,
  onLongPress,
  onUnequip,
  onSwap,
  onInfoTap,
  viewMode = 'expanded',
  customImage,
  onImageUpload,
  onImageClear,
}: SlotDrawerProps) {
  const rarity = item ? rarityConfig[item.rarity] : null;
  const accentColor = rarity ? rarity.color.replace('text-', '') : 'muted-foreground';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'w-[85vw] max-w-[320px] p-0',
          'bg-background/95 backdrop-blur-xl border-border/50',
        )}
      >
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-sm font-cinzel uppercase tracking-wider">
            {label}
          </SheetTitle>
        </SheetHeader>

        <div className="p-3">
          <EquipmentSlotCard
            slotType={slotType}
            label={label}
            icon={icon}
            item={item}
            isHighlighted={false}
            isLocked={isLocked}
            lockInfo={lockInfo}
            onTap={onTap}
            onLongPress={onLongPress}
            onSwipeLeft={onUnequip}
            onSwipeRight={onSwap}
            onInfoTap={onInfoTap}
            viewMode="expanded"
            customImage={customImage}
            onImageUpload={onImageUpload}
            onImageClear={onImageClear}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
