// Shop Screen - Main shop interface

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Package, History, Trash2, Info, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { GoldBalanceWidget } from './GoldBalanceWidget';
import { ShopItemCard } from './ShopItemCard';
import { AddItemDrawer } from './AddItemDrawer';
import { ShopItem, ParsedShopItem, PurchaseRecord } from '@/lib/shop/types';
import { Consumable } from '@/lib/consumables/types';
import { EquipmentItem } from '@/lib/inventory/types';
import shopBackground from '@/assets/shop-background.jpg';

interface ShopScreenProps {
  currentGold: number;
  shopItems: ShopItem[];
  purchaseHistory: PurchaseRecord[];
  onPurchase: (itemId: string) => { 
    success: boolean; 
    convertedItem?: Consumable | EquipmentItem;
    destinationType?: 'consumable' | 'equipment' | 'miscellaneous';
    error?: string;
  };
  onRemoveItem: (itemId: string) => void;
  onAddItem: (item: ParsedShopItem) => void;
  onAdjustGold: (amount: number) => void;
  onSetGold: (amount: number) => void;
  onClearShop: () => void;
}

export function ShopScreen({
  currentGold,
  shopItems,
  purchaseHistory,
  onPurchase,
  onRemoveItem,
  onAddItem,
  onAdjustGold,
  onSetGold,
  onClearShop,
}: ShopScreenProps) {
  const [activeView, setActiveView] = useState<'items' | 'history'>('items');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const handlePurchase = (itemId: string) => {
    setPurchasingId(itemId);
    const result = onPurchase(itemId);
    // Reset after animation completes
    setTimeout(() => {
      setPurchasingId(null);
    }, 400);
  };

  return (
    <BackgroundWrapper 
      imagePath={shopBackground} 
      overlayOpacity={70} 
      tintColor="amber" 
      tintOpacity={15}
      backgroundPosition="top center"
      className="min-h-[calc(100vh-10vh)]"
    >
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Store className="w-7 h-7 text-amber-400" />
            <h1 className="font-cinzel text-2xl text-foreground">
              Merchant's Wares
            </h1>
          </div>
          
          <GoldBalanceWidget 
            currentGold={currentGold} 
            onAdjustGold={onAdjustGold}
            onSetGold={onSetGold}
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant={activeView === 'items' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('items')}
            className="font-cinzel"
          >
            <Package className="w-4 h-4 mr-2" />
            Available ({shopItems.length})
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('history')}
            className="font-cinzel"
          >
            <History className="w-4 h-4 mr-2" />
            History ({purchaseHistory.length})
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <AddItemDrawer onAddItem={onAddItem} />
            
            {shopItems.length > 0 && activeView === 'items' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearShop}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Items View */}
        {activeView === 'items' && (
          <>
            {shopItems.length === 0 ? (
              <EmptyShopState />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {shopItems.map(item => (
                    <ShopItemCard
                      key={item.id}
                      item={item}
                      currentGold={currentGold}
                      onPurchase={handlePurchase}
                      onExpired={onRemoveItem}
                      isPurchasing={purchasingId === item.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* History View */}
        {activeView === 'history' && (
          <>
            {purchaseHistory.length === 0 ? (
              <EmptyHistoryState />
            ) : (
              <div className="space-y-2">
                {purchaseHistory.slice().reverse().map((record, index) => (
                  <motion.div
                    key={`${record.itemId}-${record.purchasedAt}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      "bg-card/50 border border-border/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        record.convertedTo === 'consumable' 
                          ? "bg-emerald-500/20 text-emerald-400"
                          : record.convertedTo === 'equipment'
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-muted text-muted-foreground",
                      )}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {record.itemName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent to {record.convertedTo === 'consumable' 
                            ? 'Consumables' 
                            : record.convertedTo === 'equipment'
                            ? 'Gear Inventory'
                            : 'Miscellaneous'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Coins className="w-3 h-3" />
                        <span className="font-medium">{record.cost.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(record.purchasedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </BackgroundWrapper>
  );
}

function EmptyShopState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-amber-500/10 mb-4">
        <Store className="w-12 h-12 text-amber-400/50" />
      </div>
      <h3 className="font-cinzel text-lg text-foreground mb-2">
        No Items for Sale
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Use Chronicle Sync to parse session logs containing merchant encounters. 
        Items offered for sale will appear here automatically.
      </p>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-muted/50 max-w-md">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground text-left">
          <strong>Tip:</strong> Session logs with phrases like "for sale", "offers to sell", 
          or "costs X gold" will trigger shop item detection.
        </p>
      </div>
    </div>
  );
}

function EmptyHistoryState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted/30 mb-4">
        <History className="w-12 h-12 text-muted-foreground/50" />
      </div>
      <h3 className="font-cinzel text-lg text-foreground mb-2">
        No Purchase History
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your purchase history will appear here after you buy items from the shop.
      </p>
    </div>
  );
}
