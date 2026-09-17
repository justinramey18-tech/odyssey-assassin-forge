import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Send, Smile, Trash2, MessageSquare, Loader2, CheckCircle2, Hourglass, ImagePlus, Pencil, Check, X, Reply, CornerUpLeft } from 'lucide-react';
import { AvatarCropDialog } from './AvatarCropDialog';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseActionCard } from '@/lib/roundChatActionCard';
import { parseReply, quotePreview, formatReply } from '@/lib/chatReply';
import { QuickActionLine } from './QuickActionCard';
import { useOnlineStatus } from '@/hooks/use-online-status';
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

export function playerColor(userId?: string | null): string {
  if (!userId) return 'text-white/80';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}

/** Background counterparts to PLAYER_COLORS, for players with no uploaded avatar. */
const PLAYER_TINTS = [
  'bg-emerald-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-rose-400',
  'bg-lime-400',
  'bg-cyan-400',
  'bg-fuchsia-400',
  'bg-orange-400',
];

/** Background counterpart to playerColor, for players with no uploaded avatar. */
function playerTint(userId: string): string {
  if (!userId) return 'bg-white/10';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PLAYER_TINTS[hash % PLAYER_TINTS.length];
}

/** Matches a message whose entire body is a shared image. Same convention the
 *  main party DM stream uses - see IMAGE_REGEX in AIDMScreen.tsx. */
const CHAT_IMAGE_REGEX = /^\s*\[image:(https?:\/\/[^\]]+)\]\s*$/;

const SWIPE_TRIGGER = 56;   // px of travel needed to arm the reply
const SWIPE_MAX = 80;       // px the bubble can be dragged


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
  /** Uploads a picture and resolves to its public URL, or null if it failed. */
  onUploadImage?: (file: File) => Promise<string | null>;
  /** Per-player table-talk (out-of-character) display names: { [userId]: name } */
  oocNames?: Record<string, string>;
  onSetOocName?: (name: string) => void | Promise<void>;

  /** userId -> ISO timestamp of the newest message that player has seen. */
  readReceipts?: Record<string, string>;
  /** Everyone in the party, for naming who has read a message. */
  partyMembers?: Array<{ user_id: string; character_name: string; updated_at?: string }>;
  /** Record that this player has seen everything up to this ISO timestamp. */
  onMarkRead?: (iso: string) => void;
}

/** Small circular face beside a message. Tapping your own opens the picker. */
function ChatAvatar({
  url,
  label,
  kind,
  editable,
  onPick,
  active,
  presence,
}: {
  url?: string;
  label: string;
  kind: 'ic' | 'ooc';
  editable: boolean;
  onPick?: (file: File) => void;
  /** When set, true = message matches the composer's mode (bright ring), false = other mode (faded). */
  active?: boolean;
  presence?: 'online' | 'offline';
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
          "w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center text-[13px] font-semibold transition-all duration-200",
          kind === 'ic'
            ? "border-emerald-400/40 bg-emerald-900/30 text-emerald-200"
            : "border-amber-400/40 border-dashed bg-amber-900/20 text-amber-200",
          active === true && (kind === 'ic' ? "ring-2 ring-emerald-400/80" : "ring-2 ring-sky-400/80"),
          active === false && "opacity-45",
          editable && "hover:brightness-125"
        )}
      >
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          initials
        )}
      </button>
      {presence && (
        /* Presence dot, styled exactly like the player cards on the home screen. */
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
            presence === 'online' ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      )}
      {editable && (
        <>
          <span
            className={cn(
              "absolute w-3 h-3 rounded-full bg-black/80 border border-white/20 flex items-center justify-center",
              presence ? "-top-0.5 -right-0.5" : "-bottom-0.5 -right-0.5",
            )}
          >
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
  onUploadImage,
  oocNames,
  onSetOocName,

  readReceipts,
  partyMembers,
  onMarkRead,
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
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const prevCountRef = useRef(messages.length);
  const wasGeneratingRef = useRef(isGenerating);
  const [justFinished, setJustFinished] = useState(false);
  // Picture chosen but not yet cropped — the crop dialog owns it until confirmed.
  const [cropTarget, setCropTarget] = useState<{ kind: 'ic' | 'ooc'; file: File } | null>(null);

  const [replyTo, setReplyTo] = useState<RoundChatMessage | null>(null);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; locked: boolean } | null>(null);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const jumpToMessage = useCallback((id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-1', 'ring-amber-400/70');
    setTimeout(() => el.classList.remove('ring-1', 'ring-amber-400/70'), 1200);
  }, []);

  const onRowTouchStart = useCallback((id: string) => (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY, locked: false };
    setSwipeId(id);
    setSwipeX(0);
  }, []);

  const onRowTouchMove = useCallback((e: React.TouchEvent) => {
    const start = swipeStart.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // Only treat it as a swipe once it is clearly horizontal, so ordinary
    // vertical scrolling is never hijacked.
    if (!start.locked) {
      if (Math.abs(dy) > Math.abs(dx)) { swipeStart.current = null; setSwipeId(null); setSwipeX(0); return; }
      if (Math.abs(dx) < 12) return;
      start.locked = true;
    }
    setSwipeX(dx > 0 ? Math.min(dx, SWIPE_MAX) : 0);
  }, []);

  const onRowTouchEnd = useCallback((m: RoundChatMessage) => () => {
    if (swipeX >= SWIPE_TRIGGER) {
      setReplyTo(m);
      try { navigator.vibrate?.(12); } catch { /* not supported, fine */ }
    }
    swipeStart.current = null;
    setSwipeId(null);
    setSwipeX(0);
  }, [swipeX]);

  useEffect(() => {
    if (open) setFullScreen(true);
    else { setFullScreen(false); setReplyTo(null); }
  }, [open]);

  // Hide the floating "Back to character sheet" shortcut while the round chat
  // is expanded, so it doesn't sit on top of the composer.
  useEffect(() => {
    if (open) document.body.classList.add('round-chat-expanded');
    else document.body.classList.remove('round-chat-expanded');
    return () => document.body.classList.remove('round-chat-expanded');
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

  // You have seen a message once it is on screen at the bottom of an open chat.
  useEffect(() => {
    if (!open || !pinned || !onMarkRead) return;
    if (messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (newest?.created_at) onMarkRead(newest.created_at);
  }, [open, pinned, messages, onMarkRead]);


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
    return null;
  })();



  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    // Posting your own line always brings you back to the bottom.
    pinnedRef.current = true;
    setPinned(true);
    await onSend(formatReply(replyTo?.id ?? null, trimmed), inCharacter);
    setReplyTo(null);
    requestAnimationFrame(() => scrollToLatest('smooth'));
  };

  const sendImage = useCallback(async (file: File) => {
    if (!onUploadImage || uploadingImage) return;
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      if (url) await onSend(`[image:${url}]`, inCharacter);
    } finally {
      setUploadingImage(false);
    }
  }, [onUploadImage, uploadingImage, onSend, inCharacter]);

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
                {progress.current} ticked
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
                  const parsedReply = parseReply(body);
                  const quoted = parsedReply.replyToId
                    ? messages.find(mm => mm.id === parsedReply.replyToId)
                    : null;
                  const imageMatch = parsedReply.body.match(CHAT_IMAGE_REGEX);
                  const imageUrl = imageMatch ? imageMatch[1] : null;
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
                  const modeMatch = m.in_character === inCharacter;

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
                  const readerNames = showActions
                    ? (partyMembers || [])
                        .filter(pm => pm.user_id !== m.user_id)
                        .filter(pm => {
                          const seenAt = readReceipts?.[pm.user_id];
                          return !!seenAt && seenAt >= m.created_at;
                        })
                        .map(pm => pm.character_name)
                    : [];

                  return (
                    <div
                      key={m.id}
                      ref={(el) => { messageRefs.current[m.id] = el; }}
                      onTouchStart={onRowTouchStart(m.id)}
                      onTouchMove={onRowTouchMove}
                      onTouchEnd={onRowTouchEnd(m)}
                      onTouchCancel={() => { swipeStart.current = null; setSwipeId(null); setSwipeX(0); }}
                      className={cn(
                        "relative flex items-end gap-1.5",
                        stacked ? "mt-[3px]" : "mt-2 first:mt-0",
                        alignRight ? "flex-row-reverse" : "flex-row",
                      )}
                      style={{
                        touchAction: 'pan-y',
                        transform: swipeId === m.id && swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
                        transition: swipeId === m.id ? 'none' : 'transform 160ms ease-out',
                      }}
                    >
                      {swipeId === m.id && swipeX > 8 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[-34px] top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300"
                          style={{ opacity: Math.min(swipeX / SWIPE_TRIGGER, 1) }}
                        >
                          <CornerUpLeft className="w-4 h-4" />
                        </span>
                      )}
                      {stacked ? (
                        <span className="shrink-0 w-10" />
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
                            "flex items-baseline gap-1.5 mb-0.5 px-1",
                            alignRight && "flex-row-reverse",
                          )}>
                            <span className={cn("font-body text-[12px] font-semibold truncate", nameColor)}>
                              {primaryName}
                            </span>
                            {secondaryName && (
                              <span className="font-body text-[10px] text-white/35 truncate">
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
                              "relative isolate overflow-hidden text-left rounded-2xl border px-2.5 py-1.5 transition-colors max-w-full min-w-0",
                              alignRight ? "rounded-br-md" : "rounded-bl-md",
                              m.in_character
                                ? (isSelf
                                    ? (modeMatch ? "bg-amber-500/25 border-amber-400/50" : "bg-amber-500/10 border-amber-400/15")
                                    : (modeMatch ? "bg-white/[0.12] border-white/25" : "bg-white/[0.04] border-white/[0.07]"))
                                : (modeMatch
                                    ? "bg-sky-500/[0.16] border-sky-400/50 border-dashed"
                                    : "bg-sky-500/[0.05] border-sky-400/15 border-dashed"),
                              m.selected && "ring-1 ring-emerald-400/60",
                              m.consumed && "opacity-55",
                              imageUrl && "p-1",
                            )}
                          >
                            {avatarUrl && !imageUrl ? (
                              /* Full clarity: no blur, no scrim. Legibility is carried
                                 entirely by the text shadow stack on the paragraph below.
                                 IC and table talk resolve to different avatar slots, so the
                                 picture itself says which mode the message was sent in.
                                 bg-top keeps faces in frame rather than centring on a
                                 portrait's chest. */
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "absolute inset-0 -z-10 bg-cover bg-top transition-opacity duration-200",
                                  modeMatch ? "opacity-100" : "opacity-40"
                                )}
                                style={{ backgroundImage: `url(${avatarUrl})` }}
                              />
                            ) : !imageUrl ? (
                              /* No uploaded picture: fall back to the speaker's own colour so
                                 they are still distinguishable from everyone else. */
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "absolute inset-0 -z-10 transition-opacity duration-200",
                                  modeMatch ? "opacity-20" : "opacity-[0.07]",
                                  playerTint(m.user_id)
                                )}
                              />
                            ) : null}

                            {parsedReply.replyToId && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); jumpToMessage(parsedReply.replyToId!); }}
                                className="relative block w-full min-w-0 max-w-full mb-1.5 pl-2 border-l-2 border-amber-400/60 text-left cursor-pointer overflow-hidden"
                              >
                                <span className="block font-body text-[11px] font-semibold text-amber-300/90 truncate">
                                  {quoted?.character_name || 'Deleted message'}
                                </span>
                                <span className="block font-body text-[11px] text-white/50 truncate">
                                  {quoted ? quotePreview(quoted.content) : 'This message is no longer here'}
                                </span>
                              </span>
                            )}

                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt="Shared image"
                                loading="lazy"
                                onClick={(e) => { e.stopPropagation(); setViewingImage(imageUrl); }}
                                className={cn(
                                  "relative block rounded-xl max-h-[260px] w-auto max-w-full object-contain cursor-zoom-in transition-opacity duration-200",
                                  modeMatch ? "opacity-100" : "opacity-60"
                                )}
                              />
                            ) : (
                              <p
                                className={cn(
                                  "relative font-body text-[13.5px] font-medium leading-[1.32] whitespace-pre-wrap break-words [overflow-wrap:anywhere] transition-colors duration-200",
                                  modeMatch ? "text-white" : "text-white/70"
                                )}
                                style={avatarUrl && !imageUrl ? {
                                  textShadow: [
                                    '0 0 1px rgba(0,0,0,1)',
                                    '0 0 2px rgba(0,0,0,1)',
                                    '0 0 3px rgba(0,0,0,1)',
                                    '0 1px 2px rgba(0,0,0,1)',
                                    '0 0 8px rgba(0,0,0,0.95)',
                                    '0 0 16px rgba(0,0,0,0.9)',
                                    '0 0 28px rgba(0,0,0,0.75)',
                                  ].join(', '),
                                } : undefined}
                              >
                                {parsedReply.body}
                              </p>
                            )}

                          </button>
                        )}

                        {(showActions || m.selected) && (
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
                            {showActions && (partyMembers?.length || 0) > 0 && (
                              <span className="font-body text-[10px] text-white/35 truncate min-w-0">
                                {readerNames.length === 0
                                  ? 'Not seen yet'
                                  : readerNames.length === (partyMembers!.length - 1)
                                    ? 'Seen by everyone'
                                    : `Seen by ${readerNames.join(', ')}`}
                              </span>
                            )}
                          </div>
                        )}

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
                

                {/* Who is speaking. The pictures are the same ones used for this
                    player's bubbles, so the tile you pick matches what appears in
                    the chat. Tapping the already-selected tile renames it. */}
                <div className="flex items-stretch gap-2">
                  {([
                    {
                      key: 'ic' as const,
                      active: inCharacter,
                      url: currentUserId ? avatars?.[currentUserId]?.ic : undefined,
                      name: (characterName || 'Character').trim(),
                      ring: 'border-2 border-amber-400/70',
                      tint: 'bg-amber-500/20 text-amber-200',
                    },
                    {
                      key: 'ooc' as const,
                      active: !inCharacter,
                      url: currentUserId ? avatars?.[currentUserId]?.ooc : undefined,
                      name: ((currentUserId && oocNames?.[currentUserId]) || 'You').trim(),
                      ring: 'border-2 border-dashed border-sky-400/70',
                      tint: 'bg-sky-500/20 text-sky-200',
                    },
                  ]).map(tile => (
                    <button
                      key={tile.key}
                      onClick={() => {
                        if (tile.key === 'ic') { setInCharacter(true); return; }
                        // Second tap on the selected table-talk tile opens the rename field.
                        if (!inCharacter && onSetOocName) {
                          setOocNameDraft((currentUserId && oocNames?.[currentUserId]) || '');
                          setEditingOocName(true);
                          return;
                        }
                        setInCharacter(false);
                      }}
                      aria-pressed={tile.active}
                      aria-label={tile.key === 'ic' ? `Speak as ${tile.name}` : `Speak as yourself, ${tile.name}`}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        "relative flex-1 min-w-0 h-20 rounded-xl overflow-hidden transition-all",
                        tile.active ? tile.ring : "border border-white/10 opacity-40 grayscale",
                      )}
                    >
                      {tile.url ? (
                        <img src={tile.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className={cn("absolute inset-0 flex items-center justify-center text-2xl font-semibold", tile.tint)}>
                          {tile.name.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1 pt-2 pb-0.5">
                        <span className="block font-body text-[11px] font-semibold leading-tight text-white/95 truncate">
                          {tile.name}
                        </span>
                      </span>
                    </button>
                  ))}

                </div>

                {editingOocName && onSetOocName && (
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
                    className="w-full px-2 py-2 rounded-lg text-[12px] bg-black/40 border border-sky-400/40 text-sky-100 outline-none"
                  />
                )}

                {replyTo && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5">
                    <Reply className="w-3.5 h-3.5 shrink-0 text-amber-300/70" />
                    <div className="min-w-0 flex-1 border-l-2 border-amber-400/60 pl-2">
                      <p className="font-body text-[11px] font-semibold text-amber-300/90 truncate">
                        Replying to {replyTo.character_name || 'Player'}
                      </p>
                      <p className="font-body text-[11px] text-white/50 truncate">
                        {quotePreview(replyTo.content)}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancel reply"
                      style={{ touchAction: 'manipulation' }}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-white/50 active:bg-white/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                          const file = item.getAsFile();
                          if (file) { e.preventDefault(); sendImage(file); }
                          return;
                        }
                      }
                    }}
                    placeholder={inCharacter ? `Speak as ${characterName || 'your character'}...` : 'Table talk — speak as yourself...'}
                    className="min-h-[38px] max-h-[140px] font-body text-[15px] py-2 resize-none bg-white/5 border-amber-900/30"
                    rows={1}
                  />
                  {onUploadImage && (
                    <>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) sendImage(file);
                        }}
                      />
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImage || sending}
                        aria-label="Share a picture"
                        style={{ touchAction: 'manipulation' }}
                        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/5 text-amber-300/70 active:bg-amber-500/15 disabled:opacity-40"
                      >
                        {uploadingImage
                          ? <Loader2 className="w-5 h-5 animate-spin" />
                          : <ImagePlus className="w-5 h-5" />}
                      </button>
                    </>
                  )}
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

      {viewingImage && createPortal(
        <div
          className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
          style={{ touchAction: 'manipulation' }}
        >
          <img
            src={viewingImage}
            alt="Shared image"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            onClick={() => setViewingImage(null)}
            aria-label="Close image"
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-black/70 border border-white/20 text-white/80"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
