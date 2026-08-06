import { useState, useCallback, useMemo } from 'react';
import { HomebrewGearItem } from '@/lib/inventory/homebrewGear';
import { Shield, Sword, Backpack, Wand2, Minimize2, Maximize2, User, Sparkles, Lock, Plus, Bot } from 'lucide-react';
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
import { useGearLock } from '@/hooks/use-gear-lock';
import { useEquipmentImages } from '@/hooks/use-equipment-images';
import { useHomebrewGear } from '@/hooks/use-homebrew-gear';
import { achievementCategories, Achievement } from '@/lib/achievements';
import { toast } from 'sonner';
import { EquipmentList } from './EquipmentList';
import { BackpackList, resolveTargetSlot } from './BackpackList';

import { HomebrewGearCreator } from './HomebrewGearCreator';
import { HomebrewGearAI } from './HomebrewGearAI';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ComparisonSheet } from './ComparisonSheet';
import { SetBonusPanel } from './SetBonusPanel';
import { ItemSelectionScreen } from './ItemSelectionScreen';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';

export type ViewMode = 'compact' | 'expanded';
export type ScreenMode = 'equipment' | 'selecting';

interface InventoryScreenProps {
  characterName: string;
  level: number;
  equipment?: CharacterEquipment;
  onEquipmentChange?: (equipment: CharacterEquipment) => void;
  achievements?: Achievement[];
  onSellGear?: (item: EquipmentItem) => void;
}

export function InventoryScreen({ 
  characterName, 
  level, 
  equipment: externalEquipment,
  onEquipmentChange,
  achievements = achievementCategories,
  onSellGear,
}: InventoryScreenProps) {
  const [internalEquipment, setInternalEquipment] = useState<CharacterEquipment>(createInitialEquipment);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  
  // Gear lock integration
  const { 
    requiresGearUnlocks, 
    isItemLocked, 
    getItemLockInfo, 
    isSetLocked 
  } = useGearLock(achievements);
  
  // Custom equipment images
  const { 
    images: equipmentImages, 
    handleImageUpload: uploadEquipmentImage, 
    clearSlotImage 
  } = useEquipmentImages();

  // Homebrew gear
  const { homebrewItems, addGear, addMultipleGear, removeGear, updateGear } = useHomebrewGear();
  const [showHomebrewCreator, setShowHomebrewCreator] = useState(false);
  const [showHomebrewAI, setShowHomebrewAI] = useState(false);
  const [editingGear, setEditingGear] = useState<HomebrewGearItem | null>(null);

  const handleEquipmentImageUpload = useCallback(async (slotType: EquipmentSlotType, file: File) => {
    try {
      await uploadEquipmentImage(slotType, file);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  }, [uploadEquipmentImage]);

  const handleEquipmentImageClear = useCallback((slotType: EquipmentSlotType) => {
    clearSlotImage(slotType);
    toast.success('Image removed');
  }, [clearSlotImage]);
  
  // Use external equipment if provided, otherwise use internal state
  const equipment = externalEquipment ?? internalEquipment;
  // Merge homebrew items into inventory
  const homebrewItemIds = useMemo(() => new Set(homebrewItems.map(i => i.id)), [homebrewItems]);
  const equipmentWithHomebrew = useMemo(() => ({
    ...equipment,
    inventory: [...equipment.inventory, ...homebrewItems],
  }), [equipment, homebrewItems]);
  const setEquipment = onEquipmentChange ?? setInternalEquipment;
  const [highlightedSlot, setHighlightedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotType | null>(null);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareItem, setCompareItem] = useState<EquipmentItem | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>('equipment');
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
      // Switch to inline selection mode for empty slot
      setSelectedSlot(slotType);
      setScreenMode('selecting');
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
    setScreenMode('selecting');
  }, []);

  const handleInfoTap = useCallback((slotType: EquipmentSlotType, item: EquipmentItem | null) => {
    setSelectedSlot(slotType);
    setSelectedItem(item);
    if (item) {
      setShowItemDetail(true);
    } else {
      setScreenMode('selecting');
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
    
    setScreenMode('equipment');
    setShowComparison(false);
    setSelectedSlot(null);
  }, [selectedSlot, equipment.slots]);

  // Equip directly from the backpack list (auto-picks the slot, swaps if occupied)
  const handleEquipFromBackpack = useCallback((item: EquipmentItem) => {
    const { slot, replacing } = resolveTargetSlot(item, equipment.slots);
    setEquipment(prev => ({
      slots: { ...prev.slots, [slot]: item },
      inventory: [
        ...prev.inventory.filter(i => i.id !== item.id),
        ...(replacing ? [replacing] : []),
      ],
    }));
    toast.success(replacing ? `Swapped ${replacing.name} for ${item.name}` : `${item.name} equipped`);
  }, [equipment.slots, setEquipment]);

  const handleBackpackItemTap = useCallback((item: EquipmentItem) => {
    setSelectedSlot(item.slotType);
    setSelectedItem(item);
    setShowItemDetail(true);
  }, []);

  const handleEditHomebrew = useCallback((item: EquipmentItem) => {

    const homebrewItem = homebrewItems.find(h => h.id === item.id);
    if (homebrewItem) {
      setEditingGear(homebrewItem);
      setShowHomebrewCreator(true);
    }
  }, [homebrewItems]);

  const handleDeleteHomebrew = useCallback((item: EquipmentItem) => {
    removeGear(item.id);
    toast.success(`${item.name} deleted`);
  }, [removeGear]);
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
      cloak: null,
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
    <div className="min-h-[calc(100vh-10vh)] relative flex flex-col overflow-hidden">
      {/* Background Image Layer - Set Armor Art (only show in equipment mode) */}
      {screenMode === 'equipment' && backgroundImage && (
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

      {/* Default background when no complete set (only show in equipment mode) */}
      {screenMode === 'equipment' && !backgroundImage && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-muted/20 via-background to-background">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <User className="w-64 h-64 text-muted-foreground" />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {screenMode === 'selecting' && selectedSlot ? (
          <ItemSelectionScreen
            key="selecting"
            slotType={selectedSlot}
            inventory={equipmentWithHomebrew.inventory}
            onSelectItem={handleEquipFromInventory}
            onBack={() => {
              setScreenMode('equipment');
              setSelectedSlot(null);
            }}
            isItemLocked={isItemLocked}
            getItemLockInfo={getItemLockInfo}
            homebrewItemIds={homebrewItemIds}
            onEditHomebrew={handleEditHomebrew}
            onDeleteHomebrew={handleDeleteHomebrew}
          />
        ) : (
          <motion.div 
            key="equipment"
            className="relative z-10 flex-1 flex flex-col"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.2 }}
          >
            {/* Title Header Row */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <h1 className="font-cinzel text-2xl font-bold text-foreground">Gear Loadout</h1>
                {completeSet && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/40">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase">{completeSet.setInfo.name}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {/* Homebrew Gear Buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowHomebrewCreator(true)}
                  title="Create Homebrew Gear"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowHomebrewAI(true)}
                  title="AI Gear Forge"
                >
                  <Bot className="w-4 h-4 text-amber-400" />
                </Button>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-8 w-8",
                                requiresGearUnlocks && "opacity-50 cursor-not-allowed"
                              )}
                              disabled={requiresGearUnlocks}
                            >
                              {requiresGearUnlocks ? (
                                <Lock className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Wand2 className="w-4 h-4 text-amber-400" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          {!requiresGearUnlocks && (
                            <DropdownMenuContent align="end" className="w-64">
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                Quick Equip Full Set
                              </div>
                              {legendarySetDefinitions.map(set => {
                                const setLocked = isSetLocked(set.id, allLegendaryItems);
                                return (
                                  <DropdownMenuItem
                                    key={set.id}
                                    onClick={() => !setLocked && handleQuickEquipSet(set.id)}
                                    disabled={setLocked}
                                    className={cn(
                                      "cursor-pointer",
                                      setLocked && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    {setLocked ? (
                                      <Lock className="w-3 h-3 text-amber-500" />
                                    ) : (
                                      <span className="text-amber-400">★</span>
                                    )}
                                    <span className="ml-2 truncate">{set.name}</span>
                                    {setLocked && (
                                      <span className="ml-auto text-[10px] text-amber-500">Locked</span>
                                    )}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          )}
                        </DropdownMenu>
                      </div>
                    </TooltipTrigger>
                    {requiresGearUnlocks && (
                      <TooltipContent side="bottom">
                        <p className="text-xs">Quick Equip disabled in Honest Mode</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Full Screen Equipment List */}
            <div className="flex-1 flex flex-col overflow-hidden">
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
                  isItemLocked={isItemLocked}
                  getItemLockInfo={getItemLockInfo}
                  equipmentImages={equipmentImages}
                  onImageUpload={handleEquipmentImageUpload}
                  onImageClear={handleEquipmentImageClear}
                />
                
                {/* Set Bonuses */}
                <SetBonusPanel equipment={equipment} />
                
                {/* Bottom padding for stats bar */}
                <div className={isCompact ? "h-16" : "h-20"} />
              </ScrollArea>
            </div>

            {/* Bottom Stats Bar */}
            <footer className={cn(
              "flex items-center justify-around border-t border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300",
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        slotType={selectedSlot}
        equipment={equipment}
        customImage={selectedSlot ? equipmentImages[selectedSlot] : null}
        onImageUpload={selectedSlot ? (file) => handleEquipmentImageUpload(selectedSlot, file) : undefined}
        onImageClear={selectedSlot ? () => handleEquipmentImageClear(selectedSlot) : undefined}
        isOpen={showItemDetail}
        onClose={() => setShowItemDetail(false)}
        onUnequip={() => selectedSlot && handleUnequip(selectedSlot)}
        onCompare={handleCompare}
        onSell={onSellGear ? (item) => {
          // Unequip first, then sell
          if (selectedSlot) handleUnequip(selectedSlot);
          setShowItemDetail(false);
          onSellGear(item);
        } : undefined}
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

      {/* Active Set Bonus Drawer */}
      <ActiveSetBonusDrawer
        open={showSetBonusDrawer}
        onOpenChange={setShowSetBonusDrawer}
        equipment={equipment}
        characterName={characterName}
      />

      {/* Homebrew Gear Creator */}
      <HomebrewGearCreator
        open={showHomebrewCreator}
        onOpenChange={(open) => {
          setShowHomebrewCreator(open);
          if (!open) setEditingGear(null);
        }}
        onSave={addGear}
        onUpdate={updateGear}
        editItem={editingGear}
      />

      {/* AI Gear Forge */}
      <HomebrewGearAI
        open={showHomebrewAI}
        onOpenChange={setShowHomebrewAI}
        onSave={addMultipleGear}
      />
    </div>
  );
}
