import { useMemo } from 'react';
import { ChevronLeft, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, EquipmentSlotType, equipmentSlotDefinitions } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { getIconByName } from '@/lib/iconUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ItemSelectionCard } from './ItemSelectionCard';
import { motion } from 'framer-motion';

interface ItemSelectionScreenProps {
  slotType: EquipmentSlotType;
  inventory: EquipmentItem[];
  onSelectItem: (item: EquipmentItem) => void;
  onBack: () => void;
  isItemLocked?: (item: EquipmentItem) => boolean;
  getItemLockInfo?: (item: EquipmentItem) => {
    isLocked: boolean;
    achievement?: Achievement;
    requiredValue?: number;
    currentValue?: number;
  };
}

export function ItemSelectionScreen({
  slotType,
  inventory,
  onSelectItem,
  onBack,
  isItemLocked,
  getItemLockInfo,
}: ItemSelectionScreenProps) {
  // Get slot definition for label and icon
  const slotDef = equipmentSlotDefinitions.find(s => s.type === slotType);
  const SlotIcon = getIconByName(slotDef?.icon || 'Package');

  // Filter inventory to show only compatible items
  const compatibleItems = useMemo(() => {
    return inventory.filter(item => {
      // Handle ring slots - both ring1 and ring2 can use any ring
      if (slotType === 'ring1' || slotType === 'ring2') {
        return item.slotType === 'ring1' || item.slotType === 'ring2';
      }
      return item.slotType === slotType;
    });
  }, [inventory, slotType]);

  return (
    <motion.div 
      className="min-h-[calc(100vh-10vh)] flex flex-col bg-background"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header Row */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-900/30 bg-background/80 backdrop-blur-md">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          className="h-9 w-9 shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center border border-amber-500/30 bg-amber-500/10"
        )}>
          <SlotIcon className="w-5 h-5 text-amber-400" />
        </div>
        
        <h1 className="font-cinzel text-xl font-bold uppercase tracking-wide text-foreground">
          Select {slotDef?.label || slotType}
        </h1>
      </div>

      {/* Scrollable Item List */}
      <ScrollArea className="flex-1 touch-pan-y">
        <div className="p-4 space-y-3">
          {compatibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm font-medium">No compatible items in inventory</p>
              <p className="text-xs mt-1 opacity-70">Find or purchase items to equip this slot</p>
            </div>
          ) : (
            compatibleItems.map(item => {
              const locked = isItemLocked ? isItemLocked(item) : false;
              const lockInfo = getItemLockInfo ? getItemLockInfo(item) : undefined;

              return (
                <ItemSelectionCard
                  key={item.id}
                  item={item}
                  onSelect={onSelectItem}
                  isLocked={locked}
                  lockInfo={lockInfo}
                />
              );
            })
          )}
        </div>
        
        {/* Bottom padding */}
        <div className="h-8" />
      </ScrollArea>
    </motion.div>
  );
}
