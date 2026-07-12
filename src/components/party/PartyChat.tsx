import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownLinkComponents } from './markdown-link';

export interface PartyChatMessage {
  id: string;
  party_id: string;
  user_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  updated_at?: string | null;
  reply_to_id?: string | null;
  image_url?: string | null;
  is_pinned?: boolean;
}

interface PartyChatProps {
  messages: PartyChatMessage[];
  currentUserId?: string;
  onSend: (message: string) => Promise<void>;
}

export function PartyChat({ messages, currentUserId, onSend }: PartyChatProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-center py-3">
          <MessageSquare className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">No messages yet</p>
        </div>
        <ChatInput text={text} setText={setText} onSend={handleSend} sending={sending} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-1">
        {messages.map((msg) => {
          const isSelf = msg.user_id === currentUserId;
          return (
            <div
              key={msg.id}
              className={cn(
                "px-2 py-1.5 rounded-md text-xs",
                isSelf ? "bg-primary/10 border border-primary/20" : "bg-muted/20 border border-border/20"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium truncate max-w-[100px]">{msg.sender_name}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{getTimeAgo(msg.created_at)}</span>
              </div>
              <div className="text-foreground/80 mt-0.5 text-xs leading-snug break-words [overflow-wrap:anywhere] prose prose-invert max-w-none prose-p:my-1 prose-p:leading-snug prose-headings:my-1 prose-headings:font-semibold prose-h1:text-sm prose-h2:text-sm prose-h3:text-xs prose-h4:text-xs prose-ul:my-1 prose-ul:pl-4 prose-ol:my-1 prose-ol:pl-4 prose-li:my-0 prose-li:marker:text-muted-foreground prose-strong:text-foreground prose-em:text-foreground/90 prose-code:text-[11px] prose-code:break-all prose-pre:my-1 prose-pre:p-2 prose-pre:text-[11px] prose-pre:whitespace-pre-wrap prose-pre:break-words prose-hr:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>{msg.message}</ReactMarkdown>
                {msg.updated_at && (
                  <span className="text-[9px] text-muted-foreground/60 ml-1 italic">(edited)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ChatInput text={text} setText={setText} onSend={handleSend} sending={sending} />
    </div>
  );
}

function ChatInput({ text, setText, onSend, sending }: { text: string; setText: (v: string) => void; onSend: () => void; sending: boolean }) {
  return (
    <div className="flex gap-1.5 items-end">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Message party... (Shift+Enter for new line)"
        className="min-h-[32px] max-h-[200px] text-xs py-1.5 resize-none"
        rows={1}
        disabled={sending}
      />
      <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onSend} disabled={!text.trim() || sending}>
        <Send className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
