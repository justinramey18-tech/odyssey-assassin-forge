import { useState, useMemo, useCallback } from 'react';
import { Gem, Star, Shuffle, Sparkles, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { geraltPrompts, geraltInfinityStones, GeraltPrompt } from '@/lib/geraltPrompts';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type IntensityLevel = 'all' | 'mild' | 'moderate' | 'extreme';

const intensityLevels: { id: IntensityLevel; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: '🎲', color: '#9ca3af' },
  { id: 'mild', label: 'Mild', icon: '🌱', color: '#22c55e' },
  { id: 'moderate', label: 'Moderate', icon: '🔥', color: '#f97316' },
  { id: 'extreme', label: 'Extreme', icon: '💥', color: '#ef4444' },
];

function getPromptIntensity(promptId: string): IntensityLevel | null {
  if (promptId.includes('-mild-')) return 'mild';
  if (promptId.includes('-moderate-')) return 'moderate';
  if (promptId.includes('-extreme-')) return 'extreme';
  return null;
}

interface GeraltStoneDMDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUsePrompt: (prompt: string) => void;
}

export function GeraltStoneDMDrawer({ open, onOpenChange, onUsePrompt }: GeraltStoneDMDrawerProps) {
  const [expandedStone, setExpandedStone] = useState<string | undefined>(undefined);
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel>('all');

  const getPromptsForStone = useCallback((stoneId: string) => {
    const stone = geraltInfinityStones.find(s => s.id === stoneId);
    if (!stone) return [];
    return geraltPrompts.filter(p => stone.categories.includes(p.category));
  }, []);

  const filterByIntensity = useCallback((prompts: GeraltPrompt[]) => {
    if (selectedIntensity === 'all') return prompts;
    return prompts.filter(p => {
      const intensity = getPromptIntensity(p.id);
      return intensity === selectedIntensity || intensity === null;
    });
  }, [selectedIntensity]);

  const allFilteredPrompts = useMemo(() => {
    return filterByIntensity(geraltInfinityStones.flatMap(stone => getPromptsForStone(stone.id)));
  }, [selectedIntensity, filterByIntensity, getPromptsForStone]);

  const processAndUse = useCallback((prompt: GeraltPrompt) => {
    onUsePrompt(prompt.prompt);
    onOpenChange(false);
    toast.success(`${prompt.icon} ${prompt.title}`, { description: 'Added to input' });
  }, [onUsePrompt, onOpenChange]);

  const pickRandom = useCallback(() => {
    if (allFilteredPrompts.length === 0) { toast.error('No prompts available'); return; }
    const prompt = allFilteredPrompts[Math.floor(Math.random() * allFilteredPrompts.length)];
    processAndUse(prompt);
  }, [allFilteredPrompts, processAndUse]);

  return (
    <>
      {open && <style>{`[data-vaul-overlay] { z-index: 9998 !important; } [vaul-drawer] { z-index: 9999 !important; }`}</style>}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] bg-gradient-to-b from-[#1a0a05] via-[#0d0d12] to-[#0a0a0f] border-amber-900/30 !z-[9999]">
          <DrawerHeader className="px-4 pt-2 pb-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-amber-200 font-cinzel">
                <span className="text-lg">🦉</span>
                Geralt's Stones
              </DrawerTitle>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
            {/* Intensity Filters */}
            <div className="flex gap-1.5 flex-wrap pt-2">
              {intensityLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedIntensity(level.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-2 rounded-full text-xs font-medium min-h-[44px]',
                    'transition-all duration-200 border',
                    selectedIntensity === level.id ? 'scale-105' : 'opacity-60 hover:opacity-100'
                  )}
                  style={{
                    backgroundColor: selectedIntensity === level.id ? `${level.color}20` : 'transparent',
                    borderColor: selectedIntensity === level.id ? level.color : 'rgba(255,255,255,0.1)',
                    color: selectedIntensity === level.id ? level.color : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <span>{level.icon}</span>
                  <span>{level.label}</span>
                </button>
              ))}
            </div>

            {/* Random */}
            <button
              onClick={pickRandom}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-gradient-to-r from-amber-700 to-orange-600 hover:from-amber-600 hover:to-orange-500 text-white transition-all"
            >
              <Shuffle className="w-4 h-4" />
              Random Geralt Prompt
            </button>

            <p className="text-xs text-muted-foreground">
              🦉 Roleplay prompts tailored for Geralt the owlbear companion
            </p>

            {/* Stone Accordions */}
            <Accordion type="single" collapsible value={expandedStone} onValueChange={setExpandedStone} className="w-full space-y-2">
              {geraltInfinityStones.map((stone) => {
                const allStonePrompts = getPromptsForStone(stone.id);
                const prompts = filterByIntensity(allStonePrompts);
                if (prompts.length === 0) return null;

                return (
                  <AccordionItem key={stone.id} value={stone.id} className="border-0">
                    <AccordionTrigger
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg hover:no-underline transition-all duration-200',
                        expandedStone === stone.id ? 'rounded-b-none' : 'hover:scale-[1.02]'
                      )}
                      style={{
                        backgroundColor: `${stone.color}15`,
                        border: `1px solid ${stone.color}40`,
                        boxShadow: expandedStone === stone.id ? `0 0 20px ${stone.color}30` : undefined,
                      }}
                    >
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: stone.color, boxShadow: `0 0 10px ${stone.color}80` }}
                      >
                        <Gem className="w-4 h-4 text-white" />
                      </span>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm" style={{ color: stone.color }}>{stone.name}</p>
                        <p className="text-[10px] text-white/40">{stone.description}</p>
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${stone.color}30`, color: stone.color }}
                      >
                        {prompts.length}
                      </span>
                    </AccordionTrigger>

                    <AccordionContent
                      className="rounded-b-lg border border-t-0 p-2 space-y-1"
                      style={{ borderColor: `${stone.color}40` }}
                    >
                      {prompts.map((prompt) => {
                        const intensity = getPromptIntensity(prompt.id);
                        const intensityConfig = intensity ? intensityLevels.find(l => l.id === intensity) : null;

                        return (
                          <div
                            key={prompt.id}
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                          >
                            <div className="flex-1 min-w-0 py-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base shrink-0">{prompt.icon}</span>
                                <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
                                {intensityConfig && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                                    style={{ backgroundColor: `${intensityConfig.color}20`, color: intensityConfig.color }}
                                  >
                                    {intensityConfig.icon}
                                  </span>
                                )}
                              </div>
                              {prompt.description && (
                                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{prompt.description}</p>
                              )}
                            </div>

                            <button
                              onClick={() => processAndUse(prompt)}
                              className="shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300 text-xs font-medium transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Use
                            </button>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
