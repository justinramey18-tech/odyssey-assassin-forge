import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { firePendingNat20Fanfare } from '@/lib/critSound';
import { SCOPED_KEYS } from '@/lib/scoped-keys';
import { useDmPolls } from '@/hooks/use-dm-polls';
import { useNPCAutocomplete } from '@/hooks/use-npc-autocomplete';
import { PartyDMInput, type PartyDMInputHandle } from './PartyDMInput';
import { PartyDMAudioRecorder } from './PartyDMAudioRecorder';
import partyChatIcon from '@/assets/party-chat-icon.jpg';
import empyreanSpeaksImg from '@/assets/empyrean-speaks.jpg';
import empyreanDmBg from '@/assets/empyrean-dm-bg.jpg';
import BurnoutFlameOverlay from '@/components/empyrean/BurnoutFlameOverlay';
import CinematicSlideshow from '@/components/empyrean/CinematicSlideshow';
import EmpyreanContextualActions from '@/components/empyrean/EmpyreanContextualActions';
import { setIsUnbonded } from '@/lib/dragonBondState';
import DeathSaveScreen from '@/components/empyrean/DeathSaveScreen';
import MemorialScreen from '@/components/empyrean/MemorialScreen';
import { EMPYREAN_FEATURE_FLAGS } from '@/lib/empyreanFeatureFlags';

import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { GeraltGameplayWidget } from './GeraltGameplayWidget';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Crown, Send, Users, Check, CheckCheck, Zap, Eye, EyeOff, X, Shield, Loader2, Pencil, Trash2, Copy, RefreshCw, MoreVertical, Film, Image as ImageIcon, Plus, Save, Volume2, VolumeX, GitBranch, Heart, Bird, ChevronDown, ChevronRight, Timer, Ghost, Lock, Maximize2, Minimize2, Radio, MessageSquare, Paperclip, Camera, BarChart3, PawPrint, Bookmark, BookmarkCheck, Music, Play, Pause, MessageCircle, SmilePlus, Theater, Megaphone, Swords, UserCog } from 'lucide-react';
import { loadState as loadGeraltState } from '@/components/companion/geralt-data';
import { SplitInitiator, SplitBanner, RegroupDialog, SplitSummariesViewer, PreSplitChatViewer } from './PartySplitUI';
import { InfinityStoneDMDrawer } from './InfinityStoneDMDrawer';
import { WhisperTray } from './WhisperTray';
import { OraclePanel } from '@/components/oracle/OraclePanel';
import { PartyDMSettings } from './PartyDMSettings';
import { usePartyChatBackground } from '@/hooks/use-party-chat-background';
import { PartyMemoryAnchorsPanel } from './PartyMemoryAnchorsPanel';
import { PartyQuestsPanel } from './PartyQuestsPanel';
import { usePartyQuests } from '@/hooks/use-party-quests';
import { useQuestRewardSplit } from '@/hooks/use-quest-reward-split';
import { usePartyNarrationStyle } from '@/hooks/use-party-narration-style';
import { useRoundChat } from '@/hooks/use-round-chat';
import { RoundChatDrawer } from './RoundChatDrawer';
import { narrationStyleLine } from '@/lib/narrationStyle';
import { withQuestEvent, WorldStateEntry, buildQuestKickoffPrompt } from '@/lib/quests';

import { DMComposePanel } from './DMComposePanel';
import { DraftReviewPanel } from './DraftReviewPanel';
import { NpcSceneDialog } from './NpcSceneDialog';
import { DevAssistantChat } from '@/components/settings/DevAssistantChat';
import { StoryMasterworkActions } from './StoryMasterworkActions';
import { DMSpotifyControls } from '@/components/spotify/DMSpotifyControls';

import { useAlignmentDrift } from '@/hooks/useAlignmentDrift';
import { getScopedItem } from '@/lib/scoped-storage';
import { loadApiKey, isFeatureSkipped } from '@/lib/api-keys';

import { DMBottomNav, DMNavTab } from './DMBottomNav';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { toast } from 'sonner';
import { sendTelegramNotification } from '@/lib/telegram-notify';
import { useNarrator } from '@/hooks/use-narrator';
import { useMessageNarration, type MessageAudioRow } from '@/hooks/use-message-narration';
import { MessageNarrationButton } from './MessageNarrationButton';
import { useSpotify } from '@/hooks/use-spotify';
import { subscribeToPush, unsubscribeFromPush, getPushSubscriptionState, type PushSubscriptionState } from '@/lib/push-subscription';
import { useAuth } from '@/hooks/use-auth';
import { loadSelectedModel, saveSelectedModel } from '@/lib/dm-models';
import { NarrationSpeedPopover } from './NarrationSpeedPopover';
import type { usePartyDm, PartyDmMessage, PartyDmPrompt } from '@/hooks/use-party-dm';
import { DMDiceRoller } from './DMDiceRoller';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { parseRollHint } from '@/lib/whisperRollHint';
import { resolveWhisperAutoRoll, performWhisperRoll } from '@/lib/whisperAutoRoll';
import { PartyDMQuickActions } from './PartyDMQuickActions';
import { useHealingItemAction } from '@/hooks/use-healing-item';
import { RoundTimer, TimerSettings } from './RoundTimer';
import { AfkPersonalityGuide } from './AfkPersonalityGuide';
import { ScheduledEventsSheet } from './ScheduledEventsSheet';
import type { CharacterContext } from '@/components/oracle/types';
import type { CampaignSession } from '@/hooks/use-campaign-sessions';
import { useWhisperTrayEnabled } from '@/hooks/use-whisper-tray-enabled';
import { useCinematicMode } from '@/hooks/use-cinematic-mode';
import { parseResponseIntoSlides, stripCinematicTags, parseBeatsIntoSlides } from '@/lib/parseSlides';
import { preloadAudioFiles, extractAudioNames } from '@/lib/slideshowAudioLoader';
import { getCtx as getAudioCtx } from '@/lib/slideshowAudioEngine';
import { useBroadcastPlaylist } from '@/hooks/use-broadcast-playlist';
import type { UseWildShapeReturn } from '@/hooks/use-wild-shape';
import { WildShapeSection } from '@/components/drawers/QuickActionsDrawer';
import { usePartyDragonBonds } from '@/hooks/use-party-dragon-bonds';
import { DragonRiderSetupSheet } from './DragonRiderSetupSheet';
import PartyDragonChat from './PartyDragonChat';
import DragonTelegramScheduler from './DragonTelegramScheduler';
import { Flame } from 'lucide-react';
import type { SwipeHandlers } from '@/components/empyrean/EmpyreanDMContainer';

import { parseWhispers } from '@/lib/whisper-parser';
import { formatForReadingMode, type FormattedReading } from '@/lib/reading-mode-formatter';
import { SoloCharacterSheet, type SheetTab } from '@/components/ai-dm/SoloCharacterSheet';
import { CharacterSheetStrip } from '@/components/ai-dm/CharacterSheetStrip';
import { PartyMemberSheets } from '@/components/party/PartyMemberSheets';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';
import { loadPendingDmItems } from '@/lib/pendingDmItems';
import { DiceRollOverlay } from '@/components/ai-dm/DiceRollOverlay';

function stripCinematicTagsFromDisplay(content: string): string {
  return content.replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '');
}

type PartyDmReturn = ReturnType<typeof usePartyDm>;

interface PartyDMScreenProps {
  onBack: () => void;
  /** Re-read the DM's latest response and pull quests out of it. */
  onScanQuests?: () => void;
  /** Shared, irreversible story outcomes shown on the quest board. */
  worldState?: WorldStateEntry[];
  partyId?: string | null;
  partyDm: PartyDmReturn;
  isCreator: boolean;
  isOriginalCreator?: boolean;
  coHostIds?: string[];
  onPromoteCoHost?: (userId: string) => void;
  onDemoteCoHost?: (userId: string) => void;
  currentUserId?: string;
  memberCount: number;
  members: Array<{ user_id: string; character_name: string; character_status?: Record<string, unknown> }>;
  onShowGuides?: () => void;
  onShowCharacterGuideBuilder?: () => void;
  
  onShowSaves?: () => void;
  onShowChat?: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  isExtracting?: boolean;
  guidesCount?: number;
  guides?: Array<{ id: string; name: string; content: string; enabled: boolean; createdAt?: string; updatedAt?: string }>;
  gmGuidesContent?: string;
  memoryAnchorsContent?: string;
  memoryAnchors?: import('@/hooks/use-dm-game-state').MemoryAnchor[];
  onAddMemoryAnchor?: (anchor: Omit<import('@/hooks/use-dm-game-state').MemoryAnchor, 'id' | 'turn' | 'created_at'>) => void;
  onRemoveMemoryAnchor?: (id: string) => void;
  characterContext?: CharacterContext;
  currentXP?: number;
  onManualLevelUp?: () => void;
  onAcceptItem?: (name: string, quantity: number) => void;
  onOpenCharacterPicker?: () => void;
  // Campaign dropdown props (creator-only)
  campaignSessions?: CampaignSession[];
  campaignSessionsLoading?: boolean;
  campaignSessionsSignedIn?: boolean;
  onNewGame?: () => void;
  onLoadCampaign?: (session: CampaignSession) => void;
  onRefreshCampaigns?: () => void;
  /** Wild Shape hook instance (for Momo Moon Druid) */
  wildShape?: UseWildShapeReturn;
  /** Whether this character is a Momo Moon Druid */
  isMomoMoonDruid?: boolean;
  onShowOocChat?: () => void;
  onHPChange?: (change: number, type: 'damage' | 'healing') => void;
  /** Applies a short/long rest to this player's own character. */
  onRestOccurred?: (type: 'short' | 'long') => void;
  /** Decrement a consumable by name. Returns false when it is not in inventory. */
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
  swipeHandlers?: SwipeHandlers;
  /** Player redo request (non-host only, when eligible) */
  onRequestCharacterRedo?: () => void;
  hasPendingRedoRequest?: boolean;
}

const EMPTY_DRAGON_NETWORK: never[] = [];
const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];
const PARTY_MOOD_PRESETS = ['combat', 'exploration', 'social', 'downtime'];

function formatAutoSaveTime(date: Date): string {

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMemberColor(userId: string, members: Array<{ user_id: string }>): string {
  const idx = members.findIndex(m => m.user_id === userId);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
}

const PARTY_VIDEO_REGEX = /^\s*\[video:(https?:\/\/.+)\]\s*$/;
const PARTY_IMAGE_REGEX = /^\s*\[image:(https?:\/\/.+)\]\s*$/;
const PARTY_AUDIO_REGEX = /^\s*\[audio:(https?:\/\/.+)\]\s*$/;

function AudioMessagePlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-black/30 border border-amber-900/20 rounded-xl px-3 py-2 max-w-[260px]">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-amber-900/40 border border-amber-500/30 flex items-center justify-center shrink-0 hover:bg-amber-900/60 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-amber-400" />
        ) : (
          <Play className="w-4 h-4 text-amber-400 ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500/60 rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/50">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />
    </div>
  );
}
const AFK_LINE_REGEX = /^(\[.+?\]) (?:\(AFK(?:\s*—\s*Cascade Prompt)?\): .+|: Holds their action)$/;
// Detect autopilot lines: [Name]: <<...  (may be single-line or start of multi-line)
const AUTOPILOT_START_REGEX = /^\[(.+?)\]:\s*<</;

function highlightAfkNames(children: React.ReactNode, afkNames: string[]): React.ReactNode {
  if (!afkNames.length) return children;
  const processNode = (node: React.ReactNode, key?: number): React.ReactNode => {
    if (typeof node === 'string') {
      const pattern = new RegExp(`\\b(${afkNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
      const parts = node.split(pattern);
      if (parts.length === 1) return node;
      return parts.map((part, i) =>
        afkNames.some(n => n.toLowerCase() === part.toLowerCase()) ? (
          <span key={i} className="inline-flex items-center gap-0.5">
            <Ghost className="w-3 h-3 text-purple-400 inline" />
            <span className="text-purple-300 font-medium">{part}</span>
          </span>
        ) : part
      );
    }
    if (Array.isArray(node)) return node.map((child, i) => processNode(child, i));
    return node;
  };
  return processNode(children);
}

/** Extract AFK character names from raw content before stripping */
function extractAfkNames(rawContent: string): string[] {
  const names: string[] = [];
  for (const line of rawContent.split('\n')) {
    // Standard AFK line
    if (AFK_LINE_REGEX.test(line)) {
      const nameMatch = line.match(/^\[(.+?)\]/);
      if (nameMatch) names.push(nameMatch[1]);
    }
    // Autopilot line (<<...>>)
    const autopilotMatch = line.match(AUTOPILOT_START_REGEX);
    if (autopilotMatch) {
      names.push(autopilotMatch[1]);
    }
  }
  return [...new Set(names)];
}

/** Strip AFK guide text lines and autopilot <<...>> blocks, keeping only non-AFK content */
function stripHidden(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipping = false;
  let skippingAutopilot = false;
  for (const line of lines) {
    // Start of autopilot block: [Name]: <<...
    if (!skippingAutopilot && AUTOPILOT_START_REGEX.test(line)) {
      skippingAutopilot = true;
      // Check if the closing >> is on the same line
      if (line.includes('>>')) {
        skippingAutopilot = false;
      }
      continue;
    }
    // Inside autopilot block, skip until we find >>
    if (skippingAutopilot) {
      if (line.includes('>>')) {
        skippingAutopilot = false;
      }
      continue;
    }
    if (AFK_LINE_REGEX.test(line)) {
      skipping = true;
      continue;
    }
    // A new player prompt line starts with [Name]: or [Name] (
    if (skipping && /^\[.+?\][\s:]/.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      result.push(line);
    }
  }
  return result.join('\n');
}

function AfkAnnotatedContent({ content, afkNames }: { content: string; afkNames?: string[] }) {
  const strippedContent = stripHidden(content);
  const names = afkNames ?? [];
  return (
    <>
      {names.length > 0 && (
        <span className="flex flex-wrap gap-1 mb-1">
          {names.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300 font-medium">
              <Ghost className="w-3 h-3" />
              {name}
            </span>
          ))}
        </span>
      )}
      {strippedContent.split('\n').map((line, i) => (
        <span key={i} className="block">{line}</span>
      ))}
    </>
  );
}

type ReactionData = { id: string; message_id: string; emoji: string; user_id: string; sender_name: string };

const EMOJI_SET = ['🤣','😅','🤪','🙄','😬','😏','🤮','🥵','🥶','🤯','🧐','😎','😱','😭','🤬','😈','❤️','💯','👏','🙌','🤝','🖕','🫦','🗣','🍑','🍆'];

function MessageReactions({ messageId, reactions, currentUserId, onAddReaction, onRemoveReaction }: {
  messageId: string;
  reactions: ReactionData[];
  currentUserId?: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; users: string[]; isMine: boolean }>();
    for (const r of reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.users.push(r.sender_name);
        if (r.user_id === currentUserId) existing.isMine = true;
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, users: [r.sender_name], isMine: r.user_id === currentUserId });
      }
    }
    return Array.from(map.values());
  }, [reactions, currentUserId]);

  return (
    <div className="flex flex-wrap gap-1 mt-1 items-center">
      {grouped.map(g => (
        <button
          key={g.emoji}
          onClick={() => g.isMine ? onRemoveReaction(messageId, g.emoji) : onAddReaction(messageId, g.emoji)}
          className={cn(
            "h-6 px-1.5 text-xs rounded-full border flex items-center gap-0.5 transition-colors",
            g.isMine
              ? "bg-amber-900/30 border-amber-500/30 hover:bg-amber-900/50"
              : "bg-white/5 border-white/10 hover:bg-white/10"
          )}
          title={g.users.join(', ')}
          style={{ touchAction: 'manipulation' }}
        >
          <span>{g.emoji}</span>
          <span className="text-white/70">{g.count}</span>
        </button>
      ))}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-6 w-6 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2 bg-black/95 border border-white/10 backdrop-blur-md z-[200]" side="top" align="start">
          <div className="grid grid-cols-7 gap-0.5">
            {EMOJI_SET.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onAddReaction(messageId, emoji); setPickerOpen(false); }}
                className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-base transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const PartyDMMessage = React.memo(function PartyDMMessage({ message, currentUserId, members, mode, isCreator, onCopy, onEdit, onDelete, onRegenerate, onRegenerateWhispers, showTeamTag, afkCharNames: afkCharNamesProp, ttsSelectMode, ttsSelected, onTtsToggle, whisperTrayEnabled = true, isBookmarked, onBookmark, isDialogueMessage, reactions, onAddReaction, onRemoveReaction, onWhisperAutoRoll, onWhisperOpenRoller, narrationAudio, isNarrating, isNarrationPlaying, onNarrate, onPlayNarration, onDeleteNarration }: {
  message: PartyDmMessage;
  currentUserId?: string;
  members: Array<{ user_id: string; character_name: string }>;
  mode: 'shared' | 'private';
  isCreator?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, note?: string) => void;
  onRegenerateWhispers?: (messageId: string) => void;
  showTeamTag?: boolean;
  afkCharNames?: string[];
  ttsSelectMode?: boolean;
  ttsSelected?: boolean;
  onTtsToggle?: (id: string) => void;
  whisperTrayEnabled?: boolean;
  isBookmarked?: boolean;
  onBookmark?: (messageId: string) => void;
  isDialogueMessage?: boolean;
  reactions?: ReactionData[];
  onAddReaction?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
  onWhisperAutoRoll?: (whisperContent: string) => void;
  onWhisperOpenRoller?: (whisperContent: string) => void;
  narrationAudio?: MessageAudioRow;
  isNarrating?: boolean;
  isNarrationPlaying?: boolean;
  onNarrate?: (messageId: string, content: string) => void;
  onPlayNarration?: (messageId: string) => void;
  onDeleteNarration?: (messageId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isEditingMsg, setIsEditingMsg] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showRegenNote, setShowRegenNote] = useState(false);
  const [regenNoteText, setRegenNoteText] = useState('');
  const isAssistant = message.role === 'assistant';
  const isMine = message.sender_user_id === currentUserId;
  const videoMatch = message.content.match(PARTY_VIDEO_REGEX);
  const imageMatch = !videoMatch ? message.content.match(PARTY_IMAGE_REGEX) : null;
  const audioMatch = !videoMatch && !imageMatch ? message.content.match(PARTY_AUDIO_REGEX) : null;

  const afkCharNames = afkCharNamesProp ?? [];

  // Privacy is enforced at the database layer via RLS (parties.private_mode +
  // party_dm_messages.is_afk_marker). The Supabase SELECT policy will not return
  // other players' user-role rows when the party is in private mode, so any row
  // that reaches this renderer is allowed to be visible. No render-time filter
  // needed.
  const isWhisper = message.team?.startsWith('whisper:');

  if (isAssistant) {
    const myCharName = members.find(m => m.user_id === currentUserId)?.character_name;
    const filteredWhispers = (message.whispers || []).filter((w: any) => {
      if (w.type !== 'whisper') return true;
      if (!w.target || !myCharName) return false;
      return w.target.toLowerCase() === myCharName.toLowerCase();
    });

    return (
      <>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
          {/* TTS Select Checkbox */}
          {ttsSelectMode && (
            <button
              onClick={() => onTtsToggle?.(message.id)}
              className="flex items-center justify-center w-6 h-6 shrink-0 self-center"
              style={{ touchAction: 'manipulation' }}
            >
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                ttsSelected
                  ? "bg-amber-500 border-amber-400"
                  : "border-white/30 hover:border-amber-400/60"
              )}>
                {ttsSelected && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
            </button>
          )}
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
            {message.sender_name === 'DM' ? (
              <Crown className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5 text-amber-500" />
            )}
          </div>
          <div className="flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-indigo-950/15 border border-indigo-500/15 rounded-bl-sm overflow-hidden">
            {message.sender_name !== 'DM' && (
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[11px] font-semibold text-amber-300">{message.sender_name}</p>
                <span className="text-[9px] italic text-amber-400/50">NPC</span>
              </div>
            )}
            {showTeamTag && message.team && (
              <span className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-cinzel mb-1",
                message.team === 'alpha' ? "bg-blue-900/30 text-blue-300 border border-blue-500/20" : "bg-purple-900/30 text-purple-300 border border-purple-500/20"
              )}>
                <GitBranch className="w-2.5 h-2.5" />
                {message.team === 'alpha' ? 'Alpha' : 'Beta'}
              </span>
            )}
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
              <div className="text-xs prose prose-invert prose-xs max-w-none break-words overflow-wrap-anywhere">
                {videoMatch ? (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Film className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel">Video</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                      <video src={videoMatch[1]} controls playsInline className="w-full rounded-xl" />
                    </div>
                  </div>
                ) : imageMatch ? (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <ImageIcon className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel">Photo</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                      <img src={imageMatch[1]} alt="Chat photo" className="w-full rounded-xl" loading="lazy" />
                    </div>
                  </div>
                ) : audioMatch ? (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Music className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel">Audio</span>
                    </div>
                    <AudioMessagePlayer src={audioMatch[1]} />
                  </div>
                ) : (
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => {
                        if (afkCharNames.length === 0) return <p className="mb-2 last:mb-0">{children}</p>;
                        return <p className="mb-2 last:mb-0">{highlightAfkNames(children, afkCharNames)}</p>;
                      },
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
                    {stripCinematicTagsFromDisplay(message.content || '...')}
                  </ReactMarkdown>
                )}
              </div>
            )}

            {showRegenNote && (
              <div className="mt-2 space-y-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/20">
                <p className="text-[10px] text-amber-300/70">
                  Tell the DM what to change. Leave blank for a plain reroll.
                </p>
                <textarea
                  value={regenNoteText}
                  onChange={(e) => setRegenNoteText(e.target.value)}
                  placeholder="e.g. make the town have people in it instead of being abandoned"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[60px]"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <Button
                    onClick={() => { setShowRegenNote(false); setRegenNoteText(''); }}
                    size="sm"
                    variant="ghost"
                    className="text-white/40 hover:text-white/70 h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      onRegenerate?.(message.id, regenNoteText.trim() || undefined);
                      setShowRegenNote(false);
                      setRegenNoteText('');
                    }}
                    size="sm"
                    className="gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300 h-7 px-2 text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}

            {/* Speechify narration (assistant messages) */}
            {!isEditingMsg && !videoMatch && !imageMatch && !audioMatch && onNarrate && (
              <MessageNarrationButton
                hasAudio={!!narrationAudio}
                isGenerating={!!isNarrating}
                isPlaying={!!isNarrationPlaying}
                voicedByName={narrationAudio?.created_by_name}
                canDelete={isCreator}
                onGenerate={() => onNarrate(message.id, message.content)}
                onPlay={() => onPlayNarration?.(message.id)}
                onDelete={onDeleteNarration ? () => onDeleteNarration(message.id) : undefined}
              />
            )}

            {/* Reactions (assistant messages) */}
            {reactions && onAddReaction && onRemoveReaction && (
              <MessageReactions messageId={message.id} reactions={reactions} currentUserId={currentUserId} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} />
            )}

            {/* Bookmark button (all users) */}
            {!isEditingMsg && onBookmark && (
              <button
                onClick={() => onBookmark(message.id)}
                className={cn(
                  "p-1 rounded transition-colors opacity-0 group-hover/msg:opacity-100",
                  isBookmarked ? "text-amber-400" : "text-white/20 hover:text-amber-400/70"
                )}
                style={{ touchAction: 'manipulation' }}
                title={isBookmarked ? "Bookmarked" : "Bookmark here"}
              >
                {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              </button>
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
                      onClick={() => { setShowRegenNote(true); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-amber-900/30 text-amber-400/60 hover:text-amber-300 transition-colors"
                      title="Regenerate with a note"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { onRegenerateWhispers?.(message.id); setShowActions(false); }}
                      className="p-1.5 rounded hover:bg-emerald-900/30 text-emerald-400/60 hover:text-emerald-300 transition-colors"
                      title="Regenerate Whisper Tray"
                    >
                      <Zap className="w-3.5 h-3.5" />
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
        {/* Whisper tray below the AI message bubble, filtered to current player */}
        {whisperTrayEnabled && filteredWhispers.length > 0 && (
          <div className="ml-[calc(1.75rem+0.375rem)]">
            <WhisperTray
              whispers={filteredWhispers}
              onAutoRoll={onWhisperAutoRoll}
              onOpenRoller={onWhisperOpenRoller}
            />
          </div>
        )}
      </>
    );
  }

  // Detect whisper messages (isWhisper hoisted above for private-mode check)
  const whisperTargetName = (() => {
    if (!isWhisper || !message.team) return '';
    const parts = message.team.split(':');
    const targetId = parts[2];
    const target = members.find(m => m.user_id === targetId);
    return target?.character_name || 'Unknown';
  })();

  // User message (combined prompts)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 justify-start group/msg relative min-w-0">
      {isWhisper ? (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-purple-900/30 border border-purple-500/30">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
        </div>
      ) : isDialogueMessage ? (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: getMemberColor(message.sender_user_id || '', members) + '25', border: `1px solid ${getMemberColor(message.sender_user_id || '', members)}40` }}>
          <MessageCircle className="w-3.5 h-3.5" style={{ color: getMemberColor(message.sender_user_id || '', members) }} />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/20 border border-primary/30">
          <Users className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={cn(
        "flex-1 min-w-0 rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-bl-sm overflow-hidden",
        isWhisper ? "bg-purple-900/20 border border-purple-500/20" : "bg-white/5 border border-white/10"
      )}>
        {!isWhisper && showTeamTag && message.team && (
          <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-cinzel mb-1",
            message.team === 'alpha' ? "bg-blue-900/30 text-blue-300 border border-blue-500/20" : "bg-purple-900/30 text-purple-300 border border-purple-500/20"
          )}>
            <GitBranch className="w-2.5 h-2.5" />
            {message.team === 'alpha' ? 'Alpha' : 'Beta'}
          </span>
        )}
        <div className="flex items-center gap-1.5 mb-1">
          <p className={cn("text-[11px] font-semibold", isWhisper ? "text-purple-300" : "text-primary")}>
            {isWhisper || isDialogueMessage ? message.sender_name : 'Party Actions'}
          </p>
          {isWhisper && (
            <>
              <span className="text-[10px] text-purple-300/50">to {whisperTargetName}</span>
              <span className="text-[9px] italic text-purple-400/70">whisper</span>
            </>
          )}
          {!isWhisper && isDialogueMessage && (() => {
            const afterPrefix = message.content.slice(message.content.indexOf(']: ') + 3);
            const hasAction = /\*[^*]+\*/.test(afterPrefix);
            const hasDialogue = /"[^"]+"/.test(afterPrefix);
            if (hasAction && hasDialogue) return <span className="text-[9px] italic text-amber-400/50">mixed</span>;
            if (hasAction) return <span className="text-[9px] italic text-amber-400/50">action</span>;
            return <span className="text-[9px] italic text-muted-foreground/50">dialogue</span>;
          })()}
        </div>
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
        <p className="text-xs whitespace-pre-wrap text-white/90">
          {videoMatch ? (
            <span>
              <span className="flex items-center gap-1 mb-1.5">
                <Film className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Video</span>
              </span>
              <span className="block rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <video src={videoMatch[1]} controls playsInline className="w-full rounded-xl" />
              </span>
            </span>
          ) : imageMatch ? (
            <span>
              <span className="flex items-center gap-1 mb-1.5">
                <ImageIcon className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Photo</span>
              </span>
              <span className="block rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <img src={imageMatch[1]} alt="Chat photo" className="w-full rounded-xl" loading="lazy" />
              </span>
            </span>
          ) : audioMatch ? (
            <span>
              <span className="flex items-center gap-1 mb-1.5">
                <Music className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Audio</span>
              </span>
              <AudioMessagePlayer src={audioMatch[1]} />
            </span>
          ) : isDialogueMessage ? (
            <ReactMarkdown
              components={{
                p: ({ children }) => <span>{children}</span>,
              }}
            >
              {stripCinematicTagsFromDisplay(message.content.slice(message.content.indexOf(']: ') + 3))}
            </ReactMarkdown>
          ) : (
            <AfkAnnotatedContent content={stripCinematicTagsFromDisplay(message.content)} afkNames={extractAfkNames(message.content)} />
          )}
        </p>
        )}

        {/* Reactions (user messages) */}
        {reactions && onAddReaction && onRemoveReaction && (
          <MessageReactions messageId={message.id} reactions={reactions} currentUserId={currentUserId} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} />
        )}

        {/* Bookmark button (all users) */}
        {!isEditingMsg && onBookmark && (
          <button
            onClick={() => onBookmark(message.id)}
            className={cn(
              "p-1 rounded transition-colors opacity-0 group-hover/msg:opacity-100 mt-1",
              isBookmarked ? "text-amber-400" : "text-white/20 hover:text-amber-400/70"
            )}
            style={{ touchAction: 'manipulation' }}
            title={isBookmarked ? "Bookmarked" : "Bookmark here"}
          >
            {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
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
}, (prev, next) => {
  return prev.message.id === next.message.id
    && prev.message.content === next.message.content
    && prev.message.role === next.message.role
    && prev.ttsSelectMode === next.ttsSelectMode
    && prev.ttsSelected === next.ttsSelected
    && prev.whisperTrayEnabled === next.whisperTrayEnabled
    && prev.isCreator === next.isCreator
    && prev.mode === next.mode
    && prev.showTeamTag === next.showTeamTag
    && prev.currentUserId === next.currentUserId
    && prev.isBookmarked === next.isBookmarked
    && prev.narrationAudio?.audio_url === next.narrationAudio?.audio_url
    && prev.isNarrating === next.isNarrating
    && prev.isNarrationPlaying === next.isNarrationPlaying
    && (prev.reactions?.length ?? 0) === (next.reactions?.length ?? 0)
    && prev.reactions?.every((r, i) => r.id === next.reactions?.[i]?.id);
});

export function PartyDMScreen({ onBack, partyId, partyDm, isCreator, isOriginalCreator: isOriginalCreatorProp, coHostIds, onPromoteCoHost, onDemoteCoHost, currentUserId, memberCount, members, onShowGuides, onShowCharacterGuideBuilder, onShowSaves, onShowChat, autoSyncEnabled, onToggleAutoSync, isExtracting, guidesCount = 0, guides = [], gmGuidesContent, memoryAnchorsContent, memoryAnchors, onAddMemoryAnchor, onRemoveMemoryAnchor, characterContext, currentXP, onManualLevelUp, onAcceptItem, onOpenCharacterPicker, campaignSessions, campaignSessionsLoading, campaignSessionsSignedIn, onNewGame, onLoadCampaign, onRefreshCampaigns, wildShape, isMomoMoonDruid, onShowOocChat, onHPChange, onRestOccurred, onUseConsumableByName, swipeHandlers, onRequestCharacterRedo, hasPendingRedoRequest, onScanQuests, worldState = [] }: PartyDMScreenProps) {
  const originalCreator = isOriginalCreatorProp ?? isCreator;
  // Shared party quest board, also shown inside each player's character sheet.
  const sheetQuests = usePartyQuests(partyId, currentUserId);
  const questRewardSplit = useQuestRewardSplit(partyId, currentUserId);
  const partyNarrationStyle = usePartyNarrationStyle(partyId, currentUserId || '');
  // Chat Rounds: mini party-chat feed that drives the DM instead of ready-up.
  const roundChat = useRoundChat(
    partyId || null,
    currentUserId,
    members.find(m => m.user_id === currentUserId)?.character_name || characterContext?.name || 'Player',
    partyDm.sessionConfig?.currentRoundId,
  );
  const chatRoundsOn = roundChat.style.mode === 'chat' || roundChat.style.mode === 'live';
  const [roundChatOpen, setRoundChatOpen] = useState(false);
  const [roundChatDraft, setRoundChatDraft] = useState<string | null>(null);
  const playerInputRef = useRef<PartyDMInputHandle>(null);
  const [, setTick] = useState(0);
  const [showDeathSaves, setShowDeathSaves] = useState(false);
  const [recapExpanded, setRecapExpanded] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [showMemorial, setShowMemorial] = useState(false);
  const [showDeathTransition, setShowDeathTransition] = useState(false);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [showPartySheets, setShowPartySheets] = useState(false);
  const partyXpSnapshot = useXPSnapshot(characterContext?.level ?? 1, currentXP ?? 0);
  const [partyPendingItemCount, setPartyPendingItemCount] = useState(() => loadPendingDmItems().length);
  useEffect(() => {
    if (showCharacterSheet) setPartyPendingItemCount(loadPendingDmItems().length);
  }, [showCharacterSheet]);
  const narrator = useNarrator();
  const spotify = useSpotify();
  const drawerContext = usePromptDrawers();
  const { whisperTrayEnabled, setWhisperTrayEnabled } = useWhisperTrayEnabled();
  const { cinematicModeEnabled, setCinematicMode } = useCinematicMode();
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [partySituation, setPartySituation] = useState('exploration');
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [slideshowSlides, setSlideshowSlides] = useState<import('@/lib/parseSlides').Slide[]>([]);
  const lastSlideshowMsgIdRef = useRef<string | null>(null);
  const [readingMode, setReadingMode] = useState(false);
  const prevIsGeneratingRef = useRef(false);
  const [formattedReading, setFormattedReading] = useState<FormattedReading | null>(null);
  const [isFormattingReading, setIsFormattingReading] = useState(false);
  const dmPolls = useDmPolls(partyId || null);
  const messageNarration = useMessageNarration(partyId || undefined, currentUserId, members.find(m => m.user_id === currentUserId)?.character_name);
  const partyNPCNames = useNPCAutocomplete(partyDm.messages as any);
  const isEmpyrean = partyDm.sessionConfig?.campaignType === 'empyrean';
  const dragonBonds = usePartyDragonBonds(isEmpyrean ? (partyId || null) : null, currentUserId || null, members);
  const { driftZone: myDriftZone, historyCount: myAlignmentHistoryCount } = useAlignmentDrift();
  const [showEmpyreanBanner, setShowEmpyreanBanner] = useState(false);


  // Fix A: Clear scoped localStorage when user identity changes (prevents data bleed between accounts)
  const lastUserIdRef = useRef<string | null>(currentUserId ?? null);
  useEffect(() => {
    if (!currentUserId) {
      lastUserIdRef.current = null;
      return;
    }
    if (lastUserIdRef.current && lastUserIdRef.current !== currentUserId) {
      console.log('[PartyDM] User changed, clearing scoped data');
      SCOPED_KEYS.forEach(key => {
        localStorage.removeItem(key);
        Object.keys(localStorage).forEach(lsKey => {
          if (lsKey.startsWith(`${key}::`)) {
            localStorage.removeItem(lsKey);
          }
        });
      });
      localStorage.removeItem('odyssey-active-cloud-save-id');
    }
    lastUserIdRef.current = currentUserId;
  }, [currentUserId]);
  const [showDragonSetup, setShowDragonSetup] = useState(false);
  const [showDragonChat, setShowDragonChat] = useState(false);
  const [showDragonTelegramScheduler, setShowDragonTelegramScheduler] = useState(false);

  // === Emoji Reactions ===
  const [messageReactions, setMessageReactions] = useState<ReactionData[]>([]);

  // Load reactions on mount
  useEffect(() => {
    if (!partyId) return;
    supabase
      .from('party_message_reactions')
      .select('id, message_id, emoji, user_id, sender_name')
      .eq('party_id', partyId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessageReactions(data);
      });
  }, [partyId]);

  // Realtime subscription for reactions
  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`dm-reactions-${partyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'party_message_reactions',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as ReactionData;
        setMessageReactions(prev => {
          if (prev.some(r => r.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'party_message_reactions',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const oldId = (payload.old as any)?.id;
        if (oldId) setMessageReactions(prev => prev.filter(r => r.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!partyId || !currentUserId) return;
    const charName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
    const optimisticReaction: ReactionData = {
      id: `optimistic-${messageId}-${currentUserId}-${emoji}`,
      message_id: messageId,
      party_id: partyId,
      user_id: currentUserId,
      emoji,
      sender_name: charName,
    } as ReactionData & { party_id: string };

    setMessageReactions(prev => {
      if (prev.some(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)) return prev;
      return [...prev, optimisticReaction];
    });

    const { data, error } = await supabase.from('party_message_reactions').upsert({
      message_id: messageId,
      party_id: partyId,
      user_id: currentUserId,
      emoji,
      sender_name: charName,
    } as any, { onConflict: 'message_id,user_id,emoji' } as any)
      .select('id, message_id, emoji, user_id, sender_name')
      .single();

    if (error) {
      console.error('[Reactions] add error:', error);
      setMessageReactions(prev => prev.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)));
      return;
    }

    if (data) {
      setMessageReactions(prev => {
        const filtered = prev.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji));
        return [...filtered, data as ReactionData];
      });
    }
  }, [partyId, currentUserId, members]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    const removedReaction = messageReactions.find(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji);

    setMessageReactions(prev => prev.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)));

    const { error } = await supabase
      .from('party_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUserId)
      .eq('emoji', emoji);
    if (error) {
      console.error('[Reactions] remove error:', error);
      if (removedReaction) {
        setMessageReactions(prev => {
          if (prev.some(r => r.id === removedReaction.id)) return prev;
          return [...prev, removedReaction];
        });
      }
    }
  }, [currentUserId, messageReactions]);
  const [ttsSelectMode, setTtsSelectMode] = useState(false);
  const [ttsSelectedIds, setTtsSelectedIds] = useState<Set<string>>(new Set());
  

  // Reading bookmark state (per user, per party, localStorage)
  const bookmarkKey = partyId && currentUserId ? `party-bookmark-${partyId}-${currentUserId}` : null;
  const [bookmarkedMessageId, setBookmarkedMessageId] = useState<string | null>(() => {
    if (!bookmarkKey) return null;
    try {
      const saved = localStorage.getItem(bookmarkKey);
      if (saved) return JSON.parse(saved).messageId ?? null;
    } catch {}
    return null;
  });
  const bookmarkRef = useRef<HTMLDivElement>(null);

  const handleSetBookmark = useCallback((messageId: string) => {
    if (!bookmarkKey) return;
    const isRemoving = bookmarkedMessageId === messageId;
    if (isRemoving) {
      localStorage.removeItem(bookmarkKey);
      setBookmarkedMessageId(null);
      toast.success('Bookmark removed');
    } else {
      localStorage.setItem(bookmarkKey, JSON.stringify({ messageId, savedAt: new Date().toISOString() }));
      setBookmarkedMessageId(messageId);
      toast.success('Bookmark saved');
    }
  }, [bookmarkKey, bookmarkedMessageId]);

  const handleJumpToBookmark = useCallback(() => {
    if (bookmarkRef.current) {
      bookmarkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);


  // Synced active mood preset — plays on all clients when host changes it, and restores on party reopen.
  const lastPlayedMoodRef = useRef<string | null>(null);
  useEffect(() => {
    const presetId = partyDm.activeMoodPresetId;
    if (!presetId) return;
    if (!spotify.connected) return;
    if (lastPlayedMoodRef.current === presetId) return;
    lastPlayedMoodRef.current = presetId;
    try {
      spotify.playPresetById(presetId);
    } catch (e) {
      console.error('[PartyDM] failed to play synced mood preset:', e);
    }
  }, [partyDm.activeMoodPresetId, spotify.connected, spotify]);

  // AI situation detection for party mode (Auto-Mood)
  const lastSituationMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Auto-mood runs for ALL party campaigns (D&D and Empyrean), but only when the
    // user has Auto-Mood enabled and Spotify is connected.
    if (!spotify.autoMoodEnabled) return;
    if (!spotify.connected) return;
    // "Save credits" toggle — skip background situation detection.
    if (isFeatureSkipped('situation')) return;

    const msgs = partyDm.messages;
    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    if (
      lastMsg.role === 'assistant' &&
      lastMsg.id !== lastSituationMsgIdRef.current &&
      lastMsg.content
    ) {
      lastSituationMsgIdRef.current = lastMsg.id;
      (async () => {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-situation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: lastMsg.content.slice(0, 2000) }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.situation) {
              let situationId = data.situation;
              if (!isEmpyrean) {
                const CORE = ['combat', 'exploration', 'social', 'downtime'];
                if (!CORE.includes(situationId)) {
                  // Map Empyrean/other situations to the nearest D&D preset.
                  const MAP: Record<string, string> = {
                    flight: 'exploration',
                    stealth: 'exploration',
                    investigation: 'exploration',
                    political: 'social',
                    ritual: 'downtime',
                    training: 'combat',
                    crisis: 'combat',
                    wardline: 'combat',
                  };
                  situationId = MAP[situationId] || 'exploration';
                }
              }
              setPartySituation(situationId);
              spotify.playPresetById(situationId);
            }
          }
        } catch { /* non-blocking — best effort */ }
      })();
    }
  }, [partyDm.messages, spotify.autoMoodEnabled, spotify.connected]);

  // Cinematic slideshow trigger: detect new assistant DM messages
  useEffect(() => {
    if (!cinematicModeEnabled || !EMPYREAN_FEATURE_FLAGS.showCinematicSlideshow) return;
    // "Save credits" toggle — skip cinematic tagging.
    if (isFeatureSkipped('cinematic')) return;
    const msgs = partyDm.messages;
    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    if (
      lastMsg.role === 'assistant' &&
      lastMsg.sender_name === 'DM' &&
      lastMsg.id !== lastSlideshowMsgIdRef.current &&
      lastMsg.content
    ) {
      lastSlideshowMsgIdRef.current = lastMsg.id;
      (async () => {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tag-cinematic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: lastMsg.content }),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.beats) && data.beats.length > 0) {
              const slides = parseBeatsIntoSlides(data.beats);
              if (slides.length > 0) {
                try {
                  const audioCtx = getAudioCtx();
                  const { sfxNames, ambienceNames } = extractAudioNames(slides);
                  preloadAudioFiles(audioCtx, sfxNames, ambienceNames);
                } catch {}
                setSlideshowSlides(slides);
                setShowSlideshow(true);
              }
            }
            // beats === null → AI failed, silently skip cinematic for this response
          }
        } catch {
          // Network failure — skip cinematic, response still appears in chat
        }
      })();
    }
  }, [partyDm.messages, cinematicModeEnabled]);

  // Auto-enter reading mode when generation completes (cinematic OFF)
  useEffect(() => {
    if (prevIsGeneratingRef.current && !partyDm.isGenerating) {
      // Generation just completed
      if (!cinematicModeEnabled) {
        // No cinematic — go straight to reading mode
        const lastMessage = partyDm.messages[partyDm.messages.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.content?.trim()) {
          setReadingMode(true);
        }
      }
      // If cinematic IS enabled, reading mode will activate when slideshow ends
    }
    prevIsGeneratingRef.current = partyDm.isGenerating;
  }, [partyDm.isGenerating, partyDm.messages, cinematicModeEnabled]);

  // Trigger AI formatting when reading mode activates
  useEffect(() => {
    if (!readingMode) {
      setFormattedReading(null);
      setIsFormattingReading(false);
      return;
    }

    const lastAssistant = [...partyDm.messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
    if (!lastAssistant) return;

    const parsed = parseWhispers(lastAssistant.content || '');
    if (!parsed.narrative.trim()) return;

    setIsFormattingReading(true);
    formatForReadingMode(parsed.narrative)
      .then(result => {
        setFormattedReading(result);
      })
      .catch(() => {
        setFormattedReading(null);
      })
      .finally(() => {
        setIsFormattingReading(false);
      });
  }, [readingMode, partyDm.messages]);


  const lastDragonReactionMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEmpyrean || !dragonBonds.isSetup || !dragonBonds.myDragon?.dragonName) return;
    const msgs = partyDm.messages;
    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role !== 'assistant' || lastMsg.sender_name !== 'DM') return;
    if (lastMsg.id === lastDragonReactionMsgIdRef.current) return;
    lastDragonReactionMsgIdRef.current = lastMsg.id;

    // Small delay so the DM message renders first, then fire dragon reaction
    const timer = setTimeout(() => {
      dragonBonds.generateNarrativeReactions(lastMsg.content).catch(err => {
        console.warn('[PartyDM] Dragon narrative reaction failed:', err);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [partyDm.messages, isEmpyrean, dragonBonds.isSetup, dragonBonds.myDragon?.dragonName]);
  useEffect(() => {
    if (!partyDm.lastAutoSaveTime) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [partyDm.lastAutoSaveTime]);
  
  const [selectedDmModel, setSelectedDmModel] = useState(() => loadSelectedModel());
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [armedSignetIntensity, setArmedSignetIntensity] = useState<number | null>(null);

  // Detect if the page was killed during a file picker operation (common on mobile)
  useEffect(() => {
    const pendingPicker = sessionStorage.getItem('pending-file-picker');
    if (!pendingPicker) return;

    sessionStorage.removeItem('pending-file-picker');
    if (pendingPicker === 'audio') return;

    toast.error('File picker was interrupted — please try again', { duration: 4000 });
  }, []);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [expandedPillUserId, setExpandedPillUserId] = useState<string | null>(null);
  const [pillEditText, setPillEditText] = useState('');
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [showNewCampaignInput, setShowNewCampaignInput] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const videoCameraRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Bottom nav state
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showStoneDrawer, setShowStoneDrawer] = useState(false);

  // Split party state
  const [showSplitInitiator, setShowSplitInitiator] = useState(false);
  const [showNpcScene, setShowNpcScene] = useState(false);
  const [npcInterjectionText, setNpcInterjectionText] = useState('');
  const [showRegroupDialog, setShowRegroupDialog] = useState(false);
  const [showSplitSummaries, setShowSplitSummaries] = useState(false);
  const [showPreSplitChat, setShowPreSplitChat] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [showAfkGuide, setShowAfkGuide] = useState(false);
  const [devAssistantOpen, setDevAssistantOpen] = useState(false);
  const [showScheduledEvents, setShowScheduledEvents] = useState(false);
  const [showMemoryAnchors, setShowMemoryAnchors] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [questsCount, setQuestsCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Two-tap confirm for changing which character plays this party campaign.
  const [confirmCharacterSwap, setConfirmCharacterSwap] = useState(false);
  useEffect(() => {
    if (!confirmCharacterSwap) return;
    const t = window.setTimeout(() => setConfirmCharacterSwap(false), 4000);
    return () => clearTimeout(t);
  }, [confirmCharacterSwap]);

  const chatBackground = usePartyChatBackground();

  // Load party quest count — Fix B: guard with currentUserId
  useEffect(() => {
    if (!partyId || !currentUserId) return;
    (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (error) {
          console.error('[PartyDM] Quest load error:', error);
          return;
        }
        if (data?.state_data) {
          const active = Object.values(data.state_data).filter((q: any) => q.status === 'active').length;
          setQuestsCount(active);
        }
      });
  }, [partyId, currentUserId, showQuests]);

  // Chat unread badge tracking — Fix B: guard with currentUserId
  const [chatTotalCount, setChatTotalCount] = useState(0);
  const chatLastSeen = useRef(0);
  useEffect(() => {
    if (!partyId || !currentUserId) return;
    try { chatLastSeen.current = parseInt(localStorage.getItem(`odyssey_chat_lastSeen_${partyId}`) || '0', 10) || 0; } catch { chatLastSeen.current = 0; }
    supabase.from('party_messages').select('id', { count: 'exact', head: true }).eq('party_id', partyId).then(({ count }) => {
      setChatTotalCount(count ?? 0);
    });
    const ch = supabase.channel(`chat-badge-${partyId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${partyId}` }, (payload: any) => {
      setChatTotalCount(prev => prev + 1);
      if (payload?.new?.message?.startsWith('[🐉 ')) {
        setShowEmpyreanBanner(true);
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partyId, currentUserId]);
  const chatUnreadCount = Math.max(0, chatTotalCount - chatLastSeen.current);
  const [myAfkGuide, setMyAfkGuide] = useState<string | null>(() => {
    const me = members.find(m => m.user_id === currentUserId);
    return (me?.character_status?.afkPersonalityGuide as string) || null;
  });
  const [myAfkCascade, setMyAfkCascade] = useState<string[] | null>(() => {
    const me = members.find(m => m.user_id === currentUserId);
    return (me?.character_status?.afkPromptCascade as string[]) || null;
  });

  // Fix D: Reset character-specific state when currentUserId changes
  useEffect(() => {
    if (!currentUserId) return;
    const me = members.find(m => m.user_id === currentUserId);
    setMyAfkGuide((me?.character_status?.afkPersonalityGuide as string) || null);
    setMyAfkCascade((me?.character_status?.afkPromptCascade as string[]) || null);
  }, [currentUserId, members]);
  // party_members.character_name is written once when joining and never updated,
  // so switching characters would leave the rest of the party seeing the old name
  // in the member list, the DM briefing and the combat log. Push the change.
  const lastSyncedCharacterName = useRef<string | null>(null);
  useEffect(() => {
    const name = characterContext?.name?.trim();
    if (!partyId || !currentUserId || !name) return;
    if (lastSyncedCharacterName.current === name) return;
    lastSyncedCharacterName.current = name;

    (async () => {
      try {
        await supabase
          .from('party_members')
          .update({ character_name: name })
          .eq('party_id', partyId)
          .eq('user_id', currentUserId);
        console.log('[PartyDM] Synced character name to party:', name);
      } catch (e) {
        console.error('[PartyDM] Failed to sync character name:', e);
      }
    })();
  }, [characterContext?.name, partyId, currentUserId]);

  const [localTimerEnabled, setLocalTimerEnabled] = useState(partyDm.sessionConfig?.timerEnabled ?? false);
  const [localTimerDuration, setLocalTimerDuration] = useState(partyDm.sessionConfig?.timerDurationSeconds ?? 120);

  const handleAudioUpload = useCallback(async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Audio too large (max 100MB)');
      return;
    }

    setIsUploadingAudio(true);
    try {
      const fallbackExt = file.type.includes('mp4') ? 'm4a' : file.type.includes('mpeg') ? 'mp3' : 'webm';
      const ext = file.name.split('.').pop() || fallbackExt;
      const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('party-chat-audio').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('party-chat-audio').getPublicUrl(path);
      const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
      await partyDm.addMediaMessage(`[audio:${urlData.publicUrl}]`, senderName);
      setShowAudioRecorder(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Audio upload failed');
      throw err;
    } finally {
      setIsUploadingAudio(false);
    }
  }, [currentUserId, members, partyDm]);

  // Sync local timer state when sessionConfig changes
  useEffect(() => {
    if (partyDm.sessionConfig) {
      setLocalTimerEnabled(partyDm.sessionConfig.timerEnabled ?? false);
      setLocalTimerDuration(partyDm.sessionConfig.timerDurationSeconds ?? 120);
    }
  }, [partyDm.sessionConfig?.timerEnabled, partyDm.sessionConfig?.timerDurationSeconds]);

  // Handle timer expiry — any connected member triggers generation
  // Database-level lock in generateResponse prevents double-generation
  // In human mode, timer expiry doesn't auto-generate — host writes manually
  const handleTimerExpire = useCallback(() => {
    const mode = partyDm.sessionConfig?.dmMode || 'ai';
    if (!partyDm.isGenerating && mode !== 'human') {
      partyDm.generateResponse();
    }
  }, [partyDm.isGenerating, partyDm.generateResponse, partyDm.sessionConfig?.dmMode]);

  const mode = partyDm.sessionConfig?.mode || 'shared';

  const visibleMembers = partyDm.isSplitActive && partyDm.splitState && !isCreator
    ? members.filter(m =>
        partyDm.myTeam === 'alpha'
          ? partyDm.splitState!.alphaMembers.includes(m.user_id)
          : partyDm.splitState!.betaMembers.includes(m.user_id)
      )
    : members;

  // Stable members reference for PartyDMMessage to avoid re-renders
  const stableMembers = useMemo(() => members.map(m => ({ user_id: m.user_id, character_name: m.character_name })), [members]);

  // Stable TTS toggle callback
  const handleTtsToggle = useCallback((id: string) => {
    setTtsSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Host broadcast playlist indicator (isolated hook)
  const broadcastPlaylist = useBroadcastPlaylist(partyId);

  // Push notification state
  const { user } = useAuth();
  const [pushState, setPushState] = useState<PushSubscriptionState>('unsupported');

  // Check push state on mount and after toggle
  const refreshPushState = useCallback(async () => {
    const state = await getPushSubscriptionState();
    setPushState(state);
  }, []);

  useEffect(() => {
    refreshPushState();
  }, [refreshPushState]);

  // Auto-prompt push subscription 1.5s after mount
  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(async () => {
      const state = await getPushSubscriptionState();
      if (state === 'supported' || state === 'unsubscribed') {
        const success = await subscribeToPush(user.id);
        if (success) setPushState('subscribed');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleTogglePush = useCallback(async () => {
    if (!user?.id) return;
    if (pushState === 'subscribed') {
      await unsubscribeFromPush(user.id);
      setPushState('unsubscribed');
      toast('🔕 Push notifications disabled');
    } else if (pushState === 'unsubscribed' || pushState === 'supported') {
      const success = await subscribeToPush(user.id);
      if (success) {
        setPushState('subscribed');
        toast('🔔 Push notifications enabled');
      } else {
        await refreshPushState();
        if (Notification.permission === 'denied') {
          toast.error('Notifications blocked — enable in browser settings');
        }
      }
    }
  }, [user?.id, pushState, refreshPushState]);

  // Scroll only when message count increases, not on prompt updates
  const prevMsgCountRef = useRef(partyDm.messages.length);
  useEffect(() => {
    if (partyDm.messages.length > prevMsgCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMsgCountRef.current = partyDm.messages.length;
  }, [partyDm.messages.length]);

  const prevNat20GenRef = useRef(false);
  useEffect(() => {
    if (prevNat20GenRef.current && !partyDm.isGenerating) firePendingNat20Fanfare();
    prevNat20GenRef.current = partyDm.isGenerating;
  }, [partyDm.isGenerating]);

  useEffect(() => {
    if (partyDm.isGenerating) {
      setExpandedPillUserId(null);
      setQueueDrawerOpen(false);
    }
  }, [partyDm.isGenerating]);

  // Use ref for partyDm to stabilize callbacks
  const partyDmRef = useRef(partyDm);
  useEffect(() => { partyDmRef.current = partyDm; });

  // Couples Mode: auto-trigger generation the instant the turn-holder readies up.
  // No manual "Generate Now" tap should be required — that button is host-only and
  // doesn't fit the turn-based flow. Dedup per round via a ref so this fires exactly
  // once per turn even across multiple re-renders while turnReady stays true.
  const lastAutoGeneratedRoundRef = useRef<string | null>(null);
  useEffect(() => {
    const pd = partyDmRef.current;
    if (!pd.isTurnBasedMode) return;
    if (!pd.turnReady) return;
    if (pd.isGenerating) return;

    const roundKey = `${pd.sessionConfig?.currentRoundId || ''}:${pd.sessionConfig?.turnUserId || ''}`;
    if (lastAutoGeneratedRoundRef.current === roundKey) return;
    lastAutoGeneratedRoundRef.current = roundKey;

    pd.generateResponse();
  }, [partyDm.isTurnBasedMode, partyDm.turnReady, partyDm.isGenerating, partyDm.sessionConfig?.currentRoundId, partyDm.sessionConfig?.turnUserId]);

  // Normal AI mode: auto-trigger generation once all players are ready.
  // Only the host's client fires; DB-level lock in generateResponse prevents doubles.
  const lastAutoGeneratedAiRoundRef = useRef<string | null>(null);
  useEffect(() => {
    const pd = partyDmRef.current;
    const mode = pd.sessionConfig?.dmMode || 'ai';
    if (mode !== 'ai') return;
    if (chatRoundsOn) return; // Chat Rounds drives the round instead of ready-up
    if (!pd.allReady) return;
    if (pd.isGenerating) return;
    if (!isCreator) return;
    const roundKey = pd.sessionConfig?.currentRoundId || '';
    if (!roundKey) return;
    if (lastAutoGeneratedAiRoundRef.current === roundKey) return;
    lastAutoGeneratedAiRoundRef.current = roundKey;
    pd.generateResponse();
  }, [partyDm.allReady, partyDm.isGenerating, partyDm.sessionConfig?.dmMode, partyDm.sessionConfig?.currentRoundId, isCreator, chatRoundsOn]);

  // ── Chat Rounds ──
  // Host bundles this round's in-character chat lines into one prompt, readies it,
  // then narration fires once the ready row is visible in state.
  const chatRoundFiredRef = useRef<string | null>(null);
  const pendingChatFireRef = useRef<string | null>(null);

  const fireChatRound = useCallback(async () => {
    const pd = partyDmRef.current;
    const roundKey = pd.sessionConfig?.currentRoundId || '';
    if (!roundKey || pd.isGenerating) return;
    const pending = roundChatRef.current.pendingMessages;
    // Keyed on the round AND the last line in it, so a round that gathers more
    // chat while the DM is busy can still fire again afterwards.
    const fireKey = `${roundKey}:${pending[pending.length - 1]?.id || ''}`;
    if (chatRoundFiredRef.current === fireKey) return;
    const bundled = roundChatRef.current.buildRoundPrompt();
    if (!bundled.trim()) return;
    chatRoundFiredRef.current = fireKey;
    setRoundChatOpen(false);
    await roundChatRef.current.consumePending();
    await pd.submitPrompt(bundled);
    await pd.setReady();
    // Call the DM directly rather than waiting for the ready row to echo back
    // through realtime — if that echo is slow or dropped the round never fires.
    pendingChatFireRef.current = roundKey;
    try {
      await pd.generateResponse();
      pendingChatFireRef.current = null;
    } catch {
      /* the ready-echo effect below is the fallback */
    }
  }, []);


  /**
   * Single exit for every player-generated line (potions, spells, dice results,
   * suggested actions, quest kickoffs, roleplay prompts, quick actions...).
   * In Chat Rounds / Live DM the round chat is the only way to reach the DM,
   * so those lines post there as in-character messages instead of the hidden
   * ready-up prompt row.
   */
  const chatRoundsOnRef = useRef(chatRoundsOn);
  chatRoundsOnRef.current = chatRoundsOn;
  const roundChatRef = useRef(roundChat);
  roundChatRef.current = roundChat;

  const dispatchPrompt = useCallback((text: string, intensity?: number) => {
    if (!text || !text.trim()) return;
    if (chatRoundsOnRef.current) {
      setRoundChatOpen(true);
      void roundChatRef.current.sendMessage(text, true);
      return;
    }
    partyDmRef.current?.submitPrompt(text, intensity);
  }, []);



  // Prerequisites met (host's trigger rule + message count) → bundle the round
  // chat and call the DM. Re-checked whenever new lines land, the round rolls
  // over, or a generation finishes, so a met round never sits waiting.
  useEffect(() => {
    if (!chatRoundsOn || !isCreator) return;
    if (!roundChat.progress.met) return;
    if (partyDm.isGenerating) return;
    void fireChatRound();
  }, [
    chatRoundsOn,
    isCreator,
    roundChat.progress.met,
    roundChat.pendingMessages.length,
    partyDm.isGenerating,
    partyDm.sessionConfig?.currentRoundId,
    fireChatRound,
  ]);


  useEffect(() => {
    if (!chatRoundsOn || !isCreator) return;
    const roundKey = partyDm.sessionConfig?.currentRoundId || '';
    if (!roundKey || pendingChatFireRef.current !== roundKey) return;
    if (partyDm.isGenerating) return;
    if (!partyDm.myPrompt?.is_ready) return;
    pendingChatFireRef.current = null;
    partyDmRef.current.generateResponse();
  }, [chatRoundsOn, isCreator, partyDm.myPrompt?.is_ready, partyDm.isGenerating, partyDm.sessionConfig?.currentRoundId]);


  const handleSubmit = useCallback((text: string) => {
    setRecapDismissed(true);
    let finalPrompt = text;
    if (armedSignetIntensity != null) {
      finalPrompt = `${text}\n\n[SIGNET CHANNELED — intensity ${armedSignetIntensity}/8. Narrate signet power proportional to this intensity: 1 = faint flicker, 8 = catastrophic overload.]`;
    }
    dispatchPrompt(finalPrompt, armedSignetIntensity ?? undefined);
    setArmedSignetIntensity(null);
  }, [armedSignetIntensity]);

  const handleReadyAutopilot = useCallback(() => {
    if (!myAfkGuide) return;
    setRecapDismissed(true);
    const autopilotPrompt = `<<${myAfkGuide}>>`;
    if (chatRoundsOnRef.current) {
      dispatchPrompt(autopilotPrompt);
    } else {
      partyDmRef.current.submitPrompt(autopilotPrompt);
      setTimeout(() => partyDmRef.current.setReady(), 100);
    }
  }, [myAfkGuide]);

  // Empyrean masterwork pills generator (Party mode)
  const handleFetchMasterworkPills = useCallback(
    async (category: 'dragon' | 'situation', situationLabel: string) => {
      const recentAssistantMessages = partyDm.messages.filter((m: any) => m.role === 'assistant').slice(-2);
      const recentNarrative = recentAssistantMessages.map((m: any) => m.content).join('\n\n').slice(0, 2500);
      if (!recentNarrative.trim()) {
        throw new Error('No recent narrative to riff on yet.');
      }
      const myMember = members.find(m => m.user_id === currentUserId);
      const { data, error } = await supabase.functions.invoke('empyrean-masterwork-pills', {
        body: {
          category,
          situation_label: situationLabel,
          recent_narrative: recentNarrative,
          character_name: myMember?.character_name || 'Rider',
          dragon_name: dragonBonds.myDragon?.dragonName || '',
          signet_type: dragonBonds.myDragon?.signetType || '',
          model: (partyDm.sessionConfig as any)?.model || undefined,
          user_api_key: loadApiKey('anthropic') || undefined,
          user_openai_key: loadApiKey('openai') || undefined,
          user_xai_key: loadApiKey('xai') || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!Array.isArray((data as any)?.pills)) throw new Error('Invalid response from masterwork generator.');
      return (data as any).pills;
    },
    [partyDm.messages, members, currentUserId, dragonBonds.myDragon?.dragonName, dragonBonds.myDragon?.signetType]
  );

  // Story-mode masterwork pills (non-Empyrean party campaigns)
  const handleFetchStoryPills = useCallback(async () => {
    // Include the recent back-and-forth (DM + this player + other players), not just DM replies,
    // so suggestions respond to what the player themselves was actually just doing.
    // Build the recent narrative newest-last, but NEVER front-truncate the joined
    // string — that would discard the most recent (and often longest) beat, which is
    // exactly the moment the suggestions must react to.
    // Strategy: walk the last 8 messages from NEWEST to oldest, add each (capped per
    // message so one giant DM reply can't crowd everything out), and stop once we hit
    // a total budget. This guarantees the latest beat is always included in full-ish.
    const PER_MESSAGE_CAP = 1800;   // enough for a rich beat without runaway size
    const TOTAL_BUDGET = 8000;      // generous overall budget; newest content prioritized
    const window = partyDm.messages.slice(-8);

    const labeled: string[] = [];
    let used = 0;
    for (let i = window.length - 1; i >= 0; i--) {
      const m: any = window[i];
      let speaker: string;
      if (m.role === 'assistant') speaker = 'DM';
      else if (m.role === 'user' && m.sender_user_id === currentUserId) speaker = 'You';
      else if (m.role === 'user') speaker = members.find(mem => mem.user_id === m.sender_user_id)?.character_name || 'Another player';
      else continue;

      const raw = (m.content || '').toString();
      if (!raw.trim()) continue;
      // Cap each message from its END if very long (keep the most recent portion of a long beat).
      const body = raw.length > PER_MESSAGE_CAP ? '…' + raw.slice(raw.length - PER_MESSAGE_CAP) : raw;
      const entry = `[${speaker}]: ${body}`;

      if (used + entry.length > TOTAL_BUDGET && labeled.length > 0) break;
      labeled.push(entry);          // building newest-first...
      used += entry.length;
    }
    labeled.reverse();              // ...then restore chronological order (oldest-first) for the model
    const recentNarrative = labeled.join('\n\n');
    if (!recentNarrative.trim()) {
      throw new Error('No recent narrative to riff on yet.');
    }
    const myMember = members.find(m => m.user_id === currentUserId);
    const myStatus = (myMember as any)?.character_status || {};
    const storedBackstory = getScopedItem('dnd-character-backstory') || '';
    const backstory = storedBackstory || myStatus.backstory || '';
    const personality = myStatus.personality || '';
    const alignment = (myDriftZone && myAlignmentHistoryCount > 0) ? myDriftZone : (myStatus.alignment || '');
    const bonds = myStatus.bonds || '';
    const flaws = myStatus.flaws || '';
    const campaignSummary = (partyDm.sessionConfig as any)?.campaignSummary || '';

    const { data, error } = await supabase.functions.invoke('empyrean-masterwork-pills', {
      body: {
        category: 'story',
        recent_narrative: recentNarrative,
        campaign_summary: campaignSummary,
        character_name: myMember?.character_name || 'the player',
        character_backstory: backstory,
        character_personality: personality,
        character_alignment: alignment,
        character_bonds: bonds,
        character_flaws: flaws,
        model: (partyDm.sessionConfig as any)?.model || undefined,
        user_api_key: loadApiKey('anthropic') || undefined,
        user_openai_key: loadApiKey('openai') || undefined,
        user_xai_key: loadApiKey('xai') || undefined,
      },
    });
    if (error || (data as any)?.error) {
      const detail = (data as any)?.error || error?.message || '';
      throw new Error(
        detail.includes('did not produce') || detail.includes('gateway') || detail.includes('non-2xx')
          ? "Couldn't generate suggestions for this scene — it may be too intense for the suggestion helper. Try writing your own move, or tap Regenerate."
          : (detail || "Couldn't generate suggestions right now. Try again.")
      );
    }
    if (!Array.isArray((data as any)?.pills)) throw new Error('Invalid response from suggestion generator.');
    return (data as any).pills;
  }, [partyDm.messages, (partyDm.sessionConfig as any)?.campaignSummary, members, currentUserId, myDriftZone, myAlignmentHistoryCount]);


  // Whisper roll: state + handlers
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [diceRollerWhisperText, setDiceRollerWhisperText] = useState<string | null>(null);

  const handleWhisperAutoRoll = useCallback((whisperContent: string) => {
    const hint = parseRollHint(whisperContent);
    const auto = resolveWhisperAutoRoll(hint);
    if (!auto.canAutoRoll || !auto.actionPhrase) {
      setDiceRollerWhisperText(whisperContent);
      setDiceRollerOpen(true);
      return;
    }
    const myMember = members.find(m => m.user_id === currentUserId);
    const characterContext: any = {
      level: (myMember as any)?.level ?? 1,
      abilityScores: (myMember as any)?.ability_scores ?? (myMember as any)?.stats ?? {},
      skillProficiencies: (myMember as any)?.skill_proficiencies ?? [],
      savingThrowProficiencies: (myMember as any)?.saving_throw_proficiencies ?? [],
    };
    const result = performWhisperRoll({ hint, actionPhrase: auto.actionPhrase, characterContext });
    dispatchPrompt(result.chatMessage);
  }, [members, currentUserId]);

  const handleWhisperOpenRoller = useCallback((whisperContent: string) => {
    setDiceRollerWhisperText(whisperContent);
    setDiceRollerOpen(true);
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
        setIsUploadingPhoto(true);
        try {
          const ext = file.type.includes('gif') ? 'gif' : file.type.split('/')[1] || 'png';
          const path = `party-dm/${partyDmRef.current.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
          const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
          await partyDmRef.current.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
        finally { setIsUploadingPhoto(false); }
        return;
      }
    }

    // Check plain text for direct image URLs
    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (text && /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(text)) {
      e.preventDefault();
      const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
      await partyDmRef.current.addMediaMessage(`[image:${text}]`, senderName);
      return;
    }

    // Check for Giphy/Tenor URLs (various formats including share pages)
    if (text && /^https?:\/\/(media\d*\.giphy\.com|giphy\.com|media\.tenor\.com|tenor\.com)\//i.test(text)) {
      e.preventDefault();
      let gifUrl = text;
      // Convert giphy.com/gifs/ page URLs to direct media URLs
      if (/giphy\.com\/gifs\//i.test(text)) {
        const slug = text.split('/').pop()?.split('-').pop();
        if (slug) gifUrl = `https://media.giphy.com/media/${slug}/giphy.gif`;
      }
      const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
      await partyDmRef.current.addMediaMessage(`[image:${gifUrl}]`, senderName);
      return;
    }

    // Check HTML content for embedded GIF images (e.g. drag from Giphy)
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+\.gif[^"']*)["']/i);
      if (imgMatch) {
        e.preventDefault();
        const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
        await partyDmRef.current.addMediaMessage(`[image:${imgMatch[1]}]`, senderName);
        return;
      }
    }
  }, [members, currentUserId]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }, []);

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    partyDmRef.current.editMessage?.(messageId, content);
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    partyDmRef.current.deleteMessage?.(messageId);
  }, []);

  const handleRegenerateMessage = useCallback((messageId: string, note?: string) => {
    partyDmRef.current.regenerateMessage?.(messageId, note);
  }, []);

  const handleRegenerateWhispers = useCallback((messageId: string) => {
    partyDmRef.current.regenerateWhispers?.(messageId);
  }, []);

  const handleDiceRoll = useCallback((message: string) => {
    if (chatRoundsOnRef.current) {
      dispatchPrompt(message);
      return;
    }
    playerInputRef.current?.appendText(message);
  }, [dispatchPrompt]);

  const handleUsePrompt = useCallback((prompt: string) => {
    // The classic composer is hidden in Chat Rounds / Live DM — post to the room instead.
    if (chatRoundsOnRef.current) {
      dispatchPrompt(prompt);
      return;
    }
    playerInputRef.current?.appendText(prompt);
  }, [dispatchPrompt]);

  const handleHealingItemUsed = useHealingItemAction({
    characterName: characterContext?.name || 'The Adventurer',
    maxHP: characterContext?.maxHP ?? 0,
    getCurrentHP: () => characterContext?.currentHP ?? 0,
    onHPChange,
    onUseConsumableByName,
  });


  // Geralt widget state (momo easter egg)
  const [showGeraltWidget, setShowGeraltWidget] = useState(false);
  const isMomo = useMemo(() => isMomoEasterEgg(characterContext?.name || ''), [characterContext?.name]);
  const geraltCharacterId = useMemo(() => (characterContext?.name || '').toLowerCase().trim() || 'unknown', [characterContext?.name]);

  // Geralt HP for sub-header (momo only) — reactive via callback
  const [geraltHp, setGeraltHp] = useState<{ current: number; max: number } | null>(null);
  useEffect(() => {
    if (isMomo) {
      const s = loadGeraltState(geraltCharacterId);
      setGeraltHp({ current: s.currentHP, max: s.maxHP });
    }
  }, [isMomo, geraltCharacterId]);
  const handleGeraltHpChange = useCallback((currentHP: number, maxHP: number) => {
    setGeraltHp({ current: currentHP, max: maxHP });
  }, []);
  const geraltHpPct = geraltHp ? Math.max(0, Math.min(100, (geraltHp.current / geraltHp.max) * 100)) : 0;

  // Bottom nav tab handler
  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'prompts') {
      setShowStoneDrawer(true);
      return;
    }
    if (tab === 'actions') {
      setQuickActionsOpen(true);
      return;
    }
    if (tab === 'geralt') {
      setShowGeraltWidget(true);
      return;
    }
    if (tab === 'afk') {
      if (isEmpyrean && dragonBonds.isSetup) {
        dragonBonds.loadDragonChat();
        setShowDragonChat(true);
      } else {
        setShowAfkGuide(true);
      }
      return;
    }
    // Dice, wildshape, oracle, settings tabs toggle full-screen content
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, [isEmpyrean, dragonBonds.isSetup]);
  const hasSubmitted = !!partyDm.myPrompt;
  const isReady = partyDm.myPrompt?.is_ready ?? false;
  const isDialogueMode = partyDm.sessionConfig?.dmMode === 'dialogue';
  const isTurnBasedMode = partyDm.isTurnBasedMode;
  const currentTurnUserId = partyDm.currentTurnUserId;
  const isMyTurn = !isTurnBasedMode || !currentTurnUserId || currentTurnUserId === currentUserId;
  const turnHolderName = isTurnBasedMode && currentTurnUserId
    ? (members.find(m => m.user_id === currentTurnUserId)?.character_name || 'Your partner')
    : '';
  const [dialogueText, setDialogueText] = useState('');
  const [whisperTarget, setWhisperTarget] = useState<{ user_id: string; character_name: string } | null>(null);
  const [whisperPickerOpen, setWhisperPickerOpen] = useState(false);
  const [dialogueAttachOpen, setDialogueAttachOpen] = useState(false);
  const dialogueInputRef = useRef<HTMLTextAreaElement>(null);
  const showDiceContent = activeNavTab === 'dice' && characterContext && !partyDm.isGenerating;

  // Fix C: Loading guard to prevent frozen overlays when auth/party hasn't resolved
  if (!currentUserId || !partyId) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-white/50">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      {/* Row 1: Main Header */}
      {!isFullscreen && (
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <Home className="w-5 h-5 text-white/80" />
          </button>
          <Crown className="w-6 h-6 text-amber-400 shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-500/25 hover:bg-white/10 transition-colors min-w-0 max-w-[190px]"
                style={{ touchAction: 'manipulation', minHeight: 40 }}
              >
                <UserCog className="w-4 h-4 text-amber-400/80 shrink-0" />
                <span className="text-xs font-cinzel text-amber-200 truncate">
                  {characterContext?.name || 'Character'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-[#1a1a2e] border-amber-900/40 backdrop-blur-md z-[9999]">
              {onOpenCharacterPicker && (
                <>
                  <DropdownMenuItem
                    onClick={onOpenCharacterPicker}
                    className="gap-2 text-amber-300 focus:text-amber-200 focus:bg-amber-900/30 text-xs"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    Change character
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-amber-900/30" />
                </>
              )}
              {partyDm.messages.length > 0 && (
                <DropdownMenuItem
                  onClick={() => {
                    const name = partyDm.activeCampaignId ? undefined : `Party Campaign ${new Date().toLocaleDateString()}`;
                    partyDm.saveCampaign(name || 'Party Campaign', partyDm.activeCampaignId || undefined);
                  }}
                  className="gap-2 text-white/70 focus:text-white/90 focus:bg-amber-900/20 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <div className="flex flex-col">
                    <span>Save campaign</span>
                    {partyDm.lastAutoSaveTime && (
                      <span className="text-[10px] text-white/30">Saved {formatAutoSaveTime(partyDm.lastAutoSaveTime)}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              )}
              {isCreator && onNewGame && (
                <DropdownMenuItem
                  onClick={onNewGame}
                  className="gap-2 text-amber-300 focus:text-amber-200 focus:bg-amber-900/30 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New campaign
                </DropdownMenuItem>
              )}
              {isCreator && campaignSessions && onLoadCampaign && (
                <>
                  <DropdownMenuSeparator className="bg-amber-900/30" />
                  {campaignSessionsLoading ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 text-amber-400/60 animate-spin" />
                    </div>
                  ) : campaignSessions.length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-white/30">No saved campaigns</div>
                  ) : (
                    <div className="max-h-[240px] overflow-y-auto">
                      {campaignSessions.map(session => {
                        const isActive = session.id === partyDm.activeCampaignId;
                        return (
                          <DropdownMenuItem
                            key={session.id}
                            onClick={() => { if (!isActive) onLoadCampaign(session); }}
                            className={cn(
                              'gap-2 focus:bg-amber-900/20 text-xs cursor-pointer',
                              isActive ? 'text-amber-300' : 'text-white/70 focus:text-white/90'
                            )}
                          >
                            {isActive ? <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Save className="w-3.5 h-3.5 text-white/30 shrink-0" />}
                            <span className="truncate">{session.name}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{memberCount} players</span>
        </div>

      </header>
      )}






      {/* Row 2: Sub-Header Strip (status only) */}
      {!isFullscreen && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/30 border-b border-amber-900/20">
        {partyDm.isSummarizing && (
          <span className="text-[11px] text-purple-400 animate-pulse whitespace-nowrap">Summarizing...</span>
        )}
        {isMomo && geraltHp && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <Bird className="w-3 h-3 text-pink-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              geraltHpPct > 50 ? "text-emerald-400" : geraltHpPct > 25 ? "text-amber-400" : "text-red-400"
            )}>
              {geraltHp.current}/{geraltHp.max}
            </span>
          </>
        )}
        {wildShape?.state.isTransformed && wildShape.state.currentForm && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <PawPrint className="w-3 h-3 text-green-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              (wildShape.state.formHP / wildShape.state.formMaxHP) > 0.5 ? "text-green-400" : (wildShape.state.formHP / wildShape.state.formMaxHP) > 0.25 ? "text-amber-400" : "text-red-400"
            )}>
              {wildShape.state.currentForm.name} {wildShape.state.formHP}/{wildShape.state.formMaxHP}
            </span>
          </>
        )}
        {isEmpyrean && dragonBonds.myDragon?.dragonName && (
          <button
            onClick={() => {
              dragonBonds.loadDragonChat();
              setShowDragonChat(true);
            }}
            className="flex items-center gap-1 hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="text-[11px] text-white/20">•</span>
            <Flame className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-300/70 whitespace-nowrap truncate max-w-[80px]">
              {dragonBonds.myDragon.dragonName}
            </span>
            {(() => {
              const bLevel = dragonBonds.myDragon.burnout;
              const bBond = dragonBonds.myDragon.bond ?? 50;
              const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
              const bRatio = bMax > 0 ? bLevel / bMax : 0;
              return (
                <span className={cn(
                  "text-[10px] font-mono whitespace-nowrap",
                  bRatio === 0 ? "text-emerald-400" : bRatio < 0.4 ? "text-yellow-400" : bRatio < 0.75 ? "text-orange-400" : "text-red-400"
                )}>
                  🔥{bLevel}/{bMax}
                </span>
              );
            })()}
            <MessageCircle className="w-3 h-3 text-cyan-400/50 shrink-0" />
          </button>
        )}
        {isCreator && isEmpyrean && dragonBonds.allDragonConfigs.length > 0 && (
          <button
            onClick={() => setShowDragonTelegramScheduler(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/60 border border-orange-700/40 text-orange-300 text-xs font-cinzel hover:bg-orange-900/60 transition-colors"
            title="Dragon Telegram Scheduler"
          >
            <Flame className="w-3 h-3" />
            Dragon Msgs
          </button>
        )}
        {broadcastPlaylist && (
          <>
            <span className="text-[11px] text-white/20">•</span>
            <Radio className="w-3 h-3 text-blue-400 shrink-0 animate-pulse" />
            <span className="text-[11px] text-blue-300/70 truncate max-w-[120px]" title={broadcastPlaylist}>
              {broadcastPlaylist}
            </span>
          </>
        )}
      </div>
      )}

      {/* New Campaign Name Input */}

      <AnimatePresence>
        {showNewCampaignInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-black/50 border-b border-amber-900/30 overflow-hidden"
          >
            <p className="text-xs text-amber-300/70 mb-1.5 font-cinzel">New Campaign Name</p>
            <p className="text-[10px] text-white/30 mb-2">This will clear all current messages and prompts.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCampaignName.trim()) {
                    partyDm.startNewCampaign(newCampaignName.trim());
                    setShowNewCampaignInput(false);
                    setNewCampaignName('');
                  }
                }}
                placeholder="Enter campaign name..."
                className="flex-1 bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                maxLength={80}
                autoFocus
              />
              <button
                onClick={() => {
                  if (newCampaignName.trim()) {
                    partyDm.startNewCampaign(newCampaignName.trim());
                    setShowNewCampaignInput(false);
                    setNewCampaignName('');
                  }
                }}
                disabled={!newCampaignName.trim()}
                className="px-3 py-2 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowNewCampaignInput(false); setNewCampaignName(''); }}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split Banner */}
      {partyDm.isSplitActive && partyDm.splitState && (
        <SplitBanner
          splitState={partyDm.splitState}
          myTeam={partyDm.myTeam}
          isCreator={isCreator}
          members={members}
          onShowPreSplitChat={() => setShowPreSplitChat(true)}
        />
      )}

      {/* Dragon Rider Setup Banner */}
      {isEmpyrean && !dragonBonds.isSetup && (
        <div className="mx-3 my-2 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-200 font-cinzel">Set up your dragon rider</span>
          </div>
          <button
            onClick={() => setShowDragonSetup(true)}
            className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors whitespace-nowrap min-h-[36px]"
          >
            Configure
          </button>
        </div>
      )}

      {/* Messages */}
      <div className={cn(
        "flex-1 min-h-0 relative flex flex-col overflow-hidden",
        isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.signetType && (() => {
          const bLevel = dragonBonds.myDragon.burnout;
          const bBond = dragonBonds.myDragon.bond ?? 50;
           const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
          return bMax > 0 && bLevel >= bMax ? "animate-[screen-shake_0.6s_ease-in-out_infinite]" : "";
        })()
      )}
        onTouchStart={swipeHandlers?.onTouchStart}
        onTouchMove={swipeHandlers?.onTouchMove}
        onTouchEnd={swipeHandlers?.onTouchEnd}
      >
        {/* Burnout flame border overlay */}
        {isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.signetType && (() => {
          const bLevel = dragonBonds.myDragon.burnout;
          const bBond = dragonBonds.myDragon.bond ?? 50;
           const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
          return (
            <BurnoutFlameOverlay
              level={bLevel}
              max={bMax}
              onGround={() => dragonBonds.updateBurnout(Math.max(0, bLevel - 1))}
              currentHP={characterContext?.currentHP ?? 10}
              maxHP={characterContext?.maxHP ?? 10}
              onHPChange={(change, type) => {
                onHPChange?.(change, type);
                if (type === 'damage') {
                  const hpAfter = (characterContext?.currentHP ?? 10) + change;
                  if (hpAfter <= 0) {
                    setTimeout(() => setShowDeathSaves(true), 600);
                  }
                }
              }}
            />
          );
        })()}
        {/* Default empyrean background — hidden when burnout is active */}
        {isEmpyrean && (() => {
          const bLevel = dragonBonds.myDragon?.burnout ?? 0;
          return bLevel <= 0;
        })() && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            <div className="absolute inset-0" style={{
              backgroundImage: `url(${empyreanDmBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.18,
            }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          </div>
        )}
        {/* Custom user-uploaded chat background (personal, per-character) */}
        {chatBackground.background && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${chatBackground.background})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: chatBackground.settings.opacity,
                filter: chatBackground.settings.blur > 0 ? `blur(${chatBackground.settings.blur}px)` : undefined,
                transform: chatBackground.settings.blur > 0 ? 'scale(1.05)' : undefined,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
          </div>
        )}
        <AnimatePresence>
          {showEmpyreanBanner && (
            <motion.button
              key="empyrean-banner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={() => { setShowEmpyreanBanner(false); onShowChat?.(); }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-lg overflow-hidden cursor-pointer"
            >
              <img src={empyreanSpeaksImg} alt="The Empyrean Speaks — tap to view" className="w-full h-full object-cover rounded-lg" />
            </motion.button>
          )}
        </AnimatePresence>
        <div ref={scrollRef} className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[2px] pr-2 py-3 sm:p-4 sm:pr-4 space-y-3 sm:space-y-4 overscroll-contain pb-[100px] relative z-[1]",
          isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.signetType && (() => {
            const bLevel = dragonBonds.myDragon.burnout;
            const bBond = dragonBonds.myDragon.bond ?? 50;
             const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
            const ratio = bMax > 0 ? bLevel / bMax : 0;
             if (ratio >= 0.875) return "animate-[text-waver-intense_2s_ease-in-out_infinite,text-color-bleed_3s_ease-in-out_infinite]";
             if (ratio >= 0.75) return "animate-[text-waver-intense_2.5s_ease-in-out_infinite,text-color-bleed_4s_ease-in-out_infinite]";
             if (ratio >= 0.625) return "animate-[text-waver_2.5s_ease-in-out_infinite,text-color-bleed_5s_ease-in-out_infinite]";
             if (ratio >= 0.5) return "animate-[text-waver_3s_ease-in-out_infinite,text-color-bleed_7s_ease-in-out_infinite]";
             if (ratio >= 0.375) return "animate-[text-waver-subtle_3s_ease-in-out_infinite]";
             if (ratio >= 0.25) return "animate-[text-waver-subtle_4s_ease-in-out_infinite]";
             if (ratio > 0) return "animate-[text-waver-subtle_6s_ease-in-out_infinite]";
            return "";
          })()
        )}>
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
              {partyDm.messages.map((msg, idx) => {
                // Hide the last assistant message while slideshow is playing
                if (msg.role === 'assistant' && idx === partyDm.messages.length - 1 && (showSlideshow || (partyDm.isGenerating && cinematicModeEnabled))) {
                  return null;
                }
                // Pre-compute AFK names from preceding user message
                let afkNames: string[] | undefined;
                if (msg.role === 'assistant' && idx > 0) {
                  const prev = partyDm.messages[idx - 1];
                  if (prev.role === 'user') {
                    afkNames = extractAfkNames(prev.content);
                  }
                }
                return (
                <React.Fragment key={msg.id}>
                  {/* Bookmark divider */}
                  {msg.id === bookmarkedMessageId && (
                    <div ref={bookmarkRef} className="flex items-center gap-2 py-1 px-2">
                      <div className="flex-1 h-px bg-amber-500/30" />
                      <span className="flex items-center gap-1.5 text-[11px] font-cinzel text-amber-400/80 whitespace-nowrap">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400 animate-[pulse_2s_ease-in-out_infinite]" style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' }} />
                        You left off here
                      </span>
                      <div className="flex-1 h-px bg-amber-500/30" />
                    </div>
                  )}
                  <PartyDMMessage
                    message={msg}
                    currentUserId={currentUserId}
                    members={stableMembers}
                    mode={partyDm.isSplitActive ? 'private' : 'shared'}
                    isCreator={isCreator}
                    onCopy={handleCopyMessage}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onRegenerate={handleRegenerateMessage}
                    onRegenerateWhispers={handleRegenerateWhispers}
                    showTeamTag={isCreator && partyDm.isSplitActive}
                    afkCharNames={afkNames}
                    ttsSelectMode={ttsSelectMode}
                    ttsSelected={ttsSelectedIds.has(msg.id)}
                    onTtsToggle={handleTtsToggle}
                    whisperTrayEnabled={whisperTrayEnabled}
                    isBookmarked={msg.id === bookmarkedMessageId}
                    onBookmark={handleSetBookmark}
                    isDialogueMessage={isDialogueMode && msg.role === 'user' && msg.sender_name !== 'Party' && msg.sender_name !== 'System' && msg.content.startsWith('[' + msg.sender_name + ']: ')}
                    reactions={messageReactions.filter(r => r.message_id === msg.id)}
                    onAddReaction={addReaction}
                    onRemoveReaction={removeReaction}
                    onWhisperAutoRoll={isEmpyrean ? handleWhisperAutoRoll : undefined}
                    onWhisperOpenRoller={isEmpyrean ? handleWhisperOpenRoller : undefined}
                    narrationAudio={messageNarration.audioByMessage[msg.id]}
                    isNarrating={messageNarration.generatingId === msg.id}
                    isNarrationPlaying={messageNarration.playingId === msg.id}
                    onNarrate={messageNarration.generate}
                    onPlayNarration={messageNarration.play}
                    onDeleteNarration={isCreator ? messageNarration.remove : undefined}
                  />
                </React.Fragment>
                );
              })}
            </AnimatePresence>
          )}

              {dmPolls.polls.filter(p => !p.closed).map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0);
                const myVote = poll.options.find(o => o.voters.some(v => v.userId === currentUserId));
                const hasVoted = !!myVote;
                const isPollCreator = poll.creatorUserId === currentUserId;
                const charName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
                return (
                  <div key={poll.pollId} className="mx-1 rounded-xl border border-amber-500/20 bg-amber-950/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-amber-300/70 font-cinzel uppercase tracking-wider">Poll</span>
                      <span className="text-[10px] text-white/30 ml-auto">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-white/90 font-medium">{poll.question}</p>
                    <p className="text-[10px] text-white/40">by {poll.creatorName}</p>
                    <div className="space-y-1">
                      {poll.options.map(opt => {
                        const isMyVote = myVote?.label === opt.label;
                        const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => !hasVoted && dmPolls.castVote(poll.pollId, opt.label, charName)}
                            disabled={hasVoted}
                            className={cn(
                              "w-full relative px-3 py-2 rounded-lg border text-xs text-left transition-all overflow-hidden",
                              isMyVote ? "border-amber-500/40 bg-amber-900/20" : "border-white/10 bg-white/5",
                              !hasVoted && "hover:bg-white/10 cursor-pointer"
                            )}
                          >
                            {hasVoted && (
                              <div className="absolute inset-y-0 left-0 bg-amber-500/10 transition-all" style={{ width: `${pct}%` }} />
                            )}
                            <div className="relative flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                {isMyVote && <Check className="w-3 h-3 text-amber-400" />}
                                {opt.label}
                              </span>
                              {hasVoted && <span className="text-[10px] text-white/40">{opt.voters.length} ({pct}%)</span>}
                            </div>
                            {hasVoted && opt.voters.length > 0 && (
                              <p className="text-[9px] text-white/30 mt-0.5 relative">{opt.voters.map(v => v.name).join(', ')}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {isPollCreator && (
                      <button onClick={() => dmPolls.closePoll(poll.pollId)} className="w-full text-[10px] text-white/30 hover:text-white/50 py-1 transition-colors">
                        Close Poll
                      </button>
                    )}
                  </div>
                );
              })}

              {dmPolls.polls.filter(p => p.closed).slice(-3).map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0);
                const winner = [...poll.options].sort((a, b) => b.voters.length - a.voters.length)[0];
                const canDelete = isCreator || poll.creatorUserId === currentUserId;
                return (
                  <div key={poll.pollId} className="mx-1 rounded-lg border border-white/5 bg-white/5 px-3 py-2 flex items-center gap-2">
                    <BarChart3 className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] text-white/30 truncate flex-1">{poll.question}</span>
                    <span className="text-[10px] text-amber-300/50 shrink-0">{winner?.label} ({totalVotes})</span>
                    {canDelete && (
                      <button
                        onClick={() => dmPolls.deletePoll(poll.pollId)}
                        className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors shrink-0"
                        title="Remove poll"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

          {/* Loading / status indicator */}
          {partyDm.isGenerating && !showSlideshow && (cinematicModeEnabled || partyDm.messages[partyDm.messages.length - 1]?.role !== 'assistant') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1">
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-amber-400/60 italic">
                  {partyDm.sessionConfig?.npcSceneActive
                    ? `NPC scene in progress (${partyDm.sessionConfig.npcSceneMessageCount ?? 0}/${partyDm.sessionConfig.npcSceneMaxMessages ?? 12})...`
                    : (partyDm.sessionConfig?.dmMode === 'ai-approval' && !isCreator)
                      ? 'The DM is reviewing the AI draft...'
                      : 'The DM weaves the tale...'}
                </span>
                {(isCreator || partyDm.sessionConfig?.npcSceneActive) && (
                  <button
                    onClick={partyDm.sessionConfig?.npcSceneActive ? partyDm.stopNpcScene : partyDm.stopGeneration}
                    className="ml-auto p-1.5 rounded-lg border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    title={partyDm.sessionConfig?.npcSceneActive ? 'Interrupt scene' : 'Stop generation'}
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {/* Pending draft indicator for non-hosts in approval mode */}
          {!isCreator && !partyDm.isGenerating && partyDm.pendingDraft && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-900/40 border border-blue-500/30">
                <Pencil className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm text-blue-400/60 italic">DM is crafting a response...</span>
            </motion.div>
          )}
          {/* Human DM mode: waiting indicator for non-hosts when all ready */}
          {!isCreator && !partyDm.isGenerating && !partyDm.pendingDraft && partyDm.allReady && (partyDm.sessionConfig?.dmMode === 'human') && !isDialogueMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-900/40 border border-amber-500/30">
                <Pencil className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-sm text-amber-400/60 italic">Waiting for the DM to respond...</span>
            </motion.div>
          )}
          {/* TTS Select Floating Bar */}
          <AnimatePresence>
            {ttsSelectMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="sticky bottom-0 z-10 flex items-center justify-center gap-3 px-4 py-2.5 bg-black/80 backdrop-blur-md border-t border-amber-500/30"
              >
                <button
                  onClick={() => { setTtsSelectMode(false); setTtsSelectedIds(new Set()); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/10 transition-colors border border-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const selected = partyDm.messages.filter(m => ttsSelectedIds.has(m.id)).map(m => m.content);
                    if (selected.length > 0) {
                      narrator.playMessage(selected.join('\n\n'));
                    }
                    setTtsSelectMode(false);
                    setTtsSelectedIds(new Set());
                  }}
                  disabled={ttsSelectedIds.size === 0}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5",
                    ttsSelectedIds.size > 0
                      ? "bg-amber-600 hover:bg-amber-500 text-black"
                      : "bg-white/10 text-white/30"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Volume2 className="w-4 h-4" />
                  Narrate {ttsSelectedIds.size > 0 ? `(${ttsSelectedIds.size})` : ''}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Suggest my next move — above Dad Huddle */}
          {!isEmpyrean && partyDm.messages.length > 0 && (
            <div className="mb-2 mx-1">
              <StoryMasterworkActions
                disabled={partyDm.isGenerating}
                onSelect={(prompt) => {
                  setRecapDismissed(true);
                  if (chatRoundsOnRef.current) {
                    setRoundChatDraft(prompt);
                    setRoundChatOpen(true);
                    return;
                  }
                  playerInputRef.current?.setText(prompt);
                }}
                fetchStoryPills={handleFetchStoryPills}
              />
            </div>
          )}
        </div>
        {/* Fullscreen toggle - bottom-right of chat area */}
        <button
          onClick={() => {
            if (!isFullscreen) setNavExpanded(false);
            setIsFullscreen(f => !f);
          }}
          className="absolute bottom-2 right-2 z-[5] w-9 h-9 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all"
          style={{ touchAction: 'manipulation' }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white/70" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white/40" />
          )}
        </button>
      </div>

      {/* Chat Rounds: mini party chat that drives the DM */}
      {partyDm.isActive && chatRoundsOn && (
        <RoundChatDrawer
          open={roundChatOpen}
          onOpenChange={setRoundChatOpen}
          messages={roundChat.messages}
          reactions={roundChat.reactions}
          currentUserId={currentUserId}
          characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Player'}
          style={roundChat.style}
          progress={roundChat.progress}
          sending={roundChat.sending}
          isGenerating={partyDm.isGenerating}
          isHost={isCreator}
          onSend={(content, ic) => roundChat.sendMessage(content, ic)}
          onToggleReaction={(id, emoji) => roundChat.toggleReaction(id, emoji, members.find(m => m.user_id === currentUserId)?.character_name || 'Player')}
          onDeleteMessage={roundChat.deleteMessage}
          onSendToDMNow={fireChatRound}
          draft={roundChatDraft}
          onDraftUsed={() => setRoundChatDraft(null)}
        />
      )}

      {/* Prompt Queue Status */}
      {partyDm.isActive && !chatRoundsOn && (
        <div className="border-t border-amber-900/20 bg-black/30 overflow-hidden">
          {/* Round Timer */}
          <RoundTimer
            sessionConfig={partyDm.sessionConfig}
            isCreator={isCreator}
            currentUserId={currentUserId}
            onStartTimer={partyDm.startTimer}
            onPauseTimer={partyDm.pauseTimer}
            onResumeTimer={partyDm.resumeTimer}
            onCancelTimer={partyDm.cancelTimer}
            onRequestExtension={partyDm.requestExtension}
            onApproveExtension={partyDm.approveExtension}
            onDismissExtensions={partyDm.dismissExtensions}
            onTimerExpire={handleTimerExpire}
          />
          {/* Collapsed status strip with mini dots + chevron toggle */}
          <button
            onClick={() => setQueueDrawerOpen(prev => !prev)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 transition-colors"
            style={{ touchAction: 'manipulation' }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any)._swipeStartY = touch.clientY;
            }}
            onTouchEnd={(e) => {
              const startY = (e.currentTarget as any)._swipeStartY;
              if (startY == null) return;
              const diffY = e.changedTouches[0].clientY - startY;
              if (diffY < -30 && !queueDrawerOpen) {
                e.preventDefault();
                setQueueDrawerOpen(true);
              }
              (e.currentTarget as any)._swipeStartY = null;
            }}
          >
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Round Queue</span>
            <span className="text-[10px] text-white/30">
              {partyDm.currentPrompts.filter(p => p.is_ready && visibleMembers.some(m => m.user_id === p.user_id)).length}/{visibleMembers.length} ready
            </span>
            {/* Mini status dots when collapsed */}
            {!queueDrawerOpen && (
              <div className="flex items-center gap-1 ml-auto mr-1">
                {visibleMembers.map(m => {
                  const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
                  return (
                    <span
                      key={m.user_id}
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-colors",
                        !prompt && "bg-white/20",
                        prompt && !prompt.is_ready && "bg-amber-400",
                        prompt?.is_ready && "bg-emerald-400",
                      )}
                    />
                  );
                })}
              </div>
            )}
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-white/30 shrink-0 transition-transform duration-200",
              queueDrawerOpen && "rotate-180",
              !queueDrawerOpen && "ml-auto",
            )} />
          </button>

          {/* Expandable pill drawer */}
          <AnimatePresence>
            {queueDrawerOpen && (
              <motion.div
                key="queue-drawer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden touch-pan-x"
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.3}
                dragSnapToOrigin
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 40) {
                    setQueueDrawerOpen(false);
                    setExpandedPillUserId(null);
                  }
                }}
                style={{ touchAction: 'pan-x' }}
              >
                <div className="flex flex-col gap-1.5 mx-1 pb-2">
                  {visibleMembers.map(m => {
                    const prompt = partyDm.currentPrompts.find(p => p.user_id === m.user_id);
                    const isSelf = m.user_id === currentUserId;
                    const hasAction = prompt && prompt.prompt.trim().length > 0;
                    const isExpanded = expandedPillUserId === m.user_id;
                    const memberTeam = partyDm.isSplitActive && partyDm.splitState
                      ? partyDm.splitState.alphaMembers.includes(m.user_id) ? 'alpha' : 'beta'
                      : null;
                    return (
                      <div key={m.user_id} className="flex flex-col">
                        <div
                          title={
                            prompt?.is_ready
                              ? `${m.character_name} — Ready${hasAction ? ' (with action)' : ' (no action)'}`
                              : prompt
                                ? `${m.character_name} — Action submitted, not ready`
                                : `${m.character_name} — Waiting...`
                          }
                          onClick={() => {
                            if (!hasAction) return;
                            // In private mode, only self can expand; in shared mode, anyone can
                            if (!isSelf && mode !== 'shared') return;
                            const toggled = isExpanded ? null : m.user_id;
                            setExpandedPillUserId(toggled);
                            if (toggled && isSelf && prompt) setPillEditText(prompt.prompt);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] border transition-all w-full",
                            !prompt && "bg-white/5 border-white/10 text-white/30",
                            prompt && !prompt.is_ready && "bg-amber-900/20 border-amber-500/30 text-amber-300",
                            prompt?.is_ready && "bg-emerald-900/20 border-emerald-500/30 text-emerald-300 animate-pulse",
                            (isSelf || mode === 'shared') && hasAction && "cursor-pointer hover:brightness-125",
                            isExpanded && "ring-1 ring-white/30",
                          )}
                        >
                          {memberTeam && (
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              memberTeam === 'alpha' ? "bg-blue-400" : "bg-purple-400"
                            )} />
                          )}
                          <span className="truncate flex-1">{m.character_name}</span>
                          {partyDm.sessionConfig?.campaignType === 'empyrean' && (() => {
                            const dc = dragonBonds.allDragonConfigs.find(d => d.userId === m.user_id);
                            if (!dc?.config.dragonName) return null;
                            return (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <span className="text-[9px]">🐉</span>
                                <span className="text-[8px] text-purple-300/80 truncate max-w-[40px]">{dc.config.dragonName}</span>
                                {(() => {
                                  const mBurnout = dc.config.burnout ?? 0;
                                  const mBond = dc.config.bond ?? 50;
                                  const mMax = mBond >= 76 ? 9 : mBond >= 51 ? 7 : mBond >= 26 ? 5 : 4;
                                  const mRatio = mMax > 0 ? mBurnout / mMax : 0;
                                  if (mRatio < 0.35) return null;
                                  return (
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      mRatio >= 0.85 ? "bg-red-500" : "bg-orange-400"
                                    )} />
                                  );
                                })()}
                              </span>
                            );
                          })()}
                          {coHostIds?.includes(m.user_id) && (
                            <span className="text-[8px] text-amber-400/70 font-bold uppercase tracking-wider shrink-0">Co-DM</span>
                          )}
                          {(m as any).character_status?.afkPersonalityGuide && (
                            <span title="AFK guide configured" className="flex items-center gap-0.5">
                              <Ghost className="w-2.5 h-2.5 text-purple-400/60 shrink-0" />
                              {((m as any).character_status?.afkPromptCascade as string[] | undefined)?.length ? (
                                <span className="text-[8px] font-bold text-purple-400/80 min-w-[10px] text-center">
                                  {((m as any).character_status.afkPromptCascade as string[]).length}
                                </span>
                              ) : null}
                            </span>
                          )}
                          {prompt?.is_ready ? (
                            <>
                              <span className={cn(
                                "text-[8px] font-semibold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded",
                                hasAction ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/50"
                              )}>
                                {hasAction ? 'Prompt queued' : 'No action'}
                              </span>
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                            </>
                          ) : prompt ? (
                            <Check className="w-3 h-3 text-amber-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                          )}
                          {mode === 'shared' && hasAction && !isExpanded && (
                            <>
                              <span className="text-[9px] text-white/30 max-w-[60px] truncate">{prompt!.prompt}</span>
                              <Eye className="w-2.5 h-2.5 text-white/20 shrink-0" />
                            </>
                          )}
                          {mode === 'shared' && hasAction && isExpanded && (
                            <Eye className="w-2.5 h-2.5 text-white/50 shrink-0" />
                          )}
                          {mode !== 'shared' && !isSelf && hasAction && (
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="w-2.5 h-2.5 text-white/20 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Prompt hidden — host has private mode enabled</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {/* Inline expanded prompt content */}
                        <AnimatePresence>
                          {isExpanded && hasAction && prompt && (() => {
                            const canEdit = isSelf && !prompt.is_ready && !partyDm.isGenerating;
                            return (
                              <motion.div
                                key={`expanded-${m.user_id}`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-1 rounded-lg bg-white/5 border border-white/10 p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-white/60">{m.character_name}'s Prompt</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExpandedPillUserId(null); }}
                                      className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {canEdit ? (
                                    <div className="space-y-1.5">
                                      <textarea
                                        value={pillEditText}
                                        onChange={(e) => setPillEditText(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[60px] max-h-[120px]"
                                        rows={3}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (pillEditText.trim()) {
                                              await partyDm.editPrompt(pillEditText.trim());
                                              toast.success('Prompt updated');
                                              setExpandedPillUserId(null);
                                            }
                                          }}
                                          className="h-6 px-2.5 text-[10px] gap-1 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                                        >
                                          <Check className="w-2.5 h-2.5" />
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-white/70 whitespace-pre-wrap break-words">{prompt.prompt}</p>
                                   )}
                                  {/* Promote/demote co-host — original creator only, non-self */}
                                  {originalCreator && m.user_id !== currentUserId && (
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (coHostIds?.includes(m.user_id)) {
                                            onDemoteCoHost?.(m.user_id);
                                            toast.success(`${m.character_name} removed as co-host`);
                                          } else {
                                            onPromoteCoHost?.(m.user_id);
                                            toast.success(`${m.character_name} promoted to co-host!`);
                                          }
                                        }}
                                        className={cn(
                                          "px-2 py-1 text-[10px] rounded border transition-colors",
                                          coHostIds?.includes(m.user_id)
                                            ? "border-red-500/30 bg-red-900/20 text-red-300 hover:bg-red-900/40"
                                            : "border-amber-500/30 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40"
                                        )}
                                      >
                                        {coHostIds?.includes(m.user_id) ? 'Remove Co-Host' : 'Make Co-Host'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })()}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Timer Settings (host only, inside queue drawer) */}
                  {isCreator && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => setShowTimerSettings(prev => !prev)}
                        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors w-full"
                      >
                        <Timer className="w-3 h-3" />
                        Timer Settings
                        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", showTimerSettings && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {showTimerSettings && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2">
                              <TimerSettings
                                enabled={localTimerEnabled}
                                durationSeconds={localTimerDuration}
                                onEnabledChange={(e) => {
                                  setLocalTimerEnabled(e);
                                  partyDm.setTimerConfig(e, localTimerDuration);
                                }}
                                onDurationChange={(s) => {
                                  setLocalTimerDuration(s);
                                  partyDm.setTimerConfig(localTimerEnabled, s);
                                }}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Burnout Override (Empyrean only) */}
                  {isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.signetType && (() => {
                    const bLevel = dragonBonds.myDragon.burnout ?? 0;
                    const bBond = dragonBonds.myDragon.bond ?? 50;
                    const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
                    const bRatio = bMax > 0 ? bLevel / bMax : 0;
                    return (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-400/60" />
                            Signet Burnout
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => dragonBonds.updateBurnout(Math.max(0, bLevel - 1))}
                              disabled={bLevel <= 0}
                              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-xs font-mono flex items-center justify-center transition-colors"
                              style={{ touchAction: 'manipulation' }}
                            >
                              −
                            </button>
                            <span className={cn(
                              "text-xs font-mono min-w-[32px] text-center",
                              bRatio === 0 ? "text-emerald-400" : bRatio < 0.4 ? "text-yellow-400" : bRatio < 0.75 ? "text-orange-400" : "text-red-400"
                            )}>
                              {bLevel}/{bMax}
                            </span>
                            <button
                              onClick={() => dragonBonds.updateBurnout(Math.min(bMax, bLevel + 1))}
                              disabled={bLevel >= bMax}
                              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-xs font-mono flex items-center justify-center transition-colors"
                              style={{ touchAction: 'manipulation' }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showPollCreator && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowPollCreator(false)}>
          <div className="w-full max-w-sm bg-gradient-to-b from-[#1a0e05] to-[#0d0d12] border border-amber-900/30 rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-cinzel text-amber-200">Create Poll</h3>
            </div>
            <input
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value.slice(0, 120))}
              placeholder="Ask the party something..."
              className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 mb-3"
              autoFocus
            />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input
                  value={opt}
                  onChange={e => { const next = [...pollOptions]; next[i] = e.target.value.slice(0, 60); setPollOptions(next); }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                />
                {pollOptions.length > 2 && (
                  <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-red-900/20 text-white/30 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3">
              {pollOptions.length < 5 && (
                <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-amber-300/60 hover:text-amber-300 transition-colors">+ Add Option</button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']); }} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">Cancel</button>
                <button
                  onClick={async () => {
                    const valid = pollOptions.map(o => o.trim()).filter(Boolean);
                    if (!pollQuestion.trim() || valid.length < 2) return;
                    const name = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
                    await dmPolls.createPoll(pollQuestion.trim(), valid, name);
                    setShowPollCreator(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                  }}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                  className="px-3 py-1.5 text-xs rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60 transition-colors disabled:opacity-40"
                >
                  Post Poll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={async (e) => {
          sessionStorage.removeItem('pending-file-picker');
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) { toast.error('Video too large (max 50MB)'); return; }
          setIsUploadingVideo(true);
          try {
            const ext = file.name.split('.').pop() || 'mp4';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('videos').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[video:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingVideo(false); if (videoInputRef.current) videoInputRef.current.value = ''; }
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          sessionStorage.removeItem('pending-file-picker');
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
          setIsUploadingPhoto(true);
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingPhoto(false); if (photoInputRef.current) photoInputRef.current.value = ''; }
        }}
      />
      <input
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return; }
          setIsUploadingPhoto(true);
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[image:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingPhoto(false); if (photoCameraRef.current) photoCameraRef.current.value = ''; }
        }}
      />
      <input
        ref={videoCameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) { toast.error('Video too large (max 50MB)'); return; }
          setIsUploadingVideo(true);
          try {
            const ext = file.name.split('.').pop() || 'mp4';
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('videos').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[video:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
          finally { setIsUploadingVideo(false); if (videoCameraRef.current) videoCameraRef.current.value = ''; }
        }}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          sessionStorage.removeItem('pending-file-picker');
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 100 * 1024 * 1024) { toast.error('Audio too large (max 100MB)'); return; }
          setIsUploadingAudio(true);
          try {
            const fallbackExt = file.type.includes('mp4') ? 'm4a' : file.type.includes('mpeg') ? 'mp3' : 'webm';
            const ext = file.name.split('.').pop() || fallbackExt;
            const path = `party-dm/${partyDm.sessionConfig?.currentRoundId || 'general'}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('party-chat-audio').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('party-chat-audio').getPublicUrl(path);
            const senderName = members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown';
            await partyDm.addMediaMessage(`[audio:${urlData.publicUrl}]`, senderName);
          } catch (err) { toast.error(err instanceof Error ? err.message : 'Audio upload failed'); }
          finally { setIsUploadingAudio(false); if (audioFileInputRef.current) audioFileInputRef.current.value = ''; }
        }}
      />
      <PartyDMAudioRecorder
        open={showAudioRecorder}
        onOpenChange={setShowAudioRecorder}
        onSubmit={handleAudioUpload}
        isUploading={isUploadingAudio}
      />

      {/* Input Area */}
      {!isFullscreen && (
      <div className={cn(
        "px-2 py-2 sm:px-3 sm:py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm mb-[48px]",
        (() => {
          if (!isEmpyrean || !dragonBonds.myDragon?.signetType) return '';
          const bLevel = dragonBonds.myDragon.burnout;
          const bBond = dragonBonds.myDragon.bond ?? 50;
          const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
          return bLevel >= bMax ? 'pointer-events-none opacity-40 select-none' : '';
        })()
      )}>
        {/* Share Media button removed — paperclip in PartyDMInput is the canonical attachment entry. */}

        {isCreator && partyDm.pendingDraft ? (
          <DraftReviewPanel
            draftContent={partyDm.pendingDraft.content}
            onApprove={partyDm.approveDraft}
            onDiscard={partyDm.discardDraft}
            onRegenerate={partyDm.generateResponse}
            partyMemberNames={members.map(m => m.character_name)}
            isRegenerating={partyDm.isGenerating}
          />
        ) : isCreator && (partyDm.sessionConfig?.dmMode === 'human') ? (
          <DMComposePanel
            onSend={partyDm.sendManualDmMessage}
            partyMemberNames={members.map(m => m.character_name)}
            disabled={partyDm.isGenerating}
          />
        ) : isDialogueMode ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {whisperTarget && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-900/20 border border-purple-500/30 text-purple-300 text-xs">
                <Lock className="w-3 h-3" />
                <span>Whispering to <strong>{whisperTarget.character_name}</strong></span>
                <button onClick={() => setWhisperTarget(null)} className="ml-auto p-0.5 hover:bg-purple-500/20 rounded">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Popover open={whisperPickerOpen} onOpenChange={setWhisperPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "p-2.5 rounded-xl border transition-colors shrink-0",
                      whisperTarget
                        ? "bg-purple-900/30 border-purple-500/40 text-purple-400"
                        : "bg-purple-900/20 border-purple-500/30 text-purple-400/60 hover:text-purple-400"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-48 p-1 z-[70]">
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Whisper to…</div>
                  {members.filter(m => m.user_id !== currentUserId).map(m => (
                    <button
                      key={m.user_id}
                      onClick={() => { setWhisperTarget({ user_id: m.user_id, character_name: m.character_name }); setWhisperPickerOpen(false); }}
                      className="w-full text-left px-2 py-2 text-sm rounded hover:bg-purple-900/20 text-foreground transition-colors"
                    >
                      {m.character_name}
                    </button>
                  ))}
                  {whisperTarget && (
                    <button
                      onClick={() => { setWhisperTarget(null); setWhisperPickerOpen(false); }}
                      className="w-full text-left px-2 py-2 text-xs rounded hover:bg-muted/20 text-muted-foreground transition-colors border-t border-border/30 mt-1"
                    >
                      Clear whisper
                    </button>
                  )}
                </PopoverContent>
              </Popover>
              <Popover open={dialogueAttachOpen} onOpenChange={setDialogueAttachOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="p-2.5 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors shrink-0"
                    disabled={isUploadingPhoto || isUploadingVideo || isUploadingAudio}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {(isUploadingPhoto || isUploadingVideo || isUploadingAudio) ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-48 p-1.5 z-[70]">
                  <button onClick={() => { photoCameraRef.current?.click(); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <Camera className="w-4 h-4" /> Take Photo
                  </button>
                  <button onClick={() => { videoCameraRef.current?.click(); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <Film className="w-4 h-4" /> Record Video
                  </button>
                  <div className="border-t border-white/5 my-0.5" />
                  <button onClick={() => { sessionStorage.setItem('pending-file-picker', 'photo'); photoInputRef.current?.click(); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <ImageIcon className="w-4 h-4" /> Photo from Gallery
                  </button>
                  <button onClick={() => { sessionStorage.setItem('pending-file-picker', 'video'); videoInputRef.current?.click(); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <Film className="w-4 h-4" /> Video from Gallery
                  </button>
                  <button onClick={() => { setShowAudioRecorder(true); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <Music className="w-4 h-4" /> Record Audio
                  </button>
                  <button onClick={() => { sessionStorage.setItem('pending-file-picker', 'audio'); audioFileInputRef.current?.click(); setDialogueAttachOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs" style={{ touchAction: 'manipulation' }}>
                    <Music className="w-4 h-4" /> Audio from Files
                  </button>
                </PopoverContent>
              </Popover>
              <textarea
                ref={dialogueInputRef}
                value={dialogueText}
                onChange={e => {
                  setDialogueText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                placeholder={whisperTarget ? `Whisper to ${whisperTarget.character_name}...` : "Speak in character... or *describe an action*"}
                rows={1}
                className={cn(
                  "flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 max-h-[200px]",
                  whisperTarget
                    ? "border border-purple-500/30 focus:ring-purple-500/30"
                    : "border border-amber-900/30 focus:ring-amber-500/30"
                )}
                style={{ touchAction: 'manipulation' }}
              />
              <button
                onClick={() => {
                  if (dialogueText.trim()) {
                    if (whisperTarget) {
                      partyDm.sendWhisper(dialogueText.trim(), whisperTarget.user_id, whisperTarget.character_name);
                      setWhisperTarget(null);
                    } else {
                      const whisperMatch = dialogueText.trim().match(/^>(\S+)\s+(.+)$/s);
                      const npcMultiMatch = dialogueText.trim().match(/^((?:@\S+\s+)+)(.+)$/s);
                      if (whisperMatch) {
                        const targetMember = members.find(m => m.character_name.toLowerCase() === whisperMatch[1].toLowerCase());
                        if (targetMember && targetMember.user_id !== currentUserId) {
                          partyDm.sendWhisper(whisperMatch[2], targetMember.user_id, targetMember.character_name);
                        } else if (!targetMember) {
                          toast.error('Player "' + whisperMatch[1] + '" not found');
                          return;
                        } else {
                          toast.error('You cannot whisper to yourself');
                          return;
                        }
                      } else if (npcMultiMatch) {
                        if (partyDm.isGenerating) {
                          toast('Wait for the NPC to finish speaking…', { duration: 2000, icon: '⏳' });
                          return;
                        }
                        const npcNames = [...npcMultiMatch[1].matchAll(/@(\S+)/g)].map(m => m[1]);
                        const message = npcMultiMatch[2];
                        if (npcNames.length > 0 && message.trim()) {
                          partyDm.voiceNPC(npcNames.length === 1 ? npcNames[0] : npcNames, message);
                        }
                      } else {
                        partyDm.sendDialogueMessage(dialogueText.trim());
                      }
                    }
                    setDialogueText('');
                    if (dialogueInputRef.current) dialogueInputRef.current.style.height = 'auto';
                  }
                }}
                disabled={!dialogueText.trim()}
                className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ touchAction: 'manipulation' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <button
                onClick={partyDm.callDM}
                disabled={partyDm.isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 font-cinzel font-semibold text-sm transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ touchAction: 'manipulation' }}
              >
                <Crown className="w-4 h-4" />
                Call the DM
               </button>
            {partyDm.isGenerating && (
              <div className="flex items-center justify-center gap-1.5 py-1">
                <Loader2 className="w-3 h-3 text-amber-400/70 animate-spin" />
                <span className="text-xs text-amber-400/50">NPC is thinking…</span>
              </div>
            )}
          </div>
        ) : partyDm.isGenerating && !isDialogueMode ? (
          partyDm.sessionConfig?.npcSceneActive ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <textarea
                value={npcInterjectionText}
                onChange={e => {
                  setNpcInterjectionText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                placeholder="Speak up — the NPCs will react to you..."
                rows={1}
                className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none border border-amber-900/30 focus:ring-1 focus:ring-amber-500/30 focus:outline-none max-h-[120px]"
                style={{ touchAction: 'manipulation' }}
              />
              <button
                onClick={() => {
                  if (npcInterjectionText.trim()) {
                    partyDm.submitNpcInterjection(npcInterjectionText.trim());
                    setNpcInterjectionText('');
                  }
                }}
                disabled={!npcInterjectionText.trim()}
                className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ touchAction: 'manipulation' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 text-amber-400/70 animate-spin" />
              <span className="text-xs text-amber-400/50">Scene in progress — jump in anytime</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-400/70">Generating response...</span>
            {isCreator && (
              <button
                onClick={partyDm.stopGeneration}
                className="ml-2 px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                Stop
              </button>
            )}
          </div>
        )) : !hasSubmitted && !isMyTurn ? (
          <div className="max-w-2xl mx-auto py-4 px-3 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Loader2 className="w-3.5 h-3.5 text-amber-400/70 animate-spin" />
              <span className="text-xs text-amber-300/80">Waiting for {turnHolderName}'s turn</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              It's not your turn yet. Chat with the party, check your character, or just enjoy the story — you'll get your turn right after {turnHolderName} acts.
            </p>
          </div>
        ) : !hasSubmitted ? (
          <>
            {isEmpyrean && partyDm.messages.length > 0 && (
              <EmpyreanContextualActions
                situation={partySituation}
                characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Rider'}
                dragonName={dragonBonds.myDragon?.dragonName || ''}
                signetType={dragonBonds.myDragon?.signetType || ''}
                onAction={(prompt) => {
                  setRecapDismissed(true);
                  dispatchPrompt(prompt);
                }}
                disabled={partyDm.isGenerating}
                isUnbonded={!dragonBonds.isSetup || !dragonBonds.myDragon?.dragonName}
                fetchMasterworkPills={handleFetchMasterworkPills}
                currentBurnout={dragonBonds.myDragon?.burnout ?? 0}
                maxBurnout={8}
                onArmSignet={(intensity) => {
                  setArmedSignetIntensity(intensity);
                  toast(`🔥 Signet armed at intensity ${intensity}/8. It channels when you ready up.`, { icon: '⚡' });
                }}
              />
            )}
            {!chatRoundsOn && (
              <PartyDMInput
                ref={playerInputRef}
                onSubmit={handleSubmit}
                onReady={partyDm.setReady}
                onReadyAutopilot={handleReadyAutopilot}
                hasAfkGuide={!!myAfkGuide}
                onPaste={handlePaste}
                hasPrompt={!!partyDm.myPrompt}
                currentUserId={currentUserId}
                isUploadingPhoto={isUploadingPhoto}
                isUploadingVideo={isUploadingVideo}
                isUploadingAudio={isUploadingAudio}
                onTakePhoto={() => photoCameraRef.current?.click()}
                onRecordVideo={() => videoCameraRef.current?.click()}
                onPickPhoto={() => { sessionStorage.setItem('pending-file-picker', 'photo'); photoInputRef.current?.click(); }}
                onPickVideo={() => { sessionStorage.setItem('pending-file-picker', 'video'); videoInputRef.current?.click(); }}
                onPickAudio={() => setShowAudioRecorder(true)}
                onPickAudioFile={() => { sessionStorage.setItem('pending-file-picker', 'audio'); audioFileInputRef.current?.click(); }}
                onCreatePoll={() => setShowPollCreator(true)}
                npcNames={partyNPCNames}
              />
            )}
          </>
        ) : !isReady ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-white/40 mb-0.5">Your action:</p>
                  <p className="text-sm text-white/70 truncate">
                    {partyDm.myPrompt?.prompt?.startsWith('<<') && partyDm.myPrompt?.prompt?.endsWith('>>')
                      ? <span className="flex items-center gap-1"><Ghost className="w-3 h-3 text-purple-400 inline" /> Autopilot</span>
                      : (partyDm.myPrompt?.prompt || '(no action)')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const promptText = partyDm.myPrompt?.prompt || '';
                    // Don't restore autopilot prompts to the text input
                    if (promptText && !promptText.startsWith('<<')) {
                      playerInputRef.current?.setText(promptText);
                    }
                    partyDm.retractPrompt();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-amber-900/20 transition-colors text-amber-300/70 hover:text-amber-300 text-xs border border-amber-500/20"
                  style={{ touchAction: 'manipulation' }}
                >
                  Retract
                </button>
              </div>
              <Button
                onClick={partyDm.setReady}
                className="w-full gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300"
                size="sm"
              >
                <Check className="w-4 h-4" />
                Ready
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300/70">
              {isDialogueMode
                ? 'Dialogue mode — chat freely!'
                : isTurnBasedMode
                  ? 'Your turn is in! The AI is responding...'
                  : (partyDm.sessionConfig?.dmMode === 'human')
                    ? 'Ready! Waiting for the DM...'
                    : (partyDm.sessionConfig?.dmMode === 'ai-approval')
                      ? 'Ready! AI will draft a response for DM review...'
                      : 'Ready! Waiting for others...'}
              </span>
              <button
                onClick={() => {
                  const promptText = partyDm.myPrompt?.prompt || '';
                  if (promptText) {
                    playerInputRef.current?.setText(promptText);
                  }
                  partyDm.retractPrompt();
                }}
                disabled={partyDm.isGenerating}
                className="ml-2 px-2 py-0.5 text-[11px] rounded border border-amber-500/30 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors disabled:opacity-40"
              >
                Retract
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Narrator speaker button */}
               {narrator.hasTTSKey && (
                <button
                  onClick={() => {
                    if (narrator.isPlaying) {
                      narrator.stop();
                    } else if (!narrator.isLoading) {
                      setTtsSelectMode(prev => !prev);
                      if (ttsSelectMode) setTtsSelectedIds(new Set());
                    }
                  }}
                  disabled={narrator.isLoading}
                  className={cn(
                    "p-2 rounded-xl border shrink-0 transition-colors",
                    narrator.isPlaying || ttsSelectMode
                      ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                      : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                  )}
                  style={{ touchAction: 'manipulation' }}
                  title={narrator.isPlaying ? "Stop narration" : ttsSelectMode ? "Cancel selection" : "Select messages to narrate"}
                >
                  {narrator.isLoading ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : narrator.isPlaying ? (
                    <VolumeX className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white/50" />
                  )}
                </button>
              )}
              {narrator.hasTTSKey && (
                <NarrationSpeedPopover iconSize="w-4 h-4" />
              )}
              {isCreator && (partyDm.sessionConfig?.dmMode || 'ai') !== 'human' && (
                <Button
                  onClick={partyDm.generateResponse}
                  disabled={partyDm.isGenerating || partyDm.currentPrompts.length === 0}
                  className="gap-1.5 bg-amber-900/40 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300"
                  size="sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {(partyDm.sessionConfig?.dmMode === 'ai-approval') ? 'Generate Draft' : 'Generate Now'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Host generate button (always visible for host when prompts exist) — hidden in human mode */}
        {isCreator && !partyDm.isGenerating && hasSubmitted && !isReady && partyDm.currentPrompts.length > 0 && (partyDm.sessionConfig?.dmMode || 'ai') !== 'human' && (
          <div className="mt-2 flex justify-end max-w-2xl mx-auto">
            <Button
              onClick={partyDm.generateResponse}
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-300 border-amber-500/30"
            >
              <Zap className="w-3.5 h-3.5" />
              {(partyDm.sessionConfig?.dmMode === 'ai-approval') ? 'Generate Draft' : 'Generate Now'}
            </Button>
          </div>
        )}
      </div>
      )}

      {/* Bottom Navigation Drawer */}
      {!isFullscreen && (
        <DMBottomNav
          headerContent={characterContext ? (
            <div className="px-3 pt-2 pb-1">
              <CharacterSheetStrip
                name={characterContext.name || 'Adventurer'}
                level={characterContext.level}
                currentHP={characterContext.currentHP}
                maxHP={characterContext.maxHP}
                xpInLevel={partyXpSnapshot.xpIntoLevel}
                xpNeeded={partyXpSnapshot.xpLevelSpan}
                totalXP={partyXpSnapshot.totalXP}
                nextLevelXP={partyXpSnapshot.nextLevelXP}
                isMilestone={partyXpSnapshot.mode === 'milestone'}
                pendingItemCount={partyPendingItemCount}
                onOpen={() => setShowCharacterSheet(true)}
              />
            </div>
          ) : undefined}
          activeTab={activeNavTab}
          onTabChange={handleNavTabChange}
          isExpanded={navExpanded}
          onExpandedChange={setNavExpanded}
          disabled={partyDm.isGenerating || (isEmpyrean && dragonBonds.myDragon?.signetType && (() => {
            const bLevel = dragonBonds.myDragon!.burnout;
            const bBond = dragonBonds.myDragon!.bond ?? 50;
            const bMax = bBond >= 76 ? 12 : bBond >= 51 ? 11 : bBond >= 26 ? 10 : 8;
            return bLevel >= bMax;
          })())}
          showGeralt={isMomo}
          showWildShape={isMomoMoonDruid}
          isWildShapeActive={wildShape?.state.isTransformed}
          afkLabel={isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.dragonName
            ? dragonBonds.myDragon.dragonName.toUpperCase()
            : undefined}
          afkColor={isEmpyrean && dragonBonds.isSetup ? 'text-amber-400' : undefined}
          afkActiveBg={isEmpyrean && dragonBonds.isSetup ? 'bg-amber-500/10' : undefined}
          diceContent={showDiceContent ? (
            <DMDiceRoller
              characterContext={characterContext!}
              onRollResult={handleDiceRoll}
              disabled={partyDm.isGenerating}
            />
          ) : undefined}
          settingsContent={activeNavTab === 'settings' ? (
            <PartyDMSettings
              narrationStyle={partyNarrationStyle.state}
              onNarrationStyleChange={partyNarrationStyle.setStyle}
              onNarrationIntensityChange={partyNarrationStyle.setIntensity}
              questRewardSplitMode={questRewardSplit.mode}
              roundStyle={roundChat.style}
              onRoundStyleChange={roundChat.updateStyle}
              onQuestRewardSplitModeChange={questRewardSplit.setMode}
              moodPresetFilter={!isEmpyrean ? PARTY_MOOD_PRESETS : undefined}
              onMoodPresetSelected={(presetId) => {
                lastPlayedMoodRef.current = presetId;
                partyDm.setActiveMoodPreset(presetId);
              }}
              mode={mode}
              onToggleMode={() => {
                const newMode = mode === 'shared' ? 'private' : 'shared';
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, mode: newMode as 'shared' | 'private' };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                  // Also persist on parties.private_mode so the RLS SELECT policy
                  // on party_dm_messages enforces per-player visibility.
                  (supabase.from('parties') as any)
                    .update({ private_mode: newMode === 'private' })
                    .eq('id', partyId)
                    .then(() => {});
                }
              }}
              isCreator={isCreator}
              isOriginalCreator={originalCreator}
              partyId={partyId}
              autoSyncEnabled={autoSyncEnabled}
              onToggleAutoSync={onToggleAutoSync}
              selectedModel={selectedDmModel}
              onModelChange={(id) => { setSelectedDmModel(id); saveSelectedModel(id); }}
              isExtracting={isExtracting}
              pushState={pushState}
              onTogglePush={handleTogglePush}
              
              onShowSaves={onShowSaves}
              onShowGuides={onShowGuides}
              onShowCharacterGuideBuilder={onShowCharacterGuideBuilder}
              onShowChat={onShowChat}
              onShowAfkGuide={() => setShowAfkGuide(true)}
              onShowDevAssistant={() => setDevAssistantOpen(true)}
              guidesCount={guidesCount}
              guides={guides}
              myAfkGuide={myAfkGuide}
              myAfkCascadeCount={myAfkCascade?.length ?? 0}
              isSplitActive={partyDm.isSplitActive}
              memberCount={memberCount}
              onShowSplitInitiator={() => setShowSplitInitiator(true)}
              onShowNpcScene={() => setShowNpcScene(true)}
              onShowOocChat={onShowOocChat}
              onRequestCharacterRedo={onRequestCharacterRedo}
              hasPendingRedoRequest={hasPendingRedoRequest}
              chatBackground={chatBackground.background}
              onChatBackgroundUpload={chatBackground.handleImageUpload}
              onChatBackgroundClear={chatBackground.clearBackground}
              chatBackgroundOpacity={chatBackground.settings.opacity}
              chatBackgroundBlur={chatBackground.settings.blur}
              onChatBackgroundOpacityChange={chatBackground.setOpacity}
              onChatBackgroundBlurChange={chatBackground.setBlur}
              onShowRegroupDialog={() => setShowRegroupDialog(true)}
              onShowSplitSummaries={() => setShowSplitSummaries(true)}
              onShowPreSplitChat={() => setShowPreSplitChat(true)}
              onNewCampaign={() => {
                setShowNewCampaignInput(true);
                setNewCampaignName('');
              }}
              onEndSession={partyDm.endSession}
              timerEnabled={localTimerEnabled}
              timerDurationSeconds={localTimerDuration}
              onTimerEnabledChange={(enabled) => {
                setLocalTimerEnabled(enabled);
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, timerEnabled: enabled };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              onTimerDurationChange={(seconds) => {
                setLocalTimerDuration(seconds);
                if (partyDm.sessionConfig) {
                  const updated = { ...partyDm.sessionConfig, timerDurationSeconds: seconds };
                  (supabase.from('party_shared_state') as any)
                    .update({ state_data: updated })
                    .eq('party_id', partyId)
                    .eq('state_type', 'dm_session')
                    .then(() => {});
                }
              }}
              onShowScheduledEvents={() => setShowScheduledEvents(true)}
              dmMode={partyDm.sessionConfig?.dmMode || 'ai'}
              onDmModeChange={async (newMode) => {
                const wasDialogue = partyDm.sessionConfig?.dmMode === 'dialogue';
                partyDm.updateSessionConfig({ dmMode: newMode });

                if (newMode === 'dialogue') {
                  sendTelegramNotification({
                    type: 'custom',
                    partyId,
                    title: '💬 Dialogue Mode Activated',
                    body: 'The DM has enabled dialogue mode. Speak freely in character — no ready-up needed. Use "Call the DM" when you want AI narration.',
                    mode: 'party',
                  });
                }

                if (wasDialogue && newMode !== 'dialogue') {
                  sendTelegramNotification({
                    type: 'custom',
                    partyId,
                    title: '🎭 Dialogue Mode Ended',
                    body: 'The DM has switched back to ' + (newMode === 'ai' ? 'AI DM' : newMode === 'human' ? 'Human DM' : 'AI + Approval') + ' mode. Ready-up is required again.',
                    mode: 'party',
                  });

                  try {
                    const recap = await partyDm.generateDialogueRecap();
                    if (recap) {
                      await (supabase.from('party_dm_messages') as any).insert({
                        party_id: partyId,
                        role: 'assistant',
                        content: `**Dialogue Recap**\n\n${recap}\n\n---\n*The DM resumes narration.*`,
                        sender_user_id: null,
                        sender_name: 'DM',
                      });
                    }
                  } catch (err) {
                    console.warn('Dialogue recap failed:', err);
                  }
                }
              }}
              members={members}
              coHostIds={coHostIds}
              currentUserId={currentUserId}
              onPromoteCoHost={onPromoteCoHost}
              onDemoteCoHost={onDemoteCoHost}
              whisperTrayEnabled={whisperTrayEnabled}
              onWhisperTrayEnabledChange={setWhisperTrayEnabled}
              cinematicModeEnabled={cinematicModeEnabled}
              onCinematicModeEnabledChange={setCinematicMode}
              onShowMemoryAnchors={onAddMemoryAnchor ? () => setShowMemoryAnchors(true) : undefined}
              memoryAnchorsCount={memoryAnchors?.length ?? 0}
              onShowQuests={partyId ? () => setShowQuests(true) : undefined}
              questsCount={questsCount}
              responseMode={partyDm.sessionConfig?.responseMode}
              onResponseModeChange={(modeId) => {
                partyDm.updateSessionConfig({ responseMode: modeId ?? undefined });
              }}
              dialogueAutoIntervene={partyDm.sessionConfig?.dialogueAutoIntervene ?? false}
              onDialogueAutoInterveneChange={(enabled) => partyDm.updateSessionConfig({ dialogueAutoIntervene: enabled })}
              hasBookmark={!!bookmarkedMessageId}
              onClearBookmark={() => {
                if (bookmarkKey) {
                  localStorage.removeItem(bookmarkKey);
                  setBookmarkedMessageId(null);
                  toast.success('Bookmark cleared');
                }
              }}
              onReclaimTurn={partyDm.reclaimTurn}
              onRedoLastRound={partyDm.redoLastRound}
            />
          ) : undefined}
          oracleContent={activeNavTab === 'oracle' && characterContext ? (() => {
            const bmIdx = bookmarkedMessageId
              ? partyDm.messages.findIndex(m => m.id === bookmarkedMessageId)
              : -1;
            const narrativeSlice = bmIdx >= 0
              ? partyDm.messages.slice(bmIdx)
              : partyDm.messages.slice(-35);
            const filteredNarrative = narrativeSlice
              .filter(m => m.role === 'user' || m.role === 'assistant');
            return (
              <OraclePanel
                characterContext={{
                  ...characterContext,
                  campaignSummary: partyDm.sessionConfig?.campaignSummary || undefined,
                  gmGuidesContent: gmGuidesContent || undefined,
                  memoryAnchors: memoryAnchorsContent || undefined,
                  recentNarrative: filteredNarrative.map(m => ({
                    role: m.role,
                    name: m.sender_name,
                    content: m.content,
                  })),
                  partyMembers: members
                    .filter(m => m.user_id !== currentUserId && m.character_name)
                    .map(m => {
                      const cs = m.character_status as any;
                      const qa = cs?.quickActions;
                      return {
                        name: m.character_name,
                        level: cs?.level,
                        className: cs?.className,
                        currentHP: cs?.currentHP,
                        maxHP: cs?.maxHP,
                        ac: cs?.ac,
                        conditions: cs?.conditions,
                        race: cs?.race,
                        gender: cs?.gender,
                        multiclassLevels: cs?.multiclassLevels,
                        abilityScores: cs?.abilityScores,
                        equippedAbilities: qa?.abilities?.map((a: any) => a.name)?.slice(0, 10),
                        preparedSpells: qa?.spells?.map((s: any) => s.name)?.slice(0, 15),
                        spellSlots: cs?.spellSlots
                          ? Object.entries(cs.spellSlots)
                              .filter(([, s]: any) => s?.max > 0)
                              .map(([lvl, s]: any) => ({ level: Number(lvl), current: s.current, max: s.max }))
                          : undefined,
                      };
                    }),
                }}
                bookmarkActive={bmIdx >= 0}
                bookmarkMessageCount={filteredNarrative.length}
                onQuestExtracted={async (quests) => {
                  try {
                    const { data: existingState } = await supabase
                      .from('party_shared_state')
                      .select('id, state_data')
                      .eq('party_id', partyId!)
                      .eq('state_type', 'quest_flags')
                      .maybeSingle();

                    const existingFlags = (existingState?.state_data as Record<string, any>) || {};
                    const updatedFlags = { ...existingFlags };
                    for (const q of quests) {
                      if (q.key && q.status) {
                        updatedFlags[q.key] = { status: q.status, notes: q.notes || '', updated_at: new Date().toISOString() };
                      }
                    }

                    if (existingState) {
                      await supabase.from('party_shared_state').update({ state_data: updatedFlags }).eq('id', existingState.id);
                    } else {
                      await supabase.from('party_shared_state').insert({
                        party_id: partyId!,
                        user_id: currentUserId,
                        state_type: 'quest_flags',
                        state_data: updatedFlags,
                      });
                    }
                    toast.success(`📜 ${quests.length} quest(s) added to quest log`);
                  } catch (err) {
                    console.warn('[PartyDM] Oracle quest save failed:', err);
                  }
                }}
              />
            );
          })() : undefined}
          wildshapeContent={activeNavTab === 'wildshape' && wildShape && wildShape.config ? (
            <div className="px-3 py-3">
              <WildShapeSection wildShape={wildShape} characterName={characterContext?.name || 'Adventurer'} />
            </div>
          ) : undefined}
        />
      )}



      {/* Geralt Gameplay Widget (momo only) */}
      {isMomo && (
        <GeraltGameplayWidget
          open={showGeraltWidget}
          onClose={() => setShowGeraltWidget(false)}
          characterId={geraltCharacterId}
          onHpChange={handleGeraltHpChange}
          onUsePrompt={handleUsePrompt}
        />
      )}

      {/* Quick Actions Drawer */}
      <PartyDMQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        characterContext={characterContext}
        characterName={characterContext?.name || 'The Adventurer'}
        onUsePrompt={handleUsePrompt}
        onHealingItemUsed={handleHealingItemUsed}
        empyreanDragonName={isEmpyrean && dragonBonds.myDragon?.dragonName ? dragonBonds.myDragon.dragonName : undefined}
      />
      <DiceRollOverlay />
      {/* Infinity Stone DM Drawer */}
      <InfinityStoneDMDrawer
        open={showStoneDrawer}
        onOpenChange={setShowStoneDrawer}
        characterName={characterContext?.name || 'The Adventurer'}
        onUsePrompt={handleUsePrompt}
      />

      {/* Split Party Overlays */}
      <SplitInitiator
        open={showSplitInitiator}
        onClose={() => setShowSplitInitiator(false)}
        members={members}
        currentUserId={currentUserId}
        onInitiate={(alphaMembers, alphaName, betaName) => partyDm.initiateSplit(alphaMembers, alphaName, betaName)}
      />
      <RegroupDialog
        open={showRegroupDialog}
        onClose={() => setShowRegroupDialog(false)}
        onRegroup={(prompt) => partyDm.regroupParty(prompt)}
        isGenerating={partyDm.isGenerating}
      />
      <NpcSceneDialog
        open={showNpcScene}
        onClose={() => setShowNpcScene(false)}
        onStart={(npcs, prompt, max) => partyDm.startNpcScene(npcs, prompt, max)}
        sessionConfig={partyDm.sessionConfig}
        messages={partyDm.allMessages}
      />
      {partyDm.splitState && (
        <SplitSummariesViewer
          open={showSplitSummaries}
          onClose={() => setShowSplitSummaries(false)}
          splitState={partyDm.splitState}
        />
      )}
      {partyDm.splitState && (
        <PreSplitChatViewer
          open={showPreSplitChat}
          onClose={() => setShowPreSplitChat(false)}
          splitState={partyDm.splitState}
        />
      )}

      {/* AFK Personality Guide Dialog */}
      {partyDm.sessionConfig && currentUserId && (
        <AfkPersonalityGuide
          open={showAfkGuide}
          onOpenChange={setShowAfkGuide}
          partyId={partyId || ''}
          userId={currentUserId}
          characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Unknown'}
          currentGuide={myAfkGuide}
          currentCascade={myAfkCascade}
          onSaved={(guide, cascade) => {
            setMyAfkGuide(guide);
            setMyAfkCascade(cascade);
          }}
        />
      )}

      {/* Scheduled Events Sheet (host only) */}
      {isCreator && partyId && (
        <ScheduledEventsSheet
          open={showScheduledEvents}
          onOpenChange={setShowScheduledEvents}
          partyId={partyId}
        />
      )}

      {/* Memory Anchors Panel */}
      {showMemoryAnchors && memoryAnchors && onAddMemoryAnchor && onRemoveMemoryAnchor && (
        <PartyMemoryAnchorsPanel
          anchors={memoryAnchors}
          onAdd={onAddMemoryAnchor}
          onRemove={onRemoveMemoryAnchor}
          onBack={() => setShowMemoryAnchors(false)}
          isCreator={isCreator}
        />
      )}

      {/* Party Quests Panel */}
      {showQuests && partyId && currentUserId && (
        <PartyQuestsPanel
          partyId={partyId}
          userId={currentUserId}
          isCreator={isCreator}
          onBack={() => setShowQuests(false)}
          onAnnounce={(text) => dispatchPrompt(text)}
        />
      )}
      {/* Dragon Rider Setup Sheet */}
      <DragonRiderSetupSheet
        open={showDragonSetup}
        onOpenChange={setShowDragonSetup}
        initialConfig={dragonBonds.myDragon}
        characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Rider'}
        onSave={(formData) => {
          dragonBonds.saveMyDragon({
            ...formData,
            bond: dragonBonds.myDragon?.bond ?? 15,
            trust: dragonBonds.myDragon?.trust ?? 10,
            mood: dragonBonds.myDragon?.mood ?? 'calm',
            burnout: dragonBonds.myDragon?.burnout ?? 0,
            memories: dragonBonds.myDragon?.memories ?? [],
          });
        }}
      />

      {/* Whisper-driven dice roller (Empyrean party mode) */}
      <Sheet open={diceRollerOpen} onOpenChange={setDiceRollerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col">
          <DMDiceRoller
            rollHint={diceRollerWhisperText ? parseRollHint(diceRollerWhisperText) : null}
            characterContext={(() => {
              const myMember = members.find(m => m.user_id === currentUserId);
              return {
                level: (myMember as any)?.level ?? 1,
                abilityScores: (myMember as any)?.ability_scores ?? (myMember as any)?.stats ?? {},
                skillProficiencies: (myMember as any)?.skill_proficiencies ?? [],
                savingThrowProficiencies: (myMember as any)?.saving_throw_proficiencies ?? [],
              } as any;
            })()}
            onRollResult={(text: string) => {
              dispatchPrompt(text);
              setDiceRollerOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Dragon Telegram Scheduler (host only, empyrean mode) */}
      {isCreator && isEmpyrean && partyId && (
        <DragonTelegramScheduler
          open={showDragonTelegramScheduler}
          onOpenChange={setShowDragonTelegramScheduler}
          partyId={partyId}
          dragons={dragonBonds.allDragonConfigs.filter(d => d.config.dragonName).map(d => ({
            userId: d.userId,
            dragonName: d.config.dragonName,
            signetType: d.config.signetType,
            dragonNotes: (d.config as any).dragonNotes ?? '',
            mood: d.config.mood ?? 'calm',
            bond: d.config.bond ?? 15,
            trust: d.config.trust ?? 10,
          }))}
          isCreator={isCreator}
        />
      )}

      {/* Dev Assistant */}
      <DevAssistantChat
        open={devAssistantOpen}
        onClose={() => setDevAssistantOpen(false)}
      />

      {/* Party Dragon Chat */}
      {isEmpyrean && dragonBonds.isSetup && (
        <PartyDragonChat
          open={showDragonChat}
          onClose={() => setShowDragonChat(false)}
          dragonNotes={dragonBonds.myDragon?.dragonNotes || ''}
          onUpdateNotes={(notes) => {
            dragonBonds.updateMyDragon({ dragonNotes: notes });
          }}
          dragonName={dragonBonds.myDragon?.dragonName || ''}
          characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Rider'}
          messages={dragonBonds.dragonChatMessages}
          onSend={(text) => {
            const narrative = partyDm.messages
              .filter(m => m.role === 'assistant' && m.sender_name === 'DM')
              .slice(-5)
              .map(m => m.content.length > 15000 ? m.content.slice(0, 15000) + '…' : m.content);
            dragonBonds.sendDragonMessage(text, members.find(m => m.user_id === currentUserId)?.character_name || 'Rider', narrative);
          }}
          isLoading={dragonBonds.isSending}
          bondState={{
            bond: dragonBonds.myDragon?.bond ?? 15,
            trust: dragonBonds.myDragon?.trust ?? 10,
            mood: dragonBonds.myDragon?.mood ?? 'calm',
          }}
          onRequestOpinion={async () => {
            const narrative = partyDm.messages
              .filter(m => m.role === 'assistant' && m.sender_name === 'DM')
              .slice(-5)
              .map(m => m.content.length > 15000 ? m.content.slice(0, 15000) + '…' : m.content);
            if (narrative.length === 0) return null;
            return dragonBonds.generateDragonOpinion(
              members.find(m => m.user_id === currentUserId)?.character_name || 'Rider',
              narrative,
            );
          }}
          myUserId={currentUserId}
          dragonNetworkMessages={EMPTY_DRAGON_NETWORK}
          otherDragons={dragonBonds.allDragonConfigs
            .filter(d => d.userId !== currentUserId && d.config.dragonName)
            .map(d => ({
              dragonName: d.config.dragonName,
              userId: d.userId,
              characterName: members.find(m => m.user_id === d.userId)?.character_name || 'Unknown',
            }))}
          onVoiceAsMyDragon={(text, targetDragonName) => {
            return dragonBonds.voiceAsMyDragon(
              text,
              targetDragonName,
              members.find(m => m.user_id === currentUserId)?.character_name || 'Rider',
            );
          }}
          onDeliverNetworkMessage={async (targetDragonName, targetUserId, voicedText, originalText, replyToId) => {
            await dragonBonds.deliverNetworkMessage(
              targetDragonName, targetUserId, voicedText, originalText, replyToId,
            );
            setShowEmpyreanBanner(true);
          }}
          isVoicing={dragonBonds.isVoicing}
          onClearChat={() => dragonBonds.clearDragonChat()}
          onDeleteMessage={(index) => dragonBonds.deleteFromDragonChat(index)}
          memories={(dragonBonds.myDragon?.memories || []) as any}
          onDeleteMemory={async (memoryId: string) => {
            const currentMemories = (dragonBonds.myDragon?.memories || []) as Array<{ id: string; text: string; source: string; createdAt: string }>;
            const filtered = currentMemories.filter(m => m.id !== memoryId);
            await dragonBonds.updateMyDragon({ memories: filtered as any });
          }}
          onAddMemory={async (text: string, source: string) => {
            const currentMemories = (dragonBonds.myDragon?.memories || []) as Array<{ id: string; text: string; source: string; createdAt: string }>;
            if (currentMemories.length >= 30) return;
            const newMemory = { id: crypto.randomUUID(), text, source, createdAt: new Date().toISOString() };
            await dragonBonds.updateMyDragon({ memories: [...currentMemories, newMemory] as any });
          }}
          onClearAllMemories={async () => {
            await dragonBonds.updateMyDragon({ memories: [] as any });
          }}
        />
      )}

      {/* Cinematic Slideshow */}
      {showSlideshow && slideshowSlides.length > 0 && (
        <CinematicSlideshow
          slides={slideshowSlides}
          onComplete={() => {
            setShowSlideshow(false);
            setSlideshowSlides([]);
            // After cinematic ends, show reading mode so player can read the full text
            const lastMessage = partyDm.messages[partyDm.messages.length - 1];
            if (lastMessage?.role === 'assistant' && lastMessage.content?.trim()) {
              setReadingMode(true);
            }
          }}
        />
      )}

      {/* Death Save Screen */}
      <DeathSaveScreen
        open={showDeathSaves}
        characterName={members.find(m => m.user_id === currentUserId)?.character_name || 'Rider'}
        dragonName={dragonBonds.myDragon?.dragonName || 'your dragon'}
        onStabilize={() => {
          setShowDeathSaves(false);
          onHPChange?.(1, 'healing');
        }}
        onDeath={() => {
          setShowDeathSaves(false);
          setShowDeathTransition(true);
          setTimeout(() => {
            setShowDeathTransition(false);
            if (EMPYREAN_FEATURE_FLAGS.showMemorialScreen) {
              setShowMemorial(true);
            } else {
              // Memorial hidden — run rebirth logic inline (mirrors MemorialScreen.onBeginAgain in this file)
              setIsUnbonded(true);
              localStorage.setItem('odyssey-unbonded-rebirth', 'true');
              toast('Your rider has fallen. Return to the hall to try again.', { duration: 4000 });
              onBack();
            }
          }, 2000);
        }}
      />

      {/* Death transition — black with pulsing red dot */}
      {showDeathTransition && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, backgroundColor: '#0a0908' }}>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#c94444',
              boxShadow: '0 0 12px 4px rgba(201,68,68,0.5)',
              animation: 'memorial-ember-pulse 1.2s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes memorial-ember-pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.5); }
            }
          `}</style>
        </div>
      )}

      {/* Memorial Screen */}
      <MemorialScreen
        open={showMemorial}
        riderName={members.find(m => m.user_id === currentUserId)?.character_name || 'Rider'}
        dragonName={dragonBonds.myDragon?.dragonName || 'Unknown Dragon'}
        dragonColor="#7a8fa6"
        signetType={dragonBonds.myDragon?.signetType || '—'}
        bondLevel={dragonBonds.myDragon?.bond ?? 0}
        maxBondLevel={100}
        characterLevel={characterContext?.level || 1}
        sessionsPlayed={0}
        causeOfDeath="Burnout — failed to ground"
        squadName="Basgiath War College"
        onBeginAgain={() => {
          setShowMemorial(false);
          setIsUnbonded(true);
          localStorage.setItem('odyssey-unbonded-rebirth', 'true');
          onBack();
        }}
      />

      {/* Reading Mode Overlay */}
      <AnimatePresence>
        {readingMode && (() => {
          const lastAssistant = [...partyDm.messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
          if (!lastAssistant) return null;

          const parsed = parseWhispers(lastAssistant.content || '');

          return (
            <motion.div
              key="reading-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#0a0a10] via-[#0d0d14] to-[#0a0a10]"
            >
              <style>{`
                .rm-narration {
                  font-size: 18px;
                  line-height: 1.8;
                  color: #e4e4e7;
                  margin-bottom: 24px;
                  font-family: 'Georgia', 'Times New Roman', serif;
                }
                .rm-action {
                  font-size: 17px;
                  line-height: 1.7;
                  color: #fca5a5;
                  margin-bottom: 24px;
                  font-family: 'Georgia', serif;
                  padding-left: 12px;
                  border-left: 2px solid #ef444440;
                }
                .rm-internal {
                  font-size: 17px;
                  line-height: 1.8;
                  color: #a1a1aa;
                  font-style: italic;
                  margin-bottom: 24px;
                  font-family: 'Georgia', serif;
                }
                .rm-dialogue {
                  margin-bottom: 20px;
                }
                .rm-speaker {
                  display: block;
                  font-size: 11px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.12em;
                  margin-bottom: 4px;
                  font-family: -apple-system, sans-serif;
                }
                .rm-speech {
                  display: block;
                  font-size: 18px;
                  line-height: 1.7;
                  padding-left: 14px;
                  border-left: 3px solid currentColor;
                  font-family: 'Georgia', serif;
                }
                .rm-pullquote {
                  font-size: 22px;
                  line-height: 1.6;
                  color: #fbbf24;
                  font-style: italic;
                  text-align: center;
                  padding: 24px 16px;
                  margin: 32px 0;
                  border-top: 1px solid #fbbf2420;
                  border-bottom: 1px solid #fbbf2420;
                  font-family: 'Georgia', serif;
                }
                .rm-dramatic {
                  color: #f9a8d4;
                  font-style: italic;
                }
                .rm-ambient {
                  color: #6b7280;
                  font-style: italic;
                  font-size: 15px;
                }
                .rm-highlight {
                  color: #fbbf24;
                  font-weight: 700;
                }
                .rm-beat {
                  height: 32px;
                }
                .rm-divider {
                  height: 1px;
                  background: linear-gradient(to right, transparent, #ffffff15, transparent);
                  margin: 32px 0;
                }
                @keyframes rm-shimmer {
                  0% { background-position: -200% 0; }
                  100% { background-position: 200% 0; }
                }
                .rm-shimmer-line {
                  height: 16px;
                  border-radius: 8px;
                  background: linear-gradient(90deg, #ffffff08 25%, #ffffff15 50%, #ffffff08 75%);
                  background-size: 200% 100%;
                  animation: rm-shimmer 1.5s ease infinite;
                  margin-bottom: 12px;
                }
                @keyframes rm-particle-float {
                  0%, 100% { opacity: 0; transform: translateY(0) translateX(0); }
                  20% { opacity: 0.6; }
                  80% { opacity: 0.4; }
                  100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift)); }
                }
              `}</style>

              {/* Ambient background tint */}
              <div
                className="absolute inset-0 z-0 transition-colors duration-[2s]"
                style={{
                  background: formattedReading
                    ? `radial-gradient(ellipse at 50% 30%, ${formattedReading.ambientColor}30 0%, #0a0a10 70%)`
                    : 'none',
                }}
              />

              {/* Particle layer */}
              {formattedReading && formattedReading.particles !== 'none' && (
                <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: 2 + Math.random() * 3,
                        height: 2 + Math.random() * 3,
                        left: `${Math.random() * 100}%`,
                        bottom: '-5%',
                        background:
                          formattedReading.particles === 'embers' ? '#f59e0b' :
                          formattedReading.particles === 'sparks' ? '#fbbf24' :
                          formattedReading.particles === 'snow' ? '#e2e8f0' :
                          formattedReading.particles === 'dust' ? '#a1a1aa' :
                          formattedReading.particles === 'mist' ? '#94a3b8' :
                          '#94a3b8',
                        opacity: 0,
                        animation: `rm-particle-float ${6 + Math.random() * 8}s ease-in-out ${Math.random() * 5}s infinite`,
                        ['--drift' as string]: `${(Math.random() - 0.5) * 40}px`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Minimal header */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10">
                <span className="text-[10px] font-cinzel uppercase tracking-[0.2em] text-amber-500/40">
                  The DM Speaks
                </span>
                <button
                  onClick={() => setReadingMode(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-8 pb-36 relative z-10">
                <div className="max-w-2xl mx-auto pt-4">
                  {isFormattingReading ? (
                    /* Loading shimmer */
                    <div className="space-y-1">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="rm-shimmer-line"
                          style={{ width: `${50 + Math.random() * 50}%`, animationDelay: `${i * 0.08}s` }}
                        />
                      ))}
                    </div>
                  ) : formattedReading ? (
                    /* AI-formatted cinematic HTML */
                    <>
                      {formattedReading.pullQuote && (
                        <div className="text-center mb-8 pt-4">
                          <p className="text-xl font-serif italic text-amber-400/60 leading-relaxed px-4">
                            &ldquo;{formattedReading.pullQuote}&rdquo;
                          </p>
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: formattedReading.html }} />
                    </>
                  ) : (
                    /* Fallback: plain text */
                    <>
                      <div className="prose prose-invert prose-lg max-w-none leading-relaxed">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {parsed.narrative}
                        </ReactMarkdown>
                      </div>
                      {parsed.whispers.length > 0 && (
                        <div className="mt-6">
                          <WhisperTray whispers={parsed.whispers} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Whisper tray for formatted mode */}
                  {formattedReading && !isFormattingReading && (() => {
                    if (parsed.whispers.length === 0) return null;
                    return (
                      <div className="mt-8">
                        <WhisperTray whispers={parsed.whispers} />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Fixed bottom action */}
              <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#0a0a10] via-[#0a0a10]/95 to-transparent relative z-10">
                <button
                  onClick={() => setReadingMode(false)}
                  className="w-full py-4 rounded-xl border border-amber-500/30 bg-amber-900/20 hover:bg-amber-900/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Swords className="w-5 h-5 text-amber-400" />
                  <span className="font-cinzel text-sm font-bold uppercase tracking-[0.15em] text-amber-300">
                    Done Reading — Ready to Play
                  </span>
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {characterContext && (
        <SoloCharacterSheet
          open={showCharacterSheet}
          origin="party"
          onViewPartySheets={() => setShowPartySheets(true)}
          partySheetCount={members.filter(m => m.user_id !== currentUserId).length}
          onClose={() => setShowCharacterSheet(false)}
          ctx={characterContext}
          currentXP={currentXP ?? 0}
          gold={characterContext.gold ?? 0}
          quests={sheetQuests.quests}
          onAcceptQuest={isCreator ? (key) => {
            const quest = sheetQuests.quests.find(q => q.key === key);
            if (!quest) return;
            const accepted = withQuestEvent({ ...quest, status: 'active' }, 'accepted', 'Quest accepted by the party — the DM is now tracking it.');
            sheetQuests.upsertQuest(accepted);
            // Kick the quest off immediately: the DM narrates the opening beat toward the next objective.
            dispatchPrompt(buildQuestKickoffPrompt(accepted, { party: true, styleLine: narrationStyleLine(partyNarrationStyle.state) }));
          } : undefined}
          onDeclineQuest={isCreator ? (key) => sheetQuests.removeQuest(key) : undefined}
          onScanQuests={isCreator ? onScanQuests : undefined}
          worldState={worldState}
          scanningQuests={isExtracting}
          onAdjustHP={(change, type) => onHPChange?.(change, type)}
          onAddXP={() => {}}
          onManualLevelUp={onManualLevelUp}
          onConditionChange={() => {}}
          onRest={onRestOccurred}
          onRestPrompt={(text) => dispatchPrompt(text)}
          onAcceptItem={onAcceptItem}
          onUseLootItem={(text) => {
            if (chatRoundsOnRef.current) { dispatchPrompt(text); return; }
            playerInputRef.current?.appendText(text);
          }}
        />
      )}

      <PartyMemberSheets
        open={showPartySheets}
        onClose={() => setShowPartySheets(false)}
        members={members}
        currentUserId={currentUserId}
      />
    </div>

  );
}
