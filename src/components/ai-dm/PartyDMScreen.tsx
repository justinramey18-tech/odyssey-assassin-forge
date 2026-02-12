import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Crown, Send, Users, Check, CheckCheck, Zap, Eye, EyeOff, X, Shield, Loader2, Pencil, Trash2, Map, FolderOpen, BookOpen, Copy, RefreshCw, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import type { usePartyDm, PartyDmMessage, PartyDmPrompt } from '@/hooks/use-party-dm';

type PartyDmReturn = ReturnType<typeof usePartyDm>;

interface PartyDMScreenProps {
  onBack: () => void;
  partyDm: PartyDmReturn;
  isCreator: boolean;
  currentUserId?: string;
  memberCount: number;
  members: Array<{ user_id: string; character_name: string }>;
  onShowGuides?: () => void;
  onShowMap?: () => void;
  onShowSaves?: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  isExtracting?: boolean;
  guidesCount?: number;
}

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];

function getMemberColor(userId: string, members: Array<{ user_id: string }>): string {
  const idx = members.findIndex(m => m.user_id === userId);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
}

function PartyDMMessage({ message, currentUserId, members, mode, isCreator, onCopy, onEdit, onDelete, onRegenerate }: {
  message: PartyDmMessage;
  currentUserId?: string;
  members: Array<{ user_id: string; character_name: string }>;
  mode: 'shared' | 'private';
  isCreator?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditingMsg, setIsEditingMsg] = useState(false);
  const [editContent, setEditContent] = useState('');
  const isAssistant = message.role === 'assistant';
  const isMine = message.sender_user_id === currentUserId;

  // In private mode, hide other players' user messages content
  if (!isAssistant && !isMine && mode === 'private') {
    return (
      <div className="flex gap-1.5 justify-start min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-50"
          style={{ backgroundColor: getMemberColor(message.sender_user_id || '', members) + '30', border: `1px solid ${getMemberColor(message.sender_user_id || '', members)}40` }}>
          <Shield className="w-3.5 h-3.5" style={{ color: getMemberColor(message.sender_user_id || '', members) }} />
        </div>
        <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-white/5 border border-white/10 rounded-bl-sm">
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: getMemberColor(message.sender_user_id || '', members) }}>
            {message.sender_name}
          </p>
          <p className="text-sm text-white/40 italic">Taking action...</p>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-amber-950/50 border border-amber-500/20 rounded-bl-sm overflow-hidden">
          {isEditingMsg ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[80px] max-h-[300px]"
                rows={4}
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <Button
                  onClick={() => setIsEditingMsg(false)}
                  size="sm"
                  variant="ghost"
                  className="text-white/40 hover:text-white/70 h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editContent.trim() && onEdit) {
                      onEdit(message.id, editContent.trim());
                    }
                    setIsEditingMsg(false);
                  }}
                  size="sm"
                  className="gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300 h-7 px-2 text-xs"
                >
                  <Check className="w-3 h-3" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="text-amber-300">{children}</strong>,
                  em: ({ children }) => <em className="text-white/70">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-amber-500/40 pl-3 italic text-white/60 my-2">{children}</blockquote>
                  ),
                }}
              >
                {message.content || '...'}
              </ReactMarkdown>
            </div>
          )}

          {/* Host action buttons */}
          {isCreator && !isEditingMsg && (
            <div className="relative mt-1.5">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 rounded text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover/msg:opacity-100"
                style={{ touchAction: 'manipulation' }}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {showActions && (
                <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-black/90 border border-amber-900/30 rounded-lg p-1 z-10 shadow-lg">
                  <button
                    onClick={() => { onCopy?.(message.content); setShowActions(false); }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditContent(message.content); setIsEditingMsg(true); setShowActions(false); }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { onRegenerate?.(message.id); setShowActions(false); }}
                    className="p-1.5 rounded hover:bg-amber-900/30 text-amber-400/60 hover:text-amber-300 transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { onDelete?.(message.id); setShowActions(false); }}
                    className="p-1.5 rounded hover:bg-red-900/20 text-red-400/60 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // User message (combined prompts)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/20 border border-primary/30">
        <Users className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-white/5 border border-white/10 rounded-bl-sm overflow-hidden">
        <p className="text-[11px] font-semibold text-primary mb-1">Party Actions</p>
        {isEditingMsg ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-none min-h-[80px] max-h-[300px]"
              rows={4}
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button
                onClick={() => setIsEditingMsg(false)}
                size="sm"
                variant="ghost"
                className="text-white/40 hover:text-white/70 h-7 px-2 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editContent.trim() && onEdit) {
                    onEdit(message.id, editContent.trim());
                  }
                  setIsEditingMsg(false);
                }}
                size="sm"
                className="gap-1 bg-primary/20 border border-primary/30 hover:bg-primary/30 text-primary h-7 px-2 text-xs"
              >
                <Check className="w-3 h-3" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-white/90">{message.content}</p>
        )}

        {/* Host action buttons */}
        {isCreator && !isEditingMsg && (
          <div className="relative mt-1.5">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover/msg:opacity-100"
              style={{ touchAction: 'manipulation' }}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showActions && (
              <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-black/90 border border-white/10 rounded-lg p-1 z-10 shadow-lg">
                <button
                  onClick={() => { onCopy?.(message.content); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setEditContent(message.content); setIsEditingMsg(true); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onDelete?.(message.id); setShowActions(false); }}
                  className="p-1.5 rounded hover:bg-red-900/20 text-red-400/60 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function PartyDMScreen({ onBack, partyDm, isCreator, currentUserId, memberCount, members, onShowGuides, onShowMap, onShowSaves, autoSyncEnabled, onToggleAutoSync, isExtracting, guidesCount = 0 }: PartyDMScreenProps) {
  const [input, setInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mode = partyDm.sessionConfig?.mode || 'shared';

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [partyDm.messages, partyDm.currentPrompts]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    partyDm.submitPrompt(input.trim());
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, partyDm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }, []);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    partyDm.editMessage?.(messageId, content);
  }, [partyDm]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    partyDm.deleteMessage?.(messageId);
  }, [partyDm]);

  const handleRegenerateMessage = useCallback((messageId: string) => {
    partyDm.regenerateMessage?.(messageId);
  }, [partyDm]);

  const hasSubmitted = !!partyDm.myPrompt;
  const isReady = partyDm.myPrompt?.is_ready ?? false;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Party DM</h1>
          <span className="text-[10px] text-muted-foreground">{memberCount} players</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
          {/* Auto-Sync Toggle */}
          {onToggleAutoSync && (
            <button
              onClick={() => onToggleAutoSync(!autoSyncEnabled)}
              className={cn(
                "px-2 py-1.5 rounded-lg text-xs font-cinzel transition-colors",
                autoSyncEnabled ? "text-amber-300 bg-amber-900/30" : "text-white/50 hover:bg-white/10"
              )}
              style={{ touchAction: 'manipulation' }}
              title={autoSyncEnabled ? 'Auto-Sync enabled' : 'Enable Auto-Sync'}
            >
              <Zap className={cn("w-3.5 h-3.5 inline mr-0.5", isExtracting && "animate-pulse")} />
              Sync
            </button>
          )}
          {/* Battle Map */}
          {onShowMap && (
            <button
              onClick={onShowMap}
              className="px-2 py-1.5 rounded-lg text-xs font-cinzel text-white/50 hover:bg-white/10 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Map className="w-3.5 h-3.5 inline mr-0.5" />
              Map
            </button>
          )}
          {/* Saves */}
          {onShowSaves && (
            <button
              onClick={onShowSaves}
              className="px-2 py-1.5 rounded-lg text-xs font-cinzel text-white/50 hover:bg-white/10 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <FolderOpen className="w-3.5 h-3.5 inline mr-0.5" />
              Saves
            </button>
          )}
          {/* Guides */}
          {onShowGuides && (
            <button
              onClick={onShowGuides}
              className={cn(
                "px-2 py-1.5 rounded-lg text-xs font-cinzel transition-colors relative",
                guidesCount > 0 ? "text-amber-300/80 hover:bg-amber-900/30" : "text-white/50 hover:bg-white/10"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <BookOpen className="w-3.5 h-3.5 inline mr-0.5" />
              Guides
              {guidesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-600 text-[8px] flex items-center justify-center text-white">
                  {guidesCount}
                </span>
              )}
            </button>
          )}
          {isCreator && (
            <>
              <button
                onClick={() => {
                  const newMode = mode === 'shared' ? 'private' : 'shared';
                  if (partyDm.sessionConfig) {
                    const updated = { ...partyDm.sessionConfig, mode: newMode as 'shared' | 'private' };
                    (supabase.from('party_shared_state') as any)
                      .update({ state_data: updated })
                      .eq('state_type', 'dm_session')
                      .then(() => {});
                  }
                }}
                className={cn(
                  "p-1.5 rounded-lg text-xs transition-colors",
                  mode === 'shared' ? "bg-emerald-900/30 text-emerald-400" : "bg-purple-900/30 text-purple-400"
                )}
                title={mode === 'shared' ? 'Shared prompts' : 'Private prompts'}
                style={{ touchAction: 'manipulation' }}
              >
                {mode === 'shared' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={partyDm.endSession}
                className="p-1.5 rounded-lg text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mode indicator */}
      <div className="flex items-center justify-center gap-2 px-3 py-1 bg-black/30 border-b border-amber-900/20">
        {mode === 'shared' ? (
          <>
            <Eye className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] text-emerald-300/70">Shared Prompts</span>
          </>
        ) : (
          <>
            <EyeOff className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] text-purple-300/70">Private Prompts</span>
          </>
        )}
        <span className="text-[11px] text-white/30">•</span>
        <span className="text-[11px] text-white/40">{partyDm.messages.length} messages</span>
        {partyDm.isSummarizing && (
          <>
            <span className="text-[11px] text-white/30">•</span>
            <span className="text-[11px] text-purple-400 animate-pulse">Summarizing...</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[2px] py-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain">
        {partyDm.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Users className="w-12 h-12 text-primary/40 mb-4" />
            <h2 className="text-lg font-cinzel text-amber-200 mb-2">Party DM Session</h2>
            <p className="text-sm text-white/40 max-w-[280px]">
              Each player submits their action, then clicks Ready. When everyone is ready, the DM responds to all actions at once.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {partyDm.messages.map(msg => (
              <PartyDMMessage
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                members={members}
                mode={mode}
                isCreator={isCreator}
                onCopy={handleCopyMessage}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onRegenerate={handleRegenerateMessage}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Loading indicator */}
        {partyDm.isGenerating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="text-sm text-amber-400/60 italic">The DM weaves the tale...</span>
          </motion.div>
        )}
      </div>

      {/* Prompt Queue Status */}
      {partyDm.isActive && (
        <div className="px-3 py-2 border-t border-amber-900/20 bg-black/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Round Queue</span>
            <span className="text-[10px] text-white/30">
              {partyDm.currentPrompts.filter(p => p.is_ready).length}/{memberCount} ready
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
              const isSelf = m.user_id === currentUserId;
              return (
                <div
                  key={m.user_id}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-all",
                    !prompt && "bg-white/5 border-white/10 text-white/30",
                    prompt && !prompt.is_ready && "bg-amber-900/20 border-amber-500/30 text-amber-300",
                    prompt?.is_ready && "bg-emerald-900/20 border-emerald-500/30 text-emerald-300",
                  )}
                >
                  <span className="max-w-[80px] truncate">{m.character_name}</span>
                  {prompt?.is_ready ? (
                    <CheckCheck className="w-3 h-3 text-emerald-400" />
                  ) : prompt ? (
                    <Check className="w-3 h-3 text-amber-400" />
                  ) : null}
                  {mode === 'shared' && prompt && !isSelf && (
                    <span className="text-[9px] text-white/30 max-w-[60px] truncate">{prompt.prompt}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-2 py-2 sm:px-3 sm:py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm">
        {partyDm.isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-400/70">Generating response...</span>
          </div>
        ) : !hasSubmitted ? (
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="What does your character do?"
              rows={1}
              className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[120px]"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                "p-2.5 rounded-xl border shrink-0 transition-colors",
                input.trim() ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60" : "bg-white/5 border-white/10 opacity-40"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Send className="w-5 h-5 text-amber-400" />
            </button>
          </div>
        ) : !isReady ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {isEditing ? (
              <div className="flex items-end gap-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={1}
                  className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[120px]"
                  autoFocus
                />
                <Button
                  onClick={() => {
                    if (editText.trim()) {
                      partyDm.editPrompt(editText.trim());
                    }
                    setIsEditing(false);
                  }}
                  size="sm"
                  className="gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  size="sm"
                  variant="ghost"
                  className="text-white/40 hover:text-white/70"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-white/40 mb-0.5">Your action:</p>
                  <p className="text-sm text-white/70 truncate">{partyDm.myPrompt?.prompt}</p>
                </div>
                <button
                  onClick={() => { setEditText(partyDm.myPrompt?.prompt || ''); setIsEditing(true); }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
                  title="Edit prompt"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => partyDm.retractPrompt()}
                  className="p-2 rounded-lg hover:bg-red-900/20 transition-colors text-white/40 hover:text-red-400"
                  title="Retract prompt"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Button
                  onClick={partyDm.setReady}
                  className="gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
                >
                  <Check className="w-4 h-4" />
                  Ready
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300/70">Ready! Waiting for others...</span>
            </div>
            {isCreator && (
              <Button
                onClick={partyDm.generateResponse}
                disabled={partyDm.isGenerating || partyDm.currentPrompts.length === 0}
                className="gap-1.5 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                size="sm"
              >
                <Zap className="w-3.5 h-3.5" />
                Generate Now
              </Button>
            )}
          </div>
        )}

        {/* Host generate button (always visible for host when prompts exist) */}
        {isCreator && !partyDm.isGenerating && hasSubmitted && !isReady && partyDm.currentPrompts.length > 0 && (
          <div className="mt-2 flex justify-end max-w-2xl mx-auto">
            <Button
              onClick={partyDm.generateResponse}
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-300 border-amber-500/30"
            >
              <Zap className="w-3.5 h-3.5" />
              Generate Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
