import { X, ArrowUp, ArrowDown, Minus, Star, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, rarityConfig, EquipmentSlotType } from '@/lib/inventory/index';
import { getIconByName } from '@/lib/iconUtils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ComparisonSheetProps {
  equippedItem: EquipmentItem | null;
  compareItem: EquipmentItem | null;
  slotType: EquipmentSlotType | null;
  isOpen: boolean;
  onClose: () => void;
  onEquipNew: () => void;
}

export function ComparisonSheet({
  equippedItem,
  compareItem,
  slotType,
  isOpen,
  onClose,
  onEquipNew,
}: ComparisonSheetProps) {
  if (!slotType) return null;

  const equippedRarity = equippedItem ? rarityConfig[equippedItem.rarity] : null;
  const compareRarity = compareItem ? rarityConfig[compareItem.rarity] : null;

  const EquippedIcon = equippedItem ? getIconByName(equippedItem.icon) : HelpCircle;
  const CompareIcon = compareItem ? getIconByName(compareItem.icon) : HelpCircle;

  const compareStats = (key: string) => {
    const equippedVal = equippedItem?.stats[key] as number || 0;
    const compareVal = compareItem?.stats[key] as number || 0;
    
    if (typeof equippedVal !== 'number' || typeof compareVal !== 'number') return null;
    
    const diff = compareVal - equippedVal;
    
    if (diff > 0) return { icon: ArrowUp, color: 'text-green-400', value: `+${diff}` };
    if (diff < 0) return { icon: ArrowDown, color: 'text-red-400', value: diff.toString() };
    return { icon: Minus, color: 'text-muted-foreground', value: '0' };
  };

  const weightDiff = compareStats('weight') || { icon: Minus, color: 'text-muted-foreground', value: '0' };
  // Weight is reversed - lower is better
  const adjustedWeightDiff = {
    ...weightDiff,
    icon: weightDiff.value.startsWith('+') ? ArrowDown : weightDiff.value.startsWith('-') ? ArrowUp : Minus,
    color: weightDiff.value.startsWith('+') ? 'text-red-400' : weightDiff.value.startsWith('-') ? 'text-green-400' : 'text-muted-foreground',
  };

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-3 h-3 fill-current" />
    ));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-xl p-0">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Compare Items</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Equipped Item */}
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Equipped
                </span>
              </div>
              
              <div className={cn(
                "p-4 rounded-lg border-2 text-center",
                equippedItem 
                  ? `${equippedRarity?.borderClass?.replace('border-l-', 'border-')} bg-muted/30`
                  : "border-dashed border-muted-foreground/30 bg-muted/10"
              )}>
                {equippedItem ? (
                  <>
                    <EquippedIcon className={cn("w-10 h-10 mx-auto mb-2", equippedRarity?.color)} />
                    <p className={cn("font-semibold text-sm truncate", equippedRarity?.color)}>
                      {equippedItem.name}
                    </p>
                    <div className={cn("flex items-center justify-center gap-0.5 mt-1", equippedRarity?.color)}>
                      {equippedRarity && renderStars(equippedRarity.stars)}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Empty Slot</p>
                )}
              </div>

              {/* Stats */}
              {equippedItem && (
                <div className="space-y-2 text-sm">
                  {equippedItem.stats.ac && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AC:</span>
                      <span>+{equippedItem.stats.ac}</span>
                    </div>
                  )}
                  {equippedItem.stats.damage && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Damage:</span>
                      <span>{equippedItem.stats.damage}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight:</span>
                    <span>{equippedItem.weight} lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value:</span>
                    <span>{equippedItem.value} gp</span>
                  </div>
                </div>
              )}
            </div>

            {/* Compare Item */}
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comparing
                </span>
              </div>
              
              <div className={cn(
                "p-4 rounded-lg border-2 text-center",
                compareItem 
                  ? `${compareRarity?.borderClass?.replace('border-l-', 'border-')} bg-muted/30`
                  : "border-dashed border-muted-foreground/30 bg-muted/10"
              )}>
                {compareItem ? (
                  <>
                    <CompareIcon className={cn("w-10 h-10 mx-auto mb-2", compareRarity?.color)} />
                    <p className={cn("font-semibold text-sm truncate", compareRarity?.color)}>
                      {compareItem.name}
                    </p>
                    <div className={cn("flex items-center justify-center gap-0.5 mt-1", compareRarity?.color)}>
                      {compareRarity && renderStars(compareRarity.stars)}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Select Item</p>
                )}
              </div>

              {/* Stats with diff indicators */}
              {compareItem && (
                <div className="space-y-2 text-sm">
                  {compareItem.stats.ac !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">AC:</span>
                      <div className="flex items-center gap-1">
                        <span>+{compareItem.stats.ac}</span>
                        {compareStats('ac') && (
                          <span className={compareStats('ac')!.color}>
                            ({compareStats('ac')!.value})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {compareItem.stats.damage && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Damage:</span>
                      <span>{compareItem.stats.damage}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Weight:</span>
                    <div className="flex items-center gap-1">
                      <span>{compareItem.weight} lbs</span>
                      <span className={adjustedWeightDiff.color}>
                        ({adjustedWeightDiff.value})
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value:</span>
                    <span>{compareItem.value} gp</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Net Effect Summary */}
          {compareItem && equippedItem && (
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-center text-muted-foreground">
                Overall: {
                  (compareItem.stats.ac || 0) > (equippedItem.stats.ac || 0)
                    ? "Better defense"
                    : (compareItem.stats.ac || 0) < (equippedItem.stats.ac || 0)
                    ? "Lower defense"
                    : compareItem.weight < equippedItem.weight
                    ? "Lighter weight"
                    : "Similar performance"
                }
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={onEquipNew} disabled={!compareItem}>
              Equip New
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
