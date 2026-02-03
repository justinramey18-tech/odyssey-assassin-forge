import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GM_GUIDE_PROMPTS, GMGuidePrompt, getCombinedGMGuide } from '@/lib/gmGuidePrompts';

interface GMGuidePromptsProps {
  className?: string;
}

export function GMGuidePrompts({ className }: GMGuidePromptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      toast.success('📚 All 10 prompts copied!');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-cinzel font-semibold text-sm">Modular GM Prompts</h4>
          <p className="text-xs text-muted-foreground">
            Choose which features to share with your AI DM
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAll}
          className={cn(
            "gap-1.5 h-8 text-xs",
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
              Copy All 10
            </>
          )}
        </Button>
      </div>

      {/* Prompt Cards */}
      <ScrollArea className="h-[45vh]">
        <div className="space-y-2 pr-2">
          {GM_GUIDE_PROMPTS.map((prompt) => (
            <Collapsible
              key={prompt.id}
              open={expandedId === prompt.id}
              onOpenChange={() => toggleExpand(prompt.id)}
            >
              <div className={cn(
                "border rounded-lg transition-all duration-200",
                expandedId === prompt.id 
                  ? "border-primary/50 bg-primary/5" 
                  : "border-border/50 bg-card/30 hover:bg-card/50"
              )}>
                {/* Card Header */}
                <div className="flex items-center gap-2 p-3">
                  <span className="text-lg">{prompt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-sm truncate">{prompt.title}</h5>
                    <p className="text-xs text-muted-foreground truncate">{prompt.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
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
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                  <div className="px-3 pb-3 pt-0">
                    <pre className="p-3 rounded-lg border border-border/30 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-[30vh] overflow-y-auto leading-relaxed">
                      {prompt.content}
                    </pre>
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full mt-2 gap-2"
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

      {/* Info Footer */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {GM_GUIDE_PROMPTS.map((prompt) => (
          <Badge 
            key={prompt.id}
            variant="outline" 
            className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => handleCopyPrompt(prompt)}
          >
            {prompt.icon}
          </Badge>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        💡 Tap any icon to quick-copy that prompt
      </p>
    </div>
  );
}
