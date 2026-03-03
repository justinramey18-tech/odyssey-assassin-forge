import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { EquipmentSlotType, EquipmentItem, rarityConfig } from '@/lib/inventory/types';
import { EquipmentSlotCard } from './EquipmentSlotCard';
import { Achievement } from '@/lib/achievements';
import type { ViewMode } from './InventoryScreen';
import type { EquipmentImages } from '@/hooks/use-equipment-images';
import { PromptEditModal } from '@/components/shared/PromptEditModal';
import { applyTimePrefix } from '@/lib/fourthWallTime';

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
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const rarity = item ? rarityConfig[item.rarity] : null;
  const accentColor = rarity ? rarity.color.replace('text-', '') : 'muted-foreground';

  const generateGearPrompt = (): string => {
    if (!item) return '';
    const statsLines = Object.entries(item.stats)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `- **${k}:** ${v}`)
      .join('\n');
    const rawPrompt = `## Gear: ${item.name}

**Slot:** ${label}
**Rarity:** ${rarity?.label || item.rarity}
**Level:** ${item.level}
${statsLines ? `\n### Stats\n${statsLines}` : ''}
${item.properties?.length ? `\n### Properties\n${item.properties.join(', ')}` : ''}
${item.enchantments?.length ? `\n### Enchantments\n${item.enchantments.map(e => `- **${e.name}:** ${e.description}`).join('\n')}` : ''}
${item.description ? `\n### Description\n${item.description}` : ''}
${item.setName ? `\n### Set\nPart of the **${item.setName}** set.` : ''}

---

*Describe how this gear looks and feels on the character, and how it might influence the current scene.*`;
    return applyTimePrefix(rawPrompt);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        onInteractOutside={(e) => e.preventDefault()}
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

          {item && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 gap-2"
              onClick={() => setPromptModalOpen(true)}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy AI Prompt
            </Button>
          )}
        </div>

        {item && (
          <PromptEditModal
            promptKey={`gear-${slotType}`}
            generatedPrompt={generateGearPrompt()}
            title={item.name}
            subtitle="Gear Prompt"
            open={promptModalOpen}
            onOpenChange={setPromptModalOpen}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
