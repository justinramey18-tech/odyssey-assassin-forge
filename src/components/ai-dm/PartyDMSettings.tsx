import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DM_MODELS, getModelLabel } from '@/lib/dm-models';
import { Eye, EyeOff, Zap, Map, FolderOpen, BookOpen, MessageSquare, Ghost, Bell, BellOff, GitBranch, Users, Plus, X, ClipboardList, Timer, Music, CalendarClock, Crown, Bot, Pen, ShieldCheck, MessageCircle, Heart, Cpu, Brain, Palette, BookmarkX, ScrollText, Sword, Theater, Megaphone, Film, RefreshCw, Code2, Image as ImageIcon, Trash2, Undo2, RotateCcw, Download, UserPlus, Lock, HelpCircle } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import iconSavesAsset from '@/assets/tools/icon-saves.png.asset.json';
import iconNewCampaignAsset from '@/assets/tools/icon-new-campaign.png.asset.json';
import iconDownloadStoryAsset from '@/assets/tools/icon-download-story.png.asset.json';
import iconOfflineNarrationAsset from '@/assets/tools/icon-offline-narration.png.asset.json';
import iconBattleMapAsset from '@/assets/tools/icon-battle-map.png.asset.json';
import iconQuestLogAsset from '@/assets/tools/icon-quest-log.png.asset.json';
import iconMemoryAnchorsAsset from '@/assets/tools/icon-memory-anchors.png.asset.json';
import iconScheduledEventsAsset from '@/assets/tools/icon-scheduled-events.png.asset.json';
import iconCharacterRedoAsset from '@/assets/tools/icon-character-redo.png.asset.json';
import iconGmGuidesAsset from '@/assets/tools/icon-gm-guides.png.asset.json';
import iconCreateCharacterAsset from '@/assets/tools/icon-create-character.png.asset.json';
import iconDownloadGuidesAsset from '@/assets/tools/icon-download-guides.png.asset.json';
import iconPartyChatAsset from '@/assets/tools/icon-party-chat.png.asset.json';
import iconAfkGuideAsset from '@/assets/tools/icon-afk-guide.png.asset.json';
import iconDevAssistantAsset from '@/assets/tools/icon-dev-assistant.png.asset.json';
import iconBookmarkAsset from '@/assets/tools/icon-bookmark.png.asset.json';
import iconChatBackgroundAsset from '@/assets/tools/icon-chat-background.png.asset.json';
import iconHowToPlayAsset from '@/assets/tools/icon-how-to-play.png.asset.json';
import toolsRowPlateAsset from '@/assets/tools/tools-row-plate.png.asset.json';
import toolsDividerAsset from '@/assets/tools/tools-divider.png.asset.json';

const iconSaves = iconSavesAsset.url;
const iconNewCampaign = iconNewCampaignAsset.url;
const iconDownloadStory = iconDownloadStoryAsset.url;
const iconOfflineNarration = iconOfflineNarrationAsset.url;
const iconBattleMap = iconBattleMapAsset.url;
const iconQuestLog = iconQuestLogAsset.url;
const iconMemoryAnchors = iconMemoryAnchorsAsset.url;
const iconScheduledEvents = iconScheduledEventsAsset.url;
const iconCharacterRedo = iconCharacterRedoAsset.url;
const iconGmGuides = iconGmGuidesAsset.url;
const iconCreateCharacter = iconCreateCharacterAsset.url;
const iconDownloadGuides = iconDownloadGuidesAsset.url;
const iconPartyChat = iconPartyChatAsset.url;
const iconAfkGuide = iconAfkGuideAsset.url;
const iconDevAssistant = iconDevAssistantAsset.url;
const iconBookmark = iconBookmarkAsset.url;
const iconChatBackground = iconChatBackgroundAsset.url;
const iconHowToPlay = iconHowToPlayAsset.url;
const toolsRowPlate = toolsRowPlateAsset.url;
const toolsDivider = toolsDividerAsset.url;

type ToolGroup = 'campaign' | 'narration' | 'lore' | 'table' | 'host';

interface ToolEntry {
  id: string;
  group: ToolGroup;
  show: boolean;
  /** false = Settings only, hidden on the Tools screen */
  screen?: boolean;
  icon: React.ReactNode;
  medallion?: string;
  mark?: 'remove';
  label: string;
  description?: string;
  badge?: number;
  onClick?: () => void;
  disabled?: boolean;
  after?: React.ReactNode;
}

const TOOL_GROUPS: { id: ToolGroup; title: string }[] = [
  { id: 'campaign', title: 'Campaign' },
  { id: 'narration', title: 'Narration' },
  { id: 'lore', title: 'Lore & Guides' },
  { id: 'table', title: 'Table' },
  { id: 'host', title: 'Host Tools' },
];
import { exportPartyStory } from '@/lib/exportPartyStory';
import { exportGMGuides } from '@/lib/exportGMGuides';
import { DMSpotifyControls } from '@/components/spotify/DMSpotifyControls';
import { TimerSettings } from './RoundTimer';
import { ResponseModeSelector } from './ResponseModeSelector';
import type { PushSubscriptionState } from '@/lib/push-subscription';
import type { DmMode } from '@/hooks/use-party-dm';
import { QUEST_REWARD_SPLIT_MODES, questRewardSplitLabel, type QuestRewardSplitMode } from '@/lib/questRewardSplit';
import { CHAOS_LABELS } from '@/hooks/use-round-chat';
import type { RoundStyle } from '@/hooks/use-round-chat';

import { NarrationStyleControl } from './NarrationStyleControl';
import { DEFAULT_NARRATION_STATE, type NarrationIntensity, type NarrationStyleId, type NarrationStyleState } from '@/lib/narrationStyle';

interface ToolRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: number;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolRow({ icon, label, description, badge, onClick, disabled }: ToolRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px]",
        "hover:bg-muted/20 active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 text-left min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {badge != null && badge > 0 && (
        <span className="shrink-0 w-5 h-5 rounded-full bg-amber-600 text-[10px] flex items-center justify-center text-white font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function ToolsGroupHeader({ title }: { title: string }) {
  return (
    <div className="mt-2.5 shrink-0" role="heading" aria-level={3}>
      <span className="-mb-1 block pl-6 font-cinzel text-[11.5px] font-bold uppercase tracking-[0.22em] text-[#E9C77B] [text-shadow:0_1px_2px_#000]">
        {title}
      </span>
      <div
        aria-hidden="true"
        style={{ height: 18, borderStyle: 'solid', borderWidth: '0 8px 0 18px', borderImage: `url(${toolsDivider}) 0 60 0 120 fill / 0 8px 0 18px stretch` }}
      />
    </div>
  );
}

function OrnateToolRow({ entry }: { entry: ToolEntry }) {
  return (
    <button
      type="button"
      onClick={entry.onClick}
      disabled={entry.disabled}
      className="relative flex h-[76px] w-full shrink-0 items-center text-left transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-[.4]"
      style={{
        touchAction: 'manipulation',
        borderStyle: 'solid',
        borderWidth: '0 20px 0 68px',
        borderImage: `url(${toolsRowPlate}) 0 64 0 216 fill / 0 20px 0 68px stretch`,
        padding: '0 4px 0 6px',
      }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 h-[50px] w-[50px] -translate-y-1/2" style={{ left: -58 }}>
        {entry.medallion
          ? <img src={entry.medallion} alt="" className={cn('h-full w-full', entry.mark === 'remove' && 'opacity-55 grayscale-[.5]')} />
          : <span className="flex h-full w-full items-center justify-center text-amber-300">{entry.icon}</span>}
        {entry.mark === 'remove' && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-red-300 bg-red-900 text-[10px] text-red-50">✕</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-cinzel text-[13.5px] font-bold tracking-[0.03em] text-[#F3DDA8] [text-shadow:0_1px_2px_#000]">{entry.label}</span>
        {entry.description && (
          <span className="line-clamp-2 text-[11px] leading-[1.3] text-[#D6C4A0]/80">{entry.description}</span>
        )}
      </span>
      {entry.badge != null && entry.badge > 0 && (
        <span
          className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold text-[#1c1003]"
          style={{ background: 'radial-gradient(circle at 35% 30%, #fde68a, #b45309 70%)', boxShadow: '0 0 6px rgba(245,158,11,.5), inset 0 -1px 2px rgba(0,0,0,.4)' }}
        >
          {entry.badge}
        </span>
      )}
    </button>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ icon, label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 min-h-[44px]">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export interface PartyDMSettingsProps {
  // Session controls
  mode: 'shared' | 'private';
  onToggleMode: () => void;
  isCreator: boolean;
  isOriginalCreator?: boolean;
  partyId?: string | null;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  isExtracting?: boolean;
  pushState: PushSubscriptionState;
  onTogglePush: () => void;
  // DM Mode
  dmMode?: DmMode;
  onDmModeChange?: (mode: DmMode) => void;
  // Tools
  /** Offline narration downloads (saved DM audio kept on this device). */
  offlineNarration?: {
    count: number;
    total: number;
    bytes: number;
    saving: boolean;
    progress: { done: number; total: number } | null;
    onSaveAll: () => void | Promise<void>;
    onClear: () => void | Promise<void>;
  };
  onShowMap?: () => void;
  onShowSaves?: () => void;
  onNewGame?: () => void;
  onShowTableGuide?: () => void;
  lastAutoSaveLabel?: string;
  onShowGuides?: () => void;
  onShowChat?: () => void;
  onShowDevAssistant?: () => void;
  onShowCharacterGuideBuilder?: () => void;
  onShowAfkGuide: () => void;
  guidesCount?: number;
  guides?: Array<{ id: string; name: string; content: string; enabled: boolean; createdAt?: string; updatedAt?: string }>;
  myAfkGuide?: string | null;
  myAfkCascadeCount?: number;
  // Party (creator-only)
  isSplitActive?: boolean;
  memberCount: number;
  onShowSplitInitiator: () => void;
  onShowNpcScene?: () => void;
  onShowRegroupDialog: () => void;
  onShowSplitSummaries: () => void;
  onShowPreSplitChat: () => void;
  onNewCampaign: () => void;
  // Danger zone
  onEndSession: () => void;
  // Timer
  timerEnabled: boolean;
  timerDurationSeconds: number;
  onTimerEnabledChange: (enabled: boolean) => void;
  onTimerDurationChange: (seconds: number) => void;
  // Scheduled events
  onShowScheduledEvents?: () => void;
  scheduledEventsCount?: number;
  // Co-host promotion
  members?: Array<{ user_id: string; character_name: string }>;
  coHostIds?: string[];
  currentUserId?: string;
  onPromoteCoHost?: (userId: string) => void;
  onDemoteCoHost?: (userId: string) => void;
  // Whisper tray
  whisperTrayEnabled?: boolean;
  onWhisperTrayEnabledChange?: (enabled: boolean) => void;
  // Cinematic mode
  cinematicModeEnabled?: boolean;
  onCinematicModeEnabledChange?: (enabled: boolean) => void;
  // Memory anchors
  onShowMemoryAnchors?: () => void;
  memoryAnchorsCount?: number;
  // Quests
  onShowQuests?: () => void;
  questsCount?: number;
  // Response mode
  responseMode?: string;
  onResponseModeChange?: (modeId: string | null) => void;
  // Reading bookmark
  hasBookmark?: boolean;
  onClearBookmark?: () => void;
  // Dialogue auto-intervention
  dialogueAutoIntervene?: boolean;
  onDialogueAutoInterveneChange?: (enabled: boolean) => void;
  onShowOocChat?: () => void;
  // Player redo request (non-host only)
  onRequestCharacterRedo?: () => void;
  /** Opens the player's private Director channel ("Talk to the DM"). */
  onOpenDirector?: () => void;
  hasPendingRedoRequest?: boolean;
  // Chat background (per-character personal preference)
  chatBackground?: string | null;
  onChatBackgroundUpload?: (file: File) => Promise<void> | void;
  onChatBackgroundClear?: () => void;
  chatBackgroundOpacity?: number;
  chatBackgroundBlur?: number;
  onChatBackgroundOpacityChange?: (value: number) => void;
  onChatBackgroundBlurChange?: (value: number) => void;
  // Host round controls
  onReclaimTurn?: () => void;
  onRedoLastRound?: () => void;
  // Music
  moodPresetFilter?: string[];
  onMoodPresetSelected?: (presetId: string) => void;
  // Quest reward distribution (party-wide, host-controlled)
  questRewardSplitMode?: QuestRewardSplitMode;
  narrationStyle?: NarrationStyleState;
  onNarrationStyleChange?: (style: NarrationStyleId) => void;
  onNarrationIntensityChange?: (intensity: NarrationIntensity) => void;
  onQuestRewardSplitModeChange?: (mode: QuestRewardSplitMode) => void;
  // Round style (party-wide, host-controlled)
  roundStyle?: RoundStyle;
  onRoundStyleChange?: (patch: Partial<RoundStyle>) => void;
  /** Host-only combat mode toggle. */
  combatMode?: boolean;
  onToggleCombatMode?: (enabled: boolean) => void;
}


export function PartyDMSettings({
  mode, onToggleMode, isCreator, isOriginalCreator: isOriginalCreatorProp, partyId,
  autoSyncEnabled, onToggleAutoSync, isExtracting, selectedModel, onModelChange,
  pushState, onTogglePush,
  dmMode = 'ai', onDmModeChange,
  offlineNarration,
  onShowMap, onShowSaves, onNewGame, onShowTableGuide, lastAutoSaveLabel, onShowGuides, onShowChat, onShowDevAssistant, onShowCharacterGuideBuilder, onShowAfkGuide,

  guidesCount = 0, guides = [], myAfkGuide, myAfkCascadeCount = 0,
  isSplitActive, memberCount, onShowSplitInitiator, onShowNpcScene, onShowRegroupDialog, onShowSplitSummaries, onShowPreSplitChat, onShowOocChat,
  onNewCampaign, onEndSession,
  timerEnabled, timerDurationSeconds, onTimerEnabledChange, onTimerDurationChange,
  onShowScheduledEvents, scheduledEventsCount = 0,
  members = [], coHostIds = [], currentUserId, onPromoteCoHost, onDemoteCoHost,
  whisperTrayEnabled, onWhisperTrayEnabledChange,
  cinematicModeEnabled, onCinematicModeEnabledChange,
  onShowMemoryAnchors, memoryAnchorsCount = 0,
  onShowQuests, questsCount = 0,
  responseMode, onResponseModeChange,
  hasBookmark, onClearBookmark,
  dialogueAutoIntervene, onDialogueAutoInterveneChange,
  onRequestCharacterRedo, onOpenDirector, hasPendingRedoRequest = false,
  chatBackground, onChatBackgroundUpload, onChatBackgroundClear,
  chatBackgroundOpacity = 0.28, chatBackgroundBlur = 0,
  onChatBackgroundOpacityChange, onChatBackgroundBlurChange,
  onReclaimTurn, onRedoLastRound,
  moodPresetFilter, onMoodPresetSelected,
  questRewardSplitMode = 'full', onQuestRewardSplitModeChange,
  narrationStyle = DEFAULT_NARRATION_STATE, onNarrationStyleChange, onNarrationIntensityChange,
  roundStyle, onRoundStyleChange,
  combatMode, onToggleCombatMode,
}: PartyDMSettingsProps) {
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const originalCreator = isOriginalCreatorProp ?? isCreator;
  const [exportingStory, setExportingStory] = useState(false);
  const [exportingGuides, setExportingGuides] = useState(false);

  const handleDownloadStory = async () => {
    if (!partyId) { toast.error('No active party'); return; }
    setExportingStory(true);
    try {
      await exportPartyStory(partyId, 'campaign', members);
      toast.success('Story downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Could not export story');
    } finally {
      setExportingStory(false);
    }
  };

  const handleDownloadGuides = async () => {
    if (!guides || guides.length === 0) { toast.error('No GM guides to export'); return; }
    setExportingGuides(true);
    try {
      await exportGMGuides(guides, 'campaign');
      toast.success('GM guides downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Could not export guides');
    } finally {
      setExportingGuides(false);
    }
  };

  const chatBgFileInput = onChatBackgroundUpload ? (
    <input
      ref={bgFileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await onChatBackgroundUpload(file);
          toast.success('Chat background updated');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to upload image');
        } finally {
          if (bgFileInputRef.current) bgFileInputRef.current.value = '';
        }
      }}
    />
  ) : null;

  const chatBgSliders = chatBackground ? (
    <div className="px-3 py-2 space-y-3">
      {onChatBackgroundOpacityChange && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-foreground">Background Opacity</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(chatBackgroundOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(chatBackgroundOpacity * 100)]}
            min={5}
            max={80}
            step={1}
            onValueChange={(v) => onChatBackgroundOpacityChange((v[0] ?? 28) / 100)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Kept under 80% so message text stays readable.</p>
        </div>
      )}
      {onChatBackgroundBlurChange && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-foreground">Background Blur</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{chatBackgroundBlur}px</span>
          </div>
          <Slider
            value={[chatBackgroundBlur]}
            min={0}
            max={20}
            step={1}
            onValueChange={(v) => onChatBackgroundBlurChange(v[0] ?? 0)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Blur busy images to reduce visual noise behind messages.</p>
        </div>
      )}
    </div>
  ) : null;

  const toolEntries: ToolEntry[] = [
    {
      id: 'battle-map', group: 'campaign', show: !!onShowMap, medallion: iconBattleMap,
      icon: <Map className="w-4 h-4" />, label: 'Battle Map', description: 'View the tactical map', onClick: onShowMap,
    },
    {
      id: 'saves', group: 'campaign', show: !!onShowSaves, medallion: iconSaves,
      icon: <FolderOpen className="w-4 h-4" />, label: 'Campaign Saves',
      description: lastAutoSaveLabel ? `Saved ${lastAutoSaveLabel}` : 'Manage saved campaigns', onClick: onShowSaves,
    },
    {
      id: 'new-campaign', group: 'campaign', show: !!(isCreator && onNewGame), medallion: iconNewCampaign,
      icon: <Plus className="w-4 h-4 text-amber-400" />, label: 'New Campaign',
      description: 'Start a fresh campaign with the Campaign Architect', onClick: onNewGame,
    },
    {
      id: 'download-story', group: 'campaign', show: true, medallion: iconDownloadStory,
      icon: <Download className="w-4 h-4" />,
      label: exportingStory ? 'Preparing…' : 'Download Full Story',
      description: 'Export the entire campaign transcript as a zip (for feeding to an assistant)',
      onClick: exportingStory ? undefined : handleDownloadStory,
      disabled: exportingStory,
    },
    {
      id: 'save-offline', group: 'narration', show: !!offlineNarration && offlineNarration.total > 0, medallion: iconOfflineNarration,
      icon: <Download className="w-4 h-4 text-sky-400" />,
      label: offlineNarration?.saving
        ? `Saving ${offlineNarration?.progress?.done ?? 0}/${offlineNarration?.progress?.total ?? 0}…`
        : 'Save Narrations Offline',
      description: `${offlineNarration?.count ?? 0} of ${offlineNarration?.total ?? 0} clips on this device${(offlineNarration?.bytes ?? 0) > 0 ? ` · ${((offlineNarration?.bytes ?? 0) / 1048576).toFixed(1)} MB` : ''} — plays with no signal`,
      onClick: offlineNarration?.saving ? undefined : () => void offlineNarration?.onSaveAll(),
      disabled: offlineNarration?.saving,
    },
    {
      id: 'remove-offline', group: 'narration',
      show: !!offlineNarration && offlineNarration.total > 0 && offlineNarration.count > 0 && !offlineNarration.saving,
      medallion: iconOfflineNarration, mark: 'remove',
      icon: <Trash2 className="w-4 h-4" />, label: 'Remove Offline Narrations',
      description: 'Frees up space on this device (clips stay in the campaign)',
      onClick: () => void offlineNarration?.onClear(),
    },
    {
      id: 'gm-guides', group: 'lore', show: !!onShowGuides, medallion: iconGmGuides,
      icon: <BookOpen className="w-4 h-4" />, label: 'GM Guides', description: 'Custom rules and lore',
      badge: guidesCount, onClick: onShowGuides,
    },
    {
      id: 'create-character', group: 'lore', show: !!onShowCharacterGuideBuilder, medallion: iconCreateCharacter,
      icon: <UserPlus className="w-4 h-4 text-amber-400" />, label: 'Create Character with AI',
      description: 'Build a character through conversation — saves as a GM guide',
      onClick: onShowCharacterGuideBuilder,
    },
    {
      id: 'download-guides', group: 'lore', show: true, medallion: iconDownloadGuides,
      icon: <Download className="w-4 h-4" />,
      label: exportingGuides ? 'Preparing…' : 'Download GM Guides',
      description: 'Export all campaign GM guides as a zip (for feeding to an assistant)',
      onClick: exportingGuides ? undefined : handleDownloadGuides,
      disabled: exportingGuides,
    },
    {
      id: 'memory-anchors', group: 'lore', show: !!onShowMemoryAnchors, medallion: iconMemoryAnchors,
      icon: <Brain className={cn("w-4 h-4", memoryAnchorsCount > 0 ? "text-purple-400" : "")} />,
      label: 'Memory Anchors', description: 'Long-term campaign facts for the Oracle',
      badge: memoryAnchorsCount, onClick: onShowMemoryAnchors,
    },
    {
      id: 'quest-log', group: 'lore', show: !!onShowQuests, medallion: iconQuestLog,
      icon: <ScrollText className={cn("w-4 h-4", questsCount > 0 ? "text-amber-400" : "")} />,
      label: 'Quest Log', description: 'Track party objectives', badge: questsCount, onClick: onShowQuests,
    },
    {
      id: 'party-chat', group: 'table', show: !!onShowChat, medallion: iconPartyChat,
      icon: <MessageSquare className="w-4 h-4" />, label: 'Party Chat',
      description: 'Out-of-character messaging', onClick: onShowChat,
    },
    {
      id: 'afk-guide', group: 'table', show: true, medallion: iconAfkGuide,
      icon: <Ghost className={cn("w-4 h-4", myAfkGuide ? "text-purple-400" : "")} />,
      label: 'AFK Personality Guide',
      description: myAfkGuide ? 'AFK guide configured' : 'Set how AI plays your character when AFK',
      badge: myAfkCascadeCount, onClick: onShowAfkGuide,
    },
    {
      id: 'scheduled-events', group: 'host', show: !!(isCreator && onShowScheduledEvents), medallion: iconScheduledEvents,
      icon: <CalendarClock className={cn("w-4 h-4", scheduledEventsCount > 0 ? "text-amber-400" : "")} />,
      label: 'Scheduled Events', description: 'Schedule narrative events for a specific date & time',
      badge: scheduledEventsCount, onClick: onShowScheduledEvents,
    },
    {
      id: 'dev-assistant', group: 'host', show: !!(isCreator && onShowDevAssistant), medallion: iconDevAssistant,
      icon: <Code2 className="w-4 h-4 text-blue-400" />, label: 'Dev Assistant',
      description: 'Ask questions about the app — uses your saved codebase & instructions',
      onClick: onShowDevAssistant,
    },
    {
      id: 'talk-to-dm', group: 'table', show: !!onOpenDirector, screen: false,
      icon: <Lock className="w-4 h-4 text-purple-300" />, label: 'Talk to the DM (private)',
      description: 'Ask questions or take secret actions — only you and the DM can see this',
      onClick: onOpenDirector,
    },
    {
      id: 'character-redo', group: 'table', show: !!onRequestCharacterRedo, medallion: iconCharacterRedo,
      icon: <RefreshCw className={cn("w-4 h-4", hasPendingRedoRequest ? "text-amber-400" : "")} />,
      label: 'Request Character Redo',
      description: hasPendingRedoRequest ? 'Awaiting host approval…' : 'Ask the host to redo your character',
      onClick: onRequestCharacterRedo, disabled: hasPendingRedoRequest,
    },
    {
      id: 'clear-bookmark', group: 'table', show: !!(hasBookmark && onClearBookmark), medallion: iconBookmark,
      icon: <BookmarkX className="w-4 h-4 text-amber-400" />, label: 'Clear Reading Bookmark',
      description: 'Remove your saved reading position', onClick: onClearBookmark,
    },
    {
      id: 'chat-background', group: 'table', show: !!onChatBackgroundUpload, medallion: iconChatBackground,
      icon: <ImageIcon className={cn('w-4 h-4', chatBackground ? 'text-emerald-400' : '')} />,
      label: chatBackground ? 'Change Chat Background' : 'Upload Chat Background',
      description: chatBackground ? 'Tap to replace your custom image' : 'Set a personal image behind the chat',
      onClick: () => bgFileInputRef.current?.click(),
      after: chatBgSliders,
    },
    {
      id: 'clear-chat-background', group: 'table',
      show: !!(onChatBackgroundUpload && chatBackground && onChatBackgroundClear),
      medallion: iconChatBackground, mark: 'remove',
      icon: <Trash2 className="w-4 h-4 text-red-400" />, label: 'Clear Chat Background',
      description: 'Restore the default background',
      onClick: () => {
        onChatBackgroundClear?.();
        toast.success('Chat background cleared');
      },
    },
    {
      id: 'how-to-play', group: 'table', show: !!onShowTableGuide, medallion: iconHowToPlay,
      icon: <HelpCircle className="w-4 h-4" />, label: 'How to Play',
      description: 'Open the table guide', onClick: onShowTableGuide,
    },
  ];

  if (layout === 'toolsScreen') {
    const visible = toolEntries.filter(e => e.show && e.screen !== false);
    return (
      <div className="flex flex-col gap-2 pt-1">
        {chatBgFileInput}
        {TOOL_GROUPS.map(g => {
          const items = visible.filter(e => e.group === g.id);
          if (items.length === 0) return null;
          return (
            <Fragment key={g.id}>
              <ToolsGroupHeader title={g.title} />
              {items.map(e => (
                <Fragment key={e.id}>
                  <OrnateToolRow entry={e} />
                  {e.after && (
                    <div className="mx-1 shrink-0 rounded-lg border border-amber-700/30 bg-black/55">{e.after}</div>
                  )}
                </Fragment>
              ))}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-2.5 w-full">
      {/* Session Controls */}
      {/* Campaign Type (creator only) */}
      <SettingsSection title="Session Controls" icon={<ClipboardList className="w-4 h-4 text-amber-400" />}>
        {isCreator && onDmModeChange && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">DM Mode</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(() => {
                const baseModeOptions = [
                  { value: 'ai' as DmMode, icon: <Bot className="w-3.5 h-3.5" />, label: 'AI DM', desc: 'AI generates responses' },
                  { value: 'human' as DmMode, icon: <Pen className="w-3.5 h-3.5" />, label: 'Human DM', desc: 'You write all responses' },
                  { value: 'ai-approval' as DmMode, icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'AI + Approval', desc: 'Review AI drafts first' },
                  { value: 'dialogue' as DmMode, icon: <MessageCircle className="w-3.5 h-3.5" />, label: 'Dialogue', desc: 'Free-flowing player chat' },
                ];
                const modeOptions = memberCount === 2
                  ? [...baseModeOptions, { value: 'turnBased' as DmMode, icon: <Heart className="w-3.5 h-3.5" />, label: 'Couples Mode', desc: 'Strict turns — one action, one response, then the other player goes' }]
                  : baseModeOptions;
                return modeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onDmModeChange(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-center transition-all min-h-[60px]",
                      "border",
                      dmMode === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="relative">
                      {opt.icon}
                      {dmMode === opt.value && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                  </button>
                ));
              })()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
              {dmMode === 'ai' && 'AI generates and broadcasts responses automatically.'}
              {dmMode === 'human' && 'You write narrative responses manually. No AI involved.'}
              {dmMode === 'ai-approval' && 'AI drafts a response for you to review, edit, and approve before players see it.'}
              {dmMode === 'dialogue' && 'Players chat freely in-character. Tap "Call the DM" when you want AI narration.'}
              {dmMode === 'turnBased' && 'Couples Mode: players take strict turns. Submit your action, the AI responds immediately, then it\'s the other player\'s turn.'}
            </p>
          </div>
        )}
        {dmMode === 'dialogue' && onDialogueAutoInterveneChange && (
          <ToggleRow
            icon={<Zap className="w-4 h-4" />}
            label="Auto DM Intervention"
            description="AI automatically steps in when the scene gets tense"
            checked={dialogueAutoIntervene ?? false}
            onCheckedChange={onDialogueAutoInterveneChange}
          />
        )}
        {isCreator && selectedModel !== undefined && onModelChange && (
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">AI Model</span>
            </div>
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue>{getModelLabel(selectedModel)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DM_MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground"> — {m.description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isCreator && (
          <ToggleRow
            icon={mode === 'shared' ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-purple-400" />}
            label={mode === 'shared' ? 'Shared Mode' : 'Private Mode'}
            description={mode === 'shared' ? 'All players see each other\'s prompts' : 'Prompts are hidden from other players'}
            checked={mode === 'shared'}
            onCheckedChange={onToggleMode}
          />
        )}
        {onToggleAutoSync && (
          <ToggleRow
            icon={<Zap className={cn("w-4 h-4", isExtracting ? "text-amber-400 animate-pulse" : "text-muted-foreground")} />}
            label="Auto-Sync"
            description="Automatically extract character changes"
            checked={autoSyncEnabled ?? false}
            onCheckedChange={(v) => onToggleAutoSync(v)}
          />
        )}
        {pushState !== 'unsupported' && (
          <ToggleRow
            icon={pushState === 'subscribed' ? <Bell className="w-4 h-4 text-amber-400" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
            label="Push Notifications"
            description={pushState === 'denied' ? 'Blocked — enable in browser settings' : pushState === 'subscribed' ? 'Receiving alerts for party events' : 'Get notified when players ready up'}
            checked={pushState === 'subscribed'}
            onCheckedChange={onTogglePush}
            disabled={pushState === 'denied'}
          />
        )}
        {onWhisperTrayEnabledChange != null && (
          <ToggleRow
            icon={<MessageCircle className={cn("w-4 h-4", whisperTrayEnabled ? "text-purple-400" : "text-muted-foreground")} />}
            label="Whisper Trays"
            description="Show mechanical hints below AI responses"
            checked={whisperTrayEnabled ?? true}
            onCheckedChange={onWhisperTrayEnabledChange}
          />
        )}
        {onCinematicModeEnabledChange != null && (
          <ToggleRow
            icon={<Film className={cn("w-4 h-4", cinematicModeEnabled ? "text-amber-400" : "text-muted-foreground")} />}
            label="Cinematic Mode"
            description="Tap-to-advance slideshow for DM responses"
            checked={cinematicModeEnabled ?? true}
            onCheckedChange={onCinematicModeEnabledChange}
          />
        )}
        {isCreator && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Round Timer</span>
            </div>
            <TimerSettings
              enabled={timerEnabled}
              durationSeconds={timerDurationSeconds}
              onEnabledChange={onTimerEnabledChange}
              onDurationChange={onTimerDurationChange}
            />
          </div>
        )}
        {/* Co-Host Promotion Manager (original creator only) */}
        {originalCreator && members.length > 0 && onPromoteCoHost && onDemoteCoHost && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-foreground">Co-Host Manager</span>
            </div>
            <div className="space-y-1">
              {members
                .filter(m => m.user_id !== currentUserId)
                .map(m => {
                  const isCo = coHostIds.includes(m.user_id);
                  return (
                    <div key={m.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-foreground truncate">{m.character_name}</span>
                        {isCo && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">Co-DM</span>
                        )}
                      </div>
                      <button
                        onClick={() => isCo ? onDemoteCoHost(m.user_id) : onPromoteCoHost(m.user_id)}
                        className={cn(
                          "shrink-0 text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors min-h-[28px]",
                          isCo
                            ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                            : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        )}
                        style={{ touchAction: 'manipulation' }}
                      >
                        {isCo ? 'Remove' : 'Promote'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Combat Mode (host only) - swaps the bottom drawer for a combat bar for every player */}
      {isCreator && onToggleCombatMode && (
        <SettingsSection title="Combat Mode" icon={<Sword className="w-4 h-4 text-red-400" />}>
          <ToggleRow
            icon={<Sword className="w-4 h-4 text-red-400" />}
            label="Combat mode"
            description="Replaces the bottom tools drawer with a combat bar for everyone in the party. Shows HP, action economy and quick access to dice, actions and spells."
            checked={Boolean(combatMode)}
            onCheckedChange={onToggleCombatMode}
          />
          <p className="text-[10px] text-muted-foreground px-3 pb-2">
            Host only. Applies to every player in the session instantly.
          </p>
        </SettingsSection>
      )}

      {/* Round Controls (host only) — recover from mis-taps / mistaken deletes */}
      {isCreator && (onRedoLastRound || (onReclaimTurn && dmMode === 'turnBased')) && (
        <SettingsSection title="Round Controls" icon={<RotateCcw className="w-4 h-4 text-amber-400" />}>
          {onReclaimTurn && dmMode === 'turnBased' && (
            <ToolRow
              icon={<Undo2 className="w-4 h-4 text-amber-400" />}
              label="Take my turn back"
              description="Couples Mode only — set the current turn back to you so you can go again."
              onClick={() => {
                if (confirm("Reclaim the turn? The current turn will be handed back to you so you can submit again.")) {
                  onReclaimTurn();
                }
              }}
            />
          )}
          {onRedoLastRound && (
            <ToolRow
              icon={<RotateCcw className="w-4 h-4 text-amber-400" />}
              label="Redo last round"
              description="Deletes the most recent DM response and player prompt, then reopens the round so you can resubmit."
              onClick={() => {
                if (confirm("Redo the last round? This deletes the last DM response and the player prompt that triggered it, then reopens the round.")) {
                  onRedoLastRound();
                }
              }}
            />
          )}
          <p className="text-[10px] text-muted-foreground px-3 pb-2">Host only. Use if you accidentally deleted an AI response or need to restart the round.</p>
        </SettingsSection>
      )}


      {/* Response Style (creator-only) */}
      {isCreator && onResponseModeChange && (
        <SettingsSection title="Response Style" icon={<Palette className="w-4 h-4 text-amber-400" />}>
          <ResponseModeSelector
            selectedMode={responseMode}
            onModeChange={onResponseModeChange}
          />
        </SettingsSection>
      )}

      {/* Narration Style */}
      <SettingsSection title="Narration Style" icon={<Palette className="w-4 h-4 text-amber-400" />}>
        <NarrationStyleControl
          state={narrationStyle}
          editable={Boolean(isCreator && onNarrationStyleChange && onNarrationIntensityChange)}
          onStyleChange={(s) => onNarrationStyleChange?.(s)}
          onIntensityChange={(i) => onNarrationIntensityChange?.(i)}
          readOnlyNote="The host sets the table's narration tone."
        />
      </SettingsSection>

      {/* Round Style */}
      {roundStyle && (
        <SettingsSection title="Round Style" icon={<MessageSquare className="w-4 h-4 text-amber-400" />}>
          <div className="px-3 py-2.5 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              How a round reaches the DM: the classic ready-up queue, a live party chat that sends
              itself once enough in-character messages land, or Live DM — which sends the table's
              out-of-character banter along too.
            </p>
            {isCreator && onRoundStyleChange ? (
              <>
                <Select
                  value={roundStyle.mode}
                  onValueChange={(v) => onRoundStyleChange({ mode: v as RoundStyle['mode'] })}
                >
                  <SelectTrigger className="w-full min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready">Ready-up queue (classic)</SelectItem>
                    <SelectItem value="chat">Chat Rounds (live party chat)</SelectItem>
                    <SelectItem value="live">Live DM (banter included)</SelectItem>
                  </SelectContent>
                </Select>

                {(roundStyle.mode === 'chat' || roundStyle.mode === 'live') && (
                  <>
                    <div className="space-y-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-red-400">
                          Chaos Intensity
                        </span>
                        <span className="text-sm font-bold text-red-300">{roundStyle.chaosLevel}/10</span>
                      </div>
                      <Slider
                        value={[roundStyle.chaosLevel]}
                        onValueChange={([v]) => onRoundStyleChange({ chaosLevel: v })}
                        min={1}
                        max={10}
                        step={1}
                        className="[&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-red-400"
                      />
                      <p className="text-[11px] text-red-300/80 text-center font-medium">
                        {CHAOS_LABELS[roundStyle.chaosLevel] || ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground text-center">
                        How much comedic, fourth-wall energy the DM brings to asides and narration. Your guides and world facts always win.
                      </p>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Players tick the chat lines they want answered; you decide when to send them to the DM.
                    </p>
                  </>
                )}
              </>
            ) : (
              <div className="text-sm text-foreground">
                {roundStyle.mode === 'live'
                  ? 'Live DM — tick the lines (banter included) and the host sends them to the DM.'
                  : roundStyle.mode === 'chat'
                    ? 'Chat Rounds — tick the lines and the host sends them to the DM.'
                    : 'Ready-up queue (classic)'}
              </div>
            )}
          </div>
        </SettingsSection>
      )}



      {/* Quest Rewards */}
      <SettingsSection title="Quest Rewards" icon={<ScrollText className="w-4 h-4 text-amber-400" />}>
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground mb-2">
            How quest XP and gold are handed out to the party when a quest is completed.
          </p>
          {isCreator && onQuestRewardSplitModeChange ? (
            <>
              <Select value={questRewardSplitMode} onValueChange={(v) => onQuestRewardSplitModeChange(v as QuestRewardSplitMode)}>
                <SelectTrigger className="w-full min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUEST_REWARD_SPLIT_MODES.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-2">
                {QUEST_REWARD_SPLIT_MODES.find(m => m.id === questRewardSplitMode)?.description}
              </p>
            </>
          ) : (
            <div className="text-sm text-foreground">
              {questRewardSplitLabel(questRewardSplitMode)}
              <p className="text-[11px] text-muted-foreground mt-1">
                {QUEST_REWARD_SPLIT_MODES.find(m => m.id === questRewardSplitMode)?.description}
              </p>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Tools */}
      <SettingsSection title="Tools" icon={<Map className="w-4 h-4 text-emerald-400" />}>
        {chatBgFileInput}
        {toolEntries.filter(e => e.show).map(e => (
          <Fragment key={e.id}>
            <ToolRow icon={e.icon} label={e.label} description={e.description} badge={e.badge} onClick={e.onClick} disabled={e.disabled} />
            {e.after}
          </Fragment>
        ))}
      </SettingsSection>


      {/* Spotify Controls */}
      <SettingsSection title="Ambient Music" icon={<Music className="w-4 h-4 text-emerald-400" />}>
        <DMSpotifyControls partyId={partyId} isCreator={isCreator} presetFilter={moodPresetFilter} onPresetSelected={onMoodPresetSelected} />
      </SettingsSection>

      {/* Party Management (creator only) */}
      {originalCreator && (
        <SettingsSection title="Party Management" icon={<Users className="w-4 h-4 text-blue-400" />}>
          {onShowNpcScene && (
            <ToolRow
              icon={<Theater className="w-4 h-4" />}
              label="NPC Scene"
              description="Launch a multi-NPC conversation"
              onClick={onShowNpcScene}
            />
          )}
          {onShowOocChat && (
            <ToolRow
              icon={<Megaphone className="w-4 h-4" />}
              label="Director's Channel"
              description="OOC chat with the DM + story directives"
              onClick={onShowOocChat}
            />
          )}
          {isSplitActive ? (
            <>
              <ToolRow icon={<Eye className="w-4 h-4" />} label="View Split Summaries" onClick={onShowSplitSummaries} />
              <ToolRow icon={<MessageSquare className="w-4 h-4" />} label="View Pre-Split Chat" description="Read-only view of the original conversation" onClick={onShowPreSplitChat} />
              <ToolRow icon={<Users className="w-4 h-4 text-emerald-400" />} label="Regroup Party" description="Merge split teams back together" onClick={onShowRegroupDialog} />
            </>
          ) : memberCount >= 4 ? (
            <ToolRow icon={<GitBranch className="w-4 h-4" />} label="Split Party" description="Divide into two teams for parallel play" onClick={onShowSplitInitiator} />
          ) : (
            <p className="text-[11px] text-muted-foreground px-3 py-2">Need 4+ players to split the party</p>
          )}
        </SettingsSection>
      )}

      {/* Danger Zone (creator only) */}
      {originalCreator && (
        <SettingsSection title="Danger Zone" variant="danger" icon={<X className="w-4 h-4 text-destructive" />}>
          <ToolRow
            icon={<X className="w-4 h-4 text-destructive" />}
            label="End Session"
            description="End the current DM session for all players"
            onClick={onEndSession}
          />
        </SettingsSection>
      )}
    </div>
  );
}
