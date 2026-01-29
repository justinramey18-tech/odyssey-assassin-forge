import { useState, useCallback } from 'react';
import { ArrowLeft, Settings, Shield, Sword, Backpack, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  CharacterEquipment, 
  EquipmentSlotType, 
  EquipmentItem, 
  calculateTotalStats,
  createInitialEquipment,
  sampleEquipment,
  legendarySetDefinitions,
  allLegendaryItems,
} from '@/lib/inventory/index';
import { CharacterDisplay } from './CharacterDisplay';
import { EquipmentTypeGrid } from './EquipmentTypeGrid';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ComparisonSheet } from './ComparisonSheet';
import { SetBonusPanel } from './SetBonusPanel';
import { InventoryDrawer } from './InventoryDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface InventoryScreenProps {
  characterName: string;
  level: number;
  onBack: () => void;
  equipment?: CharacterEquipment;
  onEquipmentChange?: (equipment: CharacterEquipment) => void;
}

export function InventoryScreen({ 
  characterName, 
  level, 
  onBack,
  equipment: externalEquipment,
  onEquipmentChange,
}: InventoryScreenProps) {
  const [internalEquipment, setInternalEquipment] = useState<CharacterEquipment>(createInitialEquipment);
  
  // Use external equipment if provided, otherwise use internal state
  const equipment = externalEquipment ?? internalEquipment;
  const setEquipment = onEquipmentChange ?? setInternalEquipment;
  const [highlightedSlot, setHighlightedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareItem, setCompareItem] = useState<EquipmentItem | null>(null);
  const [showInventoryDrawer, setShowInventoryDrawer] = useState(false);

  const stats = calculateTotalStats(equipment.slots);

  const handleUnequip = useCallback((slotType: EquipmentSlotType) => {
    const item = equipment.slots[slotType];
    if (!item) return;

    setEquipment(prev => ({
      slots: { ...prev.slots, [slotType]: null },
      inventory: [...prev.inventory, item],
    }));
    setShowItemDetail(false);
  }, [equipment.slots]);

  const handleEquipItem = useCallback((slotType: EquipmentSlotType, item: EquipmentItem) => {
    const currentItem = equipment.slots[slotType];
    
    setEquipment(prev => ({
      slots: { ...prev.slots, [slotType]: item },
      inventory: [
        ...prev.inventory.filter(i => i.id !== item.id),
        ...(currentItem ? [currentItem] : []),
      ],
    }));
  }, [equipment.slots]);

  const handleItemInfo = useCallback((item: EquipmentItem, slotType: EquipmentSlotType) => {
    setSelectedSlot(slotType);
    setSelectedItem(item);
    setShowItemDetail(true);
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

  // Quick equip a full legendary set for testing
  const handleQuickEquipSet = useCallback((setId: string) => {
    const setDef = legendarySetDefinitions.find(s => s.id === setId);
    if (!setDef) return;

    // Get all items for this set
    const setItems = allLegendaryItems.filter(item => item.setId === setId);
    
    // Create new slots with set items equipped
    const newSlots: Record<EquipmentSlotType, EquipmentItem | null> = {
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      primary_weapon: null,
      secondary_weapon: null,
      ranged_weapon: null,
      amulet: null,
      ring1: null,
      ring2: null,
    };

    // Equip each set piece to its slot
    setItems.forEach(item => {
      newSlots[item.slotType] = item;
    });

    // Collect all unequipped items for inventory
    const equippedIds = setItems.map(i => i.id);
    const newInventory = [...sampleEquipment, ...allLegendaryItems.filter(i => !equippedIds.includes(i.id))];

    setEquipment({
      slots: newSlots,
      inventory: newInventory,
    });
  }, []);

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2">
              <Wand2 className="w-5 h-5 text-amber-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Quick Equip Full Set
            </div>
            {legendarySetDefinitions.map(set => (
              <DropdownMenuItem
                key={set.id}
                onClick={() => handleQuickEquipSet(set.id)}
                className="cursor-pointer"
              >
                <span className="text-amber-400">★</span>
                <span className="ml-2 truncate">{set.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content - Vertical Layout */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Character Display (Top) */}
        <div className="h-48 flex-shrink-0 border-b border-border/30 bg-gradient-to-b from-background to-muted/20">
          <CharacterDisplay
            characterName={characterName}
            level={level}
            equipment={equipment}
            highlightedSlot={highlightedSlot}
          />
        </div>

        {/* Equipment Type Grid (Bottom) */}
        <ScrollArea className="flex-1">
          <EquipmentTypeGrid
            equipment={equipment}
            onEquipItem={handleEquipItem}
            onUnequipItem={handleUnequip}
            onItemInfo={handleItemInfo}
          />
          
          {/* Set Bonuses */}
          <SetBonusPanel equipment={equipment} />
          
          {/* Bottom padding for stats bar */}
          <div className="h-20" />
        </ScrollArea>
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
