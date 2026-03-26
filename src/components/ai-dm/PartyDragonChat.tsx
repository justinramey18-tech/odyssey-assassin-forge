import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, X, Pencil, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { getMoodDescriptor, getBondDescriptor, getTrustDescriptor, type DragonMood } from '@/lib/dragonBondState';
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
  onSendNetworkMessage?: (targetDragonName: string, targetUserId: string, targetCharacterName: string, message: string) => void;
  myUserId?: string;
  dragonNotes?: string;
  onUpdateNotes?: (notes: string) => void;
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
  onSendNetworkMessage,
  myUserId,
  dragonNotes,
  onUpdateNotes,
}: PartyDragonChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [dragonOpening, setDragonOpening] = useState<string | null>(null);
  const [networkTarget, setNetworkTarget] = useState<{ dragonName: string; userId: string; characterName: string } | null>(null);
  const [showDragonPicker, setShowDragonPicker] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const opinionFiredRef = useRef(false);

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

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
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

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    if (networkTarget && onSendNetworkMessage) {
      onSendNetworkMessage(networkTarget.dragonName, networkTarget.userId, networkTarget.characterName, inputValue.trim());
      setNetworkTarget(null);
    } else {
      onSend(inputValue.trim());
    }
    setInputValue('');
  }, [inputValue, isLoading, onSend, networkTarget, onSendNetworkMessage]);

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
        <span className="text-xs flex items-center gap-1 text-white/40">
          <span>{moodInfo.emoji}</span>
          <span>{moodInfo.label}</span>
        </span>
      </div>

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

                // Recipient view — only show delivery
                if (isRecipient && !isSender && net.toRiderDelivery) {
                  return (
                    <div key={`net-${net.id}-${idx}`} className="mb-6 pr-12">
                      <div className="border-l-2 border-cyan-500/30 pl-3">
                        <p className="text-[9px] font-mono text-cyan-400/40 mb-1">
                          {net.toDragon} — unprompted
                        </p>
                        <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {net.toRiderDelivery}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Sender view
                if (isSender) {
                  return (
                    <div key={`net-${net.id}-${idx}`} className="mb-6 pr-12">
                      <div className="border-l-2 border-purple-500/40 pl-3">
                        <p className="text-[9px] font-mono text-purple-400/50 mb-1">
                          ⟵ dragon network ⟶ {net.fromDragon} ↔ {net.toDragon}
                        </p>
                        {net.dragonExchange ? (
                          <div className="text-purple-200/70 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {net.dragonExchange}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-purple-300/30 italic text-xs animate-pulse">
                            ...reaching through the network...
                          </p>
                        )}
                        {net.toRiderDelivery && (
                          <p className="text-[10px] text-purple-300/40 mt-1.5">
                            ✓ {net.toDragon} delivered your message
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
                    className={cn(
                      isDragon ? 'mb-6' : 'mb-5',
                      isDragon ? 'pr-12' : 'pl-12',
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
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'shrink-0 p-2.5 rounded-xl border transition-all',
              inputValue.trim() && !isLoading
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
    </div>
  );
}
