import { useMemo } from 'react';
import { ArrowRight, Minus, Plus, Equal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeNarrativeDiff, getDiffStats, formatWordCount, DiffSegment } from '@/lib/scribe/textDiff';
import { cn } from '@/lib/utils';

interface ComparisonViewProps {
  originalText: string;
  transformedText: string;
  onClose: () => void;
}

export function ComparisonView({ originalText, transformedText, onClose }: ComparisonViewProps) {
  const diff = useMemo(() => 
    computeNarrativeDiff(originalText, transformedText),
    [originalText, transformedText]
  );
  
  const stats = useMemo(() => getDiffStats(diff), [diff]);
  
  const originalWordCount = originalText.split(/\s+/).filter(Boolean).length;
  const transformedWordCount = transformedText.split(/\s+/).filter(Boolean).length;
  
  return (
    <Card className="border-purple-900/30 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Original vs Transformed
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Original:</span>
            <span className="font-medium">{formatWordCount(originalWordCount)} words</span>
          </div>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Transformed:</span>
            <span className="font-medium">{formatWordCount(transformedWordCount)} words</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="w-3 h-3" />
              {stats.addedWords} added
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="w-3 h-3" />
              {stats.removedWords} removed
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Equal className="w-3 h-3" />
              {stats.changePercent}% changed
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Side-by-side view */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Original Panel */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Original Input
            </div>
            <ScrollArea className="h-[300px] rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                {originalText}
              </div>
            </ScrollArea>
          </div>
          
          {/* Transformed Panel */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Transformed Output
            </div>
            <ScrollArea className="h-[300px] rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="text-sm font-serif whitespace-pre-wrap leading-relaxed">
                {transformedText}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        {/* Diff View */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <details className="group">
            <summary className="text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors">
              View Diff Highlighting
            </summary>
            <ScrollArea className="mt-3 h-[200px] rounded-lg border border-border/50 bg-muted/10 p-3">
              <div className="text-sm leading-relaxed">
                {diff.map((segment, idx) => (
                  <DiffSpan key={idx} segment={segment} />
                ))}
              </div>
            </ScrollArea>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

function DiffSpan({ segment }: { segment: DiffSegment }) {
  return (
    <span
      className={cn(
        'inline',
        segment.type === 'added' && 'bg-green-500/20 text-green-300 px-0.5 rounded',
        segment.type === 'removed' && 'bg-red-500/20 text-red-400 line-through px-0.5 rounded',
        segment.type === 'unchanged' && 'text-foreground/80'
      )}
    >
      {segment.text}
    </span>
  );
}
