import { useState, useMemo, useCallback } from 'react';
import { Copy, Check, Star, Shuffle, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EdgeDrawer } from '@/components/drawers/EdgeDrawer';
import { empyreanPrompts, type EmpyreanPromptCategory } from '@/lib/empyreanPrompts';
import { applyTimePrefix } from '@/lib/fourthWallTime';

const FAVORITES_KEY = 'empyrean-favorite-prompts';

interface EmpyreanPromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
}

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {}
}

interface StoneMapping {
  category: EmpyreanPromptCategory;
  stone: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

const STONE_MAP: StoneMapping[] = [
  { category: 'Dragon Bond', stone: 'Soul Stone', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', icon: '🟠' },
  { category: 'Signet Abilities', stone: 'Mind Stone', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: '🟡' },
  { category: 'Basgiath War College', stone: 'Power Stone', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', icon: '🟣' },
  { category: 'Venin and Dark Forces', stone: 'Reality Stone', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', icon: '🔴' },
  { category: 'Relationships and Politics', stone: 'Space Stone', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: '🔵' },
  { category: 'Combat and Survival', stone: 'Masterwork Stone', color: 'text-gray-300', bgColor: 'bg-white/5', borderColor: 'border-white/20', icon: '⚪' },
  { category: 'Meta and Narrative', stone: 'Time Stone', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', icon: '🟢' },
];

type FilterMode = 'all' | 'favorites';

export function EmpyreanPromptLibrary({ open, onOpenChange, characterName }: EmpyreanPromptLibraryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');

  const filteredPrompts = useMemo(() => {
    if (activeFilter === 'favorites') return empyreanPrompts.filter(p => favorites.has(p.id));
    return empyreanPrompts;
  }, [activeFilter, favorites]);

  const promptsByCategory = useMemo(() => {
    const map = new Map<EmpyreanPromptCategory, typeof empyreanPrompts>();
    for (const p of filteredPrompts) {
      const list = map.get(p.category as EmpyreanPromptCategory) || [];
      list.push(p);
      map.set(p.category as EmpyreanPromptCategory, list);
    }
    return map;
  }, [filteredPrompts]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const copyPrompt = useCallback(async (prompt: string, id: string) => {
    const processed = applyTimePrefix(
      prompt.replace(/\[Character Name\]/g, characterName || '[Character Name]'),
    );
    try {
      await navigator.clipboard.writeText(processed);
      setCopiedId(id);
      toast.success('Prompt copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [characterName]);

  const randomPrompt = useCallback(() => {
    const pool = filteredPrompts.length > 0 ? filteredPrompts : empyreanPrompts;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    copyPrompt(pick.prompt, pick.id);
    toast.success(`🎲 "${pick.title}" copied!`);
  }, [filteredPrompts, copyPrompt]);

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Empyrean Prompts"
      icon={<Gem className="w-5 h-5" />}
      accentColor="#f59e0b"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-3 pr-2">
          {/* Filter toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                activeFilter === 'all'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-border/50 text-muted-foreground hover:text-foreground',
              )}
            >
              All ({empyreanPrompts.length})
            </button>
            <button
              onClick={() => setActiveFilter('favorites')}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all min-h-[44px]',
                activeFilter === 'favorites'
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  : 'border-border/50 text-muted-foreground hover:text-foreground',
              )}
            >
              ★ Favorites ({favorites.size})
            </button>
          </div>

          {/* Random button */}
          <Button
            onClick={randomPrompt}
            size="sm"
            className="w-full gap-2 h-11 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
          >
            <Shuffle className="w-4 h-4" />
            Random Prompt
          </Button>

          {/* Stone accordion */}
          <Accordion type="multiple" className="space-y-2">
            {STONE_MAP.map(stone => {
              const prompts = promptsByCategory.get(stone.category) || [];
              if (prompts.length === 0 && activeFilter === 'favorites') return null;

              return (
                <AccordionItem
                  key={stone.category}
                  value={stone.category}
                  className={cn('rounded-lg border', stone.borderColor, stone.bgColor)}
                >
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">{stone.icon}</span>
                      <span className={cn('text-sm font-cinzel font-bold', stone.color)}>
                        {stone.stone}
                      </span>
                      <Badge variant="outline" className={cn('text-[10px] h-5 ml-auto mr-2', stone.borderColor)}>
                        {prompts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-2 pb-2 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground px-1 pb-1">{stone.category}</p>
                      {prompts.map(p => {
                        const isCopied = copiedId === p.id;
                        const isFav = favorites.has(p.id);

                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/30 p-2.5"
                          >
                            <span className="text-base shrink-0">{p.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium leading-tight truncate">{p.title}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>
                            </div>
                            <button
                              onClick={() => toggleFavorite(p.id)}
                              className="p-2 rounded hover:bg-muted/50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                            >
                              <Star
                                className={cn(
                                  'w-4 h-4 transition-colors',
                                  isFav ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground',
                                )}
                              />
                            </button>
                            <button
                              onClick={() => copyPrompt(p.prompt, p.id)}
                              className={cn(
                                'p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0',
                                isCopied
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
                              )}
                            >
                              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {activeFilter === 'favorites' ? 'No favorites yet — tap ★ to add some' : 'No prompts found'}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2 pb-8">
            {empyreanPrompts.length} prompts across 7 stones
          </p>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
