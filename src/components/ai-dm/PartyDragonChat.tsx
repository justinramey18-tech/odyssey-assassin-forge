import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, X, Pencil, Check, Loader2, Trash2, Brain, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { getMoodDescriptor, getBondDescriptor, getTrustDescriptor, type DragonMood, type DragonMemory } from '@/lib/dragonBondState';
import type { DragonChatMessage, DragonNetworkMessage } from '@/hooks/use-party-dragon-bonds';

const BOND_SENSE_RE = /<!--BOND_SENSE:(.+?)-->/g;

function extractBondSense(content: string): string | null {
  const match = content.match(/<!--BOND_SENSE:(.+?)-->/);
  return match ? match[1] : null;
}

function stripDragonTags(content: string): string {
  return content
    .replace(/<!--DRAGON_MOOD:\w+-->/g, '')
    .replace(/<!--DRAGON_MEMORY:.+?-->/g, '')
    .replace(/<!--DRAGON_HABIT:.+?-->/g, '')
    .replace(BOND_SENSE_RE, '')
    .trim();
}

function renderVisionBlocks(text: string): string {
  return text.replace(
    /\*\[vision:\s*(.+?)\]\*/gi,
    '<div class="my-2 rounded-lg bg-purple-950/30 px-3 py-2.5 text-purple-200/70 text-xs italic leading-relaxed">$1</div>',
  );
}

interface PartyDragonChatProps {
  open: boolean;
  onClose: () => void;
  dragonName: string;
  characterName: string;
  messages: DragonChatMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  bondState: {
    bond: number;
    trust: number;
    mood: string;
  };
  onRequestOpinion?: () => Promise<string | null>;
  dragonNetworkMessages?: DragonNetworkMessage[];
  otherDragons?: Array<{ dragonName: string; userId: string; characterName: string }>;
  onVoiceAsMyDragon?: (text: string, targetDragonName: string) => Promise<string>;
  onDeliverNetworkMessage?: (targetDragonName: string, targetUserId: string, voicedText: string, originalText: string, replyToId?: string) => Promise<void>;
  isVoicing?: boolean;
  myUserId?: string;
  dragonNotes?: string;
  onUpdateNotes?: (notes: string) => void;
  onClearChat?: () => void;
  onDeleteMessage?: (index: number) => void;
  memories?: DragonMemory[];
  onDeleteMemory?: (memoryId: string) => void;
  onAddMemory?: (text: string) => void;
}

export default function PartyDragonChat({
  open,
  onClose,
  dragonName,
  characterName,
  messages,
  onSend,
  isLoading,
  bondState,
  onRequestOpinion,
  dragonNetworkMessages,
  otherDragons,
  onVoiceAsMyDragon,
  onDeliverNetworkMessage,
  isVoicing,
  myUserId,
  dragonNotes,
  onUpdateNotes,
  onClearChat,
  onDeleteMessage,
  memories,
  onDeleteMemory,
  onAddMemory,
}: PartyDragonChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [dragonOpening, setDragonOpening] = useState<string | null>(null);
  const [networkTarget, setNetworkTarget] = useState<{ dragonName: string; userId: string; characterName: string } | null>(null);
  const [showDragonPicker, setShowDragonPicker] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const [previewState, setPreviewState] = useState<{
    voicedText: string;
    originalText: string;
    targetDragonName: string;
    targetUserId: string;
    replyToId?: string;
  } | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const opinionFiredRef = useRef(false);
  const isNearBottomRef = useRef(true);

  // Merged timeline
  const allItems = useMemo(() => {
    const bond = messages.map(m => ({ kind: 'bond' as const, ts: m.timestamp, data: m }));
    const network = (dragonNetworkMessages || []).map(m => ({ kind: 'network' as const, ts: m.timestamp, data: m }));
    return [...bond, ...network].sort((a, b) => a.ts.localeCompare(b.ts));
  }, [messages, dragonNetworkMessages]);

  // Request dragon opinion on open
  useEffect(() => {
    if (open) {
      opinionFiredRef.current = false;
      setDragonOpening(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || opinionFiredRef.current || !onRequestOpinion) return;
    opinionFiredRef.current = true;
    onRequestOpinion().then(opinion => {
      if (opinion) setDragonOpening(opinion);
    }).catch(() => {});
  }, [open, onRequestOpinion]);

  useEffect(() => {
    if (showPersonality) {
      setEditingNotes(dragonNotes || '');
      setTimeout(() => notesTextareaRef.current?.focus(), 100);
    }
  }, [showPersonality, dragonNotes]);

  // Track whether user is near the bottom of the scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const SCROLL_THRESHOLD = 100;
    const onScroll = () => {
      isNearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  // Auto-scroll on new messages only if user is near the bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allItems, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // Show dragon picker when typing '@'
  useEffect(() => {
    if (inputValue.startsWith('@') && otherDragons && otherDragons.length > 0) {
      setShowDragonPicker(true);
    } else {
      setShowDragonPicker(false);
    }
  }, [inputValue, otherDragons]);

  const handleSaveNotes = useCallback(async () => {
    if (!onUpdateNotes) return;
    setIsSavingNotes(true);
    try {
      onUpdateNotes(editingNotes.trim());
    } finally {
      setIsSavingNotes(false);
      setShowPersonality(false);
    }
  }, [editingNotes, onUpdateNotes]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isVoicing) return;
    const text = inputValue.trim();

    if (networkTarget && onVoiceAsMyDragon) {
      setInputValue('');
      try {
        const voiced = await onVoiceAsMyDragon(text, networkTarget.dragonName);
        setPreviewState({
          voicedText: voiced,
          originalText: text,
          targetDragonName: networkTarget.dragonName,
          targetUserId: networkTarget.userId,
        });
      } catch (err) {
        console.error('Voice failed:', err);
      }
    } else {
      onSend(text);
      setInputValue('');
    }
  }, [inputValue, isLoading, isVoicing, onSend, networkTarget, onVoiceAsMyDragon]);

  const handlePreviewSend = useCallback(async () => {
    if (!previewState || !onDeliverNetworkMessage) return;
    await onDeliverNetworkMessage(
      previewState.targetDragonName,
      previewState.targetUserId,
      previewState.voicedText,
      previewState.originalText,
      previewState.replyToId,
    );
    setPreviewState(null);
    setNetworkTarget(null);
  }, [previewState, onDeliverNetworkMessage]);

  const handlePreviewReroll = useCallback(async () => {
    if (!previewState || !onVoiceAsMyDragon) return;
    try {
      const voiced = await onVoiceAsMyDragon(previewState.originalText, previewState.targetDragonName);
      setPreviewState(prev => prev ? { ...prev, voicedText: voiced } : null);
    } catch (err) {
      console.error('Re-roll failed:', err);
    }
  }, [previewState, onVoiceAsMyDragon]);

  const handlePreviewCancel = useCallback(() => {
    setPreviewState(null);
  }, []);

  const handleReply = useCallback((msg: DragonNetworkMessage) => {
    setNetworkTarget({
      dragonName: msg.fromDragon,
      userId: msg.fromUserId,
      characterName: '',
    });
    setInputValue('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (_e: React.KeyboardEvent) => {
      // intentionally no-op: Enter naturally inserts a newline in textarea
    },
    [handleSend],
  );

  if (!open) return null;

  const moodInfo = getMoodDescriptor(bondState.mood as DragonMood);
  const bondDesc = getBondDescriptor(bondState.bond);
  const trustDesc = getTrustDescriptor(bondState.trust);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-gradient-to-b from-[#0a0a1a] via-[#0d0815] to-[#0a0612]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-cyan-500/10">
        <button onClick={onClose} className="p-1.5 -ml-1 rounded-lg hover:bg-white/5 transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowLeft className="w-5 h-5 text-cyan-300/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={cn('font-cinzel text-base truncate', moodInfo.color)}>
            {dragonName || 'Your Dragon'}
          </h1>
        </div>
        <button
          onClick={() => {
            setShowMemoryPanel(prev => !prev);
            if (showPersonality) setShowPersonality(false);
          }}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showMemoryPanel
              ? "bg-purple-500/20 text-purple-400"
              : "text-white/30 hover:text-white/50 hover:bg-white/5"
          )}
          style={{ touchAction: 'manipulation' }}
          title="Manage dragon memories"
        >
          <Brain className="w-4 h-4" />
        </button>
        {onUpdateNotes && (
          <button
            onClick={() => { setShowPersonality(prev => !prev); if (showMemoryPanel) setShowMemoryPanel(false); }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showPersonality
                ? "bg-amber-500/20 text-amber-400"
                : "text-white/30 hover:text-white/50 hover:bg-white/5"
            )}
            style={{ touchAction: 'manipulation' }}
            title="Edit dragon personality"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs flex items-center gap-1 text-white/40">
          <span>{moodInfo.emoji}</span>
          <span>{moodInfo.label}</span>
        </span>
        {onClearChat && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Clear Confirm */}
      {showClearConfirm && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-3 bg-red-950/30 border-b border-red-500/20">
          <p className="text-xs text-red-200/70">Clear entire dragon chat history?</p>
          <button
            onClick={() => setShowClearConfirm(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 border border-white/10"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClearChat?.();
              setShowClearConfirm(false);
              setDeletingIdx(null);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
            style={{ touchAction: 'manipulation' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Bond / Trust Indicator */}
      <button
        onClick={() => setStatsExpanded(prev => !prev)}
        className="shrink-0 px-4 py-2 border-b border-cyan-500/5 text-left hover:bg-white/[0.02] transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        {statsExpanded ? (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-cyan-300/60">Bond</span>
                <span className="text-[10px] text-cyan-300/40">{bondState.bond}/100</span>
              </div>
              <div className="h-1 rounded-full bg-cyan-950/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500/60 transition-all duration-500"
                  style={{ width: `${bondState.bond}%` }}
                />
              </div>
              <p className="text-[9px] text-cyan-200/30 mt-0.5">{bondDesc}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-purple-300/60">Trust</span>
                <span className="text-[10px] text-purple-300/40">{bondState.trust}/100</span>
              </div>
              <div className="h-1 rounded-full bg-purple-950/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500/60 transition-all duration-500"
                  style={{ width: `${bondState.trust}%` }}
                />
              </div>
              <p className="text-[9px] text-purple-200/30 mt-0.5">{trustDesc}</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-white/30 truncate">
            Bond: <span className="text-cyan-300/50">{bondDesc.split('—')[0].trim()}</span>
            <span className="mx-1.5">·</span>
            Trust: <span className="text-purple-300/50">{trustDesc.split('—')[0].trim()}</span>
          </p>
        )}
      </button>

      {/* Personality Editor Panel */}
      {showPersonality && (
        <div className="shrink-0 border-b border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-transparent max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-500/10">
            <div className="flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-cinzel font-semibold text-amber-300">Dragon Personality Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">
                {editingNotes.length.toLocaleString()}/20,000
              </span>
              <button
                onClick={() => setShowPersonality(false)}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <textarea
              ref={notesTextareaRef}
              value={editingNotes}
              onChange={e => setEditingNotes(e.target.value.slice(0, 20000))}
              placeholder="Define your dragon's complete personality. Include their voice, temperament, speech patterns, opinions, history, quirks, how they feel about your rider, what makes them unique. This is the single source of truth for who your dragon is — the more detail you provide, the more authentic they'll feel."
              className="w-full bg-black/30 border border-amber-500/20 rounded-xl px-3.5 py-3 text-sm text-white/80 placeholder:text-white/20 resize-y focus:outline-none focus:border-amber-500/40 transition-colors"
              style={{ minHeight: '200px', maxHeight: '40vh', touchAction: 'manipulation' }}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-amber-500/10 flex items-center gap-2">
            <button
              onClick={() => setShowPersonality(false)}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors border border-white/10"
              style={{ touchAction: 'manipulation' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              {isSavingNotes ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save Profile
            </button>
          </div>
        </div>
      )}

      {showMemoryPanel && (
        <div className="shrink-0 border-b border-purple-500/20 bg-gradient-to-b from-purple-950/20 to-transparent max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-500/10">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-cinzel font-semibold text-purple-300">Dragon Memories</span>
              <span className="text-[10px] text-white/30">({(memories || []).length}/30)</span>
            </div>
            <button
              onClick={() => setShowMemoryPanel(false)}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {(!memories || memories.length === 0) ? (
              <p className="text-xs text-white/20 italic text-center py-6">No memories yet. Your dragon will form memories through conversation and campaign events.</p>
            ) : (
              [...memories].reverse().map(memory => (
                <div key={memory.id} className="group flex items-start gap-2 rounded-lg bg-black/20 border border-purple-500/10 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 leading-relaxed">{memory.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full",
                        memory.source === 'campaign' ? "bg-amber-500/10 text-amber-400/60" :
                        memory.source === 'rider-said' ? "bg-cyan-500/10 text-cyan-400/60" :
                        "bg-purple-500/10 text-purple-400/60"
                      )}>
                        {memory.source === 'campaign' ? 'campaign' : memory.source === 'rider-said' ? 'rider said' : 'bond chat'}
                      </span>
                      <span className="text-[9px] text-white/20">{new Date(memory.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {onDeleteMemory && (
                    <button
                      onClick={() => onDeleteMemory(memory.id)}
                      className="shrink-0 p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      style={{ touchAction: 'manipulation', opacity: 1 }}
                      title="Delete memory"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {allItems.length === 0 && !dragonOpening && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm italic text-cyan-200/40 leading-relaxed">
              The bond hums quietly. {dragonName || 'Your dragon'} is aware of you.
            </p>
            <button
              onClick={() => inputRef.current?.focus()}
              className="mt-4 text-xs text-cyan-400/50 border border-cyan-500/20 rounded-lg px-4 py-2 hover:bg-cyan-500/5 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Reach out
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Dragon opening opinion */}
            {dragonOpening && (
              <div className="mb-6 pr-12">
                <div className="border-l-2 border-cyan-500/30 pl-3">
                  <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-cyan-100/90">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                      {renderVisionBlocks(stripDragonTags(dragonOpening))}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            {allItems.map((item, idx) => {
              if (item.kind === 'network') {
                const net = item.data as DragonNetworkMessage;
                const isSender = net.fromUserId === myUserId;
                const isRecipient = net.toUserId === myUserId;

                if (isRecipient && !isSender) {
                  return (
                    <div key={'net-' + net.id + '-' + idx} className="mb-6 pr-12">
                      <div className="border-l-2 border-purple-500/30 pl-3">
                        <p className="text-[9px] font-mono text-purple-400/40 mb-1">
                          {dragonName} delivers a thought through the bond
                        </p>
                        <p className="text-[10px] text-purple-300/50 mb-1.5">
                          From {net.fromDragon}:
                        </p>
                        <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-cyan-100/90">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {renderVisionBlocks(stripDragonTags(net.dragonExchange || ''))}
                          </ReactMarkdown>
                        </div>
                        {onVoiceAsMyDragon && (
                          <button
                            onClick={() => handleReply(net)}
                            className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-purple-900/30 border border-purple-500/20 text-purple-200/70 hover:bg-purple-800/40 transition-colors"
                            style={{ touchAction: 'manipulation' }}
                          >
                            Reply as {dragonName}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (isSender) {
                  return (
                    <div key={'net-' + net.id + '-' + idx} className="mb-6 pr-12">
                      <div className="border-l-2 border-purple-500/40 pl-3">
                        <p className="text-[9px] font-mono text-purple-400/50 mb-1">
                          Sent to {net.toDragon}
                        </p>
                        {net.dragonExchange ? (
                          <div className="text-purple-200/70 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {renderVisionBlocks(stripDragonTags(net.dragonExchange))}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-purple-300/30 italic text-xs animate-pulse">
                            ...reaching through the network...
                          </p>
                        )}
                        <p className="text-[9px] text-white/20 italic mt-1">
                          "{net.riderMessage}"
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              }

              // Bond messages (existing rendering)
              const msg = item.data as DragonChatMessage;
              const isDragon = msg.role === 'assistant';
              const bondSense = isDragon ? extractBondSense(msg.content) : null;
              const cleaned = stripDragonTags(msg.content);
              if (!cleaned) return null;

              return (
                <div key={`${msg.timestamp}-${idx}`}>
                  <div
                    onClick={() => setDeletingIdx(prev => prev === idx ? null : idx)}
                    className={cn(
                      isDragon ? 'mb-6' : 'mb-5',
                      isDragon ? 'pr-12' : 'pl-12',
                      'cursor-pointer',
                    )}
                  >
                    <div
                      className={cn(
                        isDragon
                          ? 'border-l-2 border-cyan-500/30 pl-3'
                          : 'border-r-2 border-white/[0.12] pr-3 text-right',
                      )}
                    >
                      {isDragon ? (
                        <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-cyan-100/90">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {renderVisionBlocks(cleaned)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-white/70 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                          {cleaned}
                        </p>
                      )}
                    </div>
                  </div>
                  {bondSense && (
                    <div className="text-center text-[11px] italic text-cyan-300/40 py-2 px-4 mb-4">
                      {bondSense}
                    </div>
                  )}
                  {deletingIdx === idx && onDeleteMessage && (
                    <div className="flex justify-end px-4 pb-2 -mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const bondMessages = allItems.filter(i => i.kind === 'bond');
                          const bondIdx = bondMessages.findIndex(b => b === item);
                          if (bondIdx >= 0) onDeleteMessage(bondIdx);
                          setDeletingIdx(null);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-900/40 border border-red-500/30 text-red-300 hover:bg-red-900/60 transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        Delete message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="mb-6 pr-12">
                <div className="border-l-2 border-cyan-500/20 pl-3">
                  <p className="text-cyan-300/30 italic text-xs animate-pulse">
                    ...a thought stirs through the bond...
                  </p>
                </div>
              </div>
            )}
            {isVoicing && (
              <div className="mb-6 pr-12">
                <div className="border-l-2 border-purple-500/20 pl-3">
                  <p className="text-purple-300/30 italic text-xs animate-pulse">
                    ...your dragon finds the words...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-cyan-500/10">
        {/* Dragon picker */}
        {showDragonPicker && otherDragons && otherDragons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 px-1">
            {otherDragons.map(d => (
              <button
                key={d.userId}
                onClick={() => {
                  setNetworkTarget(d);
                  setInputValue(prev => prev.replace(/^@\s*/, ''));
                  setShowDragonPicker(false);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-900/30 border border-purple-500/20 text-purple-200/70 hover:bg-purple-800/40 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                🐉 {d.dragonName}
              </button>
            ))}
          </div>
        )}

        {/* Network target pill */}
        {networkTarget && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-900/30 border border-purple-500/25 text-purple-200/70 flex items-center gap-1.5">
              🐉 Via {networkTarget.dragonName}
              <button
                onClick={() => setNetworkTarget(null)}
                className="p-0.5 hover:bg-white/10 rounded transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              networkTarget
                ? `Ask ${dragonName} to reach ${networkTarget.dragonName}...`
                : `Think to ${dragonName || 'your dragon'}...`
            }
            rows={1}
            className="flex-1 bg-cyan-950/20 border border-cyan-500/15 rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-cyan-300/25 resize-none focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || isVoicing}
            className={cn(
              'shrink-0 p-2.5 rounded-xl border transition-all',
              inputValue.trim() && !isLoading && !isVoicing
                ? networkTarget
                  ? 'bg-purple-900/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/60'
                  : 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60'
                : 'bg-white/[0.02] border-white/5 text-white/15',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Overlay */}
      {previewState && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#0a0a1a] via-[#0d0815] to-[#0a0612]">
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-purple-500/20">
            <h2 className="font-cinzel text-sm text-purple-200">Preview Message</h2>
            <span className="text-[10px] text-purple-300/40 ml-auto">To {previewState.targetDragonName}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <p className="text-[10px] text-white/30 mb-2">Your dragon will say:</p>
            <div className="border-l-2 border-purple-500/40 pl-3 mb-6">
              <div className="text-purple-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {previewState.voicedText}
                </ReactMarkdown>
              </div>
            </div>
            <p className="text-[9px] text-white/20 italic">Original: "{previewState.originalText}"</p>
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3 border-t border-purple-500/10 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handlePreviewReroll}
                disabled={isVoicing}
                className="flex-1 px-3 py-3 rounded-xl text-sm font-medium bg-purple-900/30 border border-purple-500/20 text-purple-200/70 hover:bg-purple-800/40 transition-colors disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                {isVoicing ? 'Re-rolling...' : 'Re-roll'}
              </button>
              <button
                onClick={handlePreviewSend}
                disabled={isVoicing}
                className="flex-1 px-3 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                Send
              </button>
            </div>
            <button
              onClick={handlePreviewCancel}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
