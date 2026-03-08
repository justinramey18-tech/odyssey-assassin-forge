import { useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { WhisperEditor } from './WhisperEditor';
import { serializeWhispers } from '@/lib/whisper-parser';
import { cn } from '@/lib/utils';
import type { Whisper } from '@/lib/whisper-parser';

interface DMComposePanelProps {
  onSend: (content: string) => Promise<void>;
  partyMemberNames: string[];
  disabled?: boolean;
}

export function DMComposePanel({ onSend, partyMemberNames, disabled }: DMComposePanelProps) {
  const [narrative, setNarrative] = useState('');
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [isSending, setIsSending] = useState(false);

  const canSend = narrative.trim().length > 0 && !isSending && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const content = serializeWhispers(narrative.trim(), whispers);
      await onSend(content);
      setNarrative('');
      setWhispers([]);
    } finally {
      setIsSending(false);
    }
  }, [canSend, narrative, whispers, onSend]);

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Label */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-xs font-cinzel text-amber-300/80 uppercase tracking-wider">Compose as DM</span>
      </div>

      {/* Narrative textarea */}
      <Textarea
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
        placeholder="Write your narrative response..."
        className={cn(
          "bg-white/5 border-amber-900/30 text-sm text-foreground placeholder:text-muted-foreground",
          "focus-visible:ring-amber-500/30 focus-visible:border-amber-500/40 resize-none"
        )}
        rows={4}
      />

      {/* Whisper editor */}
      <WhisperEditor
        whispers={whispers}
        onChange={setWhispers}
        partyMemberNames={partyMemberNames}
      />

      {/* Send button */}
      <Button
        onClick={handleSend}
        disabled={!canSend}
        className="w-full gap-2 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
        size="sm"
      >
        {isSending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Send as DM
      </Button>
    </div>
  );
}
