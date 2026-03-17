import { X, Share2, Star, Sparkles, Shield, Sword, Scale, Coins, ChevronDown, Lock, TrendingUp, ImagePlus, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentItem, rarityConfig, setDefinitions, EquipmentSlotType, CharacterEquipment, equipmentSlotDefinitions } from '@/lib/inventory/index';
import { getIconByName } from '@/lib/iconUtils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useRef } from 'react';
import { itemPrerequisites, achievementCategories, getAchievementProgress } from '@/lib/achievements';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { toast } from 'sonner';

interface ItemDetailSheetProps {
  item: EquipmentItem | null;
  slotType: EquipmentSlotType | null;
  equipment: CharacterEquipment;
  customImage?: string | null;
  onImageUpload?: (file: File) => void;
  onImageClear?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onUnequip: () => void;
  onCompare: () => void;
  onSell?: (item: EquipmentItem) => void;
}

export function ItemDetailSheet({
  item,
  slotType,
  equipment,
  customImage,
  onImageUpload,
  onImageClear,
  isOpen,
  onClose,
  onUnequip,
  onCompare,
  onSell,
}: ItemDetailSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [enchantmentsOpen, setEnchantmentsOpen] = useState(true);
  const [setBonusOpen, setSetBonusOpen] = useState(true);
  const [prerequisiteOpen, setPrerequisiteOpen] = useState(true);

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

  // Get achievement prerequisite info for legendary items
  const prerequisite = itemPrerequisites[item.id];
  const prerequisiteAchievement = prerequisite 
    ? achievementCategories.find(a => a.id === prerequisite.achievementId)
    : null;
  const prerequisiteProgress = prerequisiteAchievement 
    ? Math.min(100, (prerequisiteAchievement.currentValue / prerequisite.requiredValue) * 100)
    : 0;
  const isUnlocked = prerequisiteAchievement 
    ? prerequisiteAchievement.currentValue >= prerequisite.requiredValue
    : true;

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
              <div
                className={cn(
                  "relative w-20 h-20 rounded-xl flex items-center justify-center border-2 mb-4 cursor-pointer overflow-hidden",
                  item.rarity === 'legendary' && "border-amber-400 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
                  item.rarity === 'epic' && "border-purple-400 bg-purple-400/10",
                  item.rarity === 'rare' && "border-blue-400 bg-blue-400/10",
                  item.rarity === 'uncommon' && "border-green-400 bg-green-400/10",
                  item.rarity === 'common' && "border-border bg-muted",
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImageUpload?.(file);
                      e.target.value = '';
                    }
                  }}
                />
                {customImage ? (
                  <img src={customImage} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <ItemIcon className={cn("w-10 h-10", rarity.color)} />
                )}
                <div className="absolute bottom-0.5 right-0.5 bg-background/70 rounded p-0.5">
                  <ImagePlus className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              
              <h2 className={cn("text-xl font-bold mb-1", rarity.color)}>
                {item.name}
              </h2>
              
              <div className={cn("flex items-center gap-1 mb-2", rarity.color)}>
                {renderStars(rarity.stars)}
                {rarity.stars > 0 && <span className="ml-1 text-sm">{rarity.label}</span>}
                {rarity.stars === 0 && <span className="text-sm">{rarity.label}</span>}
              </div>

              {/* Copy AI Prompt */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5"
                onClick={() => {
                  const slotLabel = slotType
                    ? equipmentSlotDefinitions.find(s => s.type === slotType)?.label || slotType
                    : '';
                  const statsLines = Object.entries(item.stats)
                    .filter(([_, v]) => v !== undefined)
                    .map(([k, v]) => `- **${k}:** ${v}`)
                    .join('\n');
                  const rawPrompt = `## Gear: ${item.name}

**Slot:** ${slotLabel}
**Rarity:** ${rarity.label}
**Level:** ${item.level}
${statsLines ? `\n### Stats\n${statsLines}` : ''}
${item.properties?.length ? `\n### Properties\n${item.properties.join(', ')}` : ''}
${item.enchantments?.length ? `\n### Enchantments\n${item.enchantments.map(e => `- **${e.name}:** ${e.description}`).join('\n')}` : ''}
${item.description ? `\n### Description\n${item.description}` : ''}
${item.setName ? `\n### Set\nPart of the **${item.setName}** set.` : ''}

---

*Describe how this gear looks and feels on the character, and how it might influence the current scene.*`;
                  const prompt = applyTimePrefix(rawPrompt);
                  navigator.clipboard.writeText(prompt);
                  toast.success('Gear prompt copied');
                }}
              >
                <Copy className="w-3 h-3" />
                Copy AI Prompt
              </Button>
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

            {/* Achievement Prerequisite for Legendary Items */}
            {prerequisite && prerequisiteAchievement && (
              <Collapsible open={prerequisiteOpen} onOpenChange={setPrerequisiteOpen} className="mb-4">
                <CollapsibleTrigger className={cn(
                  "flex items-center justify-between w-full p-3 rounded-lg border",
                  isUnlocked 
                    ? "bg-green-500/10 border-green-500/20" 
                    : "bg-red-500/10 border-red-500/20"
                )}>
                  <div className="flex items-center gap-2">
                    {isUnlocked ? (
                      <Sparkles className="w-4 h-4 text-green-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-red-400" />
                    )}
                    <span className={cn(
                      "font-semibold text-sm",
                      isUnlocked ? "text-green-400" : "text-red-400"
                    )}>
                      {isUnlocked ? "Unlocked" : "Unlock Requirement"}
                    </span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    isUnlocked ? "text-green-400" : "text-red-400",
                    prerequisiteOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className={cn(
                    "p-3 rounded-lg border",
                    isUnlocked ? "bg-green-500/5 border-green-500/10" : "bg-muted/30 border-border/50"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        isUnlocked ? "bg-green-500/20" : "bg-muted"
                      )}>
                        <TrendingUp className={cn(
                          "w-5 h-5",
                          isUnlocked ? "text-green-400" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "font-semibold text-sm",
                          isUnlocked ? "text-green-400" : "text-foreground"
                        )}>
                          {prerequisiteAchievement.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {prerequisiteAchievement.description}
                        </p>
                        
                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className={isUnlocked ? "text-green-400" : "text-amber-400"}>
                              {prerequisiteAchievement.currentValue}/{prerequisite.requiredValue}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                isUnlocked 
                                  ? "bg-gradient-to-r from-green-500 to-green-400" 
                                  : "bg-gradient-to-r from-amber-600 to-amber-400"
                              )}
                              style={{ width: `${prerequisiteProgress}%` }}
                            />
                          </div>
                        </div>
                        
                        {!isUnlocked && (
                          <p className="text-[10px] text-muted-foreground mt-2 italic">
                            Track in the Feats tab to unlock this item
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
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
