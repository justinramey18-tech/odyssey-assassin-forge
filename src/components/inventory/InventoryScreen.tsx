import { useState, useCallback } from 'react';
import { ArrowLeft, Settings, Shield, Sword, Backpack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  CharacterEquipment, 
  EquipmentSlotType, 
  EquipmentItem, 
  calculateTotalStats,
  createInitialEquipment,
  sampleEquipment,
} from '@/lib/inventory/index';
import { CharacterDisplay } from './CharacterDisplay';
import { EquipmentList } from './EquipmentList';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ComparisonSheet } from './ComparisonSheet';
import { SetBonusPanel } from './SetBonusPanel';
import { InventoryDrawer } from './InventoryDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryScreenProps {
  characterName: string;
  level: number;
  onBack: () => void;
}

export function InventoryScreen({ characterName, level, onBack }: InventoryScreenProps) {
  const [equipment, setEquipment] = useState<CharacterEquipment>(createInitialEquipment);
  const [highlightedSlot, setHighlightedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareItem, setCompareItem] = useState<EquipmentItem | null>(null);
  const [showInventoryDrawer, setShowInventoryDrawer] = useState(false);

  const stats = calculateTotalStats(equipment.slots);

  const handleSlotTap = useCallback((slotType: EquipmentSlotType) => {
    const item = equipment.slots[slotType];
    if (item) {
      setSelectedSlot(slotType);
      setSelectedItem(item);
      setShowItemDetail(true);
    } else {
      // Open inventory drawer to select item for empty slot
      setSelectedSlot(slotType);
      setShowInventoryDrawer(true);
    }
  }, [equipment.slots]);

  const handleSlotLongPress = useCallback((slotType: EquipmentSlotType) => {
    // Show quick action menu (could implement context menu here)
    setSelectedSlot(slotType);
    setSelectedItem(equipment.slots[slotType]);
    setShowItemDetail(true);
  }, [equipment.slots]);

  const handleUnequip = useCallback((slotType: EquipmentSlotType) => {
    const item = equipment.slots[slotType];
    if (!item) return;

    setEquipment(prev => ({
      slots: { ...prev.slots, [slotType]: null },
      inventory: [...prev.inventory, item],
    }));
    setShowItemDetail(false);
  }, [equipment.slots]);

  const handleSwap = useCallback((slotType: EquipmentSlotType) => {
    setSelectedSlot(slotType);
    setShowInventoryDrawer(true);
  }, []);

  const handleInfoTap = useCallback((slotType: EquipmentSlotType, item: EquipmentItem | null) => {
    setSelectedSlot(slotType);
    setSelectedItem(item);
    if (item) {
      setShowItemDetail(true);
    } else {
      setShowInventoryDrawer(true);
    }
  }, []);

  const handleCompare = useCallback(() => {
    setShowItemDetail(false);
    // Find an alternative item from inventory
    const alternatives = equipment.inventory.filter(
      item => item.slotType === selectedSlot
    );
    if (alternatives.length > 0) {
      setCompareItem(alternatives[0]);
      setShowComparison(true);
    }
  }, [equipment.inventory, selectedSlot]);

  const handleEquipFromInventory = useCallback((item: EquipmentItem) => {
    if (!selectedSlot) return;

    const currentItem = equipment.slots[selectedSlot];
    
    setEquipment(prev => ({
      slots: { ...prev.slots, [selectedSlot]: item },
      inventory: [
        ...prev.inventory.filter(i => i.id !== item.id),
        ...(currentItem ? [currentItem] : []),
      ],
    }));
    
    setShowInventoryDrawer(false);
    setShowComparison(false);
    setSelectedSlot(null);
  }, [selectedSlot, equipment.slots]);

  const handleEquipNew = useCallback(() => {
    if (compareItem && selectedSlot) {
      handleEquipFromInventory(compareItem);
    }
  }, [compareItem, selectedSlot, handleEquipFromInventory]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top Status Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">{characterName}</h1>
        <button className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </header>

      {/* Main Content - Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Character Display (40%) */}
        <div className="w-[40%] border-r border-border/30 bg-gradient-to-b from-background to-muted/20">
          <CharacterDisplay
            characterName={characterName}
            level={level}
            equipment={equipment}
            highlightedSlot={highlightedSlot}
          />
        </div>

        {/* Right Side - Equipment Slots (60%) */}
        <div className="w-[60%] flex flex-col">
          <ScrollArea className="flex-1 px-3 pt-3">
            <EquipmentList
              equipment={equipment}
              highlightedSlot={highlightedSlot}
              onSlotTap={handleSlotTap}
              onSlotLongPress={handleSlotLongPress}
              onUnequip={handleUnequip}
              onSwap={handleSwap}
              onInfoTap={handleInfoTap}
              onSlotHover={setHighlightedSlot}
            />
            
            {/* Set Bonuses */}
            <SetBonusPanel equipment={equipment} />
            
            {/* Bottom padding for stats bar */}
            <div className="h-20" />
          </ScrollArea>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <footer className="flex items-center justify-around px-4 py-3 border-t border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <div className="text-center">
            <p className="text-lg font-bold">{stats.totalAC}</p>
            <p className="text-[10px] text-muted-foreground uppercase">AC</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-red-400" />
          <div className="text-center">
            <p className="text-lg font-bold">{stats.totalDamage}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Attack</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Backpack className="w-5 h-5 text-amber-400" />
          <div className="text-center">
            <p className="text-lg font-bold">{stats.totalWeight}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Weight</p>
          </div>
        </div>
      </footer>

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        slotType={selectedSlot}
        equipment={equipment}
        isOpen={showItemDetail}
        onClose={() => setShowItemDetail(false)}
        onUnequip={() => selectedSlot && handleUnequip(selectedSlot)}
        onCompare={handleCompare}
      />

      {/* Comparison Sheet */}
      <ComparisonSheet
        equippedItem={selectedItem}
        compareItem={compareItem}
        slotType={selectedSlot}
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        onEquipNew={handleEquipNew}
      />

      {/* Inventory Drawer */}
      <InventoryDrawer
        isOpen={showInventoryDrawer}
        onClose={() => setShowInventoryDrawer(false)}
        inventory={equipment.inventory}
        slotType={selectedSlot}
        onSelectItem={handleEquipFromInventory}
      />
    </div>
  );
}
