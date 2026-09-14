import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Send, Smile, Trash2, MessageSquare, Zap, Loader2, CheckCircle2, Hourglass, ImagePlus, Pencil, Check, Maximize2, Minimize2 } from 'lucide-react';
import { AvatarCropDialog } from './AvatarCropDialog';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseActionCard } from '@/lib/roundChatActionCard';
import { QuickActionLine } from './QuickActionCard';
import type { RoundChatMessage, RoundChatReaction, RoundStyle } from '@/hooks/use-round-chat';

const EMOJI_SET = ['🤣','😅','🤪','🙄','😬','😏','🤮','🥵','🥶','🤯','🧐','😎','😱','😭','🤬','😈','❤️','💯','👏','🙌','🤝','🖕','🫦','🗣','🍑','🍆'];

/** Stable per-player name colours so everyone sees the same person in the same hue. */
const PLAYER_COLORS = [
  'text-emerald-300',
  'text-sky-300',
  'text-violet-300',
  'text-rose-300',
  'text-lime-300',
  'text-cyan-300',
  'text-fuchsia-300',
  'text-orange-300',
];

function playerColor(userId?: string | null): string {
  if (!userId) return 'text-white/80';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}

interface RoundChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: RoundChatMessage[];
  reactions: RoundChatReaction[];
  currentUserId?: string;
  characterName: string;
  style: RoundStyle;
  progress: { current: number; waiting: number; speakers?: number; met: boolean };
  sending: boolean;
  isGenerating: boolean;
  isHost: boolean;
  onSend: (content: string, inCharacter: boolean) => void | Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  /** Edit the text of a line the player already posted. */
  onEditMessage?: (messageId: string, content: string) => void | Promise<void>;

  onToggleSelected: (messageId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSendToDMNow: () => void;
  /** Ticked lines in the order they will be handed to the DM. */
  orderedSelected?: RoundChatMessage[];
  /** Replace the hand-off order with an explicit list of message ids. */
  onReorderSelected?: (ids: string[]) => void;

  /** Text pushed in from outside (e.g. "suggest my action") to prefill the composer. */
  draft?: string | null;
  onDraftUsed?: () => void;
  /** Per-player avatars: { [userId]: { ic, ooc } } */
  avatars?: Record<string, { ic?: string; ooc?: string }>;
  onUploadAvatar?: (kind: 'ic' | 'ooc', file: File) => void | Promise<void>;
  /** Per-player table-talk (out-of-character) display names: { [userId]: name } */
  oocNames?: Record<string, string>;
  onSetOocName?: (name: string) => void | Promise<void>;
}

/** Small circular face beside a message. Tapping your own opens the picker. */
function ChatAvatar({
  url,
  label,
  kind,
  editable,
  onPick,
}: {
  url?: string;
  label: string;
  kind: 'ic' | 'ooc';
  editable: boolean;
  onPick?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = (label || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="shrink-0 relative">
      <button
        type="button"
        onClick={() => editable && inputRef.current?.click()}
        disabled={!editable}
        aria-label={editable ? `Change your ${kind === 'ic' ? 'character' : 'player'} picture` : label}
        style={{ touchAction: 'manipulation' }}
        className={cn(
          "w-7 h-7 rounded-full overflow-hidden border flex items-center justify-center text-[10px] font-semibold",
          kind === 'ic'
            ? "border-emerald-400/40 bg-emerald-900/30 text-emerald-200"
            : "border-amber-400/40 border-dashed bg-amber-900/20 text-amber-200",
          editable && "hover:brightness-125"
        )}
      >
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          initials
        )}
      </button>
      {editable && (
        <>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-black/80 border border-white/20 flex items-center justify-center">
            <ImagePlus className="w-2 h-2 text-white/70" />
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick?.(f);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
        </>
      )}
    </div>
  );
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
  onEditMessage,

  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onSendToDMNow,
  orderedSelected,
  onReorderSelected,

  draft,
  onDraftUsed,
  avatars,
  onUploadAvatar,
  oocNames,
  onSetOocName,
}: RoundChatDrawerProps) {
  const [editingOocName, setEditingOocName] = useState(false);
  const [oocNameDraft, setOocNameDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const [text, setText] = useState('');
  const [inCharacter, setInCharacter] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const prevCountRef = useRef(messages.length);
  const wasGeneratingRef = useRef(isGenerating);
  const [justFinished, setJustFinished] = useState(false);
  // Picture chosen but not yet cropped — the crop dialog owns it until confirmed.
  const [cropTarget, setCropTarget] = useState<{ kind: 'ic' | 'ooc'; file: File } | null>(null);

  useEffect(() => {
    if (!open) setFullScreen(false);
  }, [open]);


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

  const triggerHint = 'Tick the lines you want the DM to answer, then the host taps Send to DM.';

  /** Compact status line: picked -> thinking -> ready. */
  const dmStatus: { tone: 'queued' | 'thinking' | 'ready'; label: string } | null = (() => {
    if (isGenerating) return { tone: 'thinking', label: 'The DM is thinking…' };
    if (justFinished) return { tone: 'ready', label: 'The DM has replied — scroll up to read the scene.' };
    if (progress.current > 0) {
      return {
        tone: 'queued',
        label: `${progress.current} line${progress.current === 1 ? '' : 's'} ticked${isHost ? ' — tap Send to DM when ready.' : ' — waiting on the host to send.'}`,
      };
    }
    if (progress.waiting > 0) {
      return { tone: 'queued', label: `${progress.waiting} line${progress.waiting === 1 ? '' : 's'} waiting — tick the ones the DM should answer.` };
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
    <div className={cn(
      "relative border-t border-amber-900/30 bg-gradient-to-b from-amber-950/25 to-black/40 overflow-hidden",
      fullScreen && "fixed inset-0 z-50 flex flex-col border-t-0 bg-[#0b0b10]",
    )}>
      {/* Expansion trigger — large, ornamented header */}
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={cn(
          "w-full relative px-3 pt-2 pb-3 text-left transition-colors hover:bg-amber-500/[0.06] active:bg-amber-500/10",
          fullScreen && "shrink-0"
        )}
        style={{ touchAction: 'manipulation', minHeight: 64 }}
      >
        {/* grab handle */}
        <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-amber-400/35" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="flex items-center gap-2 pr-9">
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
                {progress.current} ticked{progress.waiting > progress.current ? ` · ${progress.waiting - progress.current} waiting` : ''}
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

      {open && (
        <button
          onClick={(e) => { e.stopPropagation(); setFullScreen(v => !v); }}
          aria-label={fullScreen ? 'Exit full screen' : 'Open chat full screen'}
          style={{ touchAction: 'manipulation' }}
          className="absolute right-9 top-3 z-20 w-9 h-9 flex items-center justify-center rounded-lg border border-amber-500/25 bg-black/40 text-amber-300/80 active:bg-amber-500/15"
        >
          {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}


      <AnimatePresence>
        {open && (
          <motion.div
            key="round-chat-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: fullScreen ? '100%' : 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={cn("overflow-hidden", fullScreen && "flex-1 min-h-0 flex flex-col")}
          >
            <div className={cn(
              "px-2 pb-2 relative",
              fullScreen && "flex-1 min-h-0 flex flex-col",
            )}>
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
                className={cn(
                  "overflow-y-auto scrollbar-hide space-y-0 pr-0.5",
                  fullScreen && "flex-1 min-h-0",
                )}
                style={fullScreen ? undefined : { maxHeight: '38vh' }}
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
                ) : messages.map((m, idx) => {
                  const isSelf = m.user_id === currentUserId;
                  const { card, body } = parseActionCard(m.content);
                  const msgReactions = reactionsByMessage.get(m.id) || [];
                  const grouped = msgReactions.reduce<Record<string, RoundChatReaction[]>>((acc, r) => {
                    (acc[r.emoji] ||= []).push(r);
                    return acc;
                  }, {});
                  const nameColor = m.in_character ? playerColor(m.user_id) : 'text-sky-300/90';
                  const alignRight = isSelf;
                  const avatarUrl = m.in_character
                    ? avatars?.[m.user_id]?.ic
                    : avatars?.[m.user_id]?.ooc;

                  // Alter-ego line: who is speaking, and who is playing them.
                  const icName = (m.character_name || 'Player').trim();
                  const oocName = ((oocNames?.[m.user_id]) || '').trim();
                  const primaryName = m.in_character ? icName : (oocName || icName);
                  const secondaryName = m.in_character
                    ? (oocName && oocName.toLowerCase() !== icName.toLowerCase() ? oocName : '')
                    : (icName && icName.toLowerCase() !== (oocName || '').toLowerCase() ? icName : '');

                  // Collapse the header on consecutive lines from the same speaker.
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const stacked = !!prev
                    && prev.user_id === m.user_id
                    && prev.in_character === m.in_character;

                  const selectable = !m.consumed;
                  const showActions = actionsFor === m.id;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-end gap-2",
                        stacked ? "mt-0.5" : "mt-3 first:mt-0",
                        alignRight ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      {stacked ? (
                        <span className="shrink-0 w-8" />
                      ) : (
                        <ChatAvatar
                          url={avatarUrl}
                          label={primaryName}
                          kind={m.in_character ? 'ic' : 'ooc'}
                          editable={isSelf && !!onUploadAvatar}
                          onPick={(file) => setCropTarget({ kind: m.in_character ? 'ic' : 'ooc', file })}
                        />
                      )}

                      <div className={cn("min-w-0 max-w-[78%]", alignRight ? "items-end" : "items-start", "flex flex-col")}>
                        {!stacked && (
                          <div className={cn(
                            "flex items-baseline gap-1.5 mb-1 px-1",
                            alignRight && "flex-row-reverse",
                          )}>
                            <span className={cn("font-body text-[13px] font-semibold truncate", nameColor)}>
                              {primaryName}
                            </span>
                            {secondaryName && (
                              <span className="font-body text-[11px] text-white/35 truncate">
                                {secondaryName}
                              </span>
                            )}
                            {!m.in_character && (
                              <span className="font-body text-[10px] px-1.5 py-[1px] rounded-full shrink-0 bg-sky-500/15 text-sky-200/80 border border-sky-400/25">
                                table
                              </span>
                            )}
                          </div>
                        )}

                        {card ? (
                          <QuickActionLine
                            card={card}
                            actorName={icName}
                            nameClass={nameColor}
                            isSelf={isSelf}
                            alignRight={alignRight}
                          />
                        ) : editingMessageId === m.id ? (
                          <div className="w-full space-y-1.5 text-left">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              autoFocus
                              className="w-full font-body rounded-xl bg-black/40 border border-emerald-500/40 px-3 py-2 text-[15px] text-white/90 outline-none focus:border-emerald-400/70 resize-y"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => { setEditingMessageId(null); setEditDraft(''); }}
                                className="font-body px-3 py-1.5 rounded-lg text-[13px] bg-white/5 text-white/60 min-h-[36px]"
                                style={{ touchAction: 'manipulation' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  const next = editDraft.trim();
                                  if (!next || next === m.content) { setEditingMessageId(null); return; }
                                  await onEditMessage?.(m.id, next);
                                  setEditingMessageId(null);
                                  setEditDraft('');
                                }}
                                disabled={!editDraft.trim()}
                                className="font-body px-3 py-1.5 rounded-lg text-[13px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 disabled:opacity-40 min-h-[36px]"
                                style={{ touchAction: 'manipulation' }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActionsFor(showActions ? null : m.id)}
                            style={{ touchAction: 'manipulation' }}
                            className={cn(
                              "text-left rounded-2xl border px-3 py-2 transition-colors",
                              alignRight ? "rounded-br-md" : "rounded-bl-md",
                              m.in_character
                                ? (isSelf
                                    ? "bg-amber-500/15 border-amber-400/25"
                                    : "bg-white/[0.07] border-white/10")
                                : "bg-sky-500/[0.08] border-sky-400/25 border-dashed",
                              m.selected && "ring-1 ring-emerald-400/60",
                              m.consumed && "opacity-55",
                            )}
                          >
                            <p className="font-body text-[15px] leading-[1.45] text-white/90 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {body}
                            </p>
                          </button>
                        )}

                        <div className={cn(
                          "flex items-center gap-1.5 mt-1 px-1",
                          alignRight && "flex-row-reverse",
                        )}>
                          {selectable ? (
                            <button
                              onClick={() => onToggleSelected(m.id)}
                              role="checkbox"
                              aria-checked={!!m.selected}
                              aria-label={m.selected ? 'Remove from the DM hand-off' : 'Send this line to the DM'}
                              style={{ touchAction: 'manipulation' }}
                              className={cn(
                                "font-body shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                                m.selected
                                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200"
                                  : "bg-white/[0.03] border-white/10 text-white/30",
                              )}
                            >
                              <Check className="w-3 h-3" />
                              {m.selected ? 'ticked' : 'tick'}
                            </button>
                          ) : (
                            <span className="font-body shrink-0 flex items-center gap-1 text-[10px] text-emerald-300/50">
                              <Check className="w-3 h-3" /> sent
                            </span>
                          )}

                          {showActions && (
                            <>
                              <button
                                onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                                className="p-1 text-white/40 active:text-amber-300"
                                style={{ touchAction: 'manipulation' }}
                                aria-label="Add reaction"
                              >
                                <Smile className="w-4 h-4" />
                              </button>
                              {isSelf && !m.consumed && !card && onEditMessage && (
                                <button
                                  onClick={() => {
                                    setEditingMessageId(editingMessageId === m.id ? null : m.id);
                                    setEditDraft(m.content);
                                    setActionsFor(null);
                                  }}
                                  className="p-1 text-white/40 active:text-emerald-300"
                                  style={{ touchAction: 'manipulation' }}
                                  aria-label="Edit message"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {isSelf && !m.consumed && (
                                <button
                                  onClick={() => onDeleteMessage(m.id)}
                                  className="p-1 text-white/40 active:text-red-400"
                                  style={{ touchAction: 'manipulation' }}
                                  aria-label="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {Object.keys(grouped).length > 0 && (
                          <div className={cn("flex flex-wrap gap-1 mt-1", alignRight && "justify-end")}>
                            {Object.entries(grouped).map(([emoji, list]) => {
                              const mine = list.some(r => r.user_id === currentUserId);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => onToggleReaction(m.id, emoji)}
                                  className={cn(
                                    "font-body px-2 py-0.5 rounded-full text-[12px] border transition-colors",
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
                          <div className="mt-1.5 grid grid-cols-9 gap-1 p-1.5 rounded-xl bg-black/60 border border-white/10">
                            {EMOJI_SET.map(e => (
                              <button
                                key={e}
                                onClick={() => { onToggleReaction(m.id, e); setPickerFor(null); }}
                                className="text-base leading-none py-1.5 rounded active:bg-white/10"
                                style={{ touchAction: 'manipulation' }}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!pinned && messages.length > 0 && (
                <button
                  onClick={() => scrollToLatest('smooth')}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/30 bg-black/80 text-amber-200 text-[10px] shadow-lg",
                    fullScreen ? "bottom-[110px]" : "bottom-[86px]",
                  )}
                >
                  <ChevronDown className="w-3 h-3" />
                  {unseen > 0 ? `${unseen} new message${unseen === 1 ? '' : 's'}` : 'Jump to latest'}
                </button>
              )}

              {/* Composer */}
              <div
                className={cn("mt-2 space-y-1.5", fullScreen && "shrink-0")}
                style={fullScreen ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
              >
                
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
                      {(() => {
                        const ic = (characterName || '').trim();
                        const ooc = ((currentUserId && oocNames?.[currentUserId]) || '').trim();
                        return ic && ooc && ic.toLowerCase() !== ooc.toLowerCase() ? ic : 'In character';
                      })()}
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
                      {(() => {
                        const ic = (characterName || '').trim();
                        const ooc = ((currentUserId && oocNames?.[currentUserId]) || '').trim();
                        return ic && ooc && ic.toLowerCase() !== ooc.toLowerCase() ? ooc : 'Table talk';
                      })()}
                    </button>
                  </div>
                  {!inCharacter && onSetOocName && (
                    editingOocName ? (
                      <input
                        autoFocus
                        value={oocNameDraft}
                        maxLength={40}
                        onChange={(e) => setOocNameDraft(e.target.value)}
                        onBlur={() => { onSetOocName(oocNameDraft); setEditingOocName(false); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); onSetOocName(oocNameDraft); setEditingOocName(false); }
                          if (e.key === 'Escape') setEditingOocName(false);
                        }}
                        placeholder="Your table name"
                        className="w-28 shrink-0 px-2 py-1 rounded-md text-[10px] bg-black/40 border border-amber-400/40 text-amber-100 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => { setOocNameDraft((currentUserId && oocNames?.[currentUserId]) || ''); setEditingOocName(true); }}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-amber-400/30 bg-amber-900/20 text-amber-200/90"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        {(currentUserId && oocNames?.[currentUserId]) || 'Name yourself'}
                      </button>
                    )
                  )}
                  {progress.waiting > 0 && (
                    <button
                      onClick={progress.current > 0 ? onClearSelection : onSelectAll}
                      className="shrink-0 px-2 py-1 rounded-md text-[10px] border border-white/15 bg-white/5 text-white/60"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {progress.current > 0 ? 'Clear ticks' : 'Tick all'}
                    </button>
                  )}
                  <span className="text-[10px] text-white/30 truncate">
                    {progress.current > 0
                      ? `${progress.current} ticked for the DM`
                      : 'Tick lines to send'}
                  </span>

                  {isHost && (
                    <button
                      onClick={onSendToDMNow}
                      disabled={isGenerating || progress.current === 0}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-emerald-500/30 bg-emerald-900/25 text-emerald-300 hover:bg-emerald-900/45 transition-colors disabled:opacity-40"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      {isGenerating
                        ? 'DM is writing…'
                        : progress.current > 0
                          ? `Send to DM (${progress.current} line${progress.current === 1 ? '' : 's'}${progress.speakers ? ` · ${progress.speakers} hero${progress.speakers === 1 ? '' : 'es'}` : ''})`
                          : 'Send to DM'}
                    </button>
                  )}
                </div>

                {/* Hand-off order — host arranges how the DM reads the batch */}
                {isHost && onReorderSelected && (orderedSelected?.length || 0) > 1 && (
                  <div className="mb-1.5 rounded-md border border-emerald-900/30 bg-emerald-950/20 p-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-emerald-300/60 mb-1 font-cinzel">
                      Send order
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-hide">
                      {orderedSelected!.map((m, i) => {
                        const ids = orderedSelected!.map(x => x.id);
                        const move = (dir: -1 | 1) => {
                          const next = [...ids];
                          const j = i + dir;
                          if (j < 0 || j >= next.length) return;
                          [next[i], next[j]] = [next[j], next[i]];
                          onReorderSelected(next);
                        };
                        return (
                          <div key={m.id} className="flex items-center gap-1.5">
                            <span className="w-4 shrink-0 text-[9px] text-white/35 text-center">{i + 1}</span>
                            <span className={cn(
                              "text-[10px] font-semibold shrink-0 truncate max-w-[72px] font-cinzel",
                              m.in_character ? playerColor(m.user_id) : 'text-amber-300/80',
                            )}>
                              {m.in_character ? (m.character_name || 'Player') : (oocNames?.[m.user_id] || m.character_name || 'Player')}
                            </span>
                            <span className="text-[10px] text-white/45 truncate min-w-0 flex-1">
                              {parseActionCard(m.content).body || m.content}
                            </span>
                            <button
                              onClick={() => move(-1)}
                              disabled={i === 0}
                              aria-label="Move earlier"
                              style={{ touchAction: 'manipulation' }}
                              className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 text-white/60 disabled:opacity-25 flex items-center justify-center"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => move(1)}
                              disabled={i === orderedSelected!.length - 1}
                              aria-label="Move later"
                              style={{ touchAction: 'manipulation' }}
                              className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 text-white/60 disabled:opacity-25 flex items-center justify-center"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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

      <AvatarCropDialog
        open={!!cropTarget}
        file={cropTarget?.file ?? null}
        kind={cropTarget?.kind ?? 'ic'}
        onCancel={() => setCropTarget(null)}
        onConfirm={async (cropped) => {
          const kind = cropTarget?.kind ?? 'ic';
          setCropTarget(null);
          await onUploadAvatar?.(kind, cropped);
        }}
      />
    </div>
  );
}
