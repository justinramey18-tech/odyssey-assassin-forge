import { useState, useMemo } from 'react';
import { Eye, EyeOff, Filter, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { extractAssistantContent, SmartParseResult } from '@/lib/scribe/smartParsing';

interface SmartParsePreviewProps {
  text: string;
  onClose?: () => void;
}

export function SmartParsePreview({ text, onClose }: SmartParsePreviewProps) {
  const [showFiltered, setShowFiltered] = useState(true);
  const [expandedView, setExpandedView] = useState<'kept' | 'filtered' | null>(null);
  
  const parseResult = useMemo(() => extractAssistantContent(text), [text]);
  
  if (!parseResult.isChatFormat) {
    return (
      <Card className="border-amber-900/30 bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Standard Text Format</p>
              <p className="text-xs">No chat log markers detected. All content will be processed.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const { stats, keptLines, filteredLines } = parseResult;
  
  return (
    <Card className="border-purple-900/30 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Smart Parse Preview
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Keeping</span>
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.keptLineCount}</p>
            <p className="text-xs text-muted-foreground">
              lines ({(stats.filteredCharCount / 1024).toFixed(1)} KB)
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <X className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Filtering</span>
            </div>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.filteredLineCount}</p>
            <p className="text-xs text-muted-foreground">
              lines ({stats.reductionPercent}% reduction)
            </p>
          </div>
        </div>
        
        {/* Toggle View */}
        <div className="flex items-center gap-2">
          <Button
            variant={showFiltered ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFiltered(true)}
            className={`flex-1 gap-1 text-xs ${showFiltered ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
          >
            <Eye className="w-3 h-3" />
            Show Filtering
          </Button>
          <Button
            variant={!showFiltered ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFiltered(false)}
            className={`flex-1 gap-1 text-xs ${!showFiltered ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
          >
            <EyeOff className="w-3 h-3" />
            Final Result
          </Button>
        </div>
        
        {/* Content Preview */}
        {showFiltered ? (
          <div className="space-y-3">
            {/* Kept Lines */}
            <Collapsible 
              open={expandedView === 'kept'} 
              onOpenChange={(open) => setExpandedView(open ? 'kept' : null)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-2 rounded-lg bg-green-500/5 hover:bg-green-500/10 transition-colors border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Content to Keep (Assistant/DM)</span>
                  </div>
                  {expandedView === 'kept' ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-[200px] mt-2">
                  <div className="space-y-1 text-xs font-mono p-2 bg-background/50 rounded-lg">
                    {keptLines.slice(0, 100).map((line) => (
                      <div key={line.lineNumber} className="flex gap-2">
                        <span className="text-muted-foreground/50 w-8 text-right shrink-0">
                          {line.lineNumber}
                        </span>
                        <span className="text-green-300/80 break-all">
                          {line.content || <span className="text-muted-foreground/30">(empty line)</span>}
                        </span>
                      </div>
                    ))}
                    {keptLines.length > 100 && (
                      <div className="text-muted-foreground text-center py-2">
                        ... and {keptLines.length - 100} more lines
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Filtered Lines */}
            {filteredLines.length > 0 && (
              <Collapsible 
                open={expandedView === 'filtered'} 
                onOpenChange={(open) => setExpandedView(open ? 'filtered' : null)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/20">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">Content to Filter (User/Player)</span>
                    </div>
                    {expandedView === 'filtered' ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-[200px] mt-2">
                    <div className="space-y-1 text-xs font-mono p-2 bg-background/50 rounded-lg">
                      {filteredLines.slice(0, 100).map((line) => (
                        <div key={line.lineNumber} className="flex gap-2">
                          <span className="text-muted-foreground/50 w-8 text-right shrink-0">
                            {line.lineNumber}
                          </span>
                          <span className={`break-all ${line.type === 'label' ? 'text-yellow-400/60' : 'text-red-300/60 line-through'}`}>
                            {line.content || <span className="text-muted-foreground/30">(empty line)</span>}
                          </span>
                        </div>
                      ))}
                      {filteredLines.length > 100 && (
                        <div className="text-muted-foreground text-center py-2">
                          ... and {filteredLines.length - 100} more lines
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : (
          /* Final Result Preview */
          <ScrollArea className="h-[250px]">
            <div className="text-sm font-mono p-3 bg-background/50 rounded-lg whitespace-pre-wrap">
              {parseResult.filteredText || <span className="text-muted-foreground">No content after filtering</span>}
            </div>
          </ScrollArea>
        )}
        
        {/* Info Note */}
        <p className="text-xs text-muted-foreground text-center">
          Smart Parse automatically filters player inputs when AI mode is used
        </p>
      </CardContent>
    </Card>
  );
}
