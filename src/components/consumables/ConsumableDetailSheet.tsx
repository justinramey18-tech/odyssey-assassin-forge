import { useState } from 'react';
import { Minus, Plus, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Consumable, rarityConfig, typeConfig } from '@/lib/consumables/types';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';

interface ConsumableDetailSheetProps {
  consumable: Consumable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (consumable: Consumable, quantity: number) => void;
  currentCount: number;
}

export function ConsumableDetailSheet({
  consumable,
  open,
  onOpenChange,
  onAdd,
  currentCount,
}: ConsumableDetailSheetProps) {
  const [quantity, setQuantity] = useState(1);

  if (!consumable) return null;

  const rarity = rarityConfig[consumable.rarity];
  const typeInfo = typeConfig[consumable.type];
  const ItemIcon = getIconByName(consumable.icon);
  const TypeIcon = getIconByName(typeInfo.iconName);

  const handleAdd = () => {
    if (quantity > 0) {
      onAdd(consumable, quantity);
      setQuantity(1);
      onOpenChange(false);
    }
  };

  const incrementQuantity = () => setQuantity((prev) => Math.min(prev + 1, 99));
  const decrementQuantity = () => setQuantity((prev) => Math.max(prev - 1, 1));

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 99) {
      setQuantity(value);
    } else if (e.target.value === '') {
      setQuantity(1);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-xl">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={cn(
                'w-16 h-16 rounded-xl flex items-center justify-center shrink-0',
                'shadow-lg',
                rarity.bgColor,
                rarity.glowColor
              )}
            >
              <ItemIcon className={cn('w-8 h-8', rarity.color)} />
            </div>

            {/* Title & Badges */}
            <div className="flex-1 min-w-0">
              <SheetTitle className={cn('text-xl', rarity.color)}>
                {consumable.name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs', rarity.color, rarity.borderColor)}
                >
                  {rarity.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('text-xs', typeInfo.color)}
                >
                  <TypeIcon className="w-3 h-3 mr-1" />
                  {consumable.type.charAt(0).toUpperCase() + consumable.type.slice(1)}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {consumable.usageType}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="space-y-4 py-4">
          {/* Effect */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Effect
            </p>
            <p className="text-sm text-foreground">{consumable.effect}</p>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Duration
            </p>
            <p className="text-sm text-foreground">{consumable.duration}</p>
          </div>

          {/* Full Description */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {consumable.description}
            </p>
          </div>

          {/* Spell Level for Scrolls */}
          {consumable.spellLevel !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Spell Level
              </p>
              <p className="text-sm text-foreground">
                {consumable.spellLevel === 0 ? 'Cantrip' : `Level ${consumable.spellLevel}`}
              </p>
            </div>
          )}

          {/* Current Inventory Count */}
          {currentCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Currently in inventory:
              </span>
              <Badge variant="secondary" className="ml-auto">
                ×{currentCount}
              </Badge>
            </div>
          )}
        </div>

        {/* Quantity Selector & Add Button */}
        <SheetFooter className="flex-col gap-4 pt-4 border-t border-border/50">
          {/* Quantity Selector */}
          <div className="w-full">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Quantity to Add
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                className="h-12 w-12"
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={handleQuantityChange}
                className="w-20 h-12 text-center text-xl font-bold"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={incrementQuantity}
                disabled={quantity >= 99}
                className="h-12 w-12"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Add Button */}
          <Button
            onClick={handleAdd}
            className={cn(
              'w-full h-14 text-lg font-semibold',
              'bg-primary hover:bg-primary/90'
            )}
          >
            <Package className="w-5 h-5 mr-2" />
            Add {quantity} to Inventory
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
