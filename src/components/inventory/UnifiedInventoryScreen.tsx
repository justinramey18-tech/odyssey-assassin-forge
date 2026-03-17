import { useState, useEffect, useCallback } from 'react';
import { Shield, FlaskConical, Package, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { Separator } from '@/components/ui/separator';
import { InventoryScreen } from './InventoryScreen';
import { MiscItemsWidget } from './MiscItemsWidget';
import { ConsumablesInventoryWidget, AddConsumableDrawer } from '@/components/consumables';
import { LootScreen } from '@/components/loot/LootScreen';
import { ShopScreen } from '@/components/shop/ShopScreen';
import { CharacterEquipment, EquipmentItem } from '@/lib/inventory/types';
import { Achievement } from '@/lib/achievements';
import { InventoryItem, Consumable } from '@/lib/consumables/types';
import { MiscItem } from '@/lib/miscItems/types';
import { LootItem, SoldLootRecord } from '@/lib/loot/types';
import { ShopItem, ParsedShopItem, PurchaseRecord } from '@/lib/shop/types';
import { EquipmentItem as ShopEquipmentItem } from '@/lib/inventory/types';
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
  // Loot props
  lootItems: LootItem[];
  soldHistory: SoldLootRecord[];
  onAddLoot: (items: LootItem[]) => void;
  onDeleteLoot: (itemId: string) => void;
  onSellLoot: (itemId: string) => { success: boolean; goldReceived: number };
  onAddGold: (amount: number) => void;
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
  // Deep-linking
  activeInternalTab?: InventoryInternalTab;
  onInternalTabChange?: (tab: InventoryInternalTab) => void;
}

export function UnifiedInventoryScreen({
  characterName, level, equipment, onEquipmentChange, achievements,
  consumablesInventory, onUseConsumable, onAddConsumable, onAdjustConsumableQuantity, getConsumableCount,
  lootItems, soldHistory, onAddLoot, onDeleteLoot, onSellLoot, onAddGold,
  currentHP, maxHP, conditions, activeSetBonus, totalLootValue, onShareLootToParty,
  currentGold, shopItems, purchaseHistory, onPurchase, onRemoveShopItem, onAddShopItem,
  onAdjustGold, onSetGold, onClearShop,
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

  const consumableCount = consumablesInventory.reduce((sum, item) => sum + item.quantity, 0);
  const lootCount = lootItems.length;
  const shopCount = shopItems.length;
  const gearCount = Object.values(equipment.slots).filter(Boolean).length;

  const getBadge = (tabId: InventoryInternalTab): number | null => {
    switch (tabId) {
      case 'gear': return gearCount > 0 ? gearCount : null;
      case 'consumables': return consumableCount > 0 ? consumableCount : null;
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
            <div className="container max-w-4xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-cinzel text-2xl text-foreground">
                  Consumables Inventory
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
          />
        )}
      </div>
    </div>
  );
}
