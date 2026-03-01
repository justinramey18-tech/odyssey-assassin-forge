import { cn } from '@/lib/utils';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Zap, Map, FolderOpen, BookOpen, MessageSquare, Ghost, Bell, BellOff, GitBranch, Users, Plus, X, ClipboardList, Timer, Music } from 'lucide-react';
import { DMSpotifyControls } from '@/components/spotify/DMSpotifyControls';
import { TimerSettings } from './RoundTimer';
import type { PushSubscriptionState } from '@/lib/push-subscription';

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
  partyId?: string | null;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  isExtracting?: boolean;
  pushState: PushSubscriptionState;
  onTogglePush: () => void;
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
  onShowRegroupDialog: () => void;
  onShowSplitSummaries: () => void;
  onNewCampaign: () => void;
  // Danger zone
  onEndSession: () => void;
  // Timer
  timerEnabled: boolean;
  timerDurationSeconds: number;
  onTimerEnabledChange: (enabled: boolean) => void;
  onTimerDurationChange: (seconds: number) => void;
}

export function PartyDMSettings({
  mode, onToggleMode, isCreator, partyId,
  autoSyncEnabled, onToggleAutoSync, isExtracting,
  pushState, onTogglePush,
  onShowMap, onShowSaves, onShowGuides, onShowChat, onShowAfkGuide,
  guidesCount = 0, myAfkGuide, myAfkCascadeCount = 0,
  isSplitActive, memberCount, onShowSplitInitiator, onShowRegroupDialog, onShowSplitSummaries,
  onNewCampaign, onEndSession,
  timerEnabled, timerDurationSeconds, onTimerEnabledChange, onTimerDurationChange,
}: PartyDMSettingsProps) {
  return (
    <div className="px-3 py-3 space-y-2.5 max-h-[50vh] overflow-y-auto overscroll-contain">
      {/* Session Controls */}
      <SettingsSection title="Session Controls" icon={<ClipboardList className="w-4 h-4 text-amber-400" />}>
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
      </SettingsSection>

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
      </SettingsSection>

      {/* Spotify Controls */}
      <SettingsSection title="Ambient Music" icon={<Music className="w-4 h-4 text-emerald-400" />}>
        <DMSpotifyControls partyId={partyId} isCreator={isCreator} />
      </SettingsSection>

      {/* Party Management (creator only) */}
      {isCreator && (
        <SettingsSection title="Party Management" icon={<Users className="w-4 h-4 text-blue-400" />}>
          {isSplitActive ? (
            <>
              <ToolRow icon={<Eye className="w-4 h-4" />} label="View Split Summaries" onClick={onShowSplitSummaries} />
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
      {isCreator && (
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
