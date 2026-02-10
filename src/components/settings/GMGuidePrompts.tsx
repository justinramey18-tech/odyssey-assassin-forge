import { useState, useMemo, useCallback } from 'react';
import { Check, Copy, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useSwipe } from '@/hooks/use-swipe';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GM_GUIDE_PROMPTS, GMGuidePrompt, getCombinedGMGuidePart1, getCombinedGMGuidePart2, GM_GUIDE_PART1, GM_GUIDE_PART2, PROMPT_CATEGORIES, getPromptsByCategory } from '@/lib/gmGuidePrompts';

interface GMGuidePromptsProps {
  className?: string;
}

type CategoryFilter = GMGuidePrompt['category'] | 'all';

export function GMGuidePrompts({ className }: GMGuidePromptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPart, setCopiedPart] = useState<1 | 2 | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<GMGuidePrompt | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // Combined categories array for swipe navigation
  const allCategories = useMemo(() => [
    { id: 'all' as const, label: 'All', icon: '🔍' },
    ...PROMPT_CATEGORIES
  ], []);

  // Current category index
  const currentIndex = useMemo(() => 
    allCategories.findIndex(c => c.id === activeCategory),
    [allCategories, activeCategory]
  );

  // Swipe handlers with wrap-around
  const handleSwipeLeft = useCallback(() => {
    const nextIndex = (currentIndex + 1) % allCategories.length;
    setActiveCategory(allCategories[nextIndex].id);
  }, [currentIndex, allCategories]);

  const handleSwipeRight = useCallback(() => {
    const prevIndex = (currentIndex - 1 + allCategories.length) % allCategories.length;
    setActiveCategory(allCategories[prevIndex].id);
  }, [currentIndex, allCategories]);

  const { handlers: swipeHandlers, swipeOffset, swiping } = useSwipe(handleSwipeLeft, handleSwipeRight);

  const filteredPrompts = useMemo(() => {
    if (activeCategory === 'all') return GM_GUIDE_PROMPTS;
    return getPromptsByCategory(activeCategory);
  }, [activeCategory]);

  const handleCopyPrompt = async (prompt: GMGuidePrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedId(prompt.id);
      toast.success(`${prompt.icon} ${prompt.title} copied!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleCopyPart = async (part: 1 | 2) => {
    try {
      const guide = part === 1 ? getCombinedGMGuidePart1() : getCombinedGMGuidePart2();
      await navigator.clipboard.writeText(guide);
      setCopiedPart(part);
      toast.success(`📚 Part ${part} (prompts ${part === 1 ? '1-10' : '11-20'}) copied!`);
      setTimeout(() => setCopiedPart(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handlePromptClick = (prompt: GMGuidePrompt) => {
    setSelectedPrompt(prompt);
  };

  return (
    <div className={cn("flex flex-col w-full max-w-full min-w-0", className)}>
      {/* Header - Compact on mobile */}
      <div className="flex flex-col gap-2 pb-3 border-b border-border/30 shrink-0 w-full max-w-full">
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="font-cinzel font-semibold text-sm truncate">Modular GM Prompts</h4>
            <p className="text-xs text-muted-foreground">
              {filteredPrompts.length} prompts • Tap to view
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {([1, 2] as const).map((part) => (
              <Button
                key={part}
                variant="outline"
                size="sm"
                onClick={() => handleCopyPart(part)}
                className={cn(
                  "gap-1 h-8 text-xs",
                  copiedPart === part && "border-green-500/50 bg-green-500/10 text-green-400"
                )}
              >
                {copiedPart === part ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Pt {part}
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Category Filter - Single active category with navigation */}
        <div 
          className="flex items-center justify-center gap-2 w-full"
          {...swipeHandlers}
        >
          {/* Left chevron */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwipeRight}
            className="h-8 w-8 shrink-0 touch-manipulation"
            aria-label="Previous category"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {/* Active category display */}
          <div 
            className="flex-1 flex items-center justify-center"
            style={{
              transform: swiping ? `translateX(${swipeOffset}px)` : 'translateX(0)',
              transition: swiping ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-base">
                {activeCategory === 'all' ? '🔍' : allCategories[currentIndex]?.icon}
              </span>
              <span className="font-semibold text-sm text-foreground">
                {allCategories[currentIndex]?.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1}/{allCategories.length}
              </span>
            </div>
          </div>

          {/* Right chevron */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwipeLeft}
            className="h-8 w-8 shrink-0 touch-manipulation"
            aria-label="Next category"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Prompt List - Clickable cards with max height */}
      <div className="max-h-[40vh] overflow-y-auto w-full max-w-full overscroll-contain">
        <div className="space-y-2 py-3 w-full max-w-full">
          {filteredPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => handlePromptClick(prompt)}
              className={cn(
                "w-full text-left border rounded-lg transition-all duration-200",
                "border-border/50 bg-card/30 hover:bg-card/60 active:bg-card/80",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              <div className="flex items-center gap-2 p-2.5 min-h-[52px] w-full min-w-0">
                <span className="text-lg shrink-0">{prompt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h5 className="font-semibold text-sm truncate">{prompt.title}</h5>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 opacity-60">
                      {PROMPT_CATEGORIES.find(c => c.id === prompt.category)?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{prompt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick-Copy Footer - Grid for mobile */}
      <div className="pt-3 border-t border-border/30 shrink-0 w-full max-w-full">
        <p className="text-[10px] text-muted-foreground mb-1">Part 1 (1-10)</p>
        <div className="grid grid-cols-10 gap-0.5 mb-2 w-full">
          {GM_GUIDE_PART1.map((prompt) => (
            <button
              key={prompt.id}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center",
                "text-xs hover:bg-primary/10 active:bg-primary/20",
                "transition-colors touch-manipulation"
              )}
              onClick={() => handlePromptClick(prompt)}
              title={prompt.title}
            >
              {copiedId === prompt.id ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                prompt.icon
              )}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mb-1">Part 2 (11-20)</p>
        <div className="grid grid-cols-10 gap-0.5 w-full">
          {GM_GUIDE_PART2.map((prompt) => (
            <button
              key={prompt.id}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center",
                "text-xs hover:bg-primary/10 active:bg-primary/20",
                "transition-colors touch-manipulation"
              )}
              onClick={() => handlePromptClick(prompt)}
              title={prompt.title}
            >
              {copiedId === prompt.id ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                prompt.icon
              )}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          💡 Tap icons to view prompt
        </p>
      </div>

      {/* Prompt Detail Sheet */}
      <Sheet open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          {selectedPrompt && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedPrompt.icon}</span>
                  <div>
                    <SheetTitle className="text-left">{selectedPrompt.title}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
                  </div>
                </div>
              </SheetHeader>
              
              <ScrollArea className="flex-1 h-[calc(70vh-180px)]">
                <pre className={cn(
                  "p-3 rounded-lg border border-border/30 bg-muted/30 w-full",
                  "text-xs font-mono whitespace-pre-wrap break-words leading-relaxed"
                )}>
                  {selectedPrompt.content}
                </pre>
              </ScrollArea>

              <div className="pt-4 mt-auto">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full gap-2 h-12 touch-manipulation"
                  onClick={() => {
                    handleCopyPrompt(selectedPrompt);
                    setSelectedPrompt(null);
                  }}
                >
                  {copiedId === selectedPrompt.id ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
