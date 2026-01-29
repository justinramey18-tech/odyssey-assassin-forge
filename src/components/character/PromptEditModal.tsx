import { useState, useEffect } from 'react';
import { CharacterPrompt } from '@/lib/characterPrompts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Copy, Check, RotateCcw, Sparkles } from 'lucide-react';

interface PromptEditModalProps {
  prompt: CharacterPrompt;
  characterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptEditModal({
  prompt,
  characterName,
  open,
  onOpenChange,
}: PromptEditModalProps) {
  const [editedPrompt, setEditedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Replace [Character Name] with actual character name
  const getPersonalizedPrompt = () => {
    return prompt.prompt.replace(/\[Character Name\]/g, characterName || 'The Assassin');
  };

  // Initialize with personalized prompt when modal opens
  useEffect(() => {
    if (open) {
      setEditedPrompt(getPersonalizedPrompt());
      setCopied(false);
    }
  }, [open, prompt, characterName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleReset = () => {
    setEditedPrompt(getPersonalizedPrompt());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-2 border-primary/50 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            <span className="text-2xl">{prompt.icon}</span>
            {prompt.title}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Category: {prompt.category}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display uppercase tracking-wider text-muted-foreground">
                Edit Prompt
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1 text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className={cn(
                'min-h-[200px] font-body text-sm',
                'bg-background/50 border-border/50',
                'focus:border-primary/50 focus:ring-primary/20',
                'resize-y'
              )}
              placeholder="Edit your prompt here..."
            />
            
            <p className="text-xs text-muted-foreground font-body">
              Tip: Customize this prompt to fit the current scene, then copy and paste to your AI DM.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            className={cn(
              'gap-2',
              copied && 'bg-green-600 hover:bg-green-600'
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
