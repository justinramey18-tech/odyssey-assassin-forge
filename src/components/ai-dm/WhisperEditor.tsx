import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Crosshair, Shield, MessageSquareText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { Whisper } from '@/lib/whisper-parser';

interface WhisperEditorProps {
  whispers: Whisper[];
  onChange: (whispers: Whisper[]) => void;
  /** Character names available for per-player whispers */
  partyMemberNames?: string[];
}

const WHISPER_TYPE_META: Record<Whisper['type'], { label: string; icon: React.ReactNode; color: string }> = {
  action: {
    label: 'Action',
    icon: <Crosshair className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
  },
  tactics: {
    label: 'Tactics',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'text-blue-400',
  },
  whisper: {
    label: 'Whisper',
    icon: <MessageSquareText className="w-3.5 h-3.5" />,
    color: 'text-purple-400',
  },
};

export function WhisperEditor({ whispers, onChange, partyMemberNames = [] }: WhisperEditorProps) {
  const [isAdding, setIsAdding] = useState(false);

  const addWhisper = useCallback((type: Whisper['type']) => {
    const newWhisper: Whisper = {
      type,
      content: '',
      ...(type === 'whisper' && partyMemberNames.length > 0 ? { target: partyMemberNames[0] } : {}),
      ...(type === 'whisper' && partyMemberNames.length === 0 ? { target: '' } : {}),
    };
    onChange([...whispers, newWhisper]);
    setIsAdding(false);
  }, [whispers, onChange, partyMemberNames]);

  const updateWhisper = useCallback((index: number, patch: Partial<Whisper>) => {
    const updated = whispers.map((w, i) => i === index ? { ...w, ...patch } : w);
    onChange(updated);
  }, [whispers, onChange]);

  const removeWhisper = useCallback((index: number) => {
    onChange(whispers.filter((_, i) => i !== index));
  }, [whispers, onChange]);

  return (
    <div className="space-y-2">
      {/* Existing whisper cards */}
      {whispers.map((w, i) => {
        const meta = WHISPER_TYPE_META[w.type];
        return (
          <div
            key={i}
            className="rounded-lg border border-border bg-card/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border-b border-border">
              <span className={cn("shrink-0", meta.color)}>{meta.icon}</span>
              <span className="text-xs font-semibold text-foreground">{meta.label}</span>

              {/* Target selector for whisper type */}
              {w.type === 'whisper' && (
                partyMemberNames.length > 0 ? (
                  <select
                    value={w.target || ''}
                    onChange={(e) => updateWhisper(i, { target: e.target.value })}
                    className="ml-auto text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground min-h-[28px]"
                  >
                    {partyMemberNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={w.target || ''}
                    onChange={(e) => updateWhisper(i, { target: e.target.value })}
                    placeholder="Character name"
                    className="ml-auto text-xs bg-background border border-border rounded px-1.5 py-0.5 text-foreground w-28 min-h-[28px]"
                  />
                )
              )}

              <button
                onClick={() => removeWhisper(i)}
                className="ml-auto shrink-0 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Remove whisper"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <Textarea
              value={w.content}
              onChange={(e) => updateWhisper(i, { content: e.target.value })}
              placeholder={
                w.type === 'action' ? 'e.g. Roll a DC 15 Perception check'
                  : w.type === 'tactics' ? 'e.g. Enemy positions, environmental hazards...'
                    : `Private message for ${w.target || 'this character'}...`
              }
              className="border-0 rounded-none bg-transparent text-sm min-h-[60px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={2}
            />
          </div>
        );
      })}

      {/* Add whisper buttons */}
      {isAdding ? (
        <div className="flex gap-1.5">
          {(['action', 'tactics', 'whisper'] as const).map(type => {
            const meta = WHISPER_TYPE_META[type];
            return (
              <button
                key={type}
                onClick={() => addWhisper(type)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors min-h-[40px]",
                  "border border-border bg-muted/10 hover:bg-muted/20 text-foreground"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <span className={meta.color}>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
          <button
            onClick={() => setIsAdding(false)}
            className="shrink-0 p-2 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 text-muted-foreground min-h-[40px]"
            style={{ touchAction: 'manipulation' }}
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[40px]",
            "border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Whisper
        </button>
      )}
    </div>
  );
}
