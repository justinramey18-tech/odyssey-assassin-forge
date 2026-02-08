import { useState, useCallback } from 'react';
import { Loader2, RefreshCw, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NARRATIVE_STYLES, formatStyleName } from '@/lib/scribe/processingTemplates';

interface StylePreviewSheetProps {
  sampleText: string;
  characterName: string;
  trigger?: React.ReactNode;
}

interface StylePreview {
  style: string;
  output: string;
  isLoading: boolean;
  error?: string;
}

const MAX_SAMPLE_LENGTH = 800;
const MAX_STYLES_TO_COMPARE = 4;

export function StylePreviewSheet({
  sampleText,
  characterName,
  trigger,
}: StylePreviewSheetProps) {
  const [open, setOpen] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['fantasy', 'salvatore']);
  const [previews, setPreviews] = useState<Map<string, StylePreview>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Truncate sample text for preview
  const truncatedSample = sampleText.length > MAX_SAMPLE_LENGTH 
    ? sampleText.slice(0, MAX_SAMPLE_LENGTH) + '...' 
    : sampleText;

  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles(prev => {
      if (prev.includes(style)) {
        return prev.filter(s => s !== style);
      }
      if (prev.length >= MAX_STYLES_TO_COMPARE) {
        toast({
          title: `Maximum ${MAX_STYLES_TO_COMPARE} styles`,
          description: 'Deselect a style before adding another.',
        });
        return prev;
      }
      return [...prev, style];
    });
  }, [toast]);

  const generatePreviews = useCallback(async () => {
    if (selectedStyles.length === 0 || !truncatedSample.trim()) {
      toast({
        title: 'Select styles to compare',
        description: 'Choose at least one style to preview.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    // Initialize loading states
    const newPreviews = new Map<string, StylePreview>();
    selectedStyles.forEach(style => {
      newPreviews.set(style, { style, output: '', isLoading: true });
    });
    setPreviews(newPreviews);

    // Generate previews in parallel (but staggered to avoid rate limits)
    const results = await Promise.allSettled(
      selectedStyles.map(async (style, index) => {
        // Stagger requests slightly
        await new Promise(resolve => setTimeout(resolve, index * 500));
        
        try {
          const { data, error } = await supabase.functions.invoke('narrative-forge', {
            body: {
              text: truncatedSample,
              characterName,
              style,
              smartParseEnabled: true,
            },
          });

          if (error) throw error;
          
          return { style, output: data.narrative || '', error: undefined };
        } catch (err) {
          return { 
            style, 
            output: '', 
            error: err instanceof Error ? err.message : 'Generation failed' 
          };
        }
      })
    );

    // Update previews with results
    const finalPreviews = new Map<string, StylePreview>();
    results.forEach((result, index) => {
      const style = selectedStyles[index];
      if (result.status === 'fulfilled') {
        finalPreviews.set(style, {
          style,
          output: result.value.output,
          isLoading: false,
          error: result.value.error,
        });
      } else {
        finalPreviews.set(style, {
          style,
          output: '',
          isLoading: false,
          error: 'Generation failed',
        });
      }
    });

    setPreviews(finalPreviews);
    setIsGenerating(false);

    const successCount = Array.from(finalPreviews.values()).filter(p => !p.error && p.output).length;
    if (successCount > 0) {
      toast({
        title: 'Previews generated',
        description: `${successCount} style${successCount > 1 ? 's' : ''} ready for comparison.`,
      });
    }
  }, [selectedStyles, truncatedSample, characterName, toast]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Clear previews when closing
      setPreviews(new Map());
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            disabled={!sampleText.trim()}
          >
            <Eye className="w-4 h-4" />
            Compare Styles
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Style Comparison Preview
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Sample text preview */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Sample text ({truncatedSample.length} chars):</p>
            <p className="text-sm line-clamp-3 italic text-foreground/80">
              "{truncatedSample.slice(0, 150)}..."
            </p>
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Select styles to compare (max {MAX_STYLES_TO_COMPARE}):
            </Label>
            <div className="flex flex-wrap gap-2">
              {NARRATIVE_STYLES.map(style => (
                <button
                  key={style.value}
                  onClick={() => toggleStyle(style.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all ${
                    selectedStyles.includes(style.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {selectedStyles.includes(style.value) && (
                    <Check className="w-3 h-3" />
                  )}
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={generatePreviews}
            disabled={isGenerating || selectedStyles.length === 0}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating {selectedStyles.length} preview{selectedStyles.length > 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Previews
              </>
            )}
          </Button>

          {/* Preview results */}
          {previews.size > 0 && (
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="grid gap-4 pr-4">
                {Array.from(previews.values()).map(preview => (
                  <div 
                    key={preview.style}
                    className="p-4 rounded-lg border border-border/50 bg-card/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-primary">
                        {formatStyleName(preview.style)}
                      </h4>
                      {preview.isLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    
                    {preview.error ? (
                      <p className="text-sm text-destructive">{preview.error}</p>
                    ) : preview.isLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-1/2" />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap font-serif leading-relaxed">
                        {preview.output.slice(0, 600)}
                        {preview.output.length > 600 && '...'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
