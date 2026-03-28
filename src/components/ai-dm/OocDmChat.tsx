import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Pin, PinOff, Plus, Trash2, Pencil, Check, Loader2, MessageSquareText, ListChecks, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { Message } from '@/components/oracle/types';
import type { PinnedDirective } from '@/hooks/use-ooc-dm-chat';

interface OocDmChatProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onCancelRequest: () => void;
  onClearChat: () => void;
  pinnedDirectives: PinnedDirective[];
  onAddPinned: (text: string) => void;
  onRemovePinned: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onEditPinned: (id: string, newText: string) => void;
  chatDirectives: string;
  directiveCount: number;
  onClearAllDirectives: () => void;
  campaignType?: 'dnd' | 'empyrean';
}

function stripDirectiveTags(content: string): string {
  return content.replace(/<!--DIRECTIVES_START-->[\s\S]*?<!--DIRECTIVES_END-->/g, '').trim();
}

export function OocDmChat({
  open,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onCancelRequest,
  onClearChat,
  pinnedDirectives,
  onAddPinned,
  onRemovePinned,
  onTogglePinned,
  onEditPinned,
  chatDirectives,
  directiveCount,
  onClearAllDirectives,
  campaignType = 'dnd',
}: OocDmChatProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'directives'>('chat');
  const [inputValue, setInputValue] = useState('');
  const [newDirectiveText, setNewDirectiveText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpyrean = campaignType === 'empyrean';
  const accent = isEmpyrean ? 'cyan' : 'amber';

  // Auto-scroll on new messages
  useEffect(() => {
    if (activeTab === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTab]);

  // Auto-resize textarea
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

  const handleAddPinned = useCallback(() => {
    if (!newDirectiveText.trim()) return;
    onAddPinned(newDirectiveText.trim());
    setNewDirectiveText('');
  }, [newDirectiveText, onAddPinned]);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editingText.trim()) {
      onEditPinned(editingId, editingText.trim());
    }
    setEditingId(null);
    setEditingText('');
  }, [editingId, editingText, onEditPinned]);

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
          <div className="flex items-center gap-2">
            {directiveCount > 0 && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-medium',
                isEmpyrean ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              )}>
                {directiveCount}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-white/10">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2',
              activeTab === 'chat'
                ? isEmpyrean ? 'text-cyan-400 border-cyan-400' : 'text-amber-400 border-amber-400'
                : 'text-white/40 border-transparent hover:text-white/60'
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <MessageSquareText className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('directives')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2',
              activeTab === 'directives'
                ? isEmpyrean ? 'text-cyan-400 border-cyan-400' : 'text-amber-400 border-amber-400'
                : 'text-white/40 border-transparent hover:text-white/60'
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <ListChecks className="w-4 h-4" />
            Directives
            {directiveCount > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px]',
                isEmpyrean ? 'bg-cyan-500/20 text-cyan-300' : 'bg-amber-500/20 text-amber-300'
              )}>
                {directiveCount}
              </span>
            )}
          </button>
        </div>

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-white/30 text-sm mt-8">
                  <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="font-cinzel mb-1">Director's Channel</p>
                  <p className="text-xs text-white/20">
                    Tell the DM what should happen in the story. Your directives will influence the narrative without players knowing.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className={cn(
                    'rounded-xl px-3 py-2 text-sm max-w-[85%]',
                    msg.role === 'user'
                      ? isEmpyrean ? 'bg-cyan-500/20 text-cyan-100' : 'bg-amber-500/20 text-amber-100'
                      : 'bg-white/5 text-white/90'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-1.5 [&>p]:leading-relaxed">
                        <ReactMarkdown>{stripDirectiveTags(msg.content)}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
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
          </>
        )}

        {/* Directives tab */}
        {activeTab === 'directives' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Pinned directives section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin className={cn('w-4 h-4', isEmpyrean ? 'text-cyan-400' : 'text-amber-400')} />
                <h3 className={cn('font-cinzel text-sm font-semibold', isEmpyrean ? 'text-cyan-300' : 'text-amber-300')}>
                  Pinned Directives
                </h3>
              </div>
              <p className="text-xs text-white/30">
                Manual directives that persist until you remove them. These are always active.
              </p>

              {/* Add new pinned */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDirectiveText}
                  onChange={(e) => setNewDirectiveText(e.target.value)}
                  placeholder="Add a directive..."
                  className={cn(
                    'flex-1 bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none transition-colors',
                    isEmpyrean ? 'border-cyan-500/20 focus:border-cyan-500/50' : 'border-amber-500/20 focus:border-amber-500/50'
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPinned();
                    }
                  }}
                />
                <button
                  onClick={handleAddPinned}
                  disabled={!newDirectiveText.trim()}
                  className={cn(
                    'p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
                    newDirectiveText.trim()
                      ? isEmpyrean ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-white/5 text-white/30'
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Pinned list */}
              {pinnedDirectives.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-4">No pinned directives yet</p>
              ) : (
                <div className="space-y-2">
                  {pinnedDirectives.map((d) => (
                    <div
                      key={d.id}
                      className={cn(
                        'flex items-start gap-2 rounded-lg px-3 py-2.5 bg-white/5 border',
                        d.active
                          ? isEmpyrean ? 'border-cyan-500/20' : 'border-amber-500/20'
                          : 'border-white/5 opacity-60'
                      )}
                    >
                      <button
                        onClick={() => onTogglePinned(d.id)}
                        className="shrink-0 p-1 mt-0.5"
                        style={{ touchAction: 'manipulation' }}
                      >
                        {d.active ? (
                          <Pin className={cn('w-4 h-4', isEmpyrean ? 'text-cyan-400' : 'text-amber-400')} />
                        ) : (
                          <PinOff className="w-4 h-4 text-white/30" />
                        )}
                      </button>

                      {editingId === d.id ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white/90 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') { setEditingId(null); setEditingText(''); }
                            }}
                          />
                          <button onClick={handleSaveEdit} className="p-1" style={{ touchAction: 'manipulation' }}>
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                          <button onClick={() => { setEditingId(null); setEditingText(''); }} className="p-1" style={{ touchAction: 'manipulation' }}>
                            <X className="w-4 h-4 text-white/40" />
                          </button>
                        </div>
                      ) : (
                        <span className={cn('flex-1 text-sm text-white/80 leading-relaxed', !d.active && 'line-through')}>
                          {d.text}
                        </span>
                      )}

                      {editingId !== d.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingId(d.id); setEditingText(d.text); }}
                            className="p-1"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Pencil className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
                          </button>
                          <button
                            onClick={() => onRemovePinned(d.id)}
                            className="p-1"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400/50 hover:text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat-extracted directives section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className={cn('w-4 h-4', isEmpyrean ? 'text-cyan-400' : 'text-amber-400')} />
                <h3 className={cn('font-cinzel text-sm font-semibold', isEmpyrean ? 'text-cyan-300' : 'text-amber-300')}>
                  Chat-Extracted Directives
                </h3>
              </div>
              <p className="text-xs text-white/30">
                Directives the AI extracted from your chat conversation. Updated automatically.
              </p>
              {chatDirectives.trim() ? (
                <div className="bg-white/5 rounded-xl p-3 text-xs text-white/70 whitespace-pre-wrap leading-relaxed">
                  {chatDirectives}
                </div>
              ) : (
                <p className="text-xs text-white/20 text-center py-4">
                  No directives extracted yet. Chat with the DM to create some.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {directiveCount > 0 && (
          <div className="shrink-0 flex justify-center py-3 border-t border-white/5">
            <button
              onClick={onClearAllDirectives}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Directives
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
