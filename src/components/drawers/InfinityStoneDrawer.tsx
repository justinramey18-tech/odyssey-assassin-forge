import { useState, useMemo } from 'react';
import { Gem, Copy, Check, Shuffle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EdgeDrawer } from './EdgeDrawer';
import { characterPrompts, CharacterPrompt } from '@/lib/characterPrompts';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type IntensityLevel = 'all' | 'mild' | 'moderate' | 'extreme';

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

const intensityLevels: { id: IntensityLevel; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: '🎲', color: 'hsl(var(--muted-foreground))' },
  { id: 'mild', label: 'Mild', icon: '🌱', color: '#22c55e' },
  { id: 'moderate', label: 'Moderate', icon: '🔥', color: '#f97316' },
  { id: 'extreme', label: 'Extreme', icon: '💥', color: '#ef4444' },
];

// Helper to detect intensity from prompt ID
function getPromptIntensity(promptId: string): IntensityLevel | null {
  if (promptId.includes('-mild-')) return 'mild';
  if (promptId.includes('-moderate-')) return 'moderate';
  if (promptId.includes('-extreme-')) return 'extreme';
  return null; // Legacy prompts without intensity markers
}

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
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel>('all');

  const getPromptsForStone = (stoneId: string) => {
    const stone = infinityStones.find(s => s.id === stoneId);
    if (!stone) return [];
    return characterPrompts.filter(p => stone.categories.includes(p.category));
  };

  // Filter prompts by intensity
  const filterByIntensity = (prompts: CharacterPrompt[]) => {
    if (selectedIntensity === 'all') return prompts;
    return prompts.filter(p => {
      const intensity = getPromptIntensity(p.id);
      return intensity === selectedIntensity || intensity === null; // Include legacy prompts in 'all' only
    });
  };

  // Get all prompts filtered by intensity for random selection
  const allFilteredPrompts = useMemo(() => {
    const allPrompts = infinityStones.flatMap(stone => getPromptsForStone(stone.id));
    return filterByIntensity(allPrompts);
  }, [selectedIntensity]);

  const copyToClipboard = async (prompt: CharacterPrompt) => {
    // Replace character name placeholder and apply 4th Wall Time prefix
    const processedText = prompt.prompt.replace(/\[Character Name\]/g, characterName || 'The Character');
    const finalText = applyTimePrefix(processedText);
    await navigator.clipboard.writeText(finalText);
    setCopiedId(prompt.id);
    toast.success('Prompt copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pickRandomPrompt = () => {
    if (allFilteredPrompts.length === 0) {
      toast.error('No prompts available for selected intensity');
      return;
    }
    const randomIndex = Math.floor(Math.random() * allFilteredPrompts.length);
    const randomPrompt = allFilteredPrompts[randomIndex];
    copyToClipboard(randomPrompt);
    
    // Find which stone this prompt belongs to and expand it
    const stone = infinityStones.find(s => s.categories.includes(randomPrompt.category));
    if (stone) {
      setExpandedStone(stone.id);
    }
    
    const intensity = getPromptIntensity(randomPrompt.id);
    const intensityLabel = intensity ? intensityLevels.find(l => l.id === intensity)?.icon : '';
    
    toast.success(`${intensityLabel} ${randomPrompt.title}`, {
      description: 'Copied to clipboard!',
    });
  };

  const surpriseMe = () => {
    // Pick random intensity (excluding 'all')
    const intensities: IntensityLevel[] = ['mild', 'moderate', 'extreme'];
    const randomIntensity = intensities[Math.floor(Math.random() * intensities.length)];
    
    // Get all prompts with that intensity
    const allPrompts = infinityStones.flatMap(stone => getPromptsForStone(stone.id));
    const intensityPrompts = allPrompts.filter(p => getPromptIntensity(p.id) === randomIntensity);
    
    if (intensityPrompts.length === 0) {
      toast.error('No prompts available');
      return;
    }
    
    // Pick random prompt
    const randomPrompt = intensityPrompts[Math.floor(Math.random() * intensityPrompts.length)];
    
    // Update UI to show what was picked
    setSelectedIntensity(randomIntensity);
    
    // Find which stone this prompt belongs to and expand it
    const stone = infinityStones.find(s => s.categories.includes(randomPrompt.category));
    if (stone) {
      setExpandedStone(stone.id);
    }
    
    // Copy to clipboard
    copyToClipboard(randomPrompt);
    
    const intensityConfig = intensityLevels.find(l => l.id === randomIntensity);
    
    toast.success(`🎰 ${stone?.name} × ${intensityConfig?.icon} ${intensityConfig?.label}`, {
      description: randomPrompt.title,
    });
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
        <div className="space-y-3 pr-2">
          {/* Intensity Level Selector */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Filter by intensity:</p>
            <div className="flex gap-1.5 flex-wrap">
              {intensityLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedIntensity(level.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
                    'transition-all duration-200 border',
                    selectedIntensity === level.id
                      ? 'scale-105'
                      : 'opacity-60 hover:opacity-100'
                  )}
                  style={{
                    backgroundColor: selectedIntensity === level.id ? `${level.color}20` : 'transparent',
                    borderColor: selectedIntensity === level.id ? level.color : 'hsl(var(--border))',
                    color: selectedIntensity === level.id ? level.color : 'hsl(var(--muted-foreground))',
                  }}
                >
                  <span>{level.icon}</span>
                  <span>{level.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Random Prompt Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={pickRandomPrompt}
              className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
              size="sm"
            >
              <Shuffle className="w-4 h-4" />
              Random {selectedIntensity !== 'all' ? intensityLevels.find(l => l.id === selectedIntensity)?.label : ''}
            </Button>
            <Button
              onClick={surpriseMe}
              className="gap-2 bg-gradient-to-r from-amber-500 via-red-500 to-purple-600 hover:from-amber-400 hover:via-red-400 hover:to-purple-500 text-white border-0 animate-pulse hover:animate-none"
              size="sm"
            >
              <Sparkles className="w-4 h-4" />
              🎰
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
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
              const allStonePrompts = getPromptsForStone(stone.id);
              const prompts = filterByIntensity(allStonePrompts);
              const isExpanded = expandedStone === stone.id;
              
              // Skip stones with no prompts for current filter
              if (prompts.length === 0) return null;
              
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
                      const intensity = getPromptIntensity(prompt.id);
                      const intensityConfig = intensity ? intensityLevels.find(l => l.id === intensity) : null;
                      
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
                          {intensityConfig && (
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                              style={{ 
                                backgroundColor: `${intensityConfig.color}20`,
                                color: intensityConfig.color,
                              }}
                            >
                              {intensityConfig.icon}
                            </span>
                          )}
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
