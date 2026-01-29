import { useState } from 'react';
import { Sparkles, Copy, Check, ChevronDown, ChevronRight, X, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CharacterEquipment, EquipmentItem, SetInfo, rarityConfig } from '@/lib/inventory/types';
import { getActiveSetBonuses } from '@/lib/inventory/utils';
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

interface PromptModalData {
  item: EquipmentItem;
  setInfo: SetInfo;
  prompt: string;
}

export function ActiveSetBonusDrawer({
  open,
  onOpenChange,
  equipment,
  characterName,
}: ActiveSetBonusDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [promptModal, setPromptModal] = useState<PromptModalData | null>(null);

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

  const openPromptModal = (item: EquipmentItem, setInfo: SetInfo) => {
    const prompt = generateSetPiecePrompt(item, setInfo, characterName);
    setPromptModal({ item, setInfo, prompt });
  };

  const closePromptModal = () => {
    setPromptModal(null);
  };

  const copyModalPrompt = async () => {
    if (!promptModal) return;
    try {
      await navigator.clipboard.writeText(promptModal.prompt);
      setCopiedId(promptModal.item.id);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy prompt');
    }
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
                      const isCopied = copiedId === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => openPromptModal(item, setInfo)}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition-all",
                            "bg-card/50 border-l-4 hover:bg-card/80",
                            "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
                            rarity?.borderClass
                          )}
                        >
                          {/* Item Header */}
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={cn("font-semibold text-sm", rarity?.color)}>
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-1">
                              {isCopied && (
                                <Check className="w-3 h-3 text-green-400" />
                              )}
                              <Wand2 className="w-4 h-4 text-amber-400" />
                            </div>
                          </div>

                          {/* Enchantments Preview */}
                          {item.enchantments && item.enchantments.length > 0 && (
                            <div className="space-y-1">
                              {item.enchantments.slice(0, 2).map((ench, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="text-primary font-medium">
                                    {ench.name}
                                  </span>
                                </div>
                              ))}
                              {item.enchantments.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{item.enchantments.length - 2} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Tap to view hint */}
                          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                            <Wand2 className="w-3 h-3" />
                            Tap to view AI prompt
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Prompt Detail Modal */}
      <Dialog open={!!promptModal} onOpenChange={(open) => !open && closePromptModal()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b border-border/50 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber-400" />
              <span className={cn(
                "font-cinzel",
                promptModal?.item && rarityConfig[promptModal.item.rarity]?.color
              )}>
                {promptModal?.item.name}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4 space-y-4">
            {/* Set Info Badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">
                {promptModal?.setInfo.name}
              </span>
            </div>

            {/* Enchantments */}
            {promptModal?.item.enchantments && promptModal.item.enchantments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Enchantments
                </h4>
                <div className="space-y-2">
                  {promptModal.item.enchantments.map((ench, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 rounded-md bg-primary/10 border border-primary/20"
                    >
                      <span className="text-sm font-medium text-primary">
                        {ench.name}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ench.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Prompt */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                AI Prompt
              </h4>
              <Textarea
                value={promptModal?.prompt || ''}
                readOnly
                className="min-h-[180px] text-sm font-mono bg-muted/30 border-muted resize-none"
              />
            </div>
          </div>

          {/* Copy Button */}
          <div className="pt-3 border-t border-border/50">
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={copyModalPrompt}
            >
              {copiedId === promptModal?.item.id ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy AI Prompt
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EdgeDrawer>
  );
}
