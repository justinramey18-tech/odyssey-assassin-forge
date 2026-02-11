import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { PartyChatMessage } from './PartyChat';

interface FullscreenPartyChatProps {
  open: boolean;
  onClose: () => void;
  messages: PartyChatMessage[];
  currentUserId?: string;
  onSend: (message: string) => Promise<void>;
}

// Assign consistent colors to senders
const SENDER_COLORS = [
  'text-emerald-400',
  'text-sky-400',
  'text-amber-400',
  'text-rose-400',
  'text-violet-400',
  'text-cyan-400',
];

function getSenderColor(userId: string, allUserIds: string[]): string {
  const idx = allUserIds.indexOf(userId);
  return SENDER_COLORS[idx >= 0 ? idx % SENDER_COLORS.length : 0];
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FullscreenPartyChat({ open, onClose, messages, currentUserId, onSend }: FullscreenPartyChatProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }, [text, sending, onSend]);

  // Collect unique user IDs for color assignment
  const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];

  // Group consecutive messages from the same sender
  const groupedMessages: { sender: PartyChatMessage; msgs: PartyChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.sender.user_id === msg.user_id) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ sender: msg, msgs: [msg] });
    }
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-background"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h2 className="font-cinzel text-base font-semibold tracking-wide uppercase">Party Chat</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MessageSquare className="w-10 h-10 opacity-40" />
                <p className="text-sm">No messages yet. Say something!</p>
              </div>
            ) : (
              groupedMessages.map((group) => {
                const isSelf = group.sender.user_id === currentUserId;
                const senderColor = getSenderColor(group.sender.user_id, uniqueUserIds);
                return (
                  <div key={group.sender.id} className="space-y-0.5">
                    {/* Sender header */}
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-sm font-semibold", isSelf ? "text-emerald-400" : senderColor)}>
                        {group.sender.sender_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(group.sender.created_at)}
                      </span>
                    </div>
                    {/* Messages */}
                    {group.msgs.map((msg) => (
                      <p key={msg.id} className="text-sm text-foreground/90 pl-0 leading-relaxed break-words">
                        {msg.message}
                      </p>
                    ))}
                  </div>
                );
              })
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/40 px-4 py-3 bg-background/95 backdrop-blur-sm safe-area-bottom">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Type a message..."
                className="h-11 text-sm"
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="h-11 w-11 p-0 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
