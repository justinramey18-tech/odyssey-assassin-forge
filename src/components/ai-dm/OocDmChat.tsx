import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { Message } from '@/components/oracle/types';

function stripCommandTags(content: string): string {
  return content.replace(/<!--COMMAND:.+?-->/g, '').trim();
}

interface OocDmChatProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onCancelRequest: () => void;
  onClearChat: () => void;
  onDeleteMessage: (messageId: string) => void;
  pendingCommand: string | null;
  onApply: (command: string) => void;
  onDismissCommand: () => void;
  campaignType?: 'dnd' | 'empyrean';
}

export function OocDmChat({
  open,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onCancelRequest,
  onClearChat,
  onDeleteMessage,
  pendingCommand,
  onApply,
  onDismissCommand,
  campaignType = 'dnd',
}: OocDmChatProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpyrean = campaignType === 'empyrean';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleApply = useCallback(() => {
    if (!pendingCommand) return;
    onApply(pendingCommand);
    onDismissCommand();
    onClose();
  }, [pendingCommand, onApply, onDismissCommand, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3 shrink-0',
          isEmpyrean ? 'bg-cyan-950/40 border-b border-cyan-500/20' : 'bg-amber-950/40 border-b border-amber-500/20'
        )}>
          <div className="flex items-center gap-2">
            <Megaphone className={cn('w-5 h-5', isEmpyrean ? 'text-cyan-400' : 'text-amber-400')} />
            <span className={cn('font-cinzel text-base font-semibold', isEmpyrean ? 'text-cyan-300' : 'text-amber-300')}>
              Director's Channel
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClearChat}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ touchAction: 'manipulation' }}
              title="Clear all messages"
            >
              <Trash2 className={cn('w-4 h-4', isEmpyrean ? 'text-cyan-400/50' : 'text-amber-400/50')} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-white/30 text-sm mt-8">
              <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="font-cinzel mb-1">Director's Channel</p>
              <p className="text-xs text-white/20">
                Tell the DM what should happen in the story. Commands get an Apply button to inject them into the narrative.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-start gap-1.5 group',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <button
                  onClick={() => onDeleteMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-40 p-1 rounded hover:bg-white/10 transition-all mt-1 shrink-0"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Trash2 className="w-3 h-3 text-white/30" />
                </button>
              )}
              <div className={cn(
                'rounded-xl px-3 py-2 text-sm max-w-[85%]',
                msg.role === 'user'
                  ? isEmpyrean ? 'bg-cyan-500/20 text-cyan-100' : 'bg-amber-500/20 text-amber-100'
                  : 'bg-white/5 text-white/90'
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-1.5 [&>p]:leading-relaxed">
                    <ReactMarkdown>{stripCommandTags(msg.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <button
                  onClick={() => onDeleteMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-40 p-1 rounded hover:bg-white/10 transition-all mt-1 shrink-0"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Trash2 className="w-3 h-3 text-white/30" />
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <Loader2 className={cn('w-4 h-4 animate-spin', isEmpyrean ? 'text-cyan-400' : 'text-amber-400')} />
              </div>
            </div>
          )}
        </div>

        {/* Pending command Apply bar */}
        {pendingCommand && (
          <div className={cn(
            'shrink-0 mx-3 mb-2 rounded-xl px-3 py-2.5 flex items-center gap-2',
            isEmpyrean ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-amber-500/10 border border-amber-500/20'
          )}>
            <p className="flex-1 text-xs text-white/60 truncate">
              {pendingCommand.length > 80 ? pendingCommand.slice(0, 80) + '…' : pendingCommand}
            </p>
            <button
              onClick={handleApply}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition-colors shrink-0 min-h-[36px]',
                isEmpyrean ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
              )}
              style={{ touchAction: 'manipulation' }}
            >
              Apply to Story
            </button>
            <button
              onClick={onDismissCommand}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className={cn(
          'shrink-0 p-3 border-t',
          isEmpyrean ? 'border-cyan-500/20 bg-cyan-950/20' : 'border-amber-500/20 bg-amber-950/20'
        )}>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              placeholder="Tell the DM what to change..."
              rows={1}
              className={cn(
                'flex-1 bg-white/5 border rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none transition-colors',
                isEmpyrean ? 'border-cyan-500/20 focus:border-cyan-500/50' : 'border-amber-500/20 focus:border-amber-500/50'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {isLoading ? (
              <button
                onClick={onCancelRequest}
                className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-5 h-5 text-red-400" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  'p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
                  inputValue.trim()
                    ? isEmpyrean ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-white/5 text-white/30'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
