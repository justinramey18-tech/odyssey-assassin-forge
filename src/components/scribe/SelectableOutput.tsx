import { useState, useCallback, useRef, useEffect } from 'react';
import { Wand2, Loader2, X, Sparkles, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface PartialRegenerateRequest {
  precedingText: string;
  selectedText: string;
  followingText: string;
  instruction?: string;
  style?: string;
}

interface SelectableOutputProps {
  text: string;
  onTextChange: (newText: string) => void;
  onPartialRegenerate: (request: PartialRegenerateRequest) => Promise<string | null>;
  isProcessing: boolean;
  currentStyle: string;
  availableStyles: { value: string; label: string }[];
}

const CONTEXT_CHARS = 500; // Characters of context to include before/after selection

export function SelectableOutput({
  text,
  onTextChange,
  onPartialRegenerate,
  isProcessing,
  currentStyle,
  availableStyles,
}: SelectableOutputProps) {
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [overrideStyle, setOverrideStyle] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    if (!textRef.current) return;
    
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.isCollapsed) {
      // Click without selection, clear
      setSelection(null);
      return;
    }

    const selectedText = selectionObj.toString().trim();
    if (!selectedText || selectedText.length < 5) {
      // Too short to be meaningful
      setSelection(null);
      return;
    }

    // Find the selection position in the full text
    const range = selectionObj.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(textRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + selectedText.length;

    setSelection({ start, end, text: selectedText });
  }, []);

  // Clear selection when text changes externally
  useEffect(() => {
    setSelection(null);
  }, [text]);

  const handleRegenerateClick = useCallback(() => {
    if (!selection) return;
    setCustomInstruction('');
    setOverrideStyle('');
    setShowRegenerateDialog(true);
  }, [selection]);

  const handleConfirmRegenerate = useCallback(async () => {
    if (!selection) return;

    setIsRegenerating(true);
    setShowRegenerateDialog(false);

    // Extract context before and after selection
    const precedingText = text.slice(Math.max(0, selection.start - CONTEXT_CHARS), selection.start);
    const followingText = text.slice(selection.end, selection.end + CONTEXT_CHARS);

    const request: PartialRegenerateRequest = {
      precedingText,
      selectedText: selection.text,
      followingText,
      instruction: customInstruction.trim() || undefined,
      style: overrideStyle || currentStyle,
    };

    try {
      const newText = await onPartialRegenerate(request);
      
      if (newText) {
        // Replace the selected portion with the new text
        const newFullText = text.slice(0, selection.start) + newText + text.slice(selection.end);
        onTextChange(newFullText);
        setSelection(null);
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [selection, text, customInstruction, overrideStyle, currentStyle, onPartialRegenerate, onTextChange]);

  const handleCancelSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const selectedWordCount = selection ? selection.text.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="relative">
      {/* Selection Info Bar */}
      {selection && !isRegenerating && (
        <div className="sticky top-0 z-10 mb-2 p-2 bg-purple-950/90 border border-purple-500/50 rounded-lg flex items-center justify-between backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300">
              {selectedWordCount} word{selectedWordCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground truncate max-w-[200px]">
              "{selection.text.slice(0, 40)}{selection.text.length > 40 ? '...' : ''}"
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleRegenerateClick}
              disabled={isProcessing}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Regenerate Selection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Regenerating Indicator */}
      {isRegenerating && (
        <div className="sticky top-0 z-10 mb-2 p-3 bg-purple-950/90 border border-purple-500/50 rounded-lg flex items-center gap-3 backdrop-blur-sm">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          <span className="text-sm text-purple-300">Regenerating selected section...</span>
        </div>
      )}

      {/* Text Display with Selection Support */}
      <div
        ref={textRef}
        onMouseUp={handleMouseUp}
        className={cn(
          "prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-serif leading-relaxed select-text cursor-text",
          "selection:bg-purple-500/40 selection:text-white",
          isRegenerating && "opacity-50 pointer-events-none"
        )}
      >
        {text}
      </div>

      {/* Word count footer */}
      <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>{wordCount.toLocaleString()} words total</span>
        <span className="text-purple-400/70 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Select text to regenerate
        </span>
      </div>

      {/* Regenerate Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-400" />
              Regenerate Selection
            </DialogTitle>
            <DialogDescription>
              The AI will rewrite just the selected portion while maintaining context with surrounding text.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Selected Text Preview */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Selected Text ({selectedWordCount} words)
              </Label>
              <div className="p-3 rounded-lg border bg-muted/30 text-sm font-serif max-h-[100px] overflow-y-auto">
                {selection?.text}
              </div>
            </div>

            {/* Custom Instruction */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Settings2 className="w-3 h-3" />
                Custom Instruction (Optional)
              </Label>
              <Textarea
                placeholder="e.g., Make it more dramatic, Add more description, Focus on the character's emotions..."
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Style Override */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Style Override (Optional)
              </Label>
              <Select value={overrideStyle} onValueChange={setOverrideStyle}>
                <SelectTrigger>
                  <SelectValue placeholder={`Keep current (${currentStyle})`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keep current ({currentStyle})</SelectItem>
                  {availableStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRegenerate}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Wand2 className="w-4 h-4" />
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
