import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Send, Trash2, Check, X, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDirectorChat, type DirectorProposedAction } from '@/hooks/use-director-chat';

interface DirectorChatProps {
  dragonName?: string;
  characterName?: string;
  dragonNotes?: string;
  /** Called when the user taps Confirm on a proposed action. Prompt 7 wires the real dispatcher. */
  onConfirmAction?: (action: DirectorProposedAction) => void | Promise<void>;
}

export function DirectorChat({ dragonName, characterName, dragonNotes, onConfirmAction }: DirectorChatProps) {
  const { messages, isSending, error, dismissedActionIds, send, dismissAction, clearChat } = useDirectorChat({
    dragonName, characterName, dragonNotes,
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isSending) return;
    const text = input;
    setInput('');
    send(text);
  }, [input, isSending, send]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleConfirm = useCallback(async (action: DirectorProposedAction) => {
    if (onConfirmAction) {
      try {
        await onConfirmAction(action);
        dismissAction(action.id); // Remove the card after successful apply.
      } catch (e: any) {
        toast.error(e?.message || 'Failed to apply action.');
      }
    } else {
      // Stub until Prompt 7 wires the real dispatcher.
      toast.info(`Would ${action.type.replace(/_/g, ' ')} — dispatcher not wired yet (Prompt 7).`, { duration: 3500 });
      dismissAction(action.id);
    }
  }, [onConfirmAction, dismissAction]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with clear button */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="text-xs text-muted-foreground truncate">Director — shapes your campaign</span>
        </div>
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors inline-flex items-center gap-1 px-2 py-1 rounded"
                style={{ touchAction: 'manipulation' }}
                aria-label="Clear chat"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Director chat?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all messages in this Director conversation. Your campaign state (guides, memory, summary, dragon personality) is NOT affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearChat} className="bg-red-600 hover:bg-red-700 text-white">Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
        {messages.length === 0 && !isSending && (
          <div className="py-10 px-4 text-center space-y-2">
            <MessageCircle className="w-8 h-8 text-amber-400/40 mx-auto" />
            <p className="text-sm font-cinzel text-foreground">Talk to the Director</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Say things like: "Make the tone darker." "Remember the innkeeper is Garran." "My dragon is cynical now."
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-amber-600/20 border border-amber-500/30 text-amber-100'
                : 'bg-white/5 border border-white/10 text-foreground'
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.actions
                    .filter(a => !dismissedActionIds.has(a.id))
                    .map(action => (
                      <ProposedActionCard
                        key={action.id}
                        action={action}
                        onConfirm={() => handleConfirm(action)}
                        onDismiss={() => dismissAction(action.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-muted-foreground text-sm inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/30 p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to the Director..."
            rows={1}
            maxLength={2000}
            className="min-h-[44px] max-h-32 resize-none text-sm"
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white h-11 w-11 p-0"
            aria-label="Send"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Proposed Action Card ──────────────────────────────────────────────────

function ProposedActionCard({ action, onConfirm, onDismiss }: {
  action: DirectorProposedAction;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const meta = getActionMeta(action);
  const isDestructive = meta.destructive;

  return (
    <div
      className={cn(
        'rounded-md border p-2.5 space-y-2',
        isDestructive ? 'border-orange-500/35 bg-orange-500/5' : 'border-emerald-500/35 bg-emerald-500/5'
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mt-0.5',
          isDestructive ? 'border-orange-500/50 text-orange-300' : 'border-emerald-500/50 text-emerald-300'
        )}>
          {meta.label}
        </div>
        <p className="text-[11px] text-white/70 leading-snug flex-1">
          {action.rationale || meta.defaultRationale}
        </p>
      </div>
      {meta.preview && (
        <p className="text-[11px] text-white/85 italic line-clamp-3 bg-black/20 rounded px-2 py-1.5">
          {meta.preview}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          size="sm"
          className={cn(
            'flex-1 h-8 text-xs gap-1',
            isDestructive ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          )}
        >
          <Check className="w-3 h-3" />
          Confirm
        </Button>
        <Button onClick={onDismiss} size="sm" variant="outline" className="h-8 text-xs gap-1">
          <X className="w-3 h-3" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function getActionMeta(action: DirectorProposedAction): { label: string; preview: string | null; destructive: boolean; defaultRationale: string } {
  switch (action.type) {
    case 'install_guide':
      return {
        label: 'INSTALL GUIDE',
        preview: action.guide_name ? `"${action.guide_name}" — ${(action.guide_content || '').slice(0, 180)}${(action.guide_content || '').length > 180 ? '…' : ''}` : null,
        destructive: false,
        defaultRationale: 'Install a new guide.',
      };
    case 'disable_guide':
      return { label: 'DISABLE GUIDE', preview: `Guide id: ${action.guide_id}`, destructive: true, defaultRationale: 'Pause a guide.' };
    case 'delete_guide':
      return { label: 'DELETE GUIDE', preview: `Guide id: ${action.guide_id}`, destructive: true, defaultRationale: 'Permanently delete a guide.' };
    case 'update_campaign_summary':
      return {
        label: 'UPDATE SUMMARY',
        preview: action.new_summary ? `${action.new_summary.slice(0, 200)}${action.new_summary.length > 200 ? '…' : ''}` : null,
        destructive: true,
        defaultRationale: 'Replace the campaign summary.',
      };
    case 'add_memory_anchor':
      return {
        label: 'PIN MEMORY',
        preview: action.memory_anchor || null,
        destructive: false,
        defaultRationale: 'Pin a memory anchor.',
      };
    case 'update_dragon_personality':
      return {
        label: 'UPDATE DRAGON',
        preview: action.new_dragon_personality ? `${action.new_dragon_personality.slice(0, 200)}${action.new_dragon_personality.length > 200 ? '…' : ''}` : null,
        destructive: true,
        defaultRationale: 'Rewrite dragon personality notes.',
      };
    case 'ooc_passthrough': {
      const turns = typeof action.turns_remaining === 'number' && action.turns_remaining > 0 ? action.turns_remaining : 2;
      const turnLabel = turns === 1 ? '1 turn' : `${turns} turns`;
      return {
        label: `OOC · ${turnLabel}`,
        preview: action.ooc_note || null,
        destructive: false,
        defaultRationale: 'Silent context for the next DM turn(s).',
      };
    }
    default:
      return { label: 'ACTION', preview: null, destructive: false, defaultRationale: '' };
  }
}
