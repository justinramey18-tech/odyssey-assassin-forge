import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DM_MODELS, getModelLabel } from '@/lib/dm-models';
import { Eye, EyeOff, Zap, Map, FolderOpen, BookOpen, MessageSquare, Ghost, Bell, BellOff, GitBranch, Users, Plus, X, ClipboardList, Timer, Music, CalendarClock, Crown, Bot, Pen, ShieldCheck, MessageCircle, Cpu, Brain, Palette, BookmarkX, ScrollText, Sword, Flame, Theater, Megaphone, Film } from 'lucide-react';
import { DMSpotifyControls } from '@/components/spotify/DMSpotifyControls';
import { TimerSettings } from './RoundTimer';
import { ResponseModeSelector } from './ResponseModeSelector';
import type { PushSubscriptionState } from '@/lib/push-subscription';
import type { DmMode } from '@/hooks/use-party-dm';

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
  onShowMap?: () => void;
  onShowSaves?: () => void;
  onShowGuides?: () => void;
  onShowChat?: () => void;
  onShowAfkGuide: () => void;
  guidesCount?: number;
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
  // Campaign type
  campaignType?: 'dnd' | 'empyrean';
  onCampaignTypeChange?: (type: 'dnd' | 'empyrean') => void;
  empyreanFocus?: string;
  onEmpyreanFocusChange?: (focus: string) => void;
  onShowOocChat?: () => void;
}

export function PartyDMSettings({
  mode, onToggleMode, isCreator, isOriginalCreator: isOriginalCreatorProp, partyId,
  autoSyncEnabled, onToggleAutoSync, isExtracting, selectedModel, onModelChange,
  pushState, onTogglePush,
  dmMode = 'ai', onDmModeChange,
  onShowMap, onShowSaves, onShowGuides, onShowChat, onShowAfkGuide,
  guidesCount = 0, myAfkGuide, myAfkCascadeCount = 0,
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
  campaignType = 'dnd', onCampaignTypeChange,
  empyreanFocus = 'balanced', onEmpyreanFocusChange,
}: PartyDMSettingsProps) {
  const originalCreator = isOriginalCreatorProp ?? isCreator;
  return (
    <div className="px-3 py-3 space-y-2.5 w-full">
      {/* Session Controls */}
      {/* Campaign Type (creator only) */}
      {isCreator && onCampaignTypeChange && (
        <SettingsSection title="Campaign World" icon={<Sword className="w-4 h-4 text-amber-400" />}>
          <div className="px-3 py-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onCampaignTypeChange('dnd')}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all min-h-[48px]",
                  "active:scale-[0.97]",
                  campaignType === 'dnd'
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                <Sword className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium">D&D 5e</p>
                  <p className="text-[10px] opacity-60">Generic campaign</p>
                </div>
              </button>
              <button
                onClick={() => onCampaignTypeChange('empyrean')}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all min-h-[48px]",
                  "active:scale-[0.97]",
                  campaignType === 'empyrean'
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                    : "border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
                )}
              >
                <Flame className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium">Empyrean</p>
                  <p className="text-[10px] opacity-60">Dragon riders</p>
                </div>
              </button>
            </div>

            {campaignType === 'empyrean' && onEmpyreanFocusChange && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 px-0.5">Campaign Focus</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['combat', 'political', 'romance', 'mystery', 'survival', 'balanced'] as const).map(focus => (
                    <button
                      key={focus}
                      onClick={() => onEmpyreanFocusChange(focus)}
                      className={cn(
                        "px-2.5 py-1.5 rounded text-[11px] font-medium capitalize transition-all min-h-[32px]",
                        "active:scale-[0.96]",
                        empyreanFocus === focus
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-muted/10 text-muted-foreground border border-border/30 hover:bg-muted/20"
                      )}
                    >
                      {focus}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {/* Session Controls */}
      <SettingsSection title="Session Controls" icon={<ClipboardList className="w-4 h-4 text-amber-400" />}>
        {isCreator && onDmModeChange && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">DM Mode</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { value: 'ai' as DmMode, icon: <Bot className="w-3.5 h-3.5" />, label: 'AI DM', desc: 'AI generates responses' },
                { value: 'human' as DmMode, icon: <Pen className="w-3.5 h-3.5" />, label: 'Human DM', desc: 'You write all responses' },
                { value: 'ai-approval' as DmMode, icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'AI + Approval', desc: 'Review AI drafts first' },
                { value: 'dialogue' as DmMode, icon: <MessageCircle className="w-3.5 h-3.5" />, label: 'Dialogue', desc: 'Free-flowing player chat' },
              ]).map(opt => (
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
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
              {dmMode === 'ai' && 'AI generates and broadcasts responses automatically.'}
              {dmMode === 'human' && 'You write narrative responses manually. No AI involved.'}
              {dmMode === 'ai-approval' && 'AI drafts a response for you to review, edit, and approve before players see it.'}
              {dmMode === 'dialogue' && 'Players chat freely in-character. Tap "Call the DM" when you want AI narration.'}
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

      {/* Response Style (creator-only) */}
      {isCreator && onResponseModeChange && (
        <SettingsSection title="Response Style" icon={<Palette className="w-4 h-4 text-amber-400" />}>
          <ResponseModeSelector
            selectedMode={responseMode}
            onModeChange={onResponseModeChange}
          />
        </SettingsSection>
      )}

      {/* Tools */}
      <SettingsSection title="Tools" icon={<Map className="w-4 h-4 text-emerald-400" />}>
        {onShowMap && (
          <ToolRow icon={<Map className="w-4 h-4" />} label="Battle Map" description="View the tactical map" onClick={onShowMap} />
        )}
        {onShowSaves && (
          <ToolRow icon={<FolderOpen className="w-4 h-4" />} label="Campaign Saves" description="Manage saved campaigns" onClick={onShowSaves} />
        )}
        {onShowGuides && (
          <ToolRow icon={<BookOpen className="w-4 h-4" />} label="GM Guides" description="Custom rules and lore" badge={guidesCount} onClick={onShowGuides} />
        )}
        {onShowMemoryAnchors && (
          <ToolRow icon={<Brain className={cn("w-4 h-4", memoryAnchorsCount > 0 ? "text-purple-400" : "")} />} label="Memory Anchors" description="Long-term campaign facts for the Oracle" badge={memoryAnchorsCount} onClick={onShowMemoryAnchors} />
        )}
        {onShowQuests && (
          <ToolRow icon={<ScrollText className={cn("w-4 h-4", questsCount > 0 ? "text-amber-400" : "")} />} label="Quest Log" description="Track party objectives" badge={questsCount} onClick={onShowQuests} />
        )}
        {onShowChat && (
          <ToolRow icon={<MessageSquare className="w-4 h-4" />} label="Party Chat" description="Out-of-character messaging" onClick={onShowChat} />
        )}
        <ToolRow
          icon={<Ghost className={cn("w-4 h-4", myAfkGuide ? "text-purple-400" : "")} />}
          label="AFK Personality Guide"
          description={myAfkGuide ? 'AFK guide configured' : 'Set how AI plays your character when AFK'}
          badge={myAfkCascadeCount}
          onClick={onShowAfkGuide}
        />
        {isCreator && onShowScheduledEvents && (
          <ToolRow
            icon={<CalendarClock className={cn("w-4 h-4", scheduledEventsCount > 0 ? "text-amber-400" : "")} />}
            label="Scheduled Events"
            description="Schedule narrative events for a specific date & time"
            badge={scheduledEventsCount}
            onClick={onShowScheduledEvents}
          />
        )}
        {hasBookmark && onClearBookmark && (
          <ToolRow
            icon={<BookmarkX className="w-4 h-4 text-amber-400" />}
            label="Clear Reading Bookmark"
            description="Remove your saved reading position"
            onClick={onClearBookmark}
          />
        )}
      </SettingsSection>

      {/* Spotify Controls */}
      <SettingsSection title="Ambient Music" icon={<Music className="w-4 h-4 text-emerald-400" />}>
        <DMSpotifyControls partyId={partyId} isCreator={isCreator} />
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
          <ToolRow icon={<Plus className="w-4 h-4 text-amber-400" />} label="New Campaign" description="Start a fresh campaign" onClick={onNewCampaign} />
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
