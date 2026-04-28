import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, Loader2, MessageCircle, X, Lock, Eye, HelpCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePartyDirector, type DirectorCategory, type DirectorMessage } from '@/hooks/use-party-director';

interface PartyDirectorScreenProps {
  open: boolean;
  onClose: () => void;
  partyId: string | null;
  userId: string | null;
  campaignPlan?: string;
  characterContext?: string;
  /** Parent submits this text to the regular round when AI classifies as public_action. */
  onPublicAction?: (actionText: string) => void;
}

export function PartyDirectorScreen({
  open, onClose, partyId, userId, campaignPlan, characterContext, onPublicAction,
}: PartyDirectorScreenProps) {
  const { messages, isSending, error, send, overrideMessage } = usePartyDirector({
    partyId, userId, campaignPlan, characterContext, onPublicAction,
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, isSending]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-gradient-to-b from-[#080510] via-background to-background/95">
      <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-red-300" />
            <span className="text-sm font-cinzel font-semibold text-foreground">Talk to the DM</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Ask questions, share secrets, or describe what your character does in private.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-3">
        {messages.length === 0 && !isSending && (
          <div className="py-8 px-4 text-center space-y-2">
            <MessageCircle className="w-8 h-8 text-red-400/30 mx-auto" />
            <p className="text-sm font-cinzel text-foreground">Private channel to the DM</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              The DM hears everything you say here. Other players don't. Use this for questions, secret moves, or hidden character details.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <DirectorMessageBubble
            key={msg.id}
            msg={msg}
            onOverride={overrideMessage}
          />
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

      <div className="shrink-0 border-t border-border/40 p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, tell, or describe..."
            rows={1}
            maxLength={2000}
            className="min-h-[44px] max-h-32 resize-none text-sm"
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white h-11 w-11 p-0"
            aria-label="Send"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DirectorMessageBubble({ msg, onOverride }: {
  msg: DirectorMessage;
  onOverride: (messageId: string, newMode: 'private' | 'public') => Promise<void>;
}) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';
  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div className={cn(
        'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
        isUser
          ? 'bg-red-600/20 border border-red-500/30 text-red-100'
          : isSystem
            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 italic'
            : 'bg-white/5 border border-white/10 text-foreground'
      )}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
      {isUser && msg.category && (
        <div className="mt-1 flex items-center gap-1.5">
          <CategoryBadge category={msg.category} />
          {(msg.category === 'private_action' || msg.category === 'public_action') && (
            <button
              onClick={() => onOverride(msg.id, msg.category === 'private_action' ? 'public' : 'private')}
              className="text-[10px] text-muted-foreground hover:text-amber-300 transition-colors underline-offset-2 hover:underline"
              style={{ touchAction: 'manipulation' }}
            >
              Make {msg.category === 'private_action' ? 'public' : 'private'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: DirectorCategory }) {
  const config = {
    question: { icon: HelpCircle, color: 'text-blue-300', label: 'Question' },
    private_action: { icon: Lock, color: 'text-purple-300', label: 'Private' },
    public_action: { icon: Eye, color: 'text-emerald-300', label: 'Public' },
    escalated: { icon: AlertTriangle, color: 'text-amber-300', label: 'Pending Approval' },
    rejected: { icon: XCircle, color: 'text-red-400', label: 'Rejected' },
  }[category];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}
