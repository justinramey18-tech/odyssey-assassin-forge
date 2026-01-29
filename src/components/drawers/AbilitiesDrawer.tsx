import { useState } from 'react';
import { Zap, Copy, Check, Shield, Flame, Skull } from 'lucide-react';
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

const treeConfig = {
  hunter: { 
    name: 'Hunter', 
    color: '#22c55e', 
    icon: Shield,
    description: 'Stealth & survival abilities',
  },
  warrior: { 
    name: 'Warrior', 
    color: '#f97316', 
    icon: Flame,
    description: 'Combat & martial prowess',
  },
  assassin: { 
    name: 'Assassin', 
    color: '#a855f7', 
    icon: Skull,
    description: 'Deadly precision strikes',
  },
};

interface AbilitiesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
  unlockedAbilities: Map<string, number>;
}

export function AbilitiesDrawer({ 
  open, 
  onOpenChange, 
  character,
  unlockedAbilities,
}: AbilitiesDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTree, setExpandedTree] = useState<string | undefined>(undefined);

  const getAbilitiesByTree = (tree: 'hunter' | 'warrior' | 'assassin') => {
    return allAbilities.filter(a => 
      a.tree === tree && unlockedAbilities.has(a.id)
    );
  };

  const generateAbilityPrompt = (ability: Ability) => {
    const tier = unlockedAbilities.get(ability.id) || 1;
    const roll = rollDice('d20', 1);
    return generateRPPrompt(ability, tier as 1 | 2 | 3, roll, character.name || 'The Assassin');
  };

  const copyToClipboard = async (ability: Ability) => {
    const prompt = generateAbilityPrompt(ability);
    await navigator.clipboard.writeText(prompt);
    setCopiedId(ability.id);
    toast.success('Ability prompt copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const trees = ['hunter', 'warrior', 'assassin'] as const;
  const totalUnlocked = Array.from(unlockedAbilities.keys()).length;

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Abilities"
      icon={<Zap className="w-5 h-5" />}
      accentColor="#a855f7"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-2 pr-2">
          <p className="text-xs text-muted-foreground mb-4">
            {totalUnlocked} abilities unlocked • Tap to copy prompts
          </p>

          <Accordion 
            type="single" 
            collapsible 
            value={expandedTree}
            onValueChange={setExpandedTree}
            className="w-full space-y-2"
          >
            {trees.map((tree) => {
              const config = treeConfig[tree];
              const abilities = getAbilitiesByTree(tree);
              const TreeIcon = config.icon;
              const isExpanded = expandedTree === tree;
              
              if (abilities.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={tree} 
                  value={tree}
                  className="border-0"
                >
                  <AccordionTrigger
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg',
                      'hover:no-underline transition-all duration-200',
                      isExpanded 
                        ? 'rounded-b-none' 
                        : 'hover:scale-[1.02]'
                    )}
                    style={{
                      backgroundColor: `${config.color}15`,
                      border: `1px solid ${config.color}40`,
                      boxShadow: isExpanded ? `0 0 20px ${config.color}30` : undefined,
                    }}
                  >
                    <span 
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ 
                        backgroundColor: config.color,
                        boxShadow: `0 0 10px ${config.color}80`,
                      }}
                    >
                      <TreeIcon className="w-4 h-4 text-white" />
                    </span>
                    <div className="flex-1 text-left">
                      <p 
                        className="font-medium text-sm"
                        style={{ color: config.color }}
                      >
                        {config.name} Tree
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: `${config.color}30`,
                        color: config.color,
                      }}
                    >
                      {abilities.length}
                    </span>
                  </AccordionTrigger>
                  
                  <AccordionContent
                    className="rounded-b-lg border border-t-0 p-2 space-y-1"
                    style={{ borderColor: `${config.color}40` }}
                  >
                    {abilities.map((ability) => {
                      const isCopied = copiedId === ability.id;
                      const tier = unlockedAbilities.get(ability.id) || 1;
                      const isPassive = ability.type === 'passive';
                      
                      return (
                        <button
                          key={ability.id}
                          onClick={() => !isPassive && copyToClipboard(ability)}
                          disabled={isPassive}
                          className={cn(
                            'w-full flex items-center gap-2 p-2.5 rounded-lg',
                            'bg-card/50 border border-transparent',
                            'transition-all duration-200 text-left group',
                            isPassive 
                              ? 'opacity-60 cursor-not-allowed' 
                              : 'hover:bg-card',
                            isCopied && 'bg-green-500/20 border-green-500/50'
                          )}
                        >
                          <span 
                            className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ 
                              backgroundColor: `${config.color}20`,
                              color: config.color,
                            }}
                          >
                            T{tier}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              'text-sm text-foreground/90',
                              isCopied && 'text-green-400'
                            )}>
                              {ability.name}
                            </span>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {ability.actionType.replace('_', ' ')} • {ability.type}
                            </p>
                          </div>
                          {isPassive ? (
                            <span className="text-[10px] text-muted-foreground">Passive</span>
                          ) : isCopied ? (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {totalUnlocked === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No abilities unlocked yet</p>
              <p className="text-xs">Spend points in the Skills tab</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
