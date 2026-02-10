import { useState, useMemo, useCallback, useRef } from 'react';
import { HealTargetPicker } from '@/components/party/HealTargetPicker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Beaker,
  Skull,
  ScrollText,
  Plus,
  Minus,
  Zap,
  Copy,
  Check,
  Sparkles,
  PackageOpen,
  Undo2,
  Package,
  Dices,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useConsumables } from '@/hooks/use-consumables';
import { useToast } from '@/hooks/use-toast';
import { 
  Consumable, 
  InventoryItem, 
  rarityConfig, 
  typeConfig,
  ConsumableType,
} from '@/lib/consumables/types';
import { generateConsumablePrompt, ConsumableCombatContext } from '@/lib/consumables/prompts';
import { LootItem, lootRarityConfig } from '@/lib/loot/types';

// Icon mapping for consumable types
const TYPE_ICONS: Record<ConsumableType, React.ElementType> = {
  potion: Beaker,
  poison: Skull,
  scroll: ScrollText,
};

// Undo history entry
interface UndoEntry {
  consumable: Consumable;
  actionType: 'action' | 'bonus';
  timestamp: number;
}

const UNDO_TIMEOUT_MS = 10000; // 10 seconds to undo

interface MobileItemsGridProps {
  onAddToTurn: (actionType: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onRemoveFromTurn?: (description: string) => void;
  onNavigateToConsumables?: () => void;
  // Combat context for enriched prompts
  globalConditions?: Array<{ name: string; duration?: string }>;
  activeSetBonus?: { name: string; effect: string };
  concentrationSpell?: { name: string; level?: number };
  // Loot items with dice mechanics
  lootItemsWithDice?: LootItem[];
  onUseLootItem?: (item: LootItem) => void;
  // Combat log integration
  characterName?: string;
  onLogEntry?: (entry: { actionType: 'item'; actionName: string; prompt: string }) => void;
  onRemoveLogEntry?: (actionName: string) => void;
  // HP props for healing potions
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  onHPChange?: (current: number, max: number, temp: number) => void;
  // Party props for heal target picker
  partyMembers?: import('@/hooks/use-party-sync').PartyMember[];
  userId?: string;
  onSendHeal?: (targetUserId: string, actionData: { senderName?: string; itemName?: string; hpHealed?: number }) => Promise<void>;
}

export function MobileItemsGrid({
  onAddToTurn, 
  onRemoveFromTurn, 
  onNavigateToConsumables,
  globalConditions,
  activeSetBonus,
  concentrationSpell,
  lootItemsWithDice = [],
  onUseLootItem,
  characterName = 'The Assassin',
  onLogEntry,
  onRemoveLogEntry,
  currentHP,
  maxHP,
  tempHP = 0,
  onHPChange,
  partyMembers = [],
  userId,
  onSendHeal,
}: MobileItemsGridProps) {
  const { toast, dismiss } = useToast();
  const { inventory, useItem, addItem, setItemQuantity, isLoaded } = useConsumables();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<ConsumableType | 'all'>('all');
  const [copied, setCopied] = useState(false);
  
  // Undo state
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const undoTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Heal target picker state
  const [pendingHealItem, setPendingHealItem] = useState<InventoryItem | null>(null);
  const [pendingHealAmount, setPendingHealAmount] = useState(0);
  const [pendingHealCloseSheet, setPendingHealCloseSheet] = useState(false);

  // Filter inventory by type
  const filteredInventory = useMemo(() => {
    if (activeFilter === 'all') return inventory;
    return inventory.filter(item => item.consumable.type === activeFilter);
  }, [inventory, activeFilter]);

  // Count by type
  const typeCounts = useMemo(() => ({
    potion: inventory.filter(i => i.consumable.type === 'potion').reduce((s, i) => s + i.quantity, 0),
    poison: inventory.filter(i => i.consumable.type === 'poison').reduce((s, i) => s + i.quantity, 0),
    scroll: inventory.filter(i => i.consumable.type === 'scroll').reduce((s, i) => s + i.quantity, 0),
  }), [inventory]);

  // Get action type for consumable
  const getActionType = (consumable: Consumable): 'action' | 'bonus' => {
    // Potions are typically bonus actions, poisons apply as bonus, scrolls are actions
    if (consumable.type === 'potion') return 'bonus';
    if (consumable.type === 'poison') return 'bonus';
    return 'action';
  };

  // Undo a used item
  const handleUndo = useCallback((entry: UndoEntry) => {
    // Add item back to inventory
    addItem(entry.consumable, 1);
    
    // Remove from undo stack
    setUndoStack(prev => prev.filter(e => e.timestamp !== entry.timestamp));
    
    // Clear timeout if exists
    if (undoTimeoutRef.current[entry.timestamp]) {
      clearTimeout(undoTimeoutRef.current[entry.timestamp]);
      delete undoTimeoutRef.current[entry.timestamp];
    }
    
    // Remove from turn log if callback provided
    if (onRemoveFromTurn) {
      onRemoveFromTurn(`Use ${entry.consumable.name}`);
    }
    
    // Remove from combat log
    if (onRemoveLogEntry) {
      onRemoveLogEntry(`Use ${entry.consumable.name}`);
    }
    
    toast({
      title: "Undo Successful",
      description: `${entry.consumable.name} restored to inventory`,
      className: "border-amber-500/50 bg-amber-500/10",
    });
  }, [addItem, onRemoveFromTurn, onRemoveLogEntry, toast]);

  // Handle using an item (from detail sheet or quick use)
  const handleUseItem = useCallback((item: InventoryItem, closeSheet: boolean = false) => {
    const success = useItem(item.consumable.id, 1);
    if (success) {
      const actionType = getActionType(item.consumable);
      onAddToTurn(actionType, `Use ${item.consumable.name}`);
      
      // Auto-apply healing for healing potions
      const healMatch = item.consumable.effect.match(/restores?\s+(\d+)d(\d+)(?:\s*\+\s*(\d+))?\s*(?:hit\s*points|hp)/i);
      if (healMatch && onHPChange && currentHP !== undefined && maxHP !== undefined) {
        const diceCount = parseInt(healMatch[1]);
        const diceSides = parseInt(healMatch[2]);
        const modifier = parseInt(healMatch[3] || '0');
        let total = modifier;
        for (let i = 0; i < diceCount; i++) {
          total += Math.floor(Math.random() * diceSides) + 1;
        }
        
        // If in a party with other members, show target picker
        const otherMembers = partyMembers.filter(m => m.user_id !== userId);
        if (otherMembers.length > 0 && onSendHeal && userId) {
          setPendingHealItem(item);
          setPendingHealAmount(total);
          setPendingHealCloseSheet(closeSheet);
          // Don't apply heal yet — wait for target selection
        } else {
          // Solo: heal self immediately
          const newHP = Math.min(maxHP, currentHP + total);
          onHPChange(newHP, maxHP, tempHP);
        }
      }
      
      // Log to combat log with generated prompt
      if (onLogEntry) {
        const combatContext: ConsumableCombatContext = {
          conditions: globalConditions,
          setBonus: activeSetBonus,
          concentrationSpell: concentrationSpell,
        };
        const prompt = generateConsumablePrompt(item.consumable, characterName, combatContext);
        onLogEntry({
          actionType: 'item',
          actionName: `Use ${item.consumable.name}`,
          prompt,
        });
      }
      
      // Create undo entry
      const entry: UndoEntry = {
        consumable: item.consumable,
        actionType,
        timestamp: Date.now(),
      };
      
      setUndoStack(prev => [...prev, entry]);
      
      // Set timeout to remove from undo stack
      undoTimeoutRef.current[entry.timestamp] = setTimeout(() => {
        setUndoStack(prev => prev.filter(e => e.timestamp !== entry.timestamp));
        delete undoTimeoutRef.current[entry.timestamp];
      }, UNDO_TIMEOUT_MS);
      
      // Show toast with undo action
      toast({
        title: `${item.consumable.name} Used`,
        description: (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">{item.consumable.effect}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
              onClick={() => handleUndo(entry)}
            >
              <Undo2 className="w-3 h-3" />
              Undo
            </Button>
          </div>
        ),
        className: "border-cyan-500/50 bg-cyan-500/10",
        duration: UNDO_TIMEOUT_MS,
      });
      
      // Update selected item quantity in sheet
      if (!closeSheet) {
        setSelectedItem(prev => 
          prev ? { ...prev, quantity: prev.quantity - 1 } : null
        );
      }
    }
  }, [useItem, onAddToTurn, onLogEntry, globalConditions, activeSetBonus, concentrationSpell, characterName, toast, handleUndo]);

  // Quick use from grid (no sheet open)
  const handleQuickUse = useCallback((e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation(); // Don't open detail sheet
    handleUseItem(item, true);
  }, [handleUseItem]);

  // Copy AI DM prompt with combat context
  const handleCopyPrompt = async (consumable: Consumable) => {
    // Build combat context - map to ConsumableCombatContext format
    const combatContext: ConsumableCombatContext = {
      conditions: globalConditions,
      setBonus: activeSetBonus,
      concentrationSpell: concentrationSpell,
    };
    
    const prompt = generateConsumablePrompt(consumable, characterName, combatContext);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Prompt Copied",
      description: `${consumable.name} prompt ready for AI DM`,
      duration: 2000,
    });
  };

  // Update quantity for selected item
  const handleQuantityChange = (delta: number) => {
    if (!selectedItem) return;
    const newQuantity = selectedItem.quantity + delta;
    if (newQuantity <= 0) {
      setItemQuantity(selectedItem.consumable.id, 0);
      setSelectedItem(null);
    } else {
      setItemQuantity(selectedItem.consumable.id, newQuantity);
      setSelectedItem({ ...selectedItem, quantity: newQuantity });
    }
  };

  // Get current quantity from inventory (for real-time sync)
  const getCurrentQuantity = (consumableId: string): number => {
    const item = inventory.find(i => i.consumable.id === consumableId);
    return item?.quantity ?? 0;
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-24 space-y-4">
        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterPill
            label="All"
            count={inventory.reduce((s, i) => s + i.quantity, 0)}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <FilterPill
            label="Potions"
            count={typeCounts.potion}
            active={activeFilter === 'potion'}
            onClick={() => setActiveFilter('potion')}
            color="rose"
            icon={Beaker}
          />
          <FilterPill
            label="Poisons"
            count={typeCounts.poison}
            active={activeFilter === 'poison'}
            onClick={() => setActiveFilter('poison')}
            color="green"
            icon={Skull}
          />
          <FilterPill
            label="Scrolls"
            count={typeCounts.scroll}
            active={activeFilter === 'scroll'}
            onClick={() => setActiveFilter('scroll')}
            color="sky"
            icon={ScrollText}
          />
        </div>

        {/* Items Grid */}
        {filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <PackageOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No items in inventory</p>
            <p className="text-[11px] text-cyan-400 mt-2 italic">
              "Add consumables from the Consumables tab, genius."
            </p>
            {onNavigateToConsumables && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={onNavigateToConsumables}
              >
                <Plus className="w-4 h-4" />
                Go to Consumables
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredInventory.map(item => {
              const Icon = TYPE_ICONS[item.consumable.type];
              const rarity = rarityConfig[item.consumable.rarity];
              const typeConf = typeConfig[item.consumable.type];
              
              return (
                <button
                  key={item.consumable.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "flex flex-col items-center p-4 bg-card border border-l-4 rounded-xl transition-all active:scale-[0.98]",
                    rarity.borderColor,
                    item.quantity === 0 && "opacity-40"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-2",
                    typeConf.bgColor,
                    typeConf.color
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-center line-clamp-2">
                    {item.consumable.name}
                  </span>
                  
                  {/* Rarity badge */}
                  <Badge 
                    variant="outline" 
                    className={cn("text-[9px] mt-1", rarity.color, rarity.borderColor)}
                  >
                    {rarity.label}
                  </Badge>
                  
                  {/* Quantity display */}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-sm font-mono font-bold">
                      ×{item.quantity}
                    </span>
                  </div>

                  {/* Quick Use Button */}
                  <Button
                    size="sm"
                    onClick={(e) => handleQuickUse(e, item)}
                    disabled={item.quantity === 0}
                    className={cn(
                      "w-full mt-2 h-8 text-xs gap-1",
                      item.consumable.type === 'potion' && "bg-rose-600 hover:bg-rose-500",
                      item.consumable.type === 'poison' && "bg-green-600 hover:bg-green-500",
                      item.consumable.type === 'scroll' && "bg-sky-600 hover:bg-sky-500",
                    )}
                  >
                    <Zap className="w-3 h-3" />
                    Use
                  </Button>
                </button>
              );
            })}
          </div>
        )}

        {/* Loot Items with Dice Mechanics */}
        {lootItemsWithDice.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-purple-400">Loot Items</span>
              <Badge variant="secondary" className="text-[10px]">
                {lootItemsWithDice.length} with dice
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {lootItemsWithDice.map(item => {
                const rarity = lootRarityConfig[item.rarity];
                return (
                  <button
                    key={item.id}
                    onClick={() => onUseLootItem?.(item)}
                    className={cn(
                      "flex flex-col items-center p-4 bg-card border border-l-4 rounded-xl transition-all active:scale-[0.98]",
                      rarity.borderColor
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2 bg-purple-500/20 text-purple-400">
                      <Dices className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-center line-clamp-2">
                      {item.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[9px] mt-1", rarity.color, rarity.borderColor)}
                    >
                      {rarity.label}
                    </Badge>
                    {item.mechanics?.diceRoll && (
                      <span className="text-[10px] text-cyan-400 mt-1 font-mono">
                        {item.mechanics.diceRoll}
                      </span>
                    )}
                    {item.mechanics?.damage && (
                      <span className="text-[10px] text-red-400 mt-1 font-mono">
                        {item.mechanics.damage}
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseLootItem?.(item);
                      }}
                      className="w-full mt-2 h-8 text-xs gap-1 bg-purple-600 hover:bg-purple-500"
                    >
                      <Zap className="w-3 h-3" />
                      Use
                    </Button>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Item Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          
          {selectedItem && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-4">
                  {(() => {
                    const Icon = TYPE_ICONS[selectedItem.consumable.type];
                    const typeConf = typeConfig[selectedItem.consumable.type];
                    return (
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center",
                        typeConf.bgColor,
                        typeConf.color
                      )}>
                        <Icon className="w-8 h-8" />
                      </div>
                    );
                  })()}
                  <div>
                    <SheetTitle className="text-xl">{selectedItem.consumable.name}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]", 
                          rarityConfig[selectedItem.consumable.rarity].color,
                          rarityConfig[selectedItem.consumable.rarity].borderColor
                        )}
                      >
                        {rarityConfig[selectedItem.consumable.rarity].label}
                      </Badge>
                      <span>×{getCurrentQuantity(selectedItem.consumable.id)}</span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Effect */}
                <div className="p-3 bg-muted/10 rounded-lg border border-muted/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">EFFECT</div>
                  <p className="text-sm">{selectedItem.consumable.effect}</p>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 p-3 bg-muted/10 rounded-lg border border-muted/20">
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">DURATION</div>
                    <p className="text-sm">{selectedItem.consumable.duration}</p>
                  </div>
                  <div className="p-3 bg-muted/10 rounded-lg border border-muted/20">
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">USAGE</div>
                    <p className="text-sm capitalize">{selectedItem.consumable.usageType}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground italic">
                  {selectedItem.consumable.description}
                </p>

                {/* Action type badge */}
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-xs",
                    getActionType(selectedItem.consumable) === 'bonus'
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-red-500/20 text-red-300 border-red-500/50"
                  )}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {getActionType(selectedItem.consumable) === 'bonus' ? 'BONUS ACTION' : 'ACTION'}
                  </Badge>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-center gap-4 py-4">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={getCurrentQuantity(selectedItem.consumable.id) === 0}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <span className="text-4xl font-mono font-bold w-16 text-center">
                    {getCurrentQuantity(selectedItem.consumable.id)}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUseItem(selectedItem, false)}
                    disabled={getCurrentQuantity(selectedItem.consumable.id) === 0}
                    className="flex-1 h-14 text-lg bg-cyan-600 hover:bg-cyan-500"
                  >
                    Use {selectedItem.consumable.name.split(' ')[0]}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyPrompt(selectedItem.consumable)}
                    className="h-14 w-14 border-muted/40"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Heal Target Picker for party healing */}
      <HealTargetPicker
        open={!!pendingHealItem}
        onOpenChange={(open) => { if (!open) { setPendingHealItem(null); setPendingHealAmount(0); } }}
        selfName={characterName}
        partyMembers={partyMembers}
        currentUserId={userId || ''}
        healDescription={pendingHealItem ? `${pendingHealItem.consumable.name} — ${pendingHealAmount} HP` : ''}
        onSelectSelf={() => {
          if (onHPChange && currentHP !== undefined && maxHP !== undefined) {
            const newHP = Math.min(maxHP, currentHP + pendingHealAmount);
            onHPChange(newHP, maxHP, tempHP);
          }
          setPendingHealItem(null);
          setPendingHealAmount(0);
        }}
        onSelectMember={(member) => {
          if (onSendHeal && pendingHealItem) {
            onSendHeal(member.user_id, {
              senderName: characterName,
              itemName: pendingHealItem.consumable.name,
              hpHealed: pendingHealAmount,
            });
          }
          setPendingHealItem(null);
          setPendingHealAmount(0);
        }}
      />
    </>
  );
}

// Filter pill component
function FilterPill({
  label,
  count,
  active,
  onClick,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: React.ElementType;
}) {
  const colorClasses: Record<string, { active: string; inactive: string }> = {
    rose: { active: 'bg-rose-500/20 border-rose-500/50 text-rose-300', inactive: 'text-rose-400' },
    green: { active: 'bg-green-500/20 border-green-500/50 text-green-300', inactive: 'text-green-400' },
    sky: { active: 'bg-sky-500/20 border-sky-500/50 text-sky-300', inactive: 'text-sky-400' },
    slate: { active: 'bg-slate-500/20 border-slate-500/50 text-slate-300', inactive: 'text-slate-400' },
  };

  const classes = colorClasses[color || 'slate'] || colorClasses.slate;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-mono whitespace-nowrap transition-all border",
        active ? classes.active : "bg-muted/10 border-muted/20 text-muted-foreground"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      {count > 0 && (
        <span className={cn(
          "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
          active ? "bg-white/10" : "bg-muted/30"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
