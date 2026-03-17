import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
              <p className="text-foreground/80 mt-0.5 break-words">
                {msg.message}
                {msg.updated_at && (
                  <span className="text-[9px] text-muted-foreground/60 ml-1 italic">(edited)</span>
                )}
              </p>
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
    <div className="flex gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 200))}
        onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
        placeholder="Message party..."
        className="h-8 text-xs"
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
