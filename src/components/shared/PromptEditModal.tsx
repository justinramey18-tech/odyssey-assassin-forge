import { useState, useEffect } from 'react';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Copy, Check, RotateCcw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface PromptEditModalProps {
  promptKey: string;
  generatedPrompt: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptEditModal({
  promptKey,
  generatedPrompt,
  title,
  subtitle,
  open,
  onOpenChange,
}: PromptEditModalProps) {
  const [editedPrompt, setEditedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const { getSavedPrompt, savePrompt, hasSavedPrompt, deleteSavedPrompt } = useSavedPrompts();

  const isCustomized = hasSavedPrompt(promptKey);

  useEffect(() => {
    if (open) {
      const saved = getSavedPrompt(promptKey);
      setEditedPrompt(saved ? saved.customPrompt : generatedPrompt);
      setCopied(false);
    }
  }, [open, promptKey, generatedPrompt, getSavedPrompt]);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(editedPrompt);
      setCopied(true);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSave = (): void => {
    savePrompt(promptKey, generatedPrompt, editedPrompt);
    toast.success('Prompt saved!');
  };

  const handleSaveAndCopy = async (): Promise<void> => {
    savePrompt(promptKey, generatedPrompt, editedPrompt);
    await handleCopy();
  };

  const handleReset = (): void => {
    setEditedPrompt(generatedPrompt);
    deleteSavedPrompt(promptKey);
    toast.success('Prompt reset to default');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-2 border-primary/50 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            {title}
            {isCustomized && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/50">
                Customized
              </Badge>
            )}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground font-body">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-2">
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
              'min-h-[200px] max-h-[50vh] font-body text-sm',
              'bg-background/50 border-border/50',
              'focus:border-primary/50 focus:ring-primary/20',
              'resize-y'
            )}
            placeholder="Edit your prompt here..."
          />

          <p className="text-xs text-muted-foreground font-body">
            Customize this prompt and save it for reuse, or copy directly to your AI DM.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleSave} className="gap-1">
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            onClick={handleSaveAndCopy}
            size="sm"
            className={cn('gap-1', copied && 'bg-green-600 hover:bg-green-600')}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Saved & Copied!' : 'Save & Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
