import { useState, useCallback } from 'react';
import { X, User, MessageCircle, Settings as SettingsIcon, FolderOpen, Dices, Zap, Eye, Film, Cpu, Palette, RotateCcw, Trash2, AlertTriangle, Heart, Swords, Shield, Activity, Flame, Backpack } from 'lucide-react';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DM_MODELS, getModelLabel } from '@/lib/dm-models';
import { DM_CHAT_THEMES, type DMChatThemeId } from '@/lib/dm-chat-themes';
import { DICE_ODDS_CONFIGS, type DiceOddsMode } from '@/lib/diceOdds';

export type CharacterSheetTab = 'character' | 'talk' | 'settings';

interface CharacterSheetProps {
  open: boolean;
  onClose: () => void;
  initialTab?: CharacterSheetTab;
  characterName: string;
  // Settings tab props
  onCampaignSaves: () => void;
  diceOddsMode: DiceOddsMode;
  onDiceOddsModeChange: (mode: DiceOddsMode) => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  showAutoSync: boolean;
  whisperTrayEnabled: boolean;
  onWhisperTrayEnabledChange: (v: boolean) => void;
  cinematicModeEnabled: boolean;
  onCinematicModeEnabledChange: (v: boolean) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  chatThemeId: DMChatThemeId;
  onChatThemeChange: (id: DMChatThemeId) => void;
  onReconfigureCampaign: () => void;
  onClearChat: () => void;
  onNewCampaign: () => void;
  onOpenInventory?: () => void;
  onOpenAbilityPicker?: () => void;
}

const TABS: Array<{ id: CharacterSheetTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string; accent: string }> = [
  { id: 'character', label: 'Character',      icon: User,          color: 'text-sky-300',    accent: 'border-sky-400/50 bg-sky-500/10' },
  { id: 'talk',      label: 'Talk to the DM', icon: MessageCircle, color: 'text-amber-300',  accent: 'border-amber-400/50 bg-amber-500/10' },
  { id: 'settings',  label: 'Settings',       icon: SettingsIcon,  color: 'text-slate-300',  accent: 'border-slate-400/50 bg-slate-500/10' },
];

export function CharacterSheet({
  open,
  onClose,
  initialTab = 'character',
  characterName,
  onCampaignSaves,
  diceOddsMode,
  onDiceOddsModeChange,
  autoSyncEnabled,
  onToggleAutoSync,
  showAutoSync,
  whisperTrayEnabled,
  onWhisperTrayEnabledChange,
  cinematicModeEnabled,
  onCinematicModeEnabledChange,
  selectedModel,
  onModelChange,
  chatThemeId,
  onChatThemeChange,
  onReconfigureCampaign,
  onClearChat,
  onNewCampaign,
  onOpenInventory,
  onOpenAbilityPicker,
}: CharacterSheetProps) {
  const [activeTab, setActiveTab] = useState<CharacterSheetTab>(initialTab);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const activeTabConfig = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <activeTabConfig.icon className={cn('w-5 h-5', activeTabConfig.color)} />
          <span className="text-sm font-cinzel font-semibold text-foreground truncate">
            {characterName || 'Rider'}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Horizontal scrollable tab header */}
      <div className="shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                  isActive
                    ? `${tab.accent} ${tab.color}`
                    : 'border-transparent text-muted-foreground hover:bg-muted/30'
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wider whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'character' && <CharacterTab onCloseSheet={onClose} onOpenInventory={onOpenInventory} onOpenAbilityPicker={onOpenAbilityPicker} />}
            {activeTab === 'talk' && <TalkTabPlaceholder />}
            {activeTab === 'settings' && (
              <SettingsTab
                onCampaignSaves={onCampaignSaves}
                diceOddsMode={diceOddsMode}
                onDiceOddsModeChange={onDiceOddsModeChange}
                autoSyncEnabled={autoSyncEnabled}
                onToggleAutoSync={onToggleAutoSync}
                showAutoSync={showAutoSync}
                whisperTrayEnabled={whisperTrayEnabled}
                onWhisperTrayEnabledChange={onWhisperTrayEnabledChange}
                cinematicModeEnabled={cinematicModeEnabled}
                onCinematicModeEnabledChange={onCinematicModeEnabledChange}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                chatThemeId={chatThemeId}
                onChatThemeChange={onChatThemeChange}
                onReconfigureCampaign={onReconfigureCampaign}
                onClearChat={onClearChat}
                onNewCampaign={onNewCampaign}
                onCloseSheet={onClose}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Placeholder tab contents ──────────────────────────────────────────────────
// These will be replaced in subsequent prompts.

interface CharacterTabProps {
  onCloseSheet: () => void;
  onOpenInventory?: () => void;
  onOpenAbilityPicker?: () => void;
}

function CharacterTab({ onCloseSheet, onOpenInventory, onOpenAbilityPicker }: CharacterTabProps) {
  const drawers = usePromptDrawers();

  const openDrawerThenClose = useCallback((openFn: () => void) => {
    onCloseSheet();
    setTimeout(openFn, 0);
  }, [onCloseSheet]);

  return (
    <div className="px-4 py-5 space-y-6 pb-10">
      {/* ─── Stats & Progression ─── */}
      <CharacterSection title="Stats & Progression">
        <CharacterRow
          icon={<Heart className="w-4 h-4 text-rose-300" />}
          label="HP, Ability Scores & XP"
          description="Health, ability score breakdown, level, and XP tracker."
          onClick={() => openDrawerThenClose(drawers.openStatsDrawer)}
        />
        <CharacterRow
          icon={<Swords className="w-4 h-4 text-amber-300" />}
          label="Use Ability"
          description="Use an equipped ability. Starts a narrative cooldown."
          onClick={() => {
            if (onOpenAbilityPicker) {
              onCloseSheet();
              setTimeout(onOpenAbilityPicker, 0);
            } else {
              openDrawerThenClose(drawers.openAbilitiesDrawer);
            }
          }}
        />
        <CharacterRow
          icon={<Swords className="w-4 h-4 text-slate-400" />}
          label="Manage Abilities"
          description="Browse, equip, and tier up abilities."
          onClick={() => openDrawerThenClose(drawers.openAbilitiesDrawer)}
        />
        <CharacterRow
          icon={<Activity className="w-4 h-4 text-emerald-300" />}
          label="Cooldowns"
          description="Track cooldown timers for active abilities."
          onClick={() => openDrawerThenClose(drawers.openCooldownDrawer)}
        />
        <CharacterRow
          icon={<Shield className="w-4 h-4 text-purple-300" />}
          label="Conditions"
          description="Status effects currently active on your rider."
          onClick={() => openDrawerThenClose(drawers.openConditionsDrawer)}
        />
      </CharacterSection>

      {/* ─── Signet ─── */}
      <CharacterSection title="Signet">
        <CharacterRow
          icon={<Flame className="w-4 h-4 text-red-300/60" />}
          label="Signet Management"
          description="Interactive burnout tracking, channel controls, and grounding — coming soon."
          disabled
        />
      </CharacterSection>

      {/* ─── Equipment ─── */}
      <CharacterSection title="Equipment">
        <CharacterRow
          icon={<Backpack className="w-4 h-4 text-cyan-300" />}
          label="Gear & Inventory"
          description="Manage your equipped gear, generate new items, and browse inventory."
          onClick={() => {
            if (onOpenInventory) {
              onCloseSheet();
              setTimeout(onOpenInventory, 0);
            } else {
              openDrawerThenClose(drawers.openQuickActionsDrawer);
            }
          }}
        />
        <CharacterRow
          icon={<Zap className="w-4 h-4 text-indigo-300" />}
          label="Set Bonuses"
          description="Active set bonuses from equipped gear."
          onClick={() => openDrawerThenClose(drawers.openSetBonusDrawer)}
        />
      </CharacterSection>
    </div>
  );
}

function CharacterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-sky-400/70 px-1">{title}</h3>
      <div className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden divide-y divide-border/30">
        {children}
      </div>
    </div>
  );
}

interface CharacterRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  disabled?: boolean;
}

function CharacterRow({ icon, label, description, onClick, disabled }: CharacterRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-muted/30 active:bg-muted/40'
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-cinzel text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      </div>
      {!disabled && onClick && <span className="text-muted-foreground/60 text-lg leading-none shrink-0">›</span>}
    </button>
  );
}

function TalkTabPlaceholder() {
  return (
    <div className="px-4 py-6 space-y-3">
      <h2 className="text-xl font-cinzel font-bold text-amber-300">Talk to the DM</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Conversational interface for directing your AI DM. Tell it what you want changed — tone, pacing, dragon personality, campaign focus — and it will update the DM's behavior going forward.
      </p>
      <p className="text-xs text-muted-foreground/70 italic">— Placeholder. Chat interface coming in later prompts.</p>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

interface SettingsTabProps {
  onCampaignSaves: () => void;
  diceOddsMode: DiceOddsMode;
  onDiceOddsModeChange: (mode: DiceOddsMode) => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  showAutoSync: boolean;
  whisperTrayEnabled: boolean;
  onWhisperTrayEnabledChange: (v: boolean) => void;
  cinematicModeEnabled: boolean;
  onCinematicModeEnabledChange: (v: boolean) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  chatThemeId: DMChatThemeId;
  onChatThemeChange: (id: DMChatThemeId) => void;
  onReconfigureCampaign: () => void;
  onClearChat: () => void;
  onNewCampaign: () => void;
  onCloseSheet: () => void;
}

function SettingsTab({
  onCampaignSaves,
  diceOddsMode,
  onDiceOddsModeChange,
  autoSyncEnabled,
  onToggleAutoSync,
  showAutoSync,
  whisperTrayEnabled,
  onWhisperTrayEnabledChange,
  cinematicModeEnabled,
  onCinematicModeEnabledChange,
  selectedModel,
  onModelChange,
  chatThemeId,
  onChatThemeChange,
  onReconfigureCampaign,
  onClearChat,
  onNewCampaign,
  onCloseSheet,
}: SettingsTabProps) {
  const [confirmNewCampaign, setConfirmNewCampaign] = useState(false);

  const closeAndRun = useCallback((fn: () => void) => {
    onCloseSheet();
    setTimeout(fn, 0);
  }, [onCloseSheet]);

  return (
    <div className="px-4 py-5 space-y-6 pb-10">
      {/* ─── Campaign ────────────────────── */}
      <SettingsSection title="Campaign">
        <SettingsRow
          icon={<FolderOpen className="w-4 h-4 text-slate-300" />}
          label="Campaign Saves"
          onClick={() => closeAndRun(onCampaignSaves)}
          chevron
        />
      </SettingsSection>

      {/* ─── Gameplay ────────────────────── */}
      <SettingsSection title="Gameplay">
        <SettingsPickerRow
          icon={<Dices className="w-4 h-4 text-amber-300" />}
          label="Dice Odds"
        >
          <Select value={diceOddsMode} onValueChange={(v) => onDiceOddsModeChange(v as DiceOddsMode)}>
            <SelectTrigger className="w-36 h-8 text-xs bg-black/30 border-slate-700 text-white/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/95 border-slate-700">
              {(Object.keys(DICE_ODDS_CONFIGS) as DiceOddsMode[]).map(mode => (
                <SelectItem key={mode} value={mode} className="text-xs text-white/80">
                  <span className="font-medium">{DICE_ODDS_CONFIGS[mode].label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsPickerRow>

        {showAutoSync && (
          <SettingsToggleRow
            icon={<Zap className={cn('w-4 h-4', autoSyncEnabled ? 'text-amber-400' : 'text-muted-foreground')} />}
            label="Auto-Sync"
            description="Automatically update HP, XP, gold, and conditions from DM narration."
            checked={autoSyncEnabled}
            onCheckedChange={onToggleAutoSync}
          />
        )}

        <SettingsToggleRow
          icon={<Eye className={cn('w-4 h-4', whisperTrayEnabled ? 'text-purple-400' : 'text-muted-foreground')} />}
          label="Whisper Trays"
          description="Show collapsible dice/tactics whispers below DM messages."
          checked={whisperTrayEnabled}
          onCheckedChange={onWhisperTrayEnabledChange}
        />

        <SettingsToggleRow
          icon={<Film className={cn('w-4 h-4', cinematicModeEnabled ? 'text-amber-400' : 'text-muted-foreground')} />}
          label="Cinematic Mode"
          description="Enter reading mode automatically during DM responses."
          checked={cinematicModeEnabled}
          onCheckedChange={onCinematicModeEnabledChange}
        />
      </SettingsSection>

      {/* ─── Appearance ────────────────────── */}
      <SettingsSection title="Appearance">
        <SettingsPickerRow
          icon={<Cpu className="w-4 h-4 text-amber-300" />}
          label="AI Model"
        >
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-40 h-8 text-xs bg-black/30 border-slate-700 text-white/80">
              <SelectValue>{getModelLabel(selectedModel)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-black/95 border-slate-700">
              {DM_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs text-white/80">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-white/40 ml-1.5">— {m.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsPickerRow>

        <div className="px-3 py-3 rounded-lg bg-muted/20 border border-border/40">
          <div className="flex items-center gap-2 mb-2.5">
            <Palette className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-cinzel text-foreground">Chat Theme</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DM_CHAT_THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => onChatThemeChange(t.id)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-all border',
                  chatThemeId === t.id ? 'border-amber-400/60 bg-white/10' : 'border-transparent hover:bg-white/5'
                )}
                style={{ touchAction: 'manipulation' }}
                title={t.description}
              >
                <div className="flex gap-0.5">
                  {t.swatch.map((color, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <span className="text-[9px] text-white/60 leading-tight text-center truncate w-full">
                  {t.icon} {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ─── Configuration ────────────────────── */}
      <SettingsSection title="Configuration">
        <SettingsRow
          icon={<RotateCcw className="w-4 h-4 text-purple-300" />}
          label="Reconfigure Campaign"
          description="Change dragon, signet, year, or campaign focus."
          onClick={() => closeAndRun(onReconfigureCampaign)}
          chevron
        />
      </SettingsSection>

      {/* ─── Danger Zone ────────────────────── */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2 px-1">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-red-400">Danger Zone</h3>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden divide-y divide-red-500/15">
          <button
            onClick={() => closeAndRun(onClearChat)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 active:bg-red-500/15 transition-colors text-left"
            style={{ touchAction: 'manipulation' }}
          >
            <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-cinzel text-red-200">Clear Chat</p>
              <p className="text-[11px] text-red-300/60">Clears message history. Keeps campaign setup intact.</p>
            </div>
          </button>
          <button
            onClick={() => setConfirmNewCampaign(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 active:bg-red-500/15 transition-colors text-left"
            style={{ touchAction: 'manipulation' }}
          >
            <Zap className="w-4 h-4 text-red-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-cinzel text-red-200">New Campaign</p>
              <p className="text-[11px] text-red-300/60">Wipes campaign setup, dragon bond, and chat. Returns to setup menu.</p>
            </div>
          </button>
        </div>
      </div>

      <AlertDialog open={confirmNewCampaign} onOpenChange={setConfirmNewCampaign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will wipe your current campaign setup, dragon bond, and chat history. You'll be returned to the setup menu. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNewCampaign(false);
                closeAndRun(onNewCampaign);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, new campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Shared settings layout primitives ───────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-slate-400 px-1">{title}</h3>
      <div className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden divide-y divide-border/30">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ icon, label, description, onClick, chevron }: { icon: React.ReactNode; label: string; description?: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/40 transition-colors text-left"
      style={{ touchAction: 'manipulation' }}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-cinzel text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {chevron && <span className="text-muted-foreground/60 text-lg leading-none">›</span>}
    </button>
  );
}

function SettingsToggleRow({ icon, label, description, checked, onCheckedChange }: { icon: React.ReactNode; label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-cinzel text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsPickerRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-cinzel text-foreground">{label}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
