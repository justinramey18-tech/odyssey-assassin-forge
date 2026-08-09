import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Send, Smile, Trash2, MessageSquare, Zap } from 'lucide-react';
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
}: RoundChatDrawerProps) {
  const [text, setText] = useState('');
  const [inCharacter, setInCharacter] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages.length]);

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

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    await onSend(trimmed, inCharacter);
  };

  return (
    <div className="border-t border-amber-900/20 bg-black/30 overflow-hidden">
      {/* Collapsed strip */}
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 transition-colors text-left"
        style={{ touchAction: 'manipulation' }}
      >
        <MessageSquare className="w-3 h-3 text-amber-400/60 shrink-0" />
        <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold shrink-0">
          {style.mode === 'live' ? 'Live DM' : 'Round Chat'}
        </span>
        <span className={cn(
          "text-[10px] shrink-0",
          progress.met ? "text-emerald-400" : "text-white/35"
        )}>
          {progress.current}/{progress.target} {ruleLabel}
          {progress.banterExcluded ? ' (in-character)' : ''}
        </span>
        {!open && lastLine && (
          <span className="text-[10px] text-white/30 truncate ml-1">
            {lastLine.character_name}: {lastLine.content}
          </span>
        )}
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-white/30 shrink-0 ml-auto transition-transform duration-200",
          open && "rotate-180",
        )} />
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
            <div className="px-2 pb-2">
              {/* Feed — roughly half the DM chat window */}
              <div
                ref={scrollRef}
                className="overflow-y-auto scrollbar-hide space-y-1.5 pr-0.5"
                style={{ maxHeight: '38vh' }}
              >
                {messages.length === 0 ? (
                  <p className="text-[11px] text-white/30 text-center py-4">
                    No round chat yet — say something in character to start the round.
                  </p>
                ) : messages.map(m => {
                  const isSelf = m.user_id === currentUserId;
                  const msgReactions = reactionsByMessage.get(m.id) || [];
                  const grouped = msgReactions.reduce<Record<string, RoundChatReaction[]>>((acc, r) => {
                    (acc[r.emoji] ||= []).push(r);
                    return acc;
                  }, {});
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 border",
                        isSelf
                          ? "bg-amber-900/15 border-amber-500/20"
                          : "bg-white/5 border-white/10",
                        !m.in_character && "opacity-60",
                        m.consumed && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-amber-200/80 truncate">
                          {m.character_name}
                        </span>
                        {!m.in_character && (
                          <span className="text-[9px] px-1 rounded bg-white/10 text-white/40 uppercase tracking-wide">OOC</span>
                        )}
                        {m.consumed && (
                          <span className="text-[9px] px-1 rounded bg-emerald-900/30 text-emerald-300/70 uppercase tracking-wide">Sent</span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
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
                      <p className="text-xs text-white/80 leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-0.5">
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

              {/* Composer */}
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInCharacter(prev => !prev)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] border transition-colors",
                      inCharacter
                        ? "bg-amber-900/30 border-amber-500/30 text-amber-200"
                        : "bg-white/5 border-white/10 text-white/45"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {inCharacter ? 'In character' : 'Table talk (OOC)'}
                  </button>
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
