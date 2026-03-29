import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, X, MessageSquare, Pencil, Trash2, CheckSquare, Square, XCircle, Pin, PinOff, ImagePlus, Reply, ChevronDown, ChevronUp, SmilePlus, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { PartyChatMessage } from './PartyChat';
import type { MessageReaction } from '@/hooks/use-party-sync';

interface FullscreenPartyChatProps {
  open: boolean;
  onClose: () => void;
  messages: PartyChatMessage[];
  currentUserId?: string;
  isPartyCreator?: boolean;
  onSend: (message: string, options?: { replyToId?: string; imageUrl?: string }) => Promise<void>;
  onEdit?: (messageId: string, newText: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onBulkDelete?: (messageIds: string[]) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onPin?: (messageId: string) => Promise<void>;
  onUnpin?: (messageId: string) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string | null>;
  typingUsers?: { userId: string; name: string }[];
  onTyping?: () => void;
  reactions?: MessageReaction[];
  onAddReaction?: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => Promise<void>;
  /** Map of userId -> online status for showing presence dots next to sender names */
  onlineStatusMap?: Record<string, { isOnline: boolean }>;
}

const DND_EMOJIS = ['⚔️', '🛡️', '❤️', '🎲', '💀', '🔥', '✨', '🧙'];

const SENDER_COLORS = [
  'text-emerald-400', 'text-sky-400', 'text-amber-400',
  'text-rose-400', 'text-violet-400', 'text-cyan-400',
];

function getSenderColor(userId: string, allUserIds: string[]): string {
  const idx = allUserIds.indexOf(userId);
  return SENDER_COLORS[idx >= 0 ? idx % SENDER_COLORS.length : 0];
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FullscreenPartyChat({
  open, onClose, messages, currentUserId, isPartyCreator,
  onSend, onEdit, onDelete, onBulkDelete, onClearAll,
  onPin, onUnpin, onUploadImage, typingUsers, onTyping,
  reactions, onAddReaction, onRemoveReaction, onlineStatusMap,
}: FullscreenPartyChatProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [contextMsg, setContextMsg] = useState<PartyChatMessage | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reply
  const [replyTo, setReplyTo] = useState<PartyChatMessage | null>(null);

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  // Emoji picker
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Build reactions map: messageId -> { emoji -> { count, userReacted, names[] } }
  const reactionsMap = useMemo(() => {
    const map: Record<string, Record<string, { count: number; userReacted: boolean; names: string[] }>> = {};
    if (!reactions) return map;
    for (const r of reactions) {
      if (!map[r.message_id]) map[r.message_id] = {};
      if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { count: 0, userReacted: false, names: [] };
      map[r.message_id][r.emoji].count++;
      map[r.message_id][r.emoji].names.push(r.sender_name);
      if (r.user_id === currentUserId) map[r.message_id][r.emoji].userReacted = true;
    }
    return map;
  }, [reactions, currentUserId]);

  // Pinned messages section
  const [pinnedExpanded, setPinnedExpanded] = useState(true);

  const pinnedMessages = messages.filter(m => m.is_pinned);

  // Auto-scroll
  useEffect(() => {
    if (open && scrollEndRef.current && !editingId && !bulkMode) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open, editingId, bulkMode]);

   // Don't auto-focus input on open (prevents keyboard from popping up on mobile)

  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editingId]);

  // Close context menu
  useEffect(() => {
    if (!contextMsg) return;
    const dismiss = () => { setContextMsg(null); setContextPos(null); };
    document.addEventListener('pointerdown', dismiss, { once: true });
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [contextMsg]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setBulkMode(false);
      setSelectedIds(new Set());
      setEditingId(null);
      setContextMsg(null);
      setReplyTo(null);
      setPendingImageUrl(null);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImageUrl) || sending) return;
    setSending(true);
    try {
      const opts: { replyToId?: string; imageUrl?: string } = {};
      if (replyTo) opts.replyToId = replyTo.id;
      if (pendingImageUrl) opts.imageUrl = pendingImageUrl;
      await onSend(trimmed || '📷', opts);
      setText('');
      setReplyTo(null);
      setPendingImageUrl(null);
    } finally {
      setSending(false);
    }
  }, [text, sending, onSend, replyTo, pendingImageUrl]);

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

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    if (file.size > 5 * 1024 * 1024) {
      return; // silently reject files over 5MB
    }
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      if (url) setPendingImageUrl(url);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onUploadImage]);

  // Long-press handlers
  const startLongPress = useCallback((msg: PartyChatMessage, e: React.PointerEvent) => {
    if (bulkMode) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer.current = setTimeout(() => {
      setContextMsg(msg);
      setContextPos({ x, y });
    }, 500);
  }, [bulkMode]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCopyMessage = useCallback(async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg.message);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [messages]);

  const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];

  // Group consecutive messages from same sender
  const groupedMessages: { sender: PartyChatMessage; msgs: PartyChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.sender.user_id === msg.user_id) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ sender: msg, msgs: [msg] });
    }
  });

  const canDeleteMsg = (msg: PartyChatMessage) => msg.user_id === currentUserId || isPartyCreator;

  // Find a message by ID for reply preview
  const findMsg = (id: string) => messages.find(m => m.id === id);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-background"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <h2 className="font-cinzel text-base font-semibold tracking-wide uppercase">Party Chat</h2>
            </div>
            <div className="flex items-center gap-1">
              {isPartyCreator && messages.length > 0 && !bulkMode && (
                <Button variant="ghost" size="icon" onClick={() => { setBulkMode(true); setSelectedIds(new Set()); }}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Select messages">
                  <CheckSquare className="w-4 h-4" />
                </Button>
              )}
              {bulkMode && (
                <Button variant="ghost" size="icon" onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground">
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
              <span className="text-xs text-destructive font-medium">{selectedIds.size} selected</span>
              <div className="flex gap-2">
                {isPartyCreator && onClearAll && (
                  <Button variant="ghost" size="sm" onClick={onClearAll}
                    className="h-7 text-xs text-destructive hover:bg-destructive/20">Clear All</Button>
                )}
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0} className="h-7 text-xs gap-1">
                  <Trash2 className="w-3 h-3" /> Delete ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}

          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && !bulkMode && (
            <div className="border-b border-amber-500/30 bg-amber-500/5">
              <button
                onClick={() => setPinnedExpanded(p => !p)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-amber-400"
              >
                <div className="flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5" />
                  <span>{pinnedMessages.length} Pinned</span>
                </div>
                {pinnedExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {pinnedExpanded && (
                <div className="px-4 pb-2 space-y-1">
                  {pinnedMessages.map(pm => (
                    <div key={pm.id} className="flex items-start gap-2 bg-amber-500/10 rounded-md px-2 py-1.5 text-xs">
                      <Pin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-amber-300">{pm.sender_name}: </span>
                        <span className="text-foreground/80 break-words">{pm.message}</span>
                        {pm.image_url && <span className="text-amber-400/60 ml-1">[image]</span>}
                      </div>
                      {isPartyCreator && onUnpin && (
                        <button onClick={() => onUnpin(pm.id)} className="shrink-0 p-0.5 hover:text-amber-300 text-muted-foreground">
                          <PinOff className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                const isDragonMessage = group.sender.message?.startsWith('[🐉 ');
                return (
                  <div key={group.sender.id + group.msgs[0].id} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {/* Online dot */}
                      {onlineStatusMap?.[group.sender.user_id] && (
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            onlineStatusMap[group.sender.user_id].isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"
                          )}
                        />
                      )}
                      <span className={cn("text-sm font-semibold", isDragonMessage ? "text-purple-400" : isSelf ? "text-emerald-400" : senderColor)}>
                        {isDragonMessage ? `🐉 ${group.sender.sender_name}` : group.sender.sender_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(group.sender.created_at)}
                      </span>
                    </div>
                    {group.msgs.map((msg) => {
                      const isEditing = editingId === msg.id;
                      const isSelected = selectedIds.has(msg.id);
                      const repliedMsg = msg.reply_to_id ? findMsg(msg.reply_to_id) : null;
                      const isMsgDragon = msg.message?.startsWith('[🐉 ');

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-1 py-0.5 -mx-1 transition-colors select-none",
                            bulkMode && canDeleteMsg(msg) && "cursor-pointer hover:bg-muted/20",
                            isSelected && "bg-destructive/10",
                            msg.is_pinned && "border-l-2 border-amber-500/40",
                            isMsgDragon && "border-l-2 border-purple-500/40 bg-purple-500/5",
                          )}
                          onPointerDown={(e) => { if (!bulkMode) startLongPress(msg, e); }}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                          onClick={() => { if (bulkMode && canDeleteMsg(msg)) toggleSelect(msg.id); }}
                        >
                          {bulkMode && canDeleteMsg(msg) && (
                            <div className="pt-0.5 shrink-0">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-destructive" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5">
                              <Input ref={editInputRef} value={editText}
                                onChange={(e) => setEditText(e.target.value.slice(0, 500))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave();
                                  if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                }}
                                className="h-7 text-xs" />
                              <Button size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleEditSave}>
                                <Send className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0"
                                onClick={() => { setEditingId(null); setEditText(''); }}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              {/* Reply quote */}
                              {repliedMsg && (
                                <div className="flex items-center gap-1.5 mb-0.5 pl-2 border-l-2 border-primary/40 text-[11px] text-muted-foreground">
                                  <Reply className="w-3 h-3 shrink-0 rotate-180" />
                                  <span className="font-medium truncate max-w-[80px]">{repliedMsg.sender_name}</span>
                                  <span className="truncate">{repliedMsg.message}</span>
                                </div>
                              )}
                              <div className="space-y-1">
                                <p className={cn("text-sm break-words", isMsgDragon ? "text-purple-200/80 italic" : "text-foreground/90")}>{msg.message}</p>
                                {msg.image_url && (
                                  <a href={msg.image_url} target="_blank" rel="noopener noreferrer" className="block mb-1">
                                    <img src={msg.image_url} alt="Message image" className="max-w-full max-h-32 rounded" />
                                  </a>
                                )}
                                {msg.updated_at && (
                                  <p className="text-[9px] text-muted-foreground/50 italic">(edited)</p>
                                )}
                              </div>
                              {/* Reactions */}
                              {reactionsMap[msg.id] && Object.keys(reactionsMap[msg.id]).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(reactionsMap[msg.id]).map(([emoji, data]) => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (data.userReacted) {
                                          onRemoveReaction?.(msg.id, emoji);
                                        } else {
                                          onAddReaction?.(msg.id, emoji);
                                        }
                                      }}
                                      className={cn(
                                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                        data.userReacted ? "border-primary/50 bg-primary/10" : "border-border/20 bg-muted/5 hover:bg-muted/20",
                                        "text-muted-foreground"
                                      )}
                                      title={data.names.join(', ')}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-[10px] text-muted-foreground">{data.count}</span>
                                    </button>
                                  ))}
                                  {onAddReaction && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id);
                                      }}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border border-border/20 bg-muted/5 hover:bg-muted/20 transition-colors text-muted-foreground"
                                    >
                                      <SmilePlus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Inline emoji picker */}
                              {emojiPickerMsgId === msg.id && onAddReaction && (
                                <div className="flex flex-wrap gap-1 mt-1 p-1.5 rounded-lg bg-card border border-border/40 shadow-lg">
                                  {DND_EMOJIS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const existing = reactionsMap[msg.id]?.[emoji];
                                        if (existing?.userReacted) {
                                          onRemoveReaction?.(msg.id, emoji);
                                        } else {
                                          onAddReaction(msg.id, emoji);
                                        }
                                        setEmojiPickerMsgId(null);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted/30 text-lg transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
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
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.12 }}
                className="fixed z-[110] bg-card border border-border/60 rounded-lg shadow-xl py-1 min-w-[140px]"
                style={{
                  left: Math.min(contextPos.x, window.innerWidth - 160),
                  top: Math.min(contextPos.y, window.innerHeight - 180),
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* React button */}
                {onAddReaction && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                    onClick={() => { setEmojiPickerMsgId(contextMsg.id); setContextMsg(null); setContextPos(null); }}>
                    <SmilePlus className="w-3.5 h-3.5 text-amber-300" /> React
                  </button>
                )}

                {/* Reply */}
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                  onClick={() => { setReplyTo(contextMsg); setContextMsg(null); setContextPos(null); }}>
                  <Reply className="w-3.5 h-3.5 text-sky-400" /> Reply
                </button>

                {/* Pin/Unpin — party creator only */}
                {isPartyCreator && onPin && onUnpin && (
                  contextMsg.is_pinned ? (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                      onClick={async () => { await onUnpin(contextMsg.id); setContextMsg(null); setContextPos(null); }}>
                      <PinOff className="w-3.5 h-3.5 text-amber-400" /> Unpin
                    </button>
                  ) : (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                      onClick={async () => { await onPin(contextMsg.id); setContextMsg(null); setContextPos(null); }}>
                      <Pin className="w-3.5 h-3.5 text-amber-400" /> Pin
                    </button>
                  )
                )}

                {/* Copy button - available to all players */}
                <button className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors",
                  copiedMsgId === contextMsg.id && "bg-green-500/20 text-green-400"
                )}
                  onClick={() => { handleCopyMessage(contextMsg.id); setContextMsg(null); setContextPos(null); }}>
                  {copiedMsgId === contextMsg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Edit button - owner only */}
                {contextMsg.user_id === currentUserId && onEdit && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                    onClick={() => { setEditingId(contextMsg.id); setEditText(contextMsg.message); setContextMsg(null); setContextPos(null); }}>
                    <Pencil className="w-3.5 h-3.5 text-primary" /> Edit
                  </button>
                )}

                {/* Delete */}
                {canDeleteMsg(contextMsg) && onDelete && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={async () => { await onDelete(contextMsg.id); setContextMsg(null); setContextPos(null); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="border-t border-border/40 bg-background/95 backdrop-blur-sm px-4 py-3 space-y-2">
            {replyTo && (
              <div className="flex items-start gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-xs">
                <Reply className="w-4 h-4 text-primary shrink-0 rotate-180" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">{replyTo.sender_name}</p>
                  <p className="text-foreground/70 truncate">{replyTo.message}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {pendingImageUrl && (
              <div className="flex items-start gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 text-xs">
                <ImagePlus className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">Image attached</p>
                  <img src={pendingImageUrl} alt="Preview" className="max-w-full max-h-20 rounded mt-1" />
                </div>
                <button onClick={() => setPendingImageUrl(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => { setText(e.target.value.slice(0, 500)); onTyping?.(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Say something in party chat..."
                className="text-sm"
                disabled={sending || uploadingImage}
              />
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage} className="text-muted-foreground hover:text-foreground">
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={handleSend} disabled={(!text.trim() && !pendingImageUrl) || sending || uploadingImage}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
