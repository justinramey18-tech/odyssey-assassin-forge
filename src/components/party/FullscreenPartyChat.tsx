import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, MessageSquare, Pencil, Trash2, CheckSquare, Square, XCircle } from 'lucide-react';
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
  isPartyCreator?: boolean;
  onSend: (message: string) => Promise<void>;
  onEdit?: (messageId: string, newText: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onBulkDelete?: (messageIds: string[]) => Promise<void>;
  onClearAll?: () => Promise<void>;
}

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

export function FullscreenPartyChat({
  open, onClose, messages, currentUserId, isPartyCreator,
  onSend, onEdit, onDelete, onBulkDelete, onClearAll,
}: FullscreenPartyChatProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMsg, setContextMsg] = useState<PartyChatMessage | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Bulk select mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open && scrollEndRef.current && !editingId && !bulkMode) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open, editingId, bulkMode]);

  // Focus input when opened
  useEffect(() => {
    if (open && !editingId) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, editingId]);

  // Focus edit input
  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  // Close context menu on scroll/tap elsewhere
  useEffect(() => {
    if (!contextMsg) return;
    const dismiss = () => { setContextMsg(null); setContextPos(null); };
    document.addEventListener('pointerdown', dismiss, { once: true });
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [contextMsg]);

  // Reset bulk mode when closing
  useEffect(() => {
    if (!open) {
      setBulkMode(false);
      setSelectedIds(new Set());
      setEditingId(null);
      setContextMsg(null);
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

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editText.trim() || !onEdit) return;
    await onEdit(editingId, editText.trim());
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, onEdit]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !onBulkDelete) return;
    await onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, onBulkDelete]);

  const handleClearAll = useCallback(async () => {
    if (!onClearAll) return;
    await onClearAll();
  }, [onClearAll]);

  // Long-press handlers
  const startLongPress = useCallback((msg: PartyChatMessage, e: React.PointerEvent) => {
    if (bulkMode) return;
    const canAct = msg.user_id === currentUserId || isPartyCreator;
    if (!canAct) return;

    const x = e.clientX;
    const y = e.clientY;
    longPressTimer.current = setTimeout(() => {
      setContextMsg(msg);
      setContextPos({ x, y });
    }, 500);
  }, [bulkMode, currentUserId, isPartyCreator]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  // Determine which messages the user can delete (for bulk mode)
  const canDeleteMsg = (msg: PartyChatMessage) => msg.user_id === currentUserId || isPartyCreator;

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
            <div className="flex items-center gap-1">
              {/* Bulk select toggle (party creator only) */}
              {isPartyCreator && messages.length > 0 && !bulkMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setBulkMode(true); setSelectedIds(new Set()); }}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Select messages"
                >
                  <CheckSquare className="w-4 h-4" />
                </Button>
              )}
              {bulkMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Bulk action bar */}
          {bulkMode && (
            <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/30">
              <span className="text-xs text-destructive font-medium">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                {isPartyCreator && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 text-xs text-destructive hover:bg-destructive/20"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="h-7 text-xs gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}

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
                  <div key={group.sender.id + group.msgs[0].id} className="space-y-0.5">
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
                    {group.msgs.map((msg) => {
                      const isEditing = editingId === msg.id;
                      const isSelected = selectedIds.has(msg.id);

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-1 py-0.5 -mx-1 transition-colors select-none",
                            bulkMode && canDeleteMsg(msg) && "cursor-pointer hover:bg-muted/20",
                            isSelected && "bg-destructive/10",
                          )}
                          onPointerDown={(e) => {
                            if (bulkMode) return;
                            startLongPress(msg, e);
                          }}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                          onClick={() => {
                            if (bulkMode && canDeleteMsg(msg)) {
                              toggleSelect(msg.id);
                            }
                          }}
                        >
                          {/* Bulk checkbox */}
                          {bulkMode && canDeleteMsg(msg) && (
                            <div className="pt-0.5 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-destructive" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5">
                              <Input
                                ref={editInputRef}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value.slice(0, 200))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave();
                                  if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                }}
                                className="h-7 text-xs"
                              />
                              <Button size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleEditSave}>
                                <Send className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 shrink-0"
                                onClick={() => { setEditingId(null); setEditText(''); }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground/90 leading-relaxed break-words flex-1">
                              {msg.message}
                              {msg.updated_at && (
                                <span className="text-[10px] text-muted-foreground/60 ml-1.5 italic">(edited)</span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Context Menu */}
          <AnimatePresence>
            {contextMsg && contextPos && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.12 }}
                className="fixed z-[110] bg-card border border-border/60 rounded-lg shadow-xl py-1 min-w-[140px]"
                style={{
                  left: Math.min(contextPos.x, window.innerWidth - 160),
                  top: Math.min(contextPos.y, window.innerHeight - 120),
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Edit — only own messages */}
                {contextMsg.user_id === currentUserId && onEdit && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                    onClick={() => {
                      setEditingId(contextMsg.id);
                      setEditText(contextMsg.message);
                      setContextMsg(null);
                      setContextPos(null);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 text-primary" />
                    Edit
                  </button>
                )}
                {/* Delete — own messages or party creator */}
                {canDeleteMsg(contextMsg) && onDelete && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={async () => {
                      await onDelete(contextMsg.id);
                      setContextMsg(null);
                      setContextPos(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
                disabled={sending || bulkMode}
              />
              <Button
                onClick={handleSend}
                disabled={!text.trim() || sending || bulkMode}
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
