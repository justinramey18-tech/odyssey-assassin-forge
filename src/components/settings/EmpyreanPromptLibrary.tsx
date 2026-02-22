import { useState, useMemo, useCallback, useRef } from 'react';
import { Copy, Check, Star, Shuffle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { EdgeDrawer } from '@/components/drawers/EdgeDrawer';
import { empyreanPrompts, empyreanPromptCategories, type EmpyreanPromptCategory } from '@/lib/empyreanPrompts';
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

type FilterMode = 'all' | 'favorites' | EmpyreanPromptCategory;

export function EmpyreanPromptLibrary({ open, onOpenChange, characterName }: EmpyreanPromptLibraryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [activeFilter, setActiveFilter] = useState<FilterMode>('all');

  const filters: { id: FilterMode; label: string }[] = useMemo(() => [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: `★ ${favorites.size}` },
    ...empyreanPromptCategories.map(c => ({ id: c as FilterMode, label: c })),
  ], [favorites.size]);

  const filteredPrompts = useMemo(() => {
    if (activeFilter === 'all') return empyreanPrompts;
    if (activeFilter === 'favorites') return empyreanPrompts.filter(p => favorites.has(p.id));
    return empyreanPrompts.filter(p => p.category === activeFilter);
  }, [activeFilter, favorites]);

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

  // Swipe state for filter tabs
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <EdgeDrawer
      side="right"
      open={open}
      onOpenChange={onOpenChange}
      title="Empyrean Prompts"
      icon={<span className="text-lg">🐉</span>}
      accentColor="#f59e0b"
    >
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="space-y-3 pr-2">
          {/* Filter tabs — horizontally scrollable */}
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  'shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all',
                  activeFilter === f.id
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 scale-105'
                    : 'border-border/50 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Random button */}
          <Button
            onClick={randomPrompt}
            size="sm"
            className="w-full gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
          >
            <Shuffle className="w-4 h-4" />
            Random Prompt
          </Button>

          {/* Count */}
          <p className="text-[10px] text-muted-foreground">
            {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''}
            {activeFilter !== 'all' && activeFilter !== 'favorites' && (
              <> in <span className="text-foreground/70">{activeFilter}</span></>
            )}
          </p>

          {/* Prompt cards */}
          <div className="space-y-2">
            {filteredPrompts.map(p => {
              const isCopied = copiedId === p.id;
              const isFav = favorites.has(p.id);

              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleFavorite(p.id)}
                        className="p-1 rounded hover:bg-muted/50 transition-colors"
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
                          'p-1.5 rounded-lg transition-colors',
                          isCopied
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
                        )}
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Category badge */}
                  <Badge variant="outline" className="text-[10px] h-5 bg-muted/30">
                    {p.category}
                  </Badge>
                </div>
              );
            })}
          </div>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {activeFilter === 'favorites' ? 'No favorites yet — tap ★ to add some' : 'No prompts found'}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2 pb-8">
            50 prompts across {empyreanPromptCategories.length} categories
          </p>
        </div>
      </ScrollArea>
    </EdgeDrawer>
  );
}
