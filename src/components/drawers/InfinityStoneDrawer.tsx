import { useState } from 'react';
import { Gem, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { characterPrompts, CharacterPrompt } from '@/lib/characterPrompts';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Infinity Stones configuration matching the gauntlet screen
const infinityStones = [
  {
    id: 'soul',
    name: 'Soul Stone',
    color: '#f97316',
    categories: ['Emotional', 'Social'],
    description: 'Emotional depth & social interactions',
  },
  {
    id: 'reality',
    name: 'Reality Stone',
    color: '#ef4444',
    categories: ['World'],
    description: 'World interaction & consequences',
  },
  {
    id: 'power',
    name: 'Power Stone',
    color: '#a855f7',
    categories: ['Combat'],
    description: 'Combat style & battle flavor',
  },
  {
    id: 'time',
    name: 'Time Stone',
    color: '#22c55e',
    categories: ['Meta Requests'],
    description: 'Fourth-wall breaking DM requests',
  },
  {
    id: 'mind',
    name: 'Mind Stone',
    color: '#eab308',
    categories: ['Investigation'],
    description: 'Problem-solving & investigation',
  },
  {
    id: 'space',
    name: 'Space Stone',
    color: '#3b82f6',
    categories: ['Voice & Tone', 'Narrative'],
    description: 'Character voice & narrative style',
  },
];

interface InfinityStoneDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
}

export function InfinityStoneDrawer({ 
  open, 
  onOpenChange,
  characterName,
}: InfinityStoneDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedStone, setExpandedStone] = useState<string | undefined>(undefined);

  const getPromptsForStone = (stoneId: string) => {
    const stone = infinityStones.find(s => s.id === stoneId);
    if (!stone) return [];
    return characterPrompts.filter(p => stone.categories.includes(p.category));
  };

  const copyToClipboard = async (prompt: CharacterPrompt) => {
    const processedText = prompt.prompt.replace(/\[Character Name\]/g, characterName || 'The Character');
    await navigator.clipboard.writeText(processedText);
    setCopiedId(prompt.id);
    toast.success('Prompt copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="RP Prompts"
      icon={<Gem className="w-5 h-5" />}
      accentColor="#eab308"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-2 pr-2">
          <p className="text-xs text-muted-foreground mb-4">
            Tap a stone to reveal roleplay prompts for your AI DM
          </p>

          <Accordion 
            type="single" 
            collapsible 
            value={expandedStone}
            onValueChange={setExpandedStone}
            className="w-full space-y-2"
          >
            {infinityStones.map((stone) => {
              const prompts = getPromptsForStone(stone.id);
              const isExpanded = expandedStone === stone.id;
              
              return (
                <AccordionItem 
                  key={stone.id} 
                  value={stone.id}
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
                      backgroundColor: `${stone.color}15`,
                      border: `1px solid ${stone.color}40`,
                      boxShadow: isExpanded ? `0 0 20px ${stone.color}30` : undefined,
                    }}
                  >
                    <span 
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ 
                        backgroundColor: stone.color,
                        boxShadow: `0 0 10px ${stone.color}80`,
                      }}
                    >
                      <Gem className="w-4 h-4 text-white" />
                    </span>
                    <div className="flex-1 text-left">
                      <p 
                        className="font-medium text-sm"
                        style={{ color: stone.color }}
                      >
                        {stone.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stone.description}
                      </p>
                    </div>
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: `${stone.color}30`,
                        color: stone.color,
                      }}
                    >
                      {prompts.length}
                    </span>
                  </AccordionTrigger>
                  
                  <AccordionContent
                    className="rounded-b-lg border border-t-0 p-2 space-y-1"
                    style={{ borderColor: `${stone.color}40` }}
                  >
                    {prompts.map((prompt) => {
                      const isCopied = copiedId === prompt.id;
                      return (
                        <button
                          key={prompt.id}
                          onClick={() => copyToClipboard(prompt)}
                          className={cn(
                            'w-full flex items-center gap-2 p-2.5 rounded-lg',
                            'bg-card/50 hover:bg-card border border-transparent',
                            'transition-all duration-200 text-left group',
                            isCopied && 'bg-green-500/20 border-green-500/50'
                          )}
                        >
                          <span className="text-base shrink-0">{prompt.icon}</span>
                          <span className={cn(
                            'flex-1 text-sm text-foreground/90 group-hover:text-foreground',
                            isCopied && 'text-green-400'
                          )}>
                            {prompt.title}
                          </span>
                          {isCopied ? (
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
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
