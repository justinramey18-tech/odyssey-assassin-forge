import { X, Share2, Star, Sparkles, Shield, Sword, Scale, Coins, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, rarityConfig, setDefinitions, EquipmentSlotType, CharacterEquipment } from '@/lib/inventory';
import { getIconByName } from '@/lib/iconUtils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface ItemDetailSheetProps {
  item: EquipmentItem | null;
  slotType: EquipmentSlotType | null;
  equipment: CharacterEquipment;
  isOpen: boolean;
  onClose: () => void;
  onUnequip: () => void;
  onCompare: () => void;
}

export function ItemDetailSheet({
  item,
  slotType,
  equipment,
  isOpen,
  onClose,
  onUnequip,
  onCompare,
}: ItemDetailSheetProps) {
  const [enchantmentsOpen, setEnchantmentsOpen] = useState(true);
  const [setBonusOpen, setSetBonusOpen] = useState(true);

  if (!item) return null;

  const rarity = rarityConfig[item.rarity];
  const ItemIcon = getIconByName(item.icon);

  // Get set info if applicable
  const setInfo = item.setId ? setDefinitions.find(s => s.id === item.setId) : null;
  const equippedSetPieces = setInfo 
    ? Object.values(equipment.slots)
        .filter(Boolean)
        .filter(i => i?.setId === item.setId)
        .length
    : 0;

  const renderStars = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="w-4 h-4 fill-current" />
    ));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Header Actions */}
            <div className="flex items-center justify-between mb-4">
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Share2 className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Item Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className={cn(
                "w-20 h-20 rounded-xl flex items-center justify-center border-2 mb-4",
                item.rarity === 'legendary' && "border-amber-400 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
                item.rarity === 'epic' && "border-purple-400 bg-purple-400/10",
                item.rarity === 'rare' && "border-blue-400 bg-blue-400/10",
                item.rarity === 'uncommon' && "border-green-400 bg-green-400/10",
                item.rarity === 'common' && "border-border bg-muted",
              )}>
                <ItemIcon className={cn("w-10 h-10", rarity.color)} />
              </div>
              
              <h2 className={cn("text-xl font-bold mb-1", rarity.color)}>
                {item.name}
              </h2>
              
              <div className={cn("flex items-center gap-1 mb-2", rarity.color)}>
                {renderStars(rarity.stars)}
                {rarity.stars > 0 && <span className="ml-1 text-sm">{rarity.label}</span>}
                {rarity.stars === 0 && <span className="text-sm">{rarity.label}</span>}
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Primary Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {item.stats.damage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Sword className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Damage</p>
                    <p className="font-bold">{item.stats.damage}</p>
                  </div>
                </div>
              )}
              {item.stats.ac && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">AC Bonus</p>
                    <p className="font-bold">+{item.stats.ac}</p>
                  </div>
                </div>
              )}
              {item.stats.attackBonus && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Sword className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Attack Bonus</p>
                    <p className="font-bold">+{item.stats.attackBonus}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Stats */}
            <div className="space-y-2 mb-4">
              {item.properties && item.properties.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Properties</span>
                  <span>{item.properties.join(', ')}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Scale className="w-4 h-4" /> Weight
                </span>
                <span>{item.weight} lbs</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coins className="w-4 h-4" /> Value
                </span>
                <span>{item.value} gp</span>
              </div>
            </div>

            {/* Enchantments */}
            {item.enchantments && item.enchantments.length > 0 && (
              <Collapsible open={enchantmentsOpen} onOpenChange={setEnchantmentsOpen} className="mb-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-sm text-purple-400">Enchantments</span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-purple-400 transition-transform",
                    enchantmentsOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {item.enchantments.map((enchant, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="font-semibold text-sm text-purple-300">{enchant.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{enchant.description}</p>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Set Bonus */}
            {setInfo && (
              <Collapsible open={setBonusOpen} onOpenChange={setSetBonusOpen} className="mb-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-amber-400">{setInfo.name}</span>
                    <span className="text-xs text-amber-400/70">({equippedSetPieces}/{setInfo.pieces.length})</span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-amber-400 transition-transform",
                    setBonusOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-1">
                  {setInfo.bonuses.map((bonus, idx) => {
                    const isActive = equippedSetPieces >= bonus.piecesRequired;
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded text-sm",
                          isActive ? "text-amber-400" : "text-muted-foreground"
                        )}
                      >
                        <span>{isActive ? '✓' : '⏳'}</span>
                        <span>{bonus.piecesRequired}pc:</span>
                        <span>{bonus.bonus}</span>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Description */}
            {item.description && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            )}

            {/* Lore */}
            {item.lore && (
              <div className="mb-6 p-3 rounded-lg bg-muted/30 border-l-2 border-primary/50 italic">
                <p className="text-sm text-muted-foreground">{item.lore}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={onUnequip}>
                Unequip
              </Button>
              <Button variant="outline" className="flex-1" onClick={onCompare}>
                Compare
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Keep Equipped
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
