import { useState, useMemo, useCallback } from 'react';
import { Gem, Star, Shuffle, Sparkles, Play, X, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { characterPrompts, type CharacterPrompt } from '@/lib/characterPrompts';
import { empyreanPrompts, type EmpyreanPromptCategory } from '@/lib/empyreanPrompts';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { useFavoritePrompts } from '@/hooks/use-favorite-prompts';
import { Badge } from '@/components/ui/badge';
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
type PromptLibrary = 'infinity' | 'empyrean';

// Regular Infinity Stones
const infinityStones = [
  { id: 'soul', name: 'Soul Stone', color: '#f97316', categories: ['Emotional', 'Social'] },
  { id: 'reality', name: 'Reality Stone', color: '#ef4444', categories: ['World'] },
  { id: 'power', name: 'Power Stone', color: '#a855f7', categories: ['Combat'] },
  { id: 'time', name: 'Time Stone', color: '#22c55e', categories: ['Meta Requests'] },
  { id: 'mind', name: 'Mind Stone', color: '#eab308', categories: ['Investigation'] },
  { id: 'space', name: 'Space Stone', color: '#3b82f6', categories: ['Voice & Tone', 'Narrative'] },
  { id: 'masterwork', name: 'Masterwork Stone', color: '#f5f5f5', categories: ['Masterwork'] },
];

// Empyrean Stones
const empyreanStones = [
  { id: 'emp-soul', name: 'Soul Stone', color: '#f97316', category: 'Dragon Bond' as EmpyreanPromptCategory, icon: '🟠' },
  { id: 'emp-mind', name: 'Mind Stone', color: '#eab308', category: 'Signet Abilities' as EmpyreanPromptCategory, icon: '🟡' },
  { id: 'emp-power', name: 'Power Stone', color: '#a855f7', category: 'Basgiath War College' as EmpyreanPromptCategory, icon: '🟣' },
  { id: 'emp-reality', name: 'Reality Stone', color: '#ef4444', category: 'Venin and Dark Forces' as EmpyreanPromptCategory, icon: '🔴' },
  { id: 'emp-space', name: 'Space Stone', color: '#3b82f6', category: 'Relationships and Politics' as EmpyreanPromptCategory, icon: '🔵' },
  { id: 'emp-masterwork', name: 'Masterwork Stone', color: '#f5f5f5', category: 'Combat and Survival' as EmpyreanPromptCategory, icon: '⚪' },
  { id: 'emp-time', name: 'Time Stone', color: '#22c55e', category: 'Meta and Narrative' as EmpyreanPromptCategory, icon: '🟢' },
  { id: 'emp-void', name: 'Void Stone', color: '#818cf8', category: 'Forbidden Lore' as EmpyreanPromptCategory, icon: '⚫' },
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

/**
 * Transforms AI DM roleplay instructions into fiction-writing scene directives.
 * Rewrites common DM-style phrasing ("Have X do Y", "When X happens") into
 * prose-writing instructions ("Write a scene where X does Y").
 */
function adaptPromptForFiction(text: string, characterName: string): string {
  let adapted = text;

  // "Have [Name] do X" → "Write a scene where [Name] does X"
  adapted = adapted.replace(
    /^Have\s+/i,
    'Write a scene where '
  );

  // "When tension peaks..." → "Write a scene where tension peaks..."
  adapted = adapted.replace(
    /^When\s+/i,
    'Write a scene where, when '
  );

  // "Describe the..." → "Write a vivid passage describing the..."
  adapted = adapted.replace(
    /^Describe\s+/i,
    'Write a vivid passage describing '
  );

  // "Include..." at sentence start → "The scene should include..."
  adapted = adapted.replace(
    /(?<=\.\s)Include\s+/g,
    'The prose should include '
  );

  // "the DM" / "the GM" references → "the narrator"
  adapted = adapted.replace(/\bthe DM\b/gi, 'the narrator');
  adapted = adapted.replace(/\bthe GM\b/gi, 'the narrator');

  // "this session" → "this chapter"
  adapted = adapted.replace(/\bthis session\b/gi, 'this chapter');
  adapted = adapted.replace(/\bnext session\b/gi, 'the next chapter');

  // "the campaign" → "the story"
  adapted = adapted.replace(/\bthe campaign\b/gi, 'the story');

  // "the party" → "the group" (when not about a literal party/celebration)
  adapted = adapted.replace(/\bthe party\b/gi, 'the group');

  // "player" → "reader"
  adapted = adapted.replace(/\bthe player\b/gi, 'the reader');
  adapted = adapted.replace(/\bplayers\b/gi, 'readers');

  // "NPC" → "character"
  adapted = adapted.replace(/\bNPCs?\b/g, match => match.length === 3 ? 'character' : 'characters');

  // "dice roll" / "roll" mechanics references
  adapted = adapted.replace(/\bdice rolls?\b/gi, 'fate');
  adapted = adapted.replace(/\bgame mechanics\b/gi, 'narrative conventions');

  // "encounter" → "scene"
  adapted = adapted.replace(/\bencounter\b/gi, 'scene');

  // Wrap with fiction framing if the prompt doesn't already start with a writing directive
  if (!/^(Write|Draft|Compose|Create|Craft)\s/i.test(adapted)) {
    adapted = `[Fiction Writing Directive]\n${adapted}\n\nWrite this as polished prose suitable for a novel chapter. Focus on sensory detail, internal monologue, and emotional resonance.`;
  } else {
    adapted += '\n\nFocus on sensory detail, internal monologue, and emotional resonance.';
  }

  return adapted;
}

interface NovelPromptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  onUsePrompt: (prompt: string) => void;
}

export function NovelPromptDrawer({ open, onOpenChange, characterName, onUsePrompt }: NovelPromptDrawerProps) {
  const [expandedStone, setExpandedStone] = useState<string | undefined>(undefined);
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel>('all');
  const [activeLibrary, setActiveLibrary] = useState<PromptLibrary>('infinity');
  const [fictionMode, setFictionMode] = useState(true);
  const { favoriteCount, toggleFavorite, isFavorite } = useFavoritePrompts();
  const [empyreanFavorites, setEmpyreanFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('empyrean-favorite-prompts');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const toggleEmpyreanFavorite = useCallback((id: string) => {
    setEmpyreanFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('empyrean-favorite-prompts', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Infinity stone helpers
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

  // Empyrean helpers
  const filteredEmpyreanPrompts = useMemo(() => {
    if (selectedIntensity === 'favorites') return empyreanPrompts.filter(p => empyreanFavorites.has(p.id));
    return empyreanPrompts;
  }, [selectedIntensity, empyreanFavorites]);

  const processAndUse = useCallback((prompt: CharacterPrompt) => {
    const name = characterName || 'The Character';
    const base = prompt.prompt
      .replace(/\[Character Name\]/g, name)
      .replace(/\[Name\]/g, name);
    const output = fictionMode ? adaptPromptForFiction(base, name) : applyTimePrefix(base);
    onUsePrompt(output);
    onOpenChange(false);
    toast.success(`${prompt.icon} ${prompt.title}`, { description: 'Added to input' });
  }, [characterName, onUsePrompt, onOpenChange, fictionMode]);

  const pickRandom = useCallback(() => {
    if (activeLibrary === 'empyrean') {
      const pool = filteredEmpyreanPrompts.length > 0 ? filteredEmpyreanPrompts : empyreanPrompts;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      processAndUse(pick);
    } else {
      const allFiltered = filterByIntensity(infinityStones.flatMap(s => getPromptsForStone(s.id)));
      if (allFiltered.length === 0) { toast.error('No prompts available'); return; }
      processAndUse(allFiltered[Math.floor(Math.random() * allFiltered.length)]);
    }
  }, [activeLibrary, filteredEmpyreanPrompts, filterByIntensity, getPromptsForStone, processAndUse]);

  const surpriseMe = useCallback(() => {
    const intensities: IntensityLevel[] = ['mild', 'moderate', 'extreme'];
    const randomIntensity = intensities[Math.floor(Math.random() * intensities.length)];
    if (activeLibrary === 'empyrean') {
      const pool = empyreanPrompts;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      processAndUse(pick);
    } else {
      const allPrompts = infinityStones.flatMap(s => getPromptsForStone(s.id));
      const filtered = allPrompts.filter(p => getPromptIntensity(p.id) === randomIntensity);
      if (filtered.length === 0) { toast.error('No prompts at that intensity'); return; }
      setSelectedIntensity(randomIntensity);
      processAndUse(filtered[Math.floor(Math.random() * filtered.length)]);
    }
  }, [activeLibrary, getPromptsForStone, processAndUse]);

  const renderPromptRow = useCallback((prompt: CharacterPrompt, isStarred: boolean, onToggleStar: () => void) => {
    const intensity = getPromptIntensity(prompt.id);
    const intensityConfig = intensity ? intensityLevels.find(l => l.id === intensity) : null;

    return (
      <div key={prompt.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group">
        <button
          onClick={() => { onToggleStar(); toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites'); }}
          className="shrink-0 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-yellow-500/20 transition-colors"
        >
          <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-white/30 hover:text-yellow-400')} />
        </button>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">{prompt.icon}</span>
            <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
            {intensityConfig && (
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: `${intensityConfig.color}20`, color: intensityConfig.color }}>
                {intensityConfig.icon}
              </span>
            )}
          </div>
          {prompt.description && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{prompt.description}</p>}
        </div>
        <button
          onClick={() => processAndUse(prompt)}
          className="shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-rose-900/40 border border-rose-500/30 hover:bg-rose-900/60 text-rose-300 text-xs font-medium transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Use
        </button>
      </div>
    );
  }, [processAndUse]);

  return (
    <>
      {open && <style>{`[data-vaul-overlay] { z-index: 9998 !important; } [vaul-drawer] { z-index: 9999 !important; }`}</style>}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] bg-gradient-to-b from-[#1a050a] via-[#0d0d12] to-[#0a0a0f] border-rose-900/30 !z-[9999]">
          <DrawerHeader className="px-4 pt-2 pb-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-rose-200 font-cinzel">
                <Gem className="w-5 h-5 text-rose-400" />
                Writing Prompts
              </DrawerTitle>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            {/* Fiction / Raw mode toggle */}
            <div className="flex items-center justify-end gap-2 px-4 pt-1 pb-0">
              <button
                onClick={() => setFictionMode(f => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all',
                  fictionMode
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-white/5 border-white/15 text-white/50'
                )}
              >
                <BookOpen className="w-3 h-3" />
                {fictionMode ? 'Fiction Mode' : 'Raw Mode'}
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
            {/* Library toggle */}
            <div className="flex gap-1.5 pt-2">
              <button
                onClick={() => setActiveLibrary('infinity')}
                className={cn(
                  'flex-1 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                  activeLibrary === 'infinity'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'border-white/10 text-white/40 hover:text-white/70',
                )}
              >
                <Gem className="w-3.5 h-3.5 inline mr-1.5" />
                Infinity Stones
              </button>
              <button
                onClick={() => setActiveLibrary('empyrean')}
                className={cn(
                  'flex-1 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                  activeLibrary === 'empyrean'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-white/10 text-white/40 hover:text-white/70',
                )}
              >
                🐉 Empyrean
              </button>
            </div>

            {/* Intensity filters (only for infinity stones) */}
            {activeLibrary === 'infinity' && (
              <div className="flex gap-1.5 flex-wrap">
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
                      <span className="ml-0.5 text-[10px] bg-yellow-500/30 text-yellow-400 px-1.5 rounded-full">{favoriteCount}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Empyrean filter */}
            {activeLibrary === 'empyrean' && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSelectedIntensity('all')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                    selectedIntensity !== 'favorites' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'border-white/10 text-white/40',
                  )}
                >
                  All ({empyreanPrompts.length})
                </button>
                <button
                  onClick={() => setSelectedIntensity('favorites')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                    selectedIntensity === 'favorites' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'border-white/10 text-white/40',
                  )}
                >
                  ★ Favorites ({empyreanFavorites.size})
                </button>
              </div>
            )}

            {/* Random / Surprise Me */}
            <div className="flex gap-2">
              <button
                onClick={pickRandom}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white transition-all"
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

            {/* Infinity Stones Accordion */}
            {activeLibrary === 'infinity' && (
              <Accordion type="single" collapsible value={expandedStone} onValueChange={setExpandedStone} className="w-full space-y-2">
                {infinityStones.map((stone) => {
                  const prompts = filterByIntensity(getPromptsForStone(stone.id));
                  if (prompts.length === 0) return null;

                  return (
                    <AccordionItem key={stone.id} value={stone.id} className="border-0">
                      <AccordionTrigger
                        className={cn('w-full flex items-center gap-3 p-3 rounded-lg hover:no-underline transition-all duration-200', expandedStone === stone.id ? 'rounded-b-none' : 'hover:scale-[1.02]')}
                        style={{ backgroundColor: `${stone.color}15`, border: `1px solid ${stone.color}40`, boxShadow: expandedStone === stone.id ? `0 0 20px ${stone.color}30` : undefined }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: stone.color, boxShadow: `0 0 10px ${stone.color}80` }}>
                          <Gem className="w-4 h-4 text-white" />
                        </span>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm" style={{ color: stone.color }}>{stone.name}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stone.color}30`, color: stone.color }}>{prompts.length}</span>
                      </AccordionTrigger>
                      <AccordionContent className="rounded-b-lg border border-t-0 p-2 space-y-1" style={{ borderColor: `${stone.color}40` }}>
                        {prompts.map(prompt => renderPromptRow(prompt, isFavorite(prompt.id), () => toggleFavorite(prompt.id)))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {/* Empyrean Stones Accordion */}
            {activeLibrary === 'empyrean' && (
              <Accordion type="single" collapsible value={expandedStone} onValueChange={setExpandedStone} className="w-full space-y-2">
                {empyreanStones.map((stone) => {
                  const prompts = filteredEmpyreanPrompts.filter(p => p.category === stone.category);
                  if (prompts.length === 0) return null;

                  return (
                    <AccordionItem key={stone.id} value={stone.id} className="border-0">
                      <AccordionTrigger
                        className={cn('w-full flex items-center gap-3 p-3 rounded-lg hover:no-underline transition-all duration-200', expandedStone === stone.id ? 'rounded-b-none' : 'hover:scale-[1.02]')}
                        style={{ backgroundColor: `${stone.color}15`, border: `1px solid ${stone.color}40`, boxShadow: expandedStone === stone.id ? `0 0 20px ${stone.color}30` : undefined }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: stone.color, boxShadow: `0 0 10px ${stone.color}80` }}>
                          <span className="text-sm">{stone.icon}</span>
                        </span>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm" style={{ color: stone.color }}>{stone.name}</p>
                          <p className="text-[10px] text-white/40">{stone.category}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stone.color}30`, color: stone.color }}>{prompts.length}</span>
                      </AccordionTrigger>
                      <AccordionContent className="rounded-b-lg border border-t-0 p-2 space-y-1" style={{ borderColor: `${stone.color}40` }}>
                        {prompts.map(prompt => renderPromptRow(prompt, empyreanFavorites.has(prompt.id), () => toggleEmpyreanFavorite(prompt.id)))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
