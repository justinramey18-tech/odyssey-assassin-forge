import { useState, useCallback } from 'react';
import { Check, X, RefreshCw, Pencil, Eye, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SynthesisResult } from '@/lib/narrative-synthesis-prompt';

interface SynthesisReviewPanelProps {
  synthesis: SynthesisResult;
  rawPrompts: Array<{ character_name: string; prompt: string }>;
  onApprove: (editedFusedPrompt: string) => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

export function SynthesisReviewPanel({
  synthesis,
  rawPrompts,
  onApprove,
  onDiscard,
  onRegenerate,
  isRegenerating,
}: SynthesisReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(synthesis.fusedPrompt);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset when synthesis changes (e.g. after regen)
  const [lastSynthesis, setLastSynthesis] = useState(synthesis);
  if (synthesis !== lastSynthesis) {
    setLastSynthesis(synthesis);
    setEditedPrompt(synthesis.fusedPrompt);
    setIsEditing(false);
  }

  const handleApprove = useCallback(() => {
    const content = isEditing ? editedPrompt.trim() : synthesis.fusedPrompt;
    if (content) onApprove(content);
  }, [isEditing, editedPrompt, synthesis.fusedPrompt, onApprove]);

  const handleDiscard = useCallback(() => {
    if (confirmDiscard) {
      onDiscard();
      return;
    }
    setConfirmDiscard(true);
    const timer = setTimeout(() => setConfirmDiscard(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDiscard, onDiscard]);

  return (
    <div className="space-y-3 max-w-2xl mx-auto relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-cinzel text-amber-300/80 uppercase tracking-wider">
            Synthesized Prompt — Review
          </span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
            isEditing
              ? "bg-amber-900/30 text-amber-300 border border-amber-500/30"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {isEditing ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </div>

      {/* Mode + Spine badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-500/20 text-amber-300/80">
          Mode: {synthesis.mode}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-500/20 text-purple-300/80">
          Focus: {synthesis.focusCharacter}
        </span>
      </div>

      {/* Spine */}
      <p className="text-xs text-muted-foreground italic px-1">
        "{synthesis.spine}"
      </p>

      {/* Raw prompts summary */}
      <div className="rounded-lg border border-border/20 bg-white/5 p-2 space-y-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-cinzel">Player Actions</span>
        {rawPrompts.map((p, i) => (
          <div key={i} className="text-xs text-foreground/70">
            <span className="text-amber-400/80 font-semibold">[{p.character_name}]</span>{' '}
            {p.prompt.slice(0, 100)}{p.prompt.length > 100 ? '…' : ''}
          </div>
        ))}
      </div>

      {/* Fused prompt content */}
      <div className="rounded-lg border border-amber-900/30 bg-card/50 overflow-hidden max-h-[30vh] overflow-y-auto">
        {isEditing ? (
          <div className="p-3">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="bg-white/5 border-amber-900/30 text-sm text-foreground resize-none focus-visible:ring-amber-500/30"
              rows={4}
            />
          </div>
        ) : (
          <div className="p-3 text-sm text-foreground/90 whitespace-pre-wrap">
            {synthesis.fusedPrompt}
          </div>
        )}
      </div>

      {/* Sticky action buttons */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm pt-2 pb-1 border-t border-border/30 -mx-3 px-3">
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            disabled={isEditing && !editedPrompt.trim()}
            className="flex-1 gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
            size="default"
          >
            <Check className="w-4 h-4" />
            Send to DM
          </Button>
          <Button
            onClick={onRegenerate}
            disabled={isRegenerating}
            variant="outline"
            size="default"
            className="gap-1.5 text-amber-300 border-amber-500/30"
          >
            {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regen
          </Button>
          <Button
            onClick={handleDiscard}
            variant="outline"
            size="default"
            className={cn(
              "gap-1.5",
              confirmDiscard
                ? "bg-red-900/60 text-red-200 border-red-500/50 hover:bg-red-900/80"
                : "text-red-300 border-red-500/30 hover:bg-red-900/20"
            )}
          >
            <X className="w-4 h-4" />
            {confirmDiscard ? 'Tap again' : 'Skip'}
          </Button>
        </div>
      </div>
    </div>
  );
}
