import { useState, useMemo, useCallback } from 'react';
import { Gem, Star, Shuffle, Sparkles, Play, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { characterPrompts, CharacterPrompt, DEADPOOL_PROMPT_IDS, PROMPT_HINTS } from '@/lib/characterPrompts';
import { groupBySubcategory, isMasterworkStone } from '@/lib/masterworkGrouping';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { useFavoritePrompts } from '@/hooks/use-favorite-prompts';
import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { AlignmentBadge } from '@/components/alignment/AlignmentBadge';
import { MoodGateway } from '@/components/prompts/MoodGateway';
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

type IntensityLevel = 'all' | 'mild' | 'moderate' | 'extreme' | 'favorites';

const infinityStones = [
  { id: 'soul', name: 'Soul Stone', color: '#f97316', categories: ['Emotional', 'Social'] },
  { id: 'reality', name: 'Reality Stone', color: '#ef4444', categories: ['World'] },
  { id: 'power', name: 'Power Stone', color: '#a855f7', categories: ['Combat'] },
  { id: 'time', name: 'Time Stone', color: '#22c55e', categories: ['Meta Requests'] },
  { id: 'mind', name: 'Mind Stone', color: '#eab308', categories: ['Investigation'] },
  { id: 'space', name: 'Space Stone', color: '#3b82f6', categories: ['Voice & Tone', 'Narrative'] },
  { id: 'masterwork', name: 'Masterwork Stone', color: '#f5f5f5', categories: ['Masterwork'] },
];

const intensityLevels: { id: IntensityLevel; label: string; icon: string; color: string }[] = [
  { id: 'favorites', label: 'Favorites', icon: '⭐', color: '#eab308' },
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

interface InfinityStoneDMDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  onUsePrompt: (prompt: string) => void;
}

export function InfinityStoneDMDrawer({ open, onOpenChange, characterName, onUsePrompt }: InfinityStoneDMDrawerProps) {
  const [expandedStone, setExpandedStone] = useState<string | undefined>(undefined);
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel>('all');
  const [view, setView] = useState<'moods' | 'browse'>('moods');
  const { favoriteCount, toggleFavorite, isFavorite } = useFavoritePrompts();
  const { logPromptUsage } = useAlignmentDrift();

  const getPromptsForStone = useCallback((stoneId: string) => {
    const stone = infinityStones.find(s => s.id === stoneId);
    if (!stone) return [];
    return characterPrompts.filter(p => stone.categories.includes(p.category));
  }, []);

  const filterByIntensity = useCallback((prompts: CharacterPrompt[]) => {
    if (selectedIntensity === 'favorites') return prompts.filter(p => isFavorite(p.id));
    if (selectedIntensity === 'all') return prompts;
    return prompts.filter(p => {
      const intensity = getPromptIntensity(p.id);
      return intensity === selectedIntensity || intensity === null;
    });
  }, [selectedIntensity, isFavorite]);

  const allFilteredPrompts = useMemo(() => {
    return filterByIntensity(infinityStones.flatMap(stone => getPromptsForStone(stone.id)));
  }, [selectedIntensity, filterByIntensity, getPromptsForStone]);

  const processAndUse = useCallback((prompt: CharacterPrompt) => {
    const processed = prompt.prompt
      .replace(/\[Character Name\]/g, characterName || 'The Character')
      .replace(/\[Name\]/g, characterName || 'The Character');
    logPromptUsage(prompt.id);
    onUsePrompt(applyTimePrefix(processed));
    onOpenChange(false);
    toast.success(`${prompt.icon} ${prompt.title}`, { description: 'Added to input' });
  }, [characterName, logPromptUsage, onUsePrompt, onOpenChange]);

  const pickRandom = useCallback(() => {
    if (allFilteredPrompts.length === 0) { toast.error('No prompts available'); return; }
    const prompt = allFilteredPrompts[Math.floor(Math.random() * allFilteredPrompts.length)];
    processAndUse(prompt);
  }, [allFilteredPrompts, processAndUse]);

  const surpriseMe = useCallback(() => {
    const intensities: IntensityLevel[] = ['mild', 'moderate', 'extreme'];
    const randomIntensity = intensities[Math.floor(Math.random() * intensities.length)];
    const allPrompts = infinityStones.flatMap(stone => getPromptsForStone(stone.id));
    const filtered = allPrompts.filter(p => getPromptIntensity(p.id) === randomIntensity);
    if (filtered.length === 0) { toast.error('No prompts available'); return; }
    const prompt = filtered[Math.floor(Math.random() * filtered.length)];
    setSelectedIntensity(randomIntensity);
    processAndUse(prompt);
  }, [getPromptsForStone, processAndUse]);

  return (
    <>
      {/* Global style override for overlay z-index when inside DM screens (z-60) */}
      {open && <style>{`[data-vaul-overlay] { z-index: 9998 !important; } [vaul-drawer] { z-index: 9999 !important; }`}</style>}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f] border-amber-900/30 !z-[9999]">
          {/* Header */}
          <DrawerHeader className="px-4 pt-2 pb-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-amber-200 font-cinzel">
                <Gem className="w-5 h-5 text-amber-400" />
                RP Prompts
              </DrawerTitle>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </DrawerHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
            {view === 'moods' ? (
              <MoodGateway
                allPrompts={characterPrompts}
                onUsePrompt={processAndUse}
                onBrowseAll={() => setView('browse')}
                accentColor="#22c55e"
              />
            ) : (
            <>
            {/* Back to moods */}
            <button
              onClick={() => setView('moods')}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors pt-2 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to moods
            </button>

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
                  {level.id === 'favorites' && favoriteCount > 0 && (
                    <span className="ml-0.5 text-[10px] bg-yellow-500/30 text-yellow-400 px-1.5 rounded-full">
                      {favoriteCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Random / Surprise Me */}
            <div className="flex gap-2">
              <button
                onClick={pickRandom}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all"
              >
                <Shuffle className="w-4 h-4" />
                Random
              </button>
              <button
                onClick={surpriseMe}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500 via-red-500 to-purple-600 hover:from-amber-400 hover:via-red-400 hover:to-purple-500 text-white animate-pulse hover:animate-none transition-all"
              >
                <Sparkles className="w-4 h-4" />
                🎰
              </button>
            </div>

            {/* Stone Accordions */}
            <Accordion type="single" collapsible value={expandedStone} onValueChange={setExpandedStone} className="w-full space-y-2">
              {infinityStones.map((stone) => {
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
                      {isMasterworkStone(stone.id) ? (
                        groupBySubcategory(prompts).map((group) => (
                          <div key={group.subcategory}>
                            <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                              <div className="flex-1 h-px" style={{ backgroundColor: `${stone.color}20` }} />
                              <span className="text-[10px] font-cinzel text-white/30 tracking-widest uppercase whitespace-nowrap">
                                {group.subcategory}
                              </span>
                              <div className="flex-1 h-px" style={{ backgroundColor: `${stone.color}20` }} />
                            </div>
                            {group.prompts.map((prompt) => {
                              const intensity = getPromptIntensity(prompt.id);
                              const intensityConfig = intensity ? intensityLevels.find(l => l.id === intensity) : null;
                              const isStarred = isFavorite(prompt.id);

                              return (
                                <div key={prompt.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group">
                                  <button onClick={() => { toggleFavorite(prompt.id); toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites'); }} className="shrink-0 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-yellow-500/20 transition-colors">
                                    <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-white/30 hover:text-yellow-400')} />
                                  </button>
                                  <div className="flex-1 min-w-0 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base shrink-0">{prompt.icon}</span>
                                      <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
                                      <AlignmentBadge promptId={prompt.id} />
                                      {DEADPOOL_PROMPT_IDS.has(prompt.id) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-red-500/20 text-red-400">🃏</span>
                                      )}
                                      {intensityConfig && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: `${intensityConfig.color}20`, color: intensityConfig.color }}>{intensityConfig.icon}</span>
                                      )}
                                    </div>
                                    {prompt.description && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{prompt.description}</p>}
                                    {PROMPT_HINTS.has(prompt.id) && (
                                      <p className="text-[11px] text-amber-400/50 italic mt-0.5">💡 Try when: {PROMPT_HINTS.get(prompt.id)}</p>
                                    )}
                                  </div>
                                  <button onClick={() => processAndUse(prompt)} className="shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium transition-colors">
                                    <Play className="w-3.5 h-3.5" />
                                    Use
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                      prompts.map((prompt) => {
                        const intensity = getPromptIntensity(prompt.id);
                        const intensityConfig = intensity ? intensityLevels.find(l => l.id === intensity) : null;
                        const isStarred = isFavorite(prompt.id);

                        return (
                          <div
                            key={prompt.id}
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                          >
                            {/* Star */}
                            <button
                              onClick={() => {
                                toggleFavorite(prompt.id);
                                toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites');
                              }}
                              className="shrink-0 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-yellow-500/20 transition-colors"
                            >
                              <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-white/30 hover:text-yellow-400')} />
                            </button>

                            {/* Content */}
                            <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-base shrink-0">{prompt.icon}</span>
                              <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
                              <AlignmentBadge promptId={prompt.id} />
                              {DEADPOOL_PROMPT_IDS.has(prompt.id) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-red-500/20 text-red-400">🃏</span>
                              )}
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
                              {PROMPT_HINTS.has(prompt.id) && (
                                <p className="text-[11px] text-amber-400/50 italic mt-0.5">💡 Try when: {PROMPT_HINTS.get(prompt.id)}</p>
                              )}
                            </div>

                            {/* Use button */}
                            <button
                              onClick={() => processAndUse(prompt)}
                              className="shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Use
                            </button>
                          </div>
                        );
                      })
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
