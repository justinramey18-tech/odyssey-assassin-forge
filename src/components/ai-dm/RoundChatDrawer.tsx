import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Send, Smile, Trash2, MessageSquare, Zap, Loader2, CheckCircle2, Hourglass } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { RoundChatMessage, RoundChatReaction, RoundStyle } from '@/hooks/use-round-chat';

const EMOJI_SET = ['🤣','😅','🤪','🙄','😬','😏','🤮','🥵','🥶','🤯','🧐','😎','😱','😭','🤬','😈','❤️','💯','👏','🙌','🤝','🖕','🫦','🗣','🍑','🍆'];

interface RoundChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: RoundChatMessage[];
  reactions: RoundChatReaction[];
  currentUserId?: string;
  characterName: string;
  style: RoundStyle;
  progress: { current: number; target: number; met: boolean; banterExcluded?: boolean };
  sending: boolean;
  isGenerating: boolean;
  isHost: boolean;
  onSend: (content: string, inCharacter: boolean) => void | Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onSendToDMNow: () => void;
  /** Text pushed in from outside (e.g. "suggest my action") to prefill the composer. */
  draft?: string | null;
  onDraftUsed?: () => void;
}

export function RoundChatDrawer({
  open,
  onOpenChange,
  messages,
  reactions,
  currentUserId,
  characterName,
  style,
  progress,
  sending,
  isGenerating,
  isHost,
  onSend,
  onToggleReaction,
  onDeleteMessage,
  onSendToDMNow,
  draft,
  onDraftUsed,
}: RoundChatDrawerProps) {
  const [text, setText] = useState('');
  const [inCharacter, setInCharacter] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const prevCountRef = useRef(messages.length);
  const wasGeneratingRef = useRef(isGenerating);
  const [justFinished, setJustFinished] = useState(false);

  // Outside suggestions land in the composer so the player can edit before sending.
  useEffect(() => {
    if (!draft) return;
    setText(prev => (prev.trim() ? `${prev.trim()} ${draft}` : draft));
    setInCharacter(true);
    onDraftUsed?.();
  }, [draft]);

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    pinnedRef.current = true;
    setPinned(true);
    setUnseen(0);
  };

  /** Track whether the reader is parked at the bottom of the feed. */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinnedRef.current = atBottom;
    setPinned(atBottom);
    if (atBottom) setUnseen(0);
  };

  // New lines: follow only if the reader hasn't scrolled up; otherwise badge them.
  useEffect(() => {
    const added = messages.length - prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!open || added <= 0) return;
    if (pinnedRef.current) {
      requestAnimationFrame(() => scrollToLatest(messages.length <= 1 ? 'auto' : 'smooth'));
    } else {
      setUnseen(n => n + added);
    }
  }, [messages.length, open]);

  // Opening the drawer always lands on the newest line.
  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollToLatest('auto'));
  }, [open]);

  // When the DM finishes expanding its response, bring the round feed back into view.
  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating) {
      requestAnimationFrame(() => scrollToLatest('smooth'));
      setJustFinished(true);
      const t = setTimeout(() => setJustFinished(false), 6000);
      wasGeneratingRef.current = isGenerating;
      return () => clearTimeout(t);
    }
    if (isGenerating) setJustFinished(false);
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating]);


  const lastLine = messages.length > 0 ? messages[messages.length - 1] : null;


  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, RoundChatReaction[]>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, []);
      map.get(r.message_id)!.push(r);
    }
    return map;
  }, [reactions]);

  const remaining = Math.max(0, progress.target - progress.current);
  const ruleLabel =
    style.triggerRule === 'total'
      ? 'messages'
      : style.triggerRule === 'distinct'
        ? 'players'
        : 'each';

  const triggerHint = (() => {
    const n = style.messageCount;
    const s = n === 1 ? '' : 's';
    if (style.triggerRule === 'distinct') return `The DM replies once ${n} different player${s} ha${n === 1 ? 's' : 've'} spoken.`;
    if (style.triggerRule === 'perPlayer') return `The DM replies once everyone who spoke has posted ${n} message${s}.`;
    return `The DM replies after ${n} message${s}.`;
  })();

  /** Compact status line: queued -> thinking -> ready. */
  const dmStatus: { tone: 'queued' | 'thinking' | 'ready'; label: string } | null = (() => {
    if (isGenerating) return { tone: 'thinking', label: 'The DM is thinking…' };
    if (justFinished) return { tone: 'ready', label: 'The DM has replied — scroll up to read the scene.' };
    if (progress.met) return { tone: 'queued', label: 'Round is full — the DM is up next.' };
    if (progress.current > 0) {
      const left = remaining;
      return {
        tone: 'queued',
        label: `${progress.current} queued · ${left} more ${ruleLabel === 'players' ? (left === 1 ? 'player' : 'players') : left === 1 ? 'message' : 'messages'} until the DM replies`,
      };
    }
    return null;
  })();



  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    // Posting your own line always brings you back to the bottom.
    pinnedRef.current = true;
    setPinned(true);
    await onSend(trimmed, inCharacter);
    requestAnimationFrame(() => scrollToLatest('smooth'));
  };

  return (
    <div className="border-t border-amber-900/30 bg-gradient-to-b from-amber-950/25 to-black/40 overflow-hidden">
      {/* Expansion trigger — large, ornamented header */}
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="w-full relative px-3 pt-2 pb-3 text-left transition-colors hover:bg-amber-500/[0.06] active:bg-amber-500/10"
        style={{ touchAction: 'manipulation', minHeight: 64 }}
      >
        {/* grab handle */}
        <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-amber-400/35" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="flex items-center gap-2">
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <MessageSquare className="w-4 h-4 text-amber-300/80" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-cinzel text-[13px] tracking-wide text-amber-200/90">
                {style.mode === 'live' ? 'Live DM Table' : 'Round Chat'}
              </span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full border shrink-0",
                progress.met
                  ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                  : "text-white/50 border-white/15 bg-white/5"
              )}>
                {progress.current}/{progress.target} {ruleLabel}
                {progress.banterExcluded ? ' (IC)' : ''}
              </span>
            </span>
            <span className="block text-[10px] text-white/40 truncate mt-0.5">
              {!open && lastLine
                ? `${lastLine.character_name}: ${lastLine.content}`
                : open ? 'Tap to collapse the table' : 'Tap to open the table chat'}
            </span>
          </span>
          <ChevronDown className={cn(
            "w-5 h-5 text-amber-300/60 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )} />
        </div>
      </button>


      <AnimatePresence>
        {open && (
          <motion.div
            key="round-chat-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 relative">
              {/* Compact DM status banner */}
              {dmStatus && (
                <div
                  className={cn(
                    "mb-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1",
                    dmStatus.tone === 'thinking' && "bg-amber-500/10 border-amber-500/25",
                    dmStatus.tone === 'ready' && "bg-emerald-500/10 border-emerald-500/25",
                    dmStatus.tone === 'queued' && "bg-white/5 border-white/10",
                  )}
                >
                  {dmStatus.tone === 'thinking' ? (
                    <Loader2 className="w-3 h-3 text-amber-300 animate-spin shrink-0" />
                  ) : dmStatus.tone === 'ready' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                  ) : (
                    <Hourglass className="w-3 h-3 text-white/40 shrink-0" />
                  )}
                  <span className={cn(
                    "text-[10px] truncate",
                    dmStatus.tone === 'thinking' ? "text-amber-100/90"
                      : dmStatus.tone === 'ready' ? "text-emerald-100/90"
                      : "text-white/50",
                  )}>
                    {dmStatus.label}
                  </span>
                </div>
              )}

              {/* Feed — roughly half the DM chat window */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto scrollbar-hide space-y-1.5 pr-0.5"
                style={{ maxHeight: '38vh' }}
              >
                {messages.length === 0 ? (
                  <div className="py-4 px-3 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <MessageSquare className="w-3 h-3 text-amber-300/80" />
                      <span className="text-[11px] text-amber-200/90">
                        {style.mode === 'live' ? 'Live table is open' : 'The round starts here'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed max-w-[34ch] mx-auto">
                      {style.mode === 'live'
                        ? 'Type below to play your character, or flip the toggle to Table talk and just chat — the DM hears both, riffs on the banter, then plays the scene.'
                        : 'Type below to say or do something as your character. Table talk stays between players; only in-character lines reach the DM.'}
                    </p>
                    <p className="text-[10px] text-white/35 max-w-[34ch] mx-auto">
                      {triggerHint}
                    </p>
                  </div>
                ) : messages.map(m => {
                  const isSelf = m.user_id === currentUserId;
                  const msgReactions = reactionsByMessage.get(m.id) || [];
                  const grouped = msgReactions.reduce<Record<string, RoundChatReaction[]>>((acc, r) => {
                    (acc[r.emoji] ||= []).push(r);
                    return acc;
                  }, {});
                  return (
                    <div key={m.id} className={cn("flex", m.in_character ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] min-w-0",
                        m.in_character
                          ? cn(
                              "rounded-2xl rounded-br-sm px-2.5 py-1.5 border text-right",
                              isSelf
                                ? "bg-emerald-800/35 border-emerald-400/40"
                                : "bg-emerald-950/30 border-emerald-500/20"
                            )
                          : "text-left",
                        m.consumed && "opacity-60",
                      )}
                    >
                      <div className={cn("flex items-center gap-1.5", m.in_character && "flex-row-reverse")}>
                        <span className={cn(
                          "text-[10px] font-semibold truncate",
                          m.in_character ? "text-emerald-200/90 font-cinzel" : "text-amber-300/80"
                        )}>
                          {m.character_name}
                        </span>
                        <span className={cn(
                          "text-[8px] px-1 py-[1px] rounded uppercase tracking-wider shrink-0",
                          m.in_character
                            ? "bg-emerald-500/20 text-emerald-200/90"
                            : "bg-amber-500/15 text-amber-200/80"
                        )}>
                          {m.in_character ? 'In character' : 'Table talk'}
                        </span>
                        {isSelf && (
                          <span className="text-[8px] px-1 py-[1px] rounded bg-white/10 text-white/45 uppercase tracking-wider shrink-0">You</span>
                        )}
                        {m.consumed && (
                          <span className="text-[9px] px-1 rounded bg-emerald-900/30 text-emerald-300/70 uppercase tracking-wide">Sent</span>
                        )}
                        <div className={cn("flex items-center gap-1", m.in_character ? "mr-auto" : "ml-auto")}>
                          <button
                            onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                            className="p-0.5 text-white/25 hover:text-amber-300 transition-colors"
                            style={{ touchAction: 'manipulation' }}
                            aria-label="Add reaction"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          {isSelf && !m.consumed && (
                            <button
                              onClick={() => onDeleteMessage(m.id)}
                              className="p-0.5 text-white/25 hover:text-red-400 transition-colors"
                              style={{ touchAction: 'manipulation' }}
                              aria-label="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={cn(
                        "text-xs leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-0.5",
                        m.in_character ? "text-white/90 text-right" : "text-amber-200/80 italic text-left"
                      )}>
                        {m.content}
                      </p>



                      {Object.keys(grouped).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(grouped).map(([emoji, list]) => {
                            const mine = list.some(r => r.user_id === currentUserId);
                            return (
                              <button
                                key={emoji}
                                onClick={() => onToggleReaction(m.id, emoji)}
                                className={cn(
                                  "px-1.5 py-0.5 rounded-full text-[11px] border transition-colors",
                                  mine
                                    ? "bg-amber-900/40 border-amber-500/40 text-amber-200"
                                    : "bg-white/5 border-white/10 text-white/60"
                                )}
                                style={{ touchAction: 'manipulation' }}
                              >
                                {emoji} {list.length}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {pickerFor === m.id && (
                        <div className="mt-1.5 grid grid-cols-9 gap-1 p-1.5 rounded-lg bg-black/50 border border-white/10">
                          {EMOJI_SET.map(e => (
                            <button
                              key={e}
                              onClick={() => { onToggleReaction(m.id, e); setPickerFor(null); }}
                              className="text-base leading-none py-1 rounded hover:bg-white/10"
                              style={{ touchAction: 'manipulation' }}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!pinned && messages.length > 0 && (
                <button
                  onClick={() => scrollToLatest('smooth')}
                  style={{ touchAction: 'manipulation' }}
                  className="absolute left-1/2 -translate-x-1/2 bottom-[86px] z-10 flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/30 bg-black/80 text-amber-200 text-[10px] shadow-lg"
                >
                  <ChevronDown className="w-3 h-3" />
                  {unseen > 0 ? `${unseen} new message${unseen === 1 ? '' : 's'}` : 'Jump to latest'}
                </button>
              )}

              {/* Composer */}
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div
                    role="group"
                    aria-label="Post as"
                    className="flex items-center rounded-lg border border-white/10 bg-black/30 p-0.5 shrink-0"
                  >
                    <button
                      onClick={() => setInCharacter(true)}
                      aria-pressed={inCharacter}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                        inCharacter
                          ? "bg-amber-500/25 text-amber-100 border border-amber-400/40"
                          : "text-white/40 border border-transparent"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      In character
                    </button>
                    <button
                      onClick={() => setInCharacter(false)}
                      aria-pressed={!inCharacter}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                        !inCharacter
                          ? "bg-sky-500/20 text-sky-100 border border-dashed border-sky-400/50"
                          : "text-white/40 border border-transparent"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      Table talk
                    </button>
                  </div>
                  <span className="text-[10px] text-white/30">
                    {progress.met
                      ? 'Round is ready for the DM'
                      : progress.banterExcluded
                        ? `${remaining} more in-character to trigger the DM (table talk doesn't count)`
                        : `${remaining} more to trigger the DM`}
                  </span>

                  {isHost && (
                    <button
                      onClick={onSendToDMNow}
                      disabled={isGenerating}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-emerald-500/30 bg-emerald-900/25 text-emerald-300 hover:bg-emerald-900/45 transition-colors disabled:opacity-40"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Zap className="w-3 h-3" />
                      Send to DM now
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 items-end">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={inCharacter ? `Speak as ${characterName || 'your character'}...` : 'Table talk — not sent to the DM'}
                    className="min-h-[38px] max-h-[140px] text-xs py-2 resize-none bg-white/5 border-amber-900/30"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-amber-900/40 border border-amber-500/30 text-amber-300 disabled:opacity-40"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Send round chat message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
