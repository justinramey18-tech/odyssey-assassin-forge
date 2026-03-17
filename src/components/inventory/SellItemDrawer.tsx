// Sell Item Confirmation Drawer

import { useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface SellItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  suggestedPrice: number;
  quantity?: number;
  onConfirmSell: (sellPrice: number, quantity: number) => void;
}

export function SellItemDrawer({
  open,
  onOpenChange,
  itemName,
  suggestedPrice,
  quantity = 1,
  onConfirmSell,
}: SellItemDrawerProps) {
  const [sellPrice, setSellPrice] = useState(suggestedPrice);
  const [sellQty, setSellQty] = useState(1);

  // Reset when opened
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setSellPrice(suggestedPrice);
      setSellQty(1);
    }
    onOpenChange(val);
  };

  const totalGold = sellPrice * sellQty;
  const maxQty = quantity;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-cinzel flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Sell Item
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-4">
          <div className="bg-muted/30 border border-border/50 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground">{itemName}</p>
            {maxQty > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                You have {maxQty} available
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Sell Price (GP each)</label>
              <Input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            {maxQty > 1 && (
              <div className="w-20">
                <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                <Input
                  type="number"
                  min="1"
                  max={maxQty}
                  value={sellQty}
                  onChange={(e) => setSellQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <span className="text-sm text-muted-foreground">You'll receive:</span>
            <span className="text-lg font-bold text-amber-400">{totalGold} GP</span>
          </div>

          {sellPrice === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Selling for 0 GP will discard the item without earning gold.</span>
            </div>
          )}
        </div>
        <DrawerFooter>
          <Button
            onClick={() => {
              onConfirmSell(sellPrice, sellQty);
              onOpenChange(false);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-foreground"
          >
            <Coins className="w-4 h-4 mr-2" />
            Sell for {totalGold} GP
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ============ SELL PRICE UTILITIES ============

/** Estimate sell price for a consumable based on rarity (50% of estimated value) */
export function getConsumableSellPrice(rarity: string): number {
  const values: Record<string, number> = {
    common: 25,
    uncommon: 75,
    rare: 200,
    very_rare: 1000,
    legendary: 2500,
  };
  return Math.floor((values[rarity] || 25) / 2);
}

/** Sell price for equipment (50% of item value) */
export function getEquipmentSellPrice(value: number): number {
  return Math.floor(value / 2);
}

/** Sell price for misc items (50% of gold value, or 1 GP minimum) */
export function getMiscSellPrice(goldValue?: number): number {
  if (!goldValue || goldValue <= 0) return 0;
  return Math.max(1, Math.floor(goldValue / 2));
}
