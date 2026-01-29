import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Shield, Sword, Backpack, Wand2, Minimize2, Maximize2, User, Sparkles } from 'lucide-react';
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
  getActiveSetBonuses,
} from '@/lib/inventory/index';
import { setImages } from '@/lib/inventory/setImages';
import { EquipmentList } from './EquipmentList';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ComparisonSheet } from './ComparisonSheet';
import { SetBonusPanel } from './SetBonusPanel';
import { InventoryDrawer } from './InventoryDrawer';
import { ActiveSetBonusDrawer } from '@/components/drawers/ActiveSetBonusDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ViewMode = 'compact' | 'expanded';

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
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  
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
  const [showSetBonusDrawer, setShowSetBonusDrawer] = useState(false);

  const isCompact = viewMode === 'compact';

  // Check for complete legendary set for background image
  const activeSetBonuses = getActiveSetBonuses(equipment.slots);
  const completeSet = useMemo(() => {
    for (const bonus of activeSetBonuses) {
      if (bonus.activePieces >= 8 && setImages[bonus.setInfo.id]) {
        return {
          setInfo: bonus.setInfo,
          images: setImages[bonus.setInfo.id],
        };
      }
    }
    return null;
  }, [activeSetBonuses]);

  const backgroundImage = completeSet?.images.front || null;

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
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Background Image Layer - Set Armor Art */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        >
          {/* Overlay gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          {/* Animated glow effect */}
          <div 
            className="absolute inset-0 opacity-30 animate-pulse"
            style={{
              boxShadow: `inset 0 0 100px ${completeSet?.images.glowColor}`,
            }}
          />
        </div>
      )}

      {/* Default background when no complete set */}
      {!backgroundImage && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-muted/20 via-background to-background">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <User className="w-64 h-64 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Top Status Bar */}
      <header className="relative z-10 flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm">{characterName}</h1>
          {completeSet && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 uppercase">{completeSet.setInfo.name}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Active Set Bonuses Button - Only show when sets are active */}
          {activeSetBonuses.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 relative"
              onClick={() => setShowSetBonusDrawer(true)}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                {activeSetBonuses.length}
              </span>
            </Button>
          )}
          
          {/* View Mode Toggle */}
          <Toggle
            pressed={isCompact}
            onPressedChange={(pressed) => setViewMode(pressed ? 'compact' : 'expanded')}
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Toggle view mode"
          >
            {isCompact ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Toggle>
          
          {/* Quick Equip Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Wand2 className="w-4 h-4 text-amber-400" />
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
        </div>
      </header>

      {/* Full Screen Equipment List Overlay */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <ScrollArea className={cn("flex-1", isCompact ? "px-3 pt-2" : "px-4 pt-3")}>
          <EquipmentList
            equipment={equipment}
            highlightedSlot={highlightedSlot}
            onSlotTap={handleSlotTap}
            onSlotLongPress={handleSlotLongPress}
            onUnequip={handleUnequip}
            onSwap={handleSwap}
            onInfoTap={handleInfoTap}
            onSlotHover={setHighlightedSlot}
            viewMode={viewMode}
          />
          
          {/* Set Bonuses */}
          <SetBonusPanel equipment={equipment} />
          
          {/* Bottom padding for stats bar */}
          <div className={isCompact ? "h-16" : "h-20"} />
        </ScrollArea>
      </div>

      {/* Bottom Stats Bar */}
      <footer className={cn(
        "relative z-10 flex items-center justify-around border-t border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300",
        isCompact ? "px-3 py-2" : "px-4 py-3"
      )}>
        <div className="flex items-center gap-1.5">
          <Shield className={cn("text-blue-400", isCompact ? "w-4 h-4" : "w-5 h-5")} />
          <div className="text-center">
            <p className={cn("font-bold", isCompact ? "text-sm" : "text-lg")}>{stats.totalAC}</p>
            <p className={cn("text-muted-foreground uppercase", isCompact ? "text-[8px]" : "text-[10px]")}>AC</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Sword className={cn("text-red-400", isCompact ? "w-4 h-4" : "w-5 h-5")} />
          <div className="text-center">
            <p className={cn("font-bold", isCompact ? "text-sm" : "text-lg")}>{stats.totalDamage}</p>
            <p className={cn("text-muted-foreground uppercase", isCompact ? "text-[8px]" : "text-[10px]")}>Attack</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Backpack className={cn("text-amber-400", isCompact ? "w-4 h-4" : "w-5 h-5")} />
          <div className="text-center">
            <p className={cn("font-bold", isCompact ? "text-sm" : "text-lg")}>{stats.totalWeight}</p>
            <p className={cn("text-muted-foreground uppercase", isCompact ? "text-[8px]" : "text-[10px]")}>Weight</p>
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

      {/* Active Set Bonus Drawer */}
      <ActiveSetBonusDrawer
        open={showSetBonusDrawer}
        onOpenChange={setShowSetBonusDrawer}
        equipment={equipment}
        characterName={characterName}
      />
    </div>
  );
}
