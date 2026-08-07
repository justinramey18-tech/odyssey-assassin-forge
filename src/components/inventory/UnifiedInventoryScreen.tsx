import { useState, useEffect, useCallback } from 'react';
import { Shield, FlaskConical, Package, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { Separator } from '@/components/ui/separator';
import { InventoryScreen } from './InventoryScreen';
import { MiscItemsWidget } from './MiscItemsWidget';
import { SellItemDrawer, getConsumableSellPrice, getEquipmentSellPrice, getMiscSellPrice } from './SellItemDrawer';
import { ConsumablesInventoryWidget, AddConsumableDrawer } from '@/components/consumables';
import { LootScreen } from '@/components/loot/LootScreen';
import { ShopScreen } from '@/components/shop/ShopScreen';
import { CharacterEquipment, EquipmentItem } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { InventoryItem, Consumable } from '@/lib/consumables/types';
import { MiscItem } from '@/lib/miscItems/types';
import { LootItem, SoldLootRecord } from '@/lib/loot/types';
import { EncumbranceInfo } from '@/lib/inventory/encumbrance';
import { ShopItem, ParsedShopItem, PurchaseRecord } from '@/lib/shop/types';
import { CatalogItem } from '@/lib/shop/catalog';
import { EquipmentItem as ShopEquipmentItem } from '@/lib/inventory/types';
import { toast } from 'sonner';
import builderBackground from '@/assets/builder-background.jpg';

export type InventoryInternalTab = 'gear' | 'consumables' | 'loot' | 'shop';

const STORAGE_KEY = 'odyssey-inventory-active-tab';

const INTERNAL_TABS: { id: InventoryInternalTab; label: string; icon: React.ElementType }[] = [
  { id: 'gear', label: 'Gear', icon: Shield },
  { id: 'consumables', label: 'Items', icon: FlaskConical },
  { id: 'loot', label: 'Loot', icon: Package },
  { id: 'shop', label: 'Shop', icon: Store },
];

interface UnifiedInventoryScreenProps {
  // Gear props
  characterName: string;
  level: number;
  equipment: CharacterEquipment;
  onEquipmentChange: (equipment: CharacterEquipment) => void;
  achievements: Achievement[];
  // Consumables props
  consumablesInventory: InventoryItem[];
  onUseConsumable: (id: string) => void;
  onAddConsumable: (consumable: Consumable) => void;
  onAdjustConsumableQuantity: (id: string, delta: number) => void;
  getConsumableCount: (id: string) => number;
  // Misc items props
  miscItems: MiscItem[];
  onAddMiscItem: (item: Omit<MiscItem, 'id' | 'addedAt'>) => void;
  onRemoveMiscItem: (id: string) => void;
  onAdjustMiscQuantity: (id: string, delta: number) => void;
  onUpdateMiscNotes: (id: string, notes: string) => void;
  onRemoveConsumable: (consumableId: string) => void;
  onAdjustConsumableQuantitySet: (consumableId: string, quantity: number) => void;
  // Loot props
  lootItems: LootItem[];
  soldHistory: SoldLootRecord[];
  onAddLoot: (items: LootItem[]) => void;
  onDeleteLoot: (itemId: string) => void;
  onSellLoot: (itemId: string) => { success: boolean; goldReceived: number };
  onAddGold: (amount: number) => void;
  encumbrance?: EncumbranceInfo;
  attackBonus?: number;
  armorClass?: number;
  currentHP?: number;
  maxHP?: number;
  conditions?: Array<{ name: string; duration?: string }>;
  activeSetBonus?: { name: string; effect: string };
  totalLootValue: number;
  onShareLootToParty?: (item: LootItem) => void;
  // Shop props
  currentGold: number;
  shopItems: ShopItem[];
  purchaseHistory: PurchaseRecord[];
  onPurchase: (itemId: string) => {
    success: boolean;
    convertedItem?: Consumable | ShopEquipmentItem;
    destinationType?: 'consumable' | 'equipment' | 'miscellaneous';
    error?: string;
  };
  onRemoveShopItem: (itemId: string) => void;
  onAddShopItem: (item: ParsedShopItem) => void;
  onAdjustGold: (amount: number) => void;
  onSetGold: (amount: number) => void;
  onClearShop: () => void;
  onPurchaseCatalogItem?: (catalogItem: CatalogItem) => void;
  // Sell callback — adds gold to shop balance
  onAddGoldFromSale: (amount: number) => void;
  // Deep-linking
  activeInternalTab?: InventoryInternalTab;
  onInternalTabChange?: (tab: InventoryInternalTab) => void;
}

export function UnifiedInventoryScreen({
  characterName, level, equipment, onEquipmentChange, achievements,
  consumablesInventory, onUseConsumable, onAddConsumable, onAdjustConsumableQuantity, getConsumableCount,
  onRemoveConsumable, onAdjustConsumableQuantitySet,
  miscItems, onAddMiscItem, onRemoveMiscItem, onAdjustMiscQuantity, onUpdateMiscNotes,
  lootItems, soldHistory, onAddLoot, onDeleteLoot, onSellLoot, onAddGold,
  encumbrance, attackBonus, armorClass,
  currentHP, maxHP, conditions, activeSetBonus, totalLootValue, onShareLootToParty,
  currentGold, shopItems, purchaseHistory, onPurchase, onRemoveShopItem, onAddShopItem,
  onAdjustGold, onSetGold, onClearShop, onAddGoldFromSale, onPurchaseCatalogItem,
  activeInternalTab, onInternalTabChange,
}: UnifiedInventoryScreenProps) {
  const [localTab, setLocalTab] = useState<InventoryInternalTab>(() => {
    if (activeInternalTab) return activeInternalTab;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && INTERNAL_TABS.some(t => t.id === saved)) return saved as InventoryInternalTab;
    } catch { /* ignore */ }
    return 'gear';
  });

  // Sell drawer state
  const [sellDrawerOpen, setSellDrawerOpen] = useState(false);
  const [sellItemInfo, setSellItemInfo] = useState<{
    name: string;
    suggestedPrice: number;
    quantity: number;
    type: 'gear' | 'consumable' | 'misc';
    id: string;
    gearItem?: EquipmentItem;
  } | null>(null);

  const currentTab = activeInternalTab ?? localTab;

  const handleTabChange = useCallback((tab: InventoryInternalTab) => {
    setLocalTab(tab);
    try { localStorage.setItem(STORAGE_KEY, tab); } catch { /* ignore */ }
    onInternalTabChange?.(tab);
  }, [onInternalTabChange]);

  // Sync external tab changes
  useEffect(() => {
    if (activeInternalTab && activeInternalTab !== localTab) {
      setLocalTab(activeInternalTab);
    }
  }, [activeInternalTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sell handlers
  const handleSellGear = useCallback((item: EquipmentItem) => {
    setSellItemInfo({
      name: item.name,
      suggestedPrice: getEquipmentSellPrice(item.value),
      quantity: 1,
      type: 'gear',
      id: item.id,
      gearItem: item,
    });
    setSellDrawerOpen(true);
  }, []);

  const handleSellConsumable = useCallback((consumableId: string, quantity: number) => {
    const item = consumablesInventory.find(i => i.consumable.id === consumableId);
    if (!item) return;
    setSellItemInfo({
      name: item.consumable.name,
      suggestedPrice: getConsumableSellPrice(item.consumable.rarity),
      quantity: item.quantity,
      type: 'consumable',
      id: consumableId,
    });
    setSellDrawerOpen(true);
  }, [consumablesInventory]);

  const handleSellMisc = useCallback((id: string, quantity: number) => {
    const item = miscItems.find(i => i.id === id);
    if (!item) return;
    setSellItemInfo({
      name: item.name,
      suggestedPrice: getMiscSellPrice(item.goldValue),
      quantity: item.quantity,
      type: 'misc',
      id: id,
    });
    setSellDrawerOpen(true);
  }, [miscItems]);

  const handleConfirmSell = useCallback((sellPrice: number, qty: number) => {
    if (!sellItemInfo) return;
    const totalGold = sellPrice * qty;

    if (sellItemInfo.type === 'gear') {
      // Remove from inventory (already unequipped by InventoryScreen)
      const newInventory = equipment.inventory.filter(i => i.id !== sellItemInfo.id);
      onEquipmentChange({ ...equipment, inventory: newInventory });
    } else if (sellItemInfo.type === 'consumable') {
      if (qty >= (consumablesInventory.find(i => i.consumable.id === sellItemInfo.id)?.quantity ?? 0)) {
        onRemoveConsumable(sellItemInfo.id);
      } else {
        const current = consumablesInventory.find(i => i.consumable.id === sellItemInfo.id);
        if (current) {
          onAdjustConsumableQuantitySet(sellItemInfo.id, current.quantity - qty);
        }
      }
    } else if (sellItemInfo.type === 'misc') {
      const item = miscItems.find(i => i.id === sellItemInfo.id);
      if (item && qty >= item.quantity) {
        onRemoveMiscItem(sellItemInfo.id);
      } else {
        onAdjustMiscQuantity(sellItemInfo.id, -qty);
      }
    }

    onAddGoldFromSale(totalGold);
    toast.success(`Sold ${sellItemInfo.name}${qty > 1 ? ` ×${qty}` : ''} for ${totalGold} GP`);
    setSellItemInfo(null);
  }, [sellItemInfo, equipment, onEquipmentChange, consumablesInventory, onRemoveConsumable, onAdjustConsumableQuantitySet, miscItems, onRemoveMiscItem, onAdjustMiscQuantity, onAddGoldFromSale]);

  const miscCount = miscItems.reduce((sum, i) => sum + i.quantity, 0);
  const consumableCount = consumablesInventory.reduce((sum, item) => sum + item.quantity, 0);
  const lootCount = lootItems.length;
  const shopCount = shopItems.length;
  const gearCount = Object.values(equipment.slots).filter(Boolean).length;

  const getBadge = (tabId: InventoryInternalTab): number | null => {
    switch (tabId) {
      case 'gear': return gearCount > 0 ? gearCount : null;
      case 'consumables': { const total = consumableCount + miscCount; return total > 0 ? total : null; }
      case 'loot': return lootCount > 0 ? lootCount : null;
      case 'shop': return shopCount > 0 ? shopCount : null;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-10vh)]">
      {/* Internal tab bar */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border px-3 py-2">
        <div className="flex gap-1.5">
          {INTERNAL_TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;
            const badge = getBadge(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[40px]',
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {badge !== null && (
                  <span className={cn(
                    'text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full',
                    isActive ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {currentTab === 'gear' && (
          <InventoryScreen
            characterName={characterName}
            level={level}
            equipment={equipment}
            onEquipmentChange={onEquipmentChange}
            achievements={achievements}
            onSellGear={handleSellGear}
            encumbrance={encumbrance}
            attackBonus={attackBonus}
            armorClass={armorClass}
          />
        )}

        {currentTab === 'consumables' && (
          <BackgroundWrapper
            imagePath={builderBackground}
            overlayOpacity={70}
            tintColor="green"
            tintOpacity={15}
            className="min-h-[calc(100vh-14vh)]"
          >
            <div className="container max-w-4xl mx-auto px-4 py-6 space-y-8">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="font-cinzel text-2xl text-foreground">
                    Consumables
                  </h1>
                  <AddConsumableDrawer
                    onAddItem={onAddConsumable}
                    getItemCount={getConsumableCount}
                  />
                </div>
                <ConsumablesInventoryWidget
                  inventory={consumablesInventory}
                  characterName={characterName}
                  onUseItem={onUseConsumable}
                  onAdjustQuantity={(id, delta) => onAdjustConsumableQuantity(id, delta)}
                  onSellItem={handleSellConsumable}
                />
              </div>

              <Separator className="opacity-30" />

              <MiscItemsWidget
                items={miscItems}
                onAddItem={onAddMiscItem}
                onRemoveItem={onRemoveMiscItem}
                onAdjustQuantity={onAdjustMiscQuantity}
                onUpdateNotes={onUpdateMiscNotes}
                onSellItem={handleSellMisc}
              />
            </div>
          </BackgroundWrapper>
        )}

        {currentTab === 'loot' && (
          <LootScreen
            lootItems={lootItems}
            soldHistory={soldHistory}
            onAddLoot={onAddLoot}
            onDeleteLoot={onDeleteLoot}
            onSellLoot={onSellLoot}
            onAddGold={onAddGold}
            characterName={characterName}
            currentHP={currentHP}
            maxHP={maxHP}
            conditions={conditions}
            activeSetBonus={activeSetBonus}
            totalLootValue={totalLootValue}
            onShareToParty={onShareLootToParty}
          />
        )}

        {currentTab === 'shop' && (
          <ShopScreen
            currentGold={currentGold}
            shopItems={shopItems}
            purchaseHistory={purchaseHistory}
            onPurchase={onPurchase}
            onRemoveItem={onRemoveShopItem}
            onAddItem={onAddShopItem}
            onAdjustGold={onAdjustGold}
            onSetGold={onSetGold}
            onClearShop={onClearShop}
            onPurchaseCatalogItem={onPurchaseCatalogItem}
          />
        )}
      </div>

      {/* Sell Item Drawer */}
      {sellItemInfo && (
        <SellItemDrawer
          open={sellDrawerOpen}
          onOpenChange={setSellDrawerOpen}
          itemName={sellItemInfo.name}
          suggestedPrice={sellItemInfo.suggestedPrice}
          quantity={sellItemInfo.quantity}
          onConfirmSell={handleConfirmSell}
        />
      )}
    </div>
  );
}
