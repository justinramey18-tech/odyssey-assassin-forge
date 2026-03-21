import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { getMoodDescriptor, getBondDescriptor, getTrustDescriptor, type DragonMood } from '@/lib/dragonBondState';
import type { DragonChatMessage } from '@/hooks/use-party-dragon-bonds';

function stripDragonTags(content: string): string {
  return content
    .replace(/<!--DRAGON_MOOD:\w+-->/g, '')
    .replace(/<!--DRAGON_MEMORY:.+?-->/g, '')
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
}: PartyDragonChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [dragonOpening, setDragonOpening] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const opinionFiredRef = useRef(false);

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

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    onSend(inputValue.trim());
    setInputValue('');
  }, [inputValue, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
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
        {messages.length === 0 && !isLoading ? (
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
            {messages.map((msg, idx) => {
              const isDragon = msg.role === 'assistant';
              const cleaned = stripDragonTags(msg.content);
              if (!cleaned) return null;

              return (
                <div
                  key={`${msg.timestamp}-${idx}`}
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
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Think to ${dragonName || 'your dragon'}...`}
            rows={1}
            className="flex-1 bg-cyan-950/20 border border-cyan-500/15 rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-cyan-300/25 resize-none focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'shrink-0 p-2.5 rounded-xl border transition-all',
              inputValue.trim() && !isLoading
                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60'
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
