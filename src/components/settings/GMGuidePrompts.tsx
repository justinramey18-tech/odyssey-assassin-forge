import { useState, useMemo } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Layers, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GM_GUIDE_PROMPTS, GMGuidePrompt, getCombinedGMGuide, PROMPT_CATEGORIES, getPromptsByCategory } from '@/lib/gmGuidePrompts';
import { useIsMobile } from '@/hooks/use-mobile';

interface GMGuidePromptsProps {
  className?: string;
}

type CategoryFilter = GMGuidePrompt['category'] | 'all';

export function GMGuidePrompts({ className }: GMGuidePromptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const isMobile = useIsMobile();

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

  const handleCopyAll = async () => {
    try {
      const fullGuide = getCombinedGMGuide();
      await navigator.clipboard.writeText(fullGuide);
      setCopiedAll(true);
      toast.success('📚 All 20 prompts copied!');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={cn("flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden", className)}>
      {/* Header - Compact on mobile */}
      <div className="flex flex-col gap-2 pb-3 border-b border-border/30 shrink-0 w-full max-w-full">
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="font-cinzel font-semibold text-sm truncate">Modular GM Prompts</h4>
            <p className="text-xs text-muted-foreground">
              {filteredPrompts.length} prompts • Tap to copy
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className={cn(
              "gap-1.5 h-8 text-xs shrink-0",
              copiedAll && "border-green-500/50 bg-green-500/10 text-green-400"
            )}
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                All 20
              </>
            )}
          </Button>
        </div>

        {/* Category Filter - Horizontal scroll */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1.5 pb-2 px-0.5">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveCategory('all')}
              className={cn(
                "h-7 text-xs px-2.5 shrink-0",
                activeCategory === 'all' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              <Filter className="w-3 h-3 mr-1" />
              All
            </Button>
            {PROMPT_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "h-7 text-xs px-2.5 shrink-0",
                  activeCategory === cat.id 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted"
                )}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Prompt List - Mobile optimized cards */}
      <ScrollArea className="flex-1 w-full max-w-full">
        <div className="space-y-2 py-3 w-full max-w-full">
          {filteredPrompts.map((prompt) => (
            <Collapsible
              key={prompt.id}
              open={expandedId === prompt.id}
              onOpenChange={() => toggleExpand(prompt.id)}
            >
              <div className={cn(
                "border rounded-lg transition-all duration-200 w-full max-w-full",
                expandedId === prompt.id 
                  ? "border-primary/50 bg-primary/5" 
                  : "border-border/50 bg-card/30 active:bg-card/60"
              )}>
                {/* Card Header - Touch friendly */}
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 touch-manipulation",
                        copiedId === prompt.id && "text-green-400"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPrompt(prompt);
                      }}
                    >
                      {copiedId === prompt.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 touch-manipulation">
                        {expandedId === prompt.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Expandable Content */}
                <CollapsibleContent>
                  <div className="px-2.5 pb-2.5 pt-0 w-full max-w-full min-w-0">
                    <pre className={cn(
                      "p-2.5 rounded-lg border border-border/30 bg-muted/30 w-full",
                      "text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed",
                      "max-h-[40vh] overflow-y-auto overflow-x-hidden"
                    )}>
                      {prompt.content}
                    </pre>
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full mt-2 gap-2 h-10 touch-manipulation"
                      onClick={() => handleCopyPrompt(prompt)}
                    >
                      {copiedId === prompt.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy This Prompt
                        </>
                      )}
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      {/* Quick-Copy Footer - Grid for mobile */}
      <div className="pt-3 border-t border-border/30 shrink-0 w-full max-w-full">
        <div className="grid grid-cols-10 gap-0.5 mb-2 w-full">
          {GM_GUIDE_PROMPTS.slice(0, 10).map((prompt) => (
            <button
              key={prompt.id}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center",
                "text-xs hover:bg-primary/10 active:bg-primary/20",
                "transition-colors touch-manipulation"
              )}
              onClick={() => handleCopyPrompt(prompt)}
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
        <div className="grid grid-cols-10 gap-0.5 w-full">
          {GM_GUIDE_PROMPTS.slice(10, 20).map((prompt) => (
            <button
              key={prompt.id}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center",
                "text-xs hover:bg-primary/10 active:bg-primary/20",
                "transition-colors touch-manipulation"
              )}
              onClick={() => handleCopyPrompt(prompt)}
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
          💡 Tap icons to quick-copy
        </p>
      </div>
    </div>
  );
}
