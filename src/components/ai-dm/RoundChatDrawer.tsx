import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Smile, Trash2, MessageSquare, Loader2, CheckCircle2, Hourglass, ImagePlus, Pencil, Check, X, Reply, CornerUpLeft, Stamp, RefreshCw, Drama, Dices } from 'lucide-react';
import { AvatarCropDialog } from './AvatarCropDialog';
import { NpcPortrait } from './NpcPortrait';
import { attitudeLevel, keepNpcRoll, npcsToAsk, parseNpcRoll, rollButtonLabel, type NpcRollRequest } from '@/lib/live-npcs';

import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { parseActionCard } from '@/lib/roundChatActionCard';
import { parseReply, quotePreview, formatReply } from '@/lib/chatReply';
import { QuickActionLine } from './QuickActionCard';
import { PILL, parseDiceRoll } from './chatPlaques';
import homePillPlaque from '@/assets/home/home-pill-plaque.png.asset.json';
import glyphD20Asset from '@/assets/rolls/glyph-d20.png.asset.json';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { supabase } from '@/integrations/supabase/client';
import type { RoundChatMessage, RoundChatReaction, RoundStyle } from '@/hooks/use-round-chat';
import liveChatTablePov from '@/assets/live-chat/live-chat-table-pov.jpg.asset.json';
import returnToStoryBanner from '@/assets/live-chat/return-to-story-banner.jpg';
import actionsBanner from '@/assets/live-chat/actions-banner.jpg';
import sealOpenArt from '@/assets/live-chat/seal-open.png';
import sealSealedArt from '@/assets/live-chat/seal-sealed.png';
import sealedBorderArt from '@/assets/live-chat/sealed-border.png';
import sealedPlaqueArt from '@/assets/live-chat/sealed-border-plaque.png';
import playOrbArt from '@/assets/dock/play-orb.png';
import talkFrameArt from '@/assets/live-chat/composer/talk-frame.png';
import talkPlaqueArt from '@/assets/live-chat/composer/talk-plaque.png';
import characterFrameArt from '@/assets/live-chat/composer/character-frame.png';
import characterPlaqueArt from '@/assets/live-chat/composer/character-plaque.png';
import inputFrameArt from '@/assets/live-chat/composer/input-frame.png';
import pictureButtonArt from '@/assets/live-chat/composer/picture-button.png';
import sendButtonArt from '@/assets/live-chat/composer/send-button.png';
import nameChipArt from '@/assets/live-chat/composer/name-chip.png';
const PLAY_ORB_ART: string | null = playOrbArt;
const SEAL_OPEN_ART: string | null = sealOpenArt;
const SEAL_SEALED_ART: string | null = sealSealedArt;

const TILE_ART = {
  ooc: { frame: talkFrameArt, plaque: talkPlaqueArt, plaqueTop: 1, photoInset: { top: 9, right: 6, bottom: 9, left: 6 }, glow: 'drop-shadow(0 0 6px rgba(56,189,248,0.55))' },
  ic: { frame: characterFrameArt, plaque: characterPlaqueArt, plaqueTop: 4, photoInset: { top: 13, right: 11, bottom: 13, left: 11 }, glow: 'drop-shadow(0 0 6px rgba(245,158,11,0.55))' },
} as const;

if (typeof window !== 'undefined' && SEAL_SEALED_ART) { const img = new Image(); img.src = SEAL_SEALED_ART; }

/**
 * Resolves once every URL has loaded (or failed), or after capMs — whichever is first.
 * Used to warm pictures before they are revealed, never to block the chat forever.
 */
function preloadImages(urls: Array<string | undefined>, capMs: number): Promise<void> {
  const list = urls.filter((u): u is string => !!u);
  if (list.length === 0) return Promise.resolve();
  return new Promise(resolve => {
    let left = list.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, capMs);
    for (const src of list) {
      const img = new Image();
      const settle = () => { left -= 1; if (left <= 0) finish(); };
      img.onload = settle;
      img.onerror = settle;
      img.src = src;
    }
  });
}

/** How long the table scene fades in when the table opens. Change this one number to retime the opening. */
const BACKGROUND_FADE_S = 1.5;
/** Every component appears 0.1 s before the fade finishes, measured from the start of the fade. */
const CONTENT_REVEAL_S = BACKGROUND_FADE_S - 0.1;

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


/**
 * Commands the Party DM screen uses to drive the table. The open/closed state lives
 * inside the drawer, so opening or closing re-renders only the drawer, not the
 * whole Party DM screen.
 */
export interface RoundChatDrawerHandle {
  open: () => void;
  close: () => void;
  /** Adds text to the composer (as the character) and opens the table. */
  openWithDraft: (text: string) => void;
}

interface RoundChatDrawerProps {
  partyId?: string | null;
  messages: RoundChatMessage[];
  reactions: RoundChatReaction[];
  currentUserId?: string;
  characterName: string;
  style: RoundStyle;
  progress: { current: number; waiting: number; speakers?: number; met: boolean };
  sending: boolean;
  isGenerating: boolean;
  isHost: boolean;
  /** Resolve false when the line was not posted: the words go back in the box. */
  onSend: (content: string, inCharacter: boolean) => void | boolean | Promise<void | boolean>;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  /** Host-only: delete every message in the table chat for everyone. */
  onClearAll?: () => void | Promise<void>;
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
  /** Opens the Live DM Table action menu without disturbing the composer draft. */
  onOpenActionMenu?: () => void;
  /** Shared realtime presence from PartyDMScreen. When provided, the drawer uses it instead of its own channel. */
  presenceIds?: Set<string>;
  presenceReady?: boolean;
  /** True once read receipts have been fetched, so the closed-state unread badge never counts early. */
  readReceiptsLoaded?: boolean;
  /** Rendered to the left of the PLAY orb in the collapsed bottom dock (used for the Quick Recap button). */
  dockLeading?: ReactNode;

  // ── Live NPCs (D-22) ──
  /** Every NPC on the party's roster (archived ones too, so their old lines keep a face). */
  npcs?: Array<{ id: string; name: string; portrait_url: string | null; on_stage: boolean; archived: boolean }>;
  /** NPC answers in progress, shown as "Grukk is thinking…". */
  npcThinking?: Array<{ key: string; npcId: string; name: string; messageId: string; kind: 'answer' | 'regenerate' | 'spell' | 'roll' | 'banter' }>;
  /** Post an in-character line and ask these on-stage NPCs to answer it. Resolve false if the line was not posted. */
  onSendToNpcs?: (content: string, npcIds: string[]) => Promise<boolean>;
  /** Original host only: post a line as an on-stage NPC. Resolve false if it was not posted. */
  onSpeakAsNpc?: (content: string, npcId: string) => Promise<boolean>;
  /** Original host only: ask the NPC for a new version of one of its answers. */
  onRegenerateNpcLine?: (messageId: string, npcId: string | null) => void;
  /** Original host only: may edit and delete NPC lines. */
  canManageNpcs?: boolean;
  /** Original host only: opens the NPC Roster. */
  onOpenNpcRoster?: () => void;
  // ── Live NPCs v2 ──
  /** How each NPC feels about this player's character (npc id → -2 … 2). Only NPCs with an opinion are listed. */
  myNpcAttitudes?: Record<string, number>;
  /** Roll the check an NPC asked this player for, then let the NPC react. */
  onNpcRoll?: (npcLineId: string, npcId: string | null, request: NpcRollRequest) => Promise<void>;
  /** Original host only: 2 or 3 on-stage NPCs talk to each other. Resolves false if it did not start. */
  onStartScene?: (npcIds: string[], topic: string, turns: number) => Promise<boolean>;
  /** True while an NPC scene is being written. */
  sceneRunning?: boolean;
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


export const RoundChatDrawer = forwardRef<RoundChatDrawerHandle, RoundChatDrawerProps>(function RoundChatDrawer({
  partyId,
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
  onClearAll,
  onEditMessage,

  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onSendToDMNow,
  orderedSelected,
  onReorderSelected,

  avatars,
  onUploadAvatar,
  onUploadImage,
  oocNames,
  onSetOocName,

  readReceipts,
  partyMembers,
  onMarkRead,
  onOpenActionMenu,
  presenceIds,
  presenceReady,
  readReceiptsLoaded = false,
  dockLeading,
  npcs,
  npcThinking,
  onSendToNpcs,
  onSpeakAsNpc,
  onRegenerateNpcLine,
  canManageNpcs = false,
  onOpenNpcRoster,
  myNpcAttitudes,
  onNpcRoll,
  onStartScene,
  sceneRunning = false,
}, ref) {
  // Open/closed lives here, not in PartyDMScreen: toggling the table re-renders this
  // component only. The parent drives it through the ref handle below.
  const [open, setOpen] = useState(false);
  const onOpenChange = setOpen;

  const [editingOocName, setEditingOocName] = useState(false);
  const [oocNameDraft, setOocNameDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const [text, setText] = useState('');
  const [inCharacter, setInCharacter] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // The table is always full screen while open. Deriving it (instead of setting it in an
  // effect) means the very first open frame is already full size: no in-page → full-screen jump.
  const fullScreen = open;
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
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const revealTimers = useRef<Record<string, number>>({});

  // ── Live NPCs ──
  const npcById = useMemo(() => new Map((npcs || []).map(n => [n.id, n])), [npcs]);
  const stageNpcs = useMemo(() => (npcs || []).filter(n => n.on_stage && !n.archived), [npcs]);
  /** NPCs picked with the Talk to chips. They stay picked, so a conversation needs no extra taps. */
  const [talkTo, setTalkTo] = useState<string[]>([]);
  /** Host only: 'speak' turns the chips into "speak as this NPC". */
  const [npcMode, setNpcMode] = useState<'talk' | 'speak'>('talk');
  const [speakAsId, setSpeakAsId] = useState<string | null>(null);
  // v2: NPC lines a player already answered with a roll (the roll card points back at them).
  const rolledNpcLineIds = useMemo(() => {
    const done = new Set<string>();
    for (const l of messages) {
      if (l.npc_id) continue;
      const replyTo = parseActionCard(l.content).card?.replyTo;
      if (replyTo) done.add(replyTo);
    }
    return done;
  }, [messages]);
  const [rollingLineId, setRollingLineId] = useState<string | null>(null);
  // v2: the host's "Let them talk" panel.
  const [sceneOpen, setSceneOpen] = useState(false);
  const [scenePick, setScenePick] = useState<string[]>([]);
  const [sceneTopic, setSceneTopic] = useState('');
  const [sceneTurns, setSceneTurns] = useState(3);
  // An NPC who leaves the stage drops out of the chips.
  useEffect(() => {
    setTalkTo(prev => {
      const next = prev.filter(id => stageNpcs.some(n => n.id === id));
      return next.length === prev.length ? prev : next;
    });
    setSpeakAsId(prev => (prev && !stageNpcs.some(n => n.id === prev) ? null : prev));
    setScenePick(prev => {
      const next = prev.filter(id => stageNpcs.some(n => n.id === id));
      return next.length === prev.length ? prev : next;
    });
    if (stageNpcs.length < 2) setSceneOpen(false);
  }, [stageNpcs]);

  useEffect(() => () => { Object.values(revealTimers.current).forEach(id => window.clearTimeout(id)); }, []);

  const revealLine = useCallback((id: string) => {
    setRevealedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    window.clearTimeout(revealTimers.current[id]);
    revealTimers.current[id] = window.setTimeout(() => {
      setRevealedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      delete revealTimers.current[id];
    }, 12000);
  }, []);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Presence dots: same heartbeat the player cards on the home screen use.
  // Only members carrying a last-active timestamp can show a dot.
  const membersWithPresence = useMemo(
    () => (partyMembers || []).filter(
      (pm): pm is typeof pm & { updated_at: string } => typeof pm.updated_at === 'string' && pm.updated_at.length > 0,
    ),
    [partyMembers],
  );
  const onlineStatus = useOnlineStatus(membersWithPresence);
  const [livePresenceIds, setLivePresenceIds] = useState<Set<string>>(new Set());
  const [livePresenceReady, setLivePresenceReady] = useState(false);

  // The Live DM Table uses realtime presence so dots react immediately when a
  // player enters or leaves the party screen. Timestamp status remains the
  // fallback while the presence channel connects. When shared presence from
  // PartyDMScreen is provided, it wins and this drawer skips its own channel.
  useEffect(() => {
    if (!partyId || !currentUserId || presenceIds) {
      if (!presenceIds) {
        setLivePresenceIds(new Set());
        setLivePresenceReady(false);
      }
      return;
    }

    const channel = supabase.channel(`round-chat-presence-${partyId}`, {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const presences of Object.values(state)) {
          for (const presence of presences as Array<{ user_id?: string }>) {
            if (presence.user_id) ids.add(presence.user_id);
          }
        }
        setLivePresenceIds(ids);
        setLivePresenceReady(true);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [partyId, currentUserId, presenceIds]);

  // Prefer the shared presence channel from PartyDMScreen when it is connected.
  const sharedReady = presenceIds ? !!presenceReady : livePresenceReady;
  const sharedIds = presenceIds ?? livePresenceIds;

  // Unread badge on the collapsed PLAY banner: other players' lines newer than your
  // read marker. (The open-state `unseen` counter only tracks lines below your scroll.)
  const myLastRead = currentUserId ? readReceipts?.[currentUserId] : undefined;
  const closedUnread = useMemo(() => {
    if (!readReceiptsLoaded || !currentUserId) return 0;
    return messages.filter(m => (m.user_id !== currentUserId || !!m.npc_id) && (!myLastRead || m.created_at > myLastRead)).length;
  }, [messages, currentUserId, myLastRead, readReceiptsLoaded]);

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
    if (!open) setReplyTo(null);
  }, [open]);

  // ── Opening: background first, then everything at once ──
  // Every component renders — fully visible, laid out, scrolled to the newest line and
  // painted — on the very first frame, underneath a curtain. The curtain is the table
  // scene fading in over the dark base. 0.7 s into that 0.8 s fade the curtain is
  // removed, which only uncovers what is already drawn: nothing has to be painted on
  // the reveal frame, so there is no blank flash and no stall.
  const prefersReducedMotion = useReducedMotion();
  const [contentShown, setContentShown] = useState(false);
  const revealTimerRef = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    window.clearTimeout(revealTimerRef.current);
    if (!open) { setContentShown(false); return; }
    if (prefersReducedMotion) { setContentShown(true); return; }
    // Safety net: never leave the curtain down if the fade never starts (fade + 1.5 s).
    const t = window.setTimeout(() => setContentShown(true), (BACKGROUND_FADE_S + 1.5) * 1000);
    return () => window.clearTimeout(t);
  }, [open, prefersReducedMotion]);
  useEffect(() => () => window.clearTimeout(revealTimerRef.current), []);
  /** Starts the reveal clock when the fade actually starts animating, not when the tap happened,
   *  so a slow first frame on an older phone can't eat into the fade. */
  const startRevealClock = useCallback(() => {
    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => setContentShown(true), CONTENT_REVEAL_S * 1000);
  }, []);

  // Warm the pictures the open table needs while it is still collapsed, so nothing pops in late.
  useEffect(() => {
    void preloadImages([returnToStoryBanner, actionsBanner, liveChatTablePov.url], 8000);
  }, []);
  useEffect(() => {
    const urls = Object.values(avatars || {}).flatMap(a => [a?.ic, a?.ooc]);
    void preloadImages(urls, 8000);
  }, [avatars]);

  // Hide the floating "Back to character sheet" shortcut while the round chat
  // is expanded, so it doesn't sit on top of the composer.
  useEffect(() => {
    if (open) document.body.classList.add('round-chat-expanded');
    else document.body.classList.remove('round-chat-expanded');
    return () => document.body.classList.remove('round-chat-expanded');
  }, [open]);


  // Commands for the Party DM screen. Outside suggestions land in the composer so
  // the player can edit before sending.
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    openWithDraft: (draft: string) => {
      if (draft) {
        setText(prev => (prev.trim() ? `${prev.trim()} ${draft}` : draft));
        setInCharacter(true);
      }
      setOpen(true);
    },
  }), []);

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

  // An NPC starting to think shows at the bottom of the feed: follow it if the reader is there.
  const thinkingCount = npcThinking?.length ?? 0;
  useEffect(() => {
    if (open && thinkingCount > 0 && pinnedRef.current) requestAnimationFrame(() => scrollToLatest('smooth'));
  }, [thinkingCount, open]);

  // Opening the drawer always lands on the newest line — scrolled before the first
  // frame is painted, while the components are still under the curtain.
  useLayoutEffect(() => {
    if (open) scrollToLatest('auto');
  }, [open]);

  // …and once more when the curtain lifts, in case pictures changed heights during the fade.
  // (A no-op when nothing moved, so it doesn't force a repaint.)
  useLayoutEffect(() => {
    if (open && contentShown && pinnedRef.current) scrollToLatest('auto');
  }, [contentShown]);

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




  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, RoundChatReaction[]>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, []);
      map.get(r.message_id)!.push(r);
    }
    return map;
  }, [reactions]);

  const nudgeMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const x = messages[i];
      if (x.user_id === currentUserId && !x.npc_id && !x.consumed) return x.selected ? null : x.id;
    }
    return null;
  }, [messages, currentUserId]);

  const triggerHint = 'Seal the lines you want the DM to answer. The host delivers them with Send to DM.';

  /** Compact status line: picked -> thinking -> ready. */
  const dmStatus: { tone: 'queued' | 'thinking' | 'ready'; label: string } | null = (() => {
    if (isGenerating) return { tone: 'thinking', label: 'The DM is thinking…' };
    if (justFinished) return { tone: 'ready', label: 'The DM has replied — scroll up to read the scene.' };
    if (progress.current > 0) {
      return {
        tone: 'queued',
        label: `${progress.current} line${progress.current === 1 ? '' : 's'} sealed${isHost ? ' — tap Send to DM when ready.' : ' — waiting on the host to deliver them.'}`,
      };
    }
    return null;
  })();



  /** Host only, in character: the on-stage NPC the host is speaking as. */
  const speakingAs = canManageNpcs && onSpeakAsNpc && inCharacter && npcMode === 'speak' && speakAsId
    ? (stageNpcs.find(n => n.id === speakAsId) ?? null)
    : null;
  /** Which NPCs will answer the line being typed (most specific wins: @mention, then a reply, then the chips). */
  const npcsAnswering = !speakingAs && inCharacter && onSendToNpcs
    ? npcsToAsk({ text, onStage: stageNpcs, chosenIds: talkTo, replyToNpcId: replyTo?.npc_id ?? null })
    : [];

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const stored = formatReply(replyTo?.id ?? null, trimmed);
    const asking = npcsAnswering.map(n => n.id);
    const draftText = text;
    const draftReply = replyTo;
    setText('');
    // Posting your own line always brings you back to the bottom.
    pinnedRef.current = true;
    setPinned(true);
    const posted = speakingAs && onSpeakAsNpc
      ? await onSpeakAsNpc(stored, speakingAs.id)
      : asking.length > 0 && onSendToNpcs
        ? await onSendToNpcs(stored, asking)
        : await onSend(stored, inCharacter);
    if (posted === false) {
      // Nothing was posted: put the words back so they are not lost.
      setText(prev => (prev.trim() ? prev : draftText));
      setReplyTo(draftReply);
      return;
    }
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
      {/* First-person "seat at the table" scene — anchored to the bottom so the
          hands and phone stay in view at every drawer height */}
      {/* The table scene, always at full strength: behind PLAY when collapsed, and behind
          the components when open. The opening fade happens on the curtain below. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${liveChatTablePov.url})`, backgroundPosition: 'center bottom' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/10" />
      </div>
      {open ? (
        /* Expanded header — RETURN TO STORY banner artwork collapses the table.
           Its own layer, so it's painted under the curtain and just uncovered on reveal. */
        <button
          onClick={() => onOpenChange(false)}
          aria-expanded
          aria-label={style.mode === 'live' ? 'Return to story: close the Live DM Table' : 'Return to story: close the round chat'}
          className={cn(
            "relative block w-full transition-transform active:scale-[0.99]",
            fullScreen && "shrink-0"
          )}
          style={{ touchAction: 'manipulation', minHeight: 44, willChange: 'transform' }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <img
            src={returnToStoryBanner}
            alt=""
            className="w-full h-[65px] object-cover object-center block"
            draggable={false}
          />
          {/* Subtle dark gradient so the badges stay readable over the art */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-black/55 to-transparent" />
          {/* Round progress badge — keeps tick status visible on the artwork */}
          <span className={cn(
            "absolute right-2 top-2 text-[10px] px-1.5 py-0.5 rounded-full border font-cinzel tracking-wide",
            progress.met
              ? "text-emerald-300 border-emerald-400/40 bg-black/60"
              : "text-amber-100 border-amber-400/30 bg-black/60"
          )}>
            {progress.current} sealed
          </span>
          {unseen > 0 && (
            <span className="absolute left-2 top-2 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border border-red-300/40">
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </button>
      ) : (
        /* Collapsed trigger — compact bottom dock with the circular PLAY orb.
           The table-scene background behind the collapsed state shows around it. */
        <div
          className="relative flex items-center justify-center gap-8 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ minHeight: 132 }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          {dockLeading}
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-expanded={false}
            aria-label={style.mode === 'live' ? 'Open the Live DM Table' : 'Open the round chat'}
            className="relative h-[112px] w-[112px] shrink-0 rounded-full transition-transform duration-150 active:scale-[0.93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            style={{ touchAction: 'manipulation' }}
          >
            <span aria-hidden className="pointer-events-none absolute -inset-2 rounded-full bg-amber-500/25 blur-md motion-safe:animate-pulse" />
            {PLAY_ORB_ART ? (
              <img
                src={PLAY_ORB_ART}
                alt=""
                draggable={false}
                className="relative h-full w-full select-none object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <span
                className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-[#caa05a]"
                style={{
                  background: 'radial-gradient(circle at 50% 38%, #f59e0b 0%, #b45309 45%, #3b1d06 80%, #1a0e05 100%)',
                  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.7), 0 6px 14px rgba(0,0,0,0.85)',
                }}
              >
                <span
                  className="font-cinzel text-[22px] font-black tracking-[0.12em] text-[#FFE4AA]"
                  style={{ textShadow: '0 0 8px rgba(245,158,11,0.9), 0 2px 2px rgba(0,0,0,0.95)' }}
                >
                  PLAY
                </span>
              </span>
            )}
            {/* Unread badge */}
            {closedUnread > 0 && (
              <span
                className="absolute -right-1 -top-1 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border border-red-300/40"
                aria-label={`${closedUnread} unread`}
              >
                {closedUnread > 99 ? '99+' : closedUnread}
              </span>
            )}
            {/* Ticked pill — only when lines are ticked */}
            {progress.current > 0 && (
              <span
                className={cn(
                  "absolute left-1/2 -bottom-2 -translate-x-1/2 whitespace-nowrap text-[10px] font-cinzel tracking-wide px-1.5 py-0.5 rounded-full border bg-black/70",
                  progress.met
                    ? "text-emerald-300 border-emerald-400/40"
                    : "text-amber-100 border-amber-400/30"
                )}
              >
                {progress.current} sealed
              </span>
            )}
          </button>
        </div>
      )}



      {open && (
          <div className="relative overflow-hidden flex-1 min-h-0 flex flex-col" style={{ willChange: 'transform' }}>
            <div className="px-2 pb-2 relative flex-1 min-h-0 flex flex-col">
              {/* Status pops + messages */}
              <div className="flex-1 min-h-0 flex flex-col">
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

              {/* Host-only: wipe the whole table chat */}
              {isHost && onClearAll && messages.length > 0 && (
                <div className="mb-1.5 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300 transition-colors hover:bg-red-500/20 active:bg-red-500/25"
                        style={{ touchAction: 'manipulation', minHeight: 48 }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear chat for everyone
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear the table chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This deletes every message in the live chat for everyone in the party. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep messages</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => { void onClearAll(); }}
                        >
                          Delete all
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                  const isNpc = !!m.npc_id;
                  const npc = isNpc ? npcById.get(m.npc_id as string) : undefined;
                  const isSelf = !isNpc && m.user_id === currentUserId;
                  const { card, body } = parseActionCard(m.content);
                  const parsedReply = parseReply(body);
                  // v2: an NPC line may end with a roll request; it is shown as a button, not text.
                  const npcRoll = isNpc && !card ? parseNpcRoll(parsedReply.body) : null;
                  const diceRoll = !card ? parseDiceRoll(parsedReply.body) : null;
                  const quoted = parsedReply.replyToId
                    ? messages.find(mm => mm.id === parsedReply.replyToId)
                    : null;
                  const ownsLine = isSelf || (isNpc && !!quoted && !quoted.npc_id && quoted.user_id === currentUserId);
                  const canChange = (isSelf || (isNpc && canManageNpcs)) && !m.consumed;
                  const imageMatch = parsedReply.body.match(CHAT_IMAGE_REGEX);
                  const imageUrl = imageMatch ? imageMatch[1] : null;
                  const msgReactions = reactionsByMessage.get(m.id) || [];
                  const grouped = msgReactions.reduce<Record<string, RoundChatReaction[]>>((acc, r) => {
                    (acc[r.emoji] ||= []).push(r);
                    return acc;
                  }, {});
                  const nameColor = isNpc ? 'text-amber-200' : m.in_character ? playerColor(m.user_id) : 'text-sky-300/90';
                  // Placement follows the mode, not the sender: every in-character
                  // line (yours included) sits on the right, every table-talk
                  // line on the left. NPC lines sit on the left, facing the party.
                  const alignRight = m.in_character && !isNpc;
                  const avatarUrl = isNpc
                    ? (npc?.portrait_url || undefined)
                    : m.in_character
                      ? avatars?.[m.user_id]?.ic
                      : avatars?.[m.user_id]?.ooc;
                  const modeMatch = m.in_character === inCharacter;
                  const presenceInfo = onlineStatus[m.user_id];
                  const presence = isNpc ? undefined : sharedReady
                    ? (sharedIds.has(m.user_id) ? 'online' as const : 'offline' as const)
                    : presenceInfo
                      ? (presenceInfo.isOnline ? 'online' as const : 'offline' as const)
                      : undefined;

                  // Alter-ego line: who is speaking, and who is playing them.
                  const icName = (m.character_name || 'Player').trim();
                  const oocName = isNpc ? '' : ((oocNames?.[m.user_id]) || '').trim();
                  const primaryName = m.in_character ? icName : (oocName || icName);
                  const secondaryName = m.in_character
                    ? (oocName && oocName.toLowerCase() !== icName.toLowerCase() ? oocName : '')
                    : (icName && icName.toLowerCase() !== (oocName || '').toLowerCase() ? icName : '');

                  // Collapse the header on consecutive lines from the same speaker.
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const stacked = !!prev
                    && prev.user_id === m.user_id
                    && prev.in_character === m.in_character
                    && (prev.npc_id ?? null) === (m.npc_id ?? null);

                  const selectable = !m.consumed;
                  const showActions = actionsFor === m.id;
                  const sealedForOthers = !!m.selected && !m.consumed && !ownsLine && !card && !diceRoll && editingMessageId !== m.id;
                  const veiled = sealedForOthers && !revealedIds.has(m.id);
                  const readerNames = showActions
                    ? (partyMembers || [])
                        .filter(pm => isNpc || pm.user_id !== m.user_id)
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
                          active={modeMatch}
                          presence={presence}
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
                            {isNpc && (
                              <span className="font-body text-[10px] px-1.5 py-[1px] rounded-full shrink-0 bg-amber-500/15 text-amber-200/90 border border-amber-400/30">
                                NPC
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
                        ) : diceRoll ? (
                          <button
                            onClick={() => setActionsFor(showActions ? null : m.id)}
                            style={{ ...PILL(homePillPlaque.url), touchAction: 'manipulation' }}
                            className={cn(
                              "inline-flex items-center gap-1.5 max-w-full whitespace-nowrap text-xs text-amber-50 active:scale-[0.98] transition-transform",
                              m.selected && "drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]",
                              !modeMatch && "opacity-40",
                            )}
                          >
                            <img src={glyphD20Asset.url} alt="" className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-cinzel">{diceRoll.label}</span>
                            <span className="opacity-50">·</span>
                            {diceRoll.rolls.map((r, i) => (
                              <span key={i} className={cn(r.dropped && "line-through opacity-40")}>{r.value}</span>
                            ))}
                            {diceRoll.modifier && <span>{diceRoll.modifier}</span>}
                            <span className="opacity-50">=</span>
                            <span className="font-cinzel text-[15px] text-white">{diceRoll.total}</span>
                            {diceRoll.crit === 'nat20' && (
                              <span className="text-[9px] font-semibold tracking-wider text-amber-300">NAT 20</span>
                            )}
                            {diceRoll.crit === 'nat1' && (
                              <span className="text-[9px] font-semibold tracking-wider text-red-400">NAT 1</span>
                            )}
                            {m.consumed && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
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
                                  const shown = npcRoll ? npcRoll.body : parsedReply.body;
                                  if (!next || next === shown.trim()) { setEditingMessageId(null); return; }
                                  // v2: an NPC's roll request stays on the line when the host edits its words.
                                  await onEditMessage?.(m.id, formatReply(parsedReply.replyToId, npcRoll ? keepNpcRoll(next, parsedReply.body) : next));
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
                        ) : (() => {
                          const bubble = (
                          <button
                            onClick={() => veiled ? revealLine(m.id) : setActionsFor(showActions ? null : m.id)}
                            aria-label={veiled ? `Sealed line from ${primaryName}, hidden. Tap to reveal.` : undefined}
                            style={{ touchAction: 'manipulation' }}
                            className={cn(
                              "relative isolate overflow-hidden text-left rounded-2xl border px-2.5 py-1.5 transition-colors max-w-full min-w-0",
                              alignRight ? "rounded-br-md" : "rounded-bl-md",
                              isNpc
                                ? (modeMatch ? "bg-amber-950/50 border-amber-300/45" : "bg-amber-950/10 border-amber-300/10")
                                : m.in_character
                                ? (isSelf
                                    ? (modeMatch ? "bg-amber-500/25 border-amber-400/50" : "bg-amber-500/[0.06] border-amber-400/10")
                                    : (modeMatch ? "bg-white/[0.12] border-white/25" : "bg-white/[0.02] border-white/[0.05]"))
                                : (modeMatch
                                    ? "bg-sky-500/[0.16] border-sky-300/90 border-dashed ring-1 ring-sky-400/35"
                                    : "bg-sky-500/[0.03] border-sky-400/10 border-dashed"),
                              m.selected && "ring-2 ring-emerald-400/70",
                              imageUrl && "p-1",
                              veiled && "min-w-[200px] min-h-[56px] bg-[#062014]/85 border-emerald-400/35",
                            )}
                          >
                            {avatarUrl && !imageUrl && !veiled ? (
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
                                  modeMatch ? "opacity-100" : "opacity-20"
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
                                  modeMatch ? "opacity-20" : "opacity-[0.04]",
                                  isNpc ? 'bg-amber-600' : playerTint(m.user_id)
                                )}
                              />
                            ) : null}

                            {/* Sent to the DM: a giant green check behind the words but
                                above the background picture. It fades with the mode
                                toggle like everything else. */}
                            {m.consumed && !imageUrl && (
                              <Check
                                aria-hidden="true"
                                strokeWidth={2.5}
                                className={cn(
                                  // Scales with the bubble (up to a cap) so it stays
                                  // obvious even on tall multi-line messages.
                                  "absolute inset-0 m-auto w-[min(80%,140px)] h-[min(80%,140px)] min-w-9 min-h-9 text-emerald-400 pointer-events-none transition-opacity duration-200",
                                  modeMatch ? "opacity-80" : "opacity-25",
                                )}
                              />
                            )}

                            {parsedReply.replyToId && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); veiled ? revealLine(m.id) : jumpToMessage(parsedReply.replyToId!); }}
                                className={cn(
                                  "relative block w-full min-w-0 max-w-full mb-1.5 pl-2 border-l-2 border-amber-400/60 text-left cursor-pointer overflow-hidden",
                                  veiled && "blur-[4px] select-none",
                                )}
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
                                onClick={(e) => { e.stopPropagation(); veiled ? revealLine(m.id) : setViewingImage(imageUrl); }}
                                className={cn(
                                  "relative block rounded-xl max-h-[260px] w-auto max-w-full object-contain cursor-zoom-in transition-opacity duration-200",
                                  modeMatch ? "opacity-100" : "opacity-30",
                                  veiled && "blur-xl",
                                )}
                              />
                            ) : (
                              <p
                                aria-hidden={veiled || undefined}
                                className={cn(
                                  "relative font-body text-[13.5px] font-medium leading-[1.32] whitespace-pre-wrap break-words [overflow-wrap:anywhere] transition-colors duration-200",
                                  modeMatch ? "text-white" : "text-white/45",
                                  veiled && "blur-[5px] opacity-60 select-none",
                                )}
                                style={{
                                  ...(avatarUrl && !imageUrl ? {
                                    textShadow: [
                                      '0 0 1px rgba(0,0,0,1)',
                                      '0 0 2px rgba(0,0,0,1)',
                                      '0 0 3px rgba(0,0,0,1)',
                                      '0 1px 2px rgba(0,0,0,1)',
                                      '0 0 8px rgba(0,0,0,0.95)',
                                      '0 0 16px rgba(0,0,0,0.9)',
                                      '0 0 28px rgba(0,0,0,0.75)',
                                    ].join(', '),
                                  } : {}),
                                  // Thin light outline on the letters of active-mode text only.
                                  ...(modeMatch ? { WebkitTextStroke: '0.4px rgba(255,255,255,0.6)' } : {}),
                                }}
                              >
                                {npcRoll ? npcRoll.body : parsedReply.body}
                              </p>
                            )}

                            {/* Same sent check for shared pictures — drawn on top of
                                the image so it stays visible. */}
                            {m.consumed && imageUrl && (
                              <Check
                                aria-hidden="true"
                                strokeWidth={2.5}
                                className={cn(
                                  "absolute inset-0 m-auto w-[min(80%,140px)] h-[min(80%,140px)] min-w-9 min-h-9 text-emerald-400 pointer-events-none transition-opacity duration-200",
                                  modeMatch ? "opacity-80" : "opacity-25",
                                )}
                              />
                            )}

                            {veiled && <span aria-hidden className="ink-sparkle" />}

                          </button>
                          );

                          return sealedForOthers ? (
                            <div className="relative mx-4 mt-6 mb-4">
                              {bubble}
                              <span
                                aria-hidden
                                className="pointer-events-none absolute -inset-[18px] z-10"
                                style={{ borderStyle: 'solid', borderWidth: 40, borderImage: `url(${sealedBorderArt}) 128 / 40px stretch` }}
                              />
                              {veiled && (
                                <img
                                  src={sealedPlaqueArt}
                                  alt=""
                                  aria-hidden
                                  draggable={false}
                                  className="pointer-events-none absolute left-1/2 -top-[25px] z-20 h-8 w-auto -translate-x-1/2 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                />
                              )}
                            </div>
                          ) : bubble;
                        })()}

                        {/* v2: the roll this NPC asked for. Only the named player gets the button. */}
                        {npcRoll?.roll && (() => {
                          const request = npcRoll.roll;
                          const mine = request.to === currentUserId;
                          const rolled = rolledNpcLineIds.has(m.id);
                          const label = rollButtonLabel(request);
                          return (
                            <div className="mt-1 px-1 flex">
                              {mine && !rolled && !m.consumed && onNpcRoll ? (
                                <button
                                  type="button"
                                  disabled={rollingLineId === m.id}
                                  onClick={async () => {
                                    setRollingLineId(m.id);
                                    try { await onNpcRoll(m.id, m.npc_id ?? null, request); } finally { setRollingLineId(null); }
                                  }}
                                  aria-label={`Roll ${label} for ${m.character_name || 'the NPC'}`}
                                  style={{ touchAction: 'manipulation' }}
                                  className="inline-flex items-center gap-1.5 min-h-[40px] rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-500/30 to-amber-700/30 px-3.5 font-cinzel text-[12px] font-bold tracking-wide text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.35)] active:scale-95 transition-transform disabled:opacity-50"
                                >
                                  {rollingLineId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
                                  Roll {label}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 min-h-[28px] rounded-full border border-white/10 bg-black/40 px-2.5 font-body text-[11px] text-white/60">
                                  <Dices className="w-3.5 h-3.5 text-amber-300/70" />
                                  {mine ? (rolled ? `You rolled ${label}` : label) : `${request.name}: ${label}${rolled ? ' · rolled' : ''}`}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {(selectable || m.consumed || showActions) && (
                          <div className={cn(
                            "flex items-center gap-1.5 mt-1 px-1",
                            alignRight && "flex-row-reverse",
                          )}>
                            {selectable ? (
                              <button
                                type="button"
                                onClick={() => onToggleSelected(m.id)}
                                role="checkbox"
                                aria-checked={!!m.selected}
                                aria-label={m.selected ? 'Unseal this line. It will not go to the DM.' : 'Seal this line for the DM. The host sends sealed lines to the DM.'}
                                style={{ touchAction: 'manipulation' }}
                                className={cn(
                                  "relative shrink-0 inline-flex items-center gap-1.5 min-h-[32px] rounded-full border pl-1 pr-3 py-1 font-cinzel text-[11px] tracking-wide transition-all duration-150 active:scale-95",
                                  m.selected
                                    ? "border-emerald-400/70 bg-gradient-to-b from-[#0f3d22] to-[#062014] text-emerald-50 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                                    : "border-amber-500/45 bg-black/55 text-amber-200/85",
                                )}
                              >
                                {m.id === nudgeMessageId && (
                                  <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-amber-400/60 motion-safe:animate-pulse" />
                                )}
                                <motion.span
                                  key={m.selected ? 'sealed' : 'open'}
                                  initial={{ scale: 1.35 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                                  className="shrink-0"
                                >
                                  {m.selected ? (
                                    SEAL_SEALED_ART ? (
                                      <img src={SEAL_SEALED_ART} alt="" draggable={false} className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                                    ) : (
                                      <Stamp className="h-6 w-6 shrink-0 text-emerald-300" />
                                    )
                                  ) : SEAL_OPEN_ART ? (
                                    <img src={SEAL_OPEN_ART} alt="" draggable={false} className="h-6 w-6 shrink-0 object-contain" />
                                  ) : (
                                    <Stamp className="h-6 w-6 shrink-0 text-amber-300/80" />
                                  )}
                                </motion.span>
                                {m.selected ? 'Sealed for DM' : 'Seal for DM'}
                              </button>
                            ) : (
                              <span className="font-body shrink-0 flex items-center gap-1 text-[10px] text-emerald-300/50">
                                <Check className="w-3 h-3" /> delivered
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
                                {isNpc && canManageNpcs && !m.consumed && parsedReply.replyToId && onRegenerateNpcLine && (
                                  <button
                                    onClick={() => { onRegenerateNpcLine(m.id, m.npc_id ?? null); setActionsFor(null); }}
                                    className="p-1 text-white/40 active:text-amber-300"
                                    style={{ touchAction: 'manipulation' }}
                                    aria-label={`Ask ${m.character_name || 'the NPC'} for a new answer`}
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                                {canChange && !card && onEditMessage && (
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(editingMessageId === m.id ? null : m.id);
                                      setEditDraft(npcRoll ? npcRoll.body : parsedReply.body);
                                      setActionsFor(null);
                                    }}
                                    className="p-1 text-white/40 active:text-emerald-300"
                                    style={{ touchAction: 'manipulation' }}
                                    aria-label="Edit message"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )}
                                {canChange && (
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
                {(npcThinking || []).map(t => (
                  <div key={t.key} className="mt-2 flex items-end gap-1.5" aria-live="polite">
                    <NpcPortrait url={npcById.get(t.npcId)?.portrait_url} name={t.name} className="w-10 h-10 text-[13px]" />
                    <div className="rounded-2xl rounded-bl-md border border-amber-300/30 bg-amber-950/40 px-3 py-2 flex items-center gap-2">
                      <span aria-hidden className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-200/80 motion-safe:animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-200/80 motion-safe:animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-200/80 motion-safe:animate-bounce [animation-delay:300ms]" />
                      </span>
                      <span className="font-body text-[12px] text-amber-100/85">
                        {t.kind === 'regenerate' ? `${t.name} is rethinking…` : t.kind === 'banter' ? `${t.name} is in the scene…` : t.kind === 'spell' ? `${t.name} saw the spell…` : `${t.name} is thinking…`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
                <div className="space-y-1.5">
                <div className="flex items-stretch gap-2 pt-0.5">
                  {([
                    {
                      key: 'ooc' as const,
                      active: !inCharacter,
                      url: currentUserId ? avatars?.[currentUserId]?.ooc : undefined,
                      name: ((currentUserId && oocNames?.[currentUserId]) || 'You').trim(),
                      tint: 'bg-sky-500/20 text-sky-200',
                    },
                    {
                      key: 'ic' as const,
                      active: inCharacter,
                      url: currentUserId ? avatars?.[currentUserId]?.ic : undefined,
                      name: (characterName || 'Character').trim(),
                      tint: 'bg-amber-500/20 text-amber-200',
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
                      style={{
                        touchAction: 'manipulation',
                        filter: tile.active ? TILE_ART[tile.key].glow : undefined,
                      }}
                      className={cn(
                        "relative flex-1 min-w-0 h-24 overflow-hidden transition-[opacity,filter] duration-200",
                        !tile.active && "opacity-45 grayscale",
                      )}
                    >
                      {tile.url ? (
                        <span
                          className="absolute overflow-hidden bg-black/60"
                          style={TILE_ART[tile.key].photoInset}
                        >
                          <img
                            src={tile.url}
                            alt=""
                            draggable={false}
                            className="h-full w-full object-cover object-center select-none"
                          />
                        </span>
                      ) : (
                        <span
                          className={cn("absolute flex items-center justify-center text-2xl font-semibold", tile.tint)}
                          style={TILE_ART[tile.key].photoInset}
                        >
                          {tile.name.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          borderStyle: 'solid',
                          borderWidth: 28,
                          borderImage: `url(${TILE_ART[tile.key].frame}) 100 / 28px stretch`,
                        }}
                      />
                      <img
                        src={TILE_ART[tile.key].plaque}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-[calc(100%-60px)] max-w-[170px] h-auto select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
                        style={{ top: TILE_ART[tile.key].plaqueTop }}
                      />
                      {tile.key === 'ic' && (
                        <span
                          className="absolute inset-x-0 bottom-[15px] text-center font-body text-[11px] font-semibold text-white truncate px-8"
                          style={{ textShadow: '0 1px 2px #000, 0 0 6px #000' }}
                        >
                          {tile.name}
                        </span>
                      )}
                      {tile.key === 'ooc' && (onSetOocName ? (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Rename yourself (currently ${tile.name})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!onSetOocName) return;
                            setOocNameDraft((currentUserId && oocNames?.[currentUserId]) || '');
                            setEditingOocName(true);
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && onSetOocName) {
                              e.preventDefault();
                              e.stopPropagation();
                              setOocNameDraft((currentUserId && oocNames?.[currentUserId]) || '');
                              setEditingOocName(true);
                            }
                          }}
                          className="absolute left-1/2 -translate-x-1/2 bottom-[13px] h-5 flex items-center"
                          style={{ aspectRatio: '300 / 63', backgroundImage: `url(${nameChipArt})`, backgroundSize: '100% 100%', paddingLeft: '22%', paddingRight: '8%', touchAction: 'manipulation' }}
                        >
                          <span className="font-body text-[10.5px] font-semibold text-sky-100 truncate" style={{ textShadow: '0 1px 1px #000' }}>{tile.name}</span>
                        </span>
                      ) : (
                        <span
                          className="absolute left-1/2 -translate-x-1/2 bottom-[13px] h-5 flex items-center"
                          style={{ aspectRatio: '300 / 63', backgroundImage: `url(${nameChipArt})`, backgroundSize: '100% 100%', paddingLeft: '22%', paddingRight: '8%', touchAction: 'manipulation' }}
                        >
                          <span className="font-body text-[10.5px] font-semibold text-sky-100 truncate" style={{ textShadow: '0 1px 1px #000' }}>{tile.name}</span>
                        </span>
                      ))}
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
                </div>

                {/* The input field (reply chip, text box, picture + send, actions banner). */}
                <div className="space-y-1.5">

                {/* Live NPCs: pick who you are talking to. The host can also speak as an NPC. */}
                {inCharacter && npcs && (stageNpcs.length > 0 || (canManageNpcs && onOpenNpcRoster)) && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                      {stageNpcs.length > 0 && (canManageNpcs && onSpeakAsNpc ? (
                        <button
                          onClick={() => setNpcMode(mode => (mode === 'talk' ? 'speak' : 'talk'))}
                          aria-label={npcMode === 'talk' ? 'Talking to NPCs. Tap to speak as an NPC instead.' : 'Speaking as an NPC. Tap to talk to NPCs instead.'}
                          style={{ touchAction: 'manipulation' }}
                          className={cn(
                            "shrink-0 min-h-[36px] px-2.5 rounded-full border font-cinzel text-[11px] transition-colors",
                            npcMode === 'speak' ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : "border-white/15 bg-black/50 text-white/70",
                          )}
                        >
                          {npcMode === 'speak' ? 'Speak as' : 'Talk to'}
                        </button>
                      ) : (
                        <span className="shrink-0 pl-1 font-cinzel text-[11px] text-white/55">Talk to</span>
                      ))}
                      {stageNpcs.map(n => {
                        const voicing = npcMode === 'speak' && canManageNpcs && !!onSpeakAsNpc;
                        const picked = voicing ? speakAsId === n.id : talkTo.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              if (voicing) setSpeakAsId(prev => (prev === n.id ? null : n.id));
                              else setTalkTo(prev => (prev.includes(n.id) ? prev.filter(x => x !== n.id) : [...prev, n.id]));
                            }}
                            aria-pressed={picked}
                            aria-label={voicing ? `Speak as ${n.name}` : `Talk to ${n.name}`}
                            style={{ touchAction: 'manipulation' }}
                            className={cn(
                              "shrink-0 min-h-[36px] pl-0.5 pr-2.5 rounded-full border flex items-center gap-1.5 font-body text-[12px] transition-colors",
                              picked
                                ? (voicing ? "border-rose-300/80 bg-rose-500/25 text-white" : "border-amber-300/80 bg-amber-500/25 text-white shadow-[0_0_8px_rgba(245,158,11,0.45)]")
                                : "border-white/15 bg-black/50 text-white/75",
                            )}
                          >
                            <NpcPortrait url={n.portrait_url} name={n.name} className="w-8 h-8 text-[12px]" />
                            <span className="max-w-[110px] truncate">{n.name}</span>
                            {!voicing && myNpcAttitudes && myNpcAttitudes[n.id] !== undefined && (() => {
                              const level = attitudeLevel(myNpcAttitudes[n.id]);
                              return (
                                <span
                                  className="shrink-0 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white/75"
                                  aria-label={`${n.name} feels ${level.label} toward you`}
                                >
                                  {level.emoji} {level.label}
                                </span>
                              );
                            })()}
                          </button>
                        );
                      })}
                      {canManageNpcs && onStartScene && stageNpcs.length >= 2 && (
                        <button
                          onClick={() => {
                            setSceneOpen(open => !open);
                            setScenePick(prev => (prev.length >= 2 ? prev : stageNpcs.slice(0, 3).map(n => n.id)));
                          }}
                          aria-expanded={sceneOpen}
                          disabled={sceneRunning}
                          style={{ touchAction: 'manipulation' }}
                          className={cn(
                            "shrink-0 min-h-[36px] px-2.5 rounded-full border font-body text-[11px] flex items-center gap-1 disabled:opacity-50",
                            sceneOpen ? "border-amber-300/80 bg-amber-500/25 text-white" : "border-amber-400/40 bg-black/50 text-amber-200/85",
                          )}
                        >
                          {sceneRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Drama className="w-3.5 h-3.5" />}
                          {sceneRunning ? 'Scene running…' : 'Let them talk'}
                        </button>
                      )}
                      {canManageNpcs && onOpenNpcRoster && (
                        <button
                          onClick={onOpenNpcRoster}
                          style={{ touchAction: 'manipulation' }}
                          className="shrink-0 min-h-[36px] px-2.5 rounded-full border border-dashed border-amber-400/40 font-body text-[11px] text-amber-200/80 flex items-center gap-1"
                        >
                          <Drama className="w-3.5 h-3.5" />
                          {stageNpcs.length ? 'Roster' : 'NPC Roster: nobody on stage'}
                        </button>
                      )}
                    </div>
                    {sceneOpen && canManageNpcs && onStartScene && stageNpcs.length >= 2 && (
                      <div className="rounded-xl border border-amber-400/30 bg-black/70 p-2.5 space-y-2">
                        <p className="font-body text-[11px] text-amber-100/80">
                          Pick 2 or 3 NPCs. They talk to each other while everyone watches. Any player line stops the scene.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {stageNpcs.map(n => {
                            const on = scenePick.includes(n.id);
                            return (
                              <button
                                key={n.id}
                                onClick={() => setScenePick(prev => (on ? prev.filter(x => x !== n.id) : prev.length >= 3 ? prev : [...prev, n.id]))}
                                aria-pressed={on}
                                style={{ touchAction: 'manipulation' }}
                                className={cn(
                                  "min-h-[36px] pl-0.5 pr-2.5 rounded-full border flex items-center gap-1.5 font-body text-[12px]",
                                  on ? "border-amber-300/80 bg-amber-500/25 text-white" : "border-white/15 bg-black/50 text-white/70",
                                )}
                              >
                                <NpcPortrait url={n.portrait_url} name={n.name} className="w-7 h-7 text-[11px]" />
                                <span className="max-w-[100px] truncate">{n.name}</span>
                              </button>
                            );
                          })}
                        </div>
                        <input
                          value={sceneTopic}
                          onChange={(e) => setSceneTopic(e.target.value)}
                          maxLength={500}
                          placeholder="What are they talking about? (optional)"
                          className="w-full min-h-[40px] rounded-lg bg-black/50 border border-white/15 px-3 text-[14px] text-white/90 placeholder:text-white/35 outline-none focus:border-amber-400/60"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="font-body text-[11px] text-white/55">Lines</span>
                          {[2, 3, 4].map(t => (
                            <button
                              key={t}
                              onClick={() => setSceneTurns(t)}
                              aria-pressed={sceneTurns === t}
                              style={{ touchAction: 'manipulation' }}
                              className={cn(
                                "w-10 min-h-[36px] rounded-md border text-[13px]",
                                sceneTurns === t ? "border-amber-300/80 bg-amber-500/25 text-white" : "border-white/15 text-white/60",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                          <button
                            onClick={async () => {
                              const ok = await onStartScene(scenePick, sceneTopic.trim(), sceneTurns);
                              if (ok) { setSceneOpen(false); setSceneTopic(''); }
                            }}
                            disabled={scenePick.length < 2 || sceneRunning}
                            style={{ touchAction: 'manipulation' }}
                            className="ml-auto min-h-[40px] px-4 rounded-lg border border-amber-400/60 bg-amber-500/25 font-cinzel text-[13px] text-amber-100 disabled:opacity-40"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    )}
                    {speakingAs ? (
                      <p className="px-1 font-body text-[10.5px] text-rose-200/80">You are speaking as {speakingAs.name}.</p>
                    ) : npcsAnswering.length > 0 ? (
                      <p className="px-1 font-body text-[10.5px] text-amber-200/80">
                        {npcsAnswering.map(n => n.name).join(' and ')} will answer. Type @Name to ask someone else.
                      </p>
                    ) : stageNpcs.length > 0 ? (
                      <p className="px-1 font-body text-[10.5px] text-white/45">
                        {npcMode === 'speak' && canManageNpcs && onSpeakAsNpc ? 'Tap a name to speak as them.' : 'Tap a name to talk to them, or type @Name.'}
                      </p>
                    ) : null}
                  </div>
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
                  <div
                    className="flex-1 min-w-0 transition-[filter] focus-within:[filter:drop-shadow(0_0_6px_rgba(245,158,11,0.45))]"
                    style={{ borderStyle: 'solid', borderWidth: 12, borderImage: `url(${inputFrameArt}) 40 fill / 12px stretch` }}
                  >
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
                      placeholder={speakingAs ? `Speak as ${speakingAs.name}...` : inCharacter ? `Speak as ${characterName || 'your character'}...` : 'Speak as yourself...'}
                      className="min-h-[24px] max-h-[116px] font-body text-[15px] px-1.5 py-1 resize-none bg-transparent border-0 shadow-none rounded-none text-stone-100 placeholder:text-amber-100/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                      rows={1}
                    />
                  </div>
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
                        className="relative shrink-0 w-11 h-11 active:scale-95 transition-transform disabled:opacity-40"
                      >
                        <img src={pictureButtonArt} alt="" draggable={false} className="h-full w-full select-none" />
                        {uploadingImage && <Loader2 className="absolute inset-0 m-auto w-5 h-5 animate-spin text-amber-200" />}
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="relative shrink-0 w-11 h-11 active:scale-95 transition-transform disabled:opacity-40"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Send round chat message"
                  >
                    <img src={sendButtonArt} alt="" draggable={false} className="h-full w-full select-none" />
                  </button>
                </div>
                {onOpenActionMenu && (
                  <button
                    type="button"
                    onClick={onOpenActionMenu}
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Open actions: roll dice, fight, spells, stats, quests"
                    className="relative h-[90px] min-h-[44px] w-full overflow-hidden rounded-lg border border-amber-500/30 bg-muted/40 active:brightness-110"
                  >
                    <img
                      src={actionsBanner}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  </button>
                )}
                </div>
              </div>
            </div>
          </div>
      )}

      {/* The curtain. While the table scene fades in, this covers the components, which
          are already fully rendered and painted on their own layers underneath. At 0.7 s
          it is removed in one frame: the components are uncovered, not drawn, so the
          reveal is instant with no blank flash. It also swallows taps while it's down. */}
      {open && !contentShown && (
        <div
          aria-hidden
          className="absolute inset-0 z-20 bg-[#0b0b10]"
          style={{ willChange: 'opacity' }}
        >
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: BACKGROUND_FADE_S, ease: 'easeOut' }}
            onAnimationStart={startRevealClock}
          >
            <div
              className="absolute inset-0 bg-cover bg-no-repeat"
              style={{ backgroundImage: `url(${liveChatTablePov.url})`, backgroundPosition: 'center bottom' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/10" />
          </motion.div>
        </div>
      )}

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
});
