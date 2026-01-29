import { useState } from 'react';
import { Sparkles, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CharacterEquipment, EquipmentItem, SetInfo, rarityConfig } from '@/lib/inventory/types';
import { getActiveSetBonuses, allEquipment } from '@/lib/inventory/utils';
import { toast } from 'sonner';

interface ActiveSetBonusDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: CharacterEquipment;
  characterName: string;
}

// Generate the roleplay prompt for a set piece
function generateSetPiecePrompt(
  item: EquipmentItem,
  setInfo: SetInfo,
  characterName: string
): string {
  // Build the enchantment/property descriptions
  const bonusDescriptions: string[] = [];
  
  if (item.enchantments && item.enchantments.length > 0) {
    item.enchantments.forEach(ench => {
      bonusDescriptions.push(`${ench.name}: ${ench.description}`);
    });
  }
  
  if (item.properties && item.properties.length > 0) {
    bonusDescriptions.push(`Properties: ${item.properties.join(', ')}`);
  }

  const bonusText = bonusDescriptions.length > 0 
    ? bonusDescriptions.join('. ')
    : item.description || 'unique magical abilities';

  // Build the roleplay context based on item slot
  const slotRoleplay = getSlotRoleplayContext(item.slotType, item.name);

  const prompt = `I have the ${item.name} equipped, which offers me ${bonusText}. 

${slotRoleplay}

As ${characterName}, I want to invoke the power of this legendary artifact from the ${setInfo.name}. Describe how the ${item.name}'s magic manifests as I channel its abilities in this moment, incorporating its unique enchantments and the meta-narrative powers it grants me.`;

  return prompt;
}

function getSlotRoleplayContext(slotType: string, itemName: string): string {
  const contexts: Record<string, string> = {
    head: `The ${itemName} pulses with awareness, its enchantments flowing through my thoughts and perception.`,
    chest: `The ${itemName} radiates protective energy across my form, its regenerative magic coursing through my body.`,
    arms: `The ${itemName} crackles with deadly potential, ready to amplify my strikes and gestures.`,
    waist: `The ${itemName} hums with utility magic, its pouches and attachments holding secrets of convenience.`,
    legs: `The ${itemName} thrums with kinetic energy, granting me impossible movement and acrobatic grace.`,
    primary_weapon: `I draw my ${itemName}, its blade humming with narrative awareness and meta-physical power.`,
    secondary_weapon: `I ready my ${itemName}, feeling its chaotic energy yearning for creative destruction.`,
    ranged_weapon: `I aim my ${itemName}, its projectiles guided by dramatic timing and cinematic flair.`,
  };
  
  return contexts[slotType] || `The ${itemName} resonates with legendary power, ready to be unleashed.`;
}

export function ActiveSetBonusDrawer({
  open,
  onOpenChange,
  equipment,
  characterName,
}: ActiveSetBonusDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const activeSetBonuses = getActiveSetBonuses(equipment.slots);

  const handleCopy = async (prompt: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(itemId);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy prompt');
    }
  };

  const toggleSet = (setId: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(setId)) {
      newExpanded.delete(setId);
    } else {
      newExpanded.add(setId);
    }
    setExpandedSets(newExpanded);
  };

  // Get equipped items that belong to active sets
  const getEquippedSetPieces = (setInfo: SetInfo): EquipmentItem[] => {
    const equippedItems = Object.values(equipment.slots).filter(Boolean) as EquipmentItem[];
    return equippedItems.filter(item => item.setId === setInfo.id);
  };

  if (activeSetBonuses.length === 0) {
    return (
      <EdgeDrawer
        side="right"
        open={open}
        onOpenChange={onOpenChange}
        title="Active Set Bonuses"
        icon={<Sparkles className="w-5 h-5" />}
        accentColor="#f59e0b"
      >
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <Sparkles className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            No active set bonuses. Equip 2+ pieces from the same legendary set to unlock powerful AI prompts!
          </p>
        </div>
      </EdgeDrawer>
    );
  }

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Active Set Bonuses"
      icon={<Sparkles className="w-5 h-5" />}
      accentColor="#f59e0b"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-4 pb-4">
          {activeSetBonuses.map(({ setInfo, activePieces }) => {
            const equippedPieces = getEquippedSetPieces(setInfo);
            const isExpanded = expandedSets.has(setInfo.id);
            
            // Get active bonuses for this set
            const activeBonuses = setInfo.bonuses.filter(
              bonus => activePieces >= bonus.piecesRequired
            );

            return (
              <Collapsible
                key={setInfo.id}
                open={isExpanded}
                onOpenChange={() => toggleSet(setInfo.id)}
              >
                {/* Set Header */}
                <CollapsibleTrigger asChild>
                  <button className="w-full">
                    <div
                      className={cn(
                        "rounded-lg border p-3 transition-all",
                        "bg-amber-400/10 border-amber-400/30",
                        "hover:bg-amber-400/15"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="font-bold text-sm text-amber-400">
                            {setInfo.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-400/80">
                            {activePieces}/{setInfo.pieces.length}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Active Bonuses Preview */}
                      <div className="mt-2 space-y-1">
                        {activeBonuses.map((bonus, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs text-amber-300/80"
                          >
                            <span className="text-amber-400">✓</span>
                            <span className="font-medium">{bonus.piecesRequired}pc:</span>
                            <span className="flex-1 text-left">{bonus.bonus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>

                {/* Expanded Content - Individual Piece Prompts */}
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-2">
                    {equippedPieces.map((item) => {
                      const rarity = rarityConfig[item.rarity];
                      const prompt = generateSetPiecePrompt(item, setInfo, characterName);
                      const isCopied = copiedId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-lg border p-3",
                            "bg-card/50 border-l-4",
                            rarity?.borderClass
                          )}
                        >
                          {/* Item Header */}
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={cn("font-semibold text-sm", rarity?.color)}>
                              {item.name}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleCopy(prompt, item.id)}
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>

                          {/* Enchantments */}
                          {item.enchantments && item.enchantments.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {item.enchantments.map((ench, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="text-primary font-medium">
                                    {ench.name}:
                                  </span>
                                  <span className="text-muted-foreground ml-1">
                                    {ench.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Copy Prompt Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 text-xs h-8 border-amber-400/30 hover:bg-amber-400/10 hover:border-amber-400/50"
                            onClick={() => handleCopy(prompt, item.id)}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 mr-1 text-green-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy AI Prompt
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
