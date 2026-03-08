import { useState, useCallback, useMemo } from 'react';
import { Check, X, RefreshCw, Pencil, Eye, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { WhisperEditor } from './WhisperEditor';
import { parseWhispers, serializeWhispers } from '@/lib/whisper-parser';
import { cn } from '@/lib/utils';
import type { Whisper } from '@/lib/whisper-parser';
import ReactMarkdown from 'react-markdown';

interface DraftReviewPanelProps {
  draftContent: string;
  onApprove: (editedContent: string) => Promise<void>;
  onDiscard: () => void;
  onRegenerate: () => void;
  partyMemberNames: string[];
  isRegenerating?: boolean;
}

export function DraftReviewPanel({
  draftContent,
  onApprove,
  onDiscard,
  onRegenerate,
  partyMemberNames,
  isRegenerating,
}: DraftReviewPanelProps) {
  const parsed = useMemo(() => parseWhispers(draftContent), [draftContent]);

  const [isEditing, setIsEditing] = useState(false);
  const [narrative, setNarrative] = useState(parsed.narrative);
  const [whispers, setWhispers] = useState<Whisper[]>(parsed.whispers);
  const [isApproving, setIsApproving] = useState(false);

  // Reset state when draft content changes (e.g. after regeneration)
  const [lastDraft, setLastDraft] = useState(draftContent);
  if (draftContent !== lastDraft) {
    setLastDraft(draftContent);
    const reParsed = parseWhispers(draftContent);
    setNarrative(reParsed.narrative);
    setWhispers(reParsed.whispers);
    setIsEditing(false);
  }

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      const content = serializeWhispers(narrative.trim(), whispers);
      await onApprove(content);
    } finally {
      setIsApproving(false);
    }
  }, [narrative, whispers, onApprove]);

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="text-xs font-cinzel text-blue-300/80 uppercase tracking-wider">AI Draft — Review</span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
            isEditing
              ? "bg-blue-900/30 text-blue-300 border border-blue-500/30"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {isEditing ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </div>

      {/* Draft content */}
      <div className="rounded-lg border border-blue-900/30 bg-card/50 overflow-hidden max-h-[40vh] overflow-y-auto">
        {isEditing ? (
          <div className="p-3 space-y-3">
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="bg-white/5 border-blue-900/30 text-sm text-foreground resize-none focus-visible:ring-blue-500/30"
              rows={6}
            />
            <WhisperEditor
              whispers={whispers}
              onChange={setWhispers}
              partyMemberNames={partyMemberNames}
            />
          </div>
        ) : (
          <div className="p-3 prose prose-invert prose-sm max-w-none text-foreground/90">
            <ReactMarkdown>{narrative}</ReactMarkdown>
            {whispers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                {whispers.map((w, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className={cn(
                      "font-semibold",
                      w.type === 'action' && "text-amber-400",
                      w.type === 'tactics' && "text-blue-400",
                      w.type === 'whisper' && "text-purple-400",
                    )}>
                      [{w.type === 'whisper' ? `Whisper → ${w.target}` : w.type.charAt(0).toUpperCase() + w.type.slice(1)}]
                    </span>{' '}
                    {w.content.slice(0, 80)}{w.content.length > 80 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleApprove}
          disabled={isApproving || !narrative.trim()}
          className="flex-1 gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
          size="sm"
        >
          {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Approve
        </Button>
        <Button
          onClick={onRegenerate}
          disabled={isRegenerating || isApproving}
          variant="outline"
          size="sm"
          className="gap-1.5 text-amber-300 border-amber-500/30"
        >
          {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Regen
        </Button>
        <Button
          onClick={onDiscard}
          disabled={isApproving}
          variant="outline"
          size="sm"
          className="gap-1.5 text-red-300 border-red-500/30 hover:bg-red-900/20"
        >
          <X className="w-4 h-4" />
          Discard
        </Button>
      </div>
    </div>
  );
}
