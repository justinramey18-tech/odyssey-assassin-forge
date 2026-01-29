import { useState } from 'react';
import { Swords, Copy, Check, Target, Shield, Zap, Eye, Footprints, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { allAbilities } from '@/lib/abilities';
import { Ability, Character } from '@/lib/types';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { rollDice } from '@/lib/diceRoller';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ConsumablesInventoryWidget, AddConsumableDrawer } from '@/components/consumables';
import { useConsumables } from '@/hooks/use-consumables';
import { Separator } from '@/components/ui/separator';

const combatActions = [
  {
    id: 'attack',
    name: 'Attack Action',
    description: 'Make a melee or ranged weapon attack',
    icon: Swords,
    promptTemplate: '[Character Name] executes a precise attack, weapon flashing in a deadly arc toward their target. Describe the attack with tactical precision, noting stance, weapon angle, and the moment of impact.',
  },
  {
    id: 'dodge',
    name: 'Dodge Action',
    description: 'Focus on avoiding attacks',
    icon: Shield,
    promptTemplate: '[Character Name] shifts into a defensive stance, every sense attuned to incoming threats. They become a ghost of motion, ready to evade any attack. Describe their fluid, evasive movements.',
  },
  {
    id: 'dash',
    name: 'Dash Action',
    description: 'Double your movement speed',
    icon: Zap,
    promptTemplate: '[Character Name] breaks into a full sprint, covering ground with explosive speed. Their movement is a blur of calculated motion. Describe the rush of their dash across the battlefield.',
  },
  {
    id: 'hide',
    name: 'Hide Action',
    description: 'Attempt to become hidden',
    icon: Eye,
    promptTemplate: '[Character Name] melts into the shadows, using every bit of cover available. Their breathing slows, their presence fades. Describe how they vanish from sight.',
  },
  {
    id: 'disengage',
    name: 'Disengage Action',
    description: 'Move without provoking opportunity attacks',
    icon: Footprints,
    promptTemplate: '[Character Name] executes a tactical withdrawal, slipping away from enemies with practiced ease. No opening is given, no vulnerability exposed. Describe their smooth extraction.',
  },
];

interface CombatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  unlockedAbilities: Map<string, number>;
}

export function CombatDrawer({ 
  open, 
  onOpenChange, 
  character,
  unlockedAbilities,
}: CombatDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { 
    inventory, 
    useItem, 
    addItem, 
    setItemQuantity, 
    getItemCount,
    getTotalItems 
  } = useConsumables();

  const copyToClipboard = async (text: string, id: string) => {
    const processedText = text.replace(/\[Character Name\]/g, character.name || 'The Assassin');
    await navigator.clipboard.writeText(processedText);
    setCopiedId(id);
    toast.success('Prompt copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateAbilityPrompt = (ability: Ability) => {
    const tier = unlockedAbilities.get(ability.id) || 1;
    const roll = rollDice('d20', 1);
    return generateRPPrompt(ability, tier as 1 | 2 | 3, roll, character.name || 'The Assassin');
  };

  const getUnlockedAbilities = () => {
    return allAbilities.filter(a => unlockedAbilities.has(a.id) && a.type === 'active');
  };

  const unlockedActiveAbilities = getUnlockedAbilities();

  const handleUseConsumable = (id: string) => {
    useItem(id);
  };

  const handleAdjustQuantity = (id: string, delta: number) => {
    const current = getItemCount(id);
    setItemQuantity(id, current + delta);
  };

  return (
    <EdgeDrawer
      side="left"
      open={open}
      onOpenChange={onOpenChange}
      title="Combat Prompts"
      icon={<Swords className="w-5 h-5" />}
      accentColor="#ef4444"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-4 pr-2">
          {/* Consumables Section */}
          <Accordion type="single" collapsible className="w-full" defaultValue="consumables">
            <AccordionItem value="consumables" className="border-border/50">
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Consumables ({getTotalItems()})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <AddConsumableDrawer 
                    onAddItem={addItem}
                    getItemCount={getItemCount}
                  />
                  <ConsumablesInventoryWidget
                    inventory={inventory}
                    characterName={character.name || 'The Assassin'}
                    onUseItem={handleUseConsumable}
                    onAdjustQuantity={handleAdjustQuantity}
                    compact
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator className="bg-border/30" />

          {/* Basic Combat Actions */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Basic Actions
            </h3>
            <div className="space-y-2">
              {combatActions.map((action) => {
                const Icon = action.icon;
                const isCopied = copiedId === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={() => copyToClipboard(action.promptTemplate, action.id)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg',
                      'bg-card/50 hover:bg-card border border-border/50',
                      'transition-all duration-200 text-left group',
                      isCopied && 'bg-green-500/20 border-green-500/50'
                    )}
                  >
                    <span className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      'bg-red-500/20 text-red-400 group-hover:bg-red-500/30',
                      isCopied && 'bg-green-500/30 text-green-400'
                    )}>
                      {isCopied ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{action.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <Copy className={cn(
                      'w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                      isCopied && 'opacity-0'
                    )} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unlocked Abilities */}
          {unlockedActiveAbilities.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="abilities" className="border-border/50">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 hover:no-underline">
                  Unlocked Abilities ({unlockedActiveAbilities.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {unlockedActiveAbilities.map((ability) => {
                      const isCopied = copiedId === `ability-${ability.id}`;
                      const tier = unlockedAbilities.get(ability.id) || 1;
                      const treeColor = ability.tree === 'hunter' ? '#22c55e' 
                        : ability.tree === 'warrior' ? '#f97316' 
                        : '#a855f7';
                      
                      return (
                        <button
                          key={ability.id}
                          onClick={() => copyToClipboard(
                            generateAbilityPrompt(ability), 
                            `ability-${ability.id}`
                          )}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-lg',
                            'bg-card/50 hover:bg-card border border-border/50',
                            'transition-all duration-200 text-left group',
                            isCopied && 'bg-green-500/20 border-green-500/50'
                          )}
                        >
                          <span 
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ 
                              backgroundColor: `${treeColor}20`,
                              color: treeColor,
                            }}
                          >
                            {isCopied ? <Check className="w-4 h-4" /> : `T${tier}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground">{ability.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {ability.tree} • {ability.actionType.replace('_', ' ')}
                            </p>
                          </div>
                          <Copy className={cn(
                            'w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                            isCopied && 'opacity-0'
                          )} />
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Sneak Attack Prompt */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Special Attacks
            </h3>
            <button
              onClick={() => copyToClipboard(
                `[Character Name] spots the perfect opening. With the precision of a master assassin, they exploit their target's blindspot, channeling all their killing intent into a single devastating strike. The blade finds its mark with surgical accuracy, dealing ${character.level >= 17 ? '9d6' : character.level >= 13 ? '7d6' : character.level >= 9 ? '5d6' : character.level >= 5 ? '3d6' : '2d6'} additional sneak attack damage. Describe the lethal elegance of this assassination attempt.`,
                'sneak-attack'
              )}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg',
                'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30',
                'transition-all duration-200 text-left group',
                copiedId === 'sneak-attack' && 'bg-green-500/20 border-green-500/50'
              )}
            >
              <span className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                'bg-purple-500/30 text-purple-400',
                copiedId === 'sneak-attack' && 'bg-green-500/30 text-green-400'
              )}>
                {copiedId === 'sneak-attack' ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">Sneak Attack</p>
                <p className="text-xs text-muted-foreground">
                  +{character.level >= 17 ? '9d6' : character.level >= 13 ? '7d6' : character.level >= 9 ? '5d6' : character.level >= 5 ? '3d6' : '2d6'} precision damage
                </p>
              </div>
              <Copy className={cn(
                'w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                copiedId === 'sneak-attack' && 'opacity-0'
              )} />
            </button>
          </div>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
