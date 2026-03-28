import { useCallback, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RotateCcw, Map, FolderOpen, BookOpen, Globe, Zap, Trash2, Brain, Cpu, Palette, Eye, Theater, Megaphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DM_MODELS, getModelLabel } from '@/lib/dm-models';
import { DM_CHAT_THEMES, DMChatThemeId } from '@/lib/dm-chat-themes';

interface DMToolsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewCampaign: () => void;
  
  onSaves: () => void;
  onGuides: () => void;
  onWorldState: () => void;
  onClearChat: () => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  isExtracting: boolean;
  showAutoSync: boolean;
  guidesCount: number;
  anchorsCount: number;
  onRetakePersonalityTest?: () => Promise<void>;
  dmPersonaName?: string;
  onEmpyreanPrompts?: () => void;
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  chatThemeId?: DMChatThemeId;
  onChatThemeChange?: (id: DMChatThemeId) => void;
  whisperTrayEnabled?: boolean;
  onWhisperTrayEnabledChange?: (enabled: boolean) => void;
  empyreanConfig?: { campaignFocus: string; dragonName: string; signetType: string; yearAtBasgiath: string } | null;
  dragonNotes?: string;
  onDragonNotesChange?: (notes: string) => void;
  onReconfigureEmpyrean?: () => void;
  onResetBurnout?: () => void;
  onNpcScene?: () => void;
}

export function DMToolsDrawer({
  open,
  onOpenChange,
  onNewCampaign,
  
  onSaves,
  onGuides,
  onWorldState,
  onClearChat,
  autoSyncEnabled,
  onToggleAutoSync,
  isExtracting,
  showAutoSync,
  guidesCount,
  anchorsCount,
  onRetakePersonalityTest,
  dmPersonaName,
  onEmpyreanPrompts,
  selectedModel,
  onModelChange,
  chatThemeId,
  onChatThemeChange,
  whisperTrayEnabled,
  onWhisperTrayEnabledChange,
  empyreanConfig,
  dragonNotes,
  onDragonNotesChange,
  onReconfigureEmpyrean,
  onResetBurnout,
  onNpcScene,
}: DMToolsDrawerProps) {
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);

  const closeAndRun = useCallback((fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 150);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[280px] max-w-[85vw] p-0 bg-glass backdrop-blur-xl border-glass z-[70]"
        style={{
          borderLeft: '2px solid hsl(36 60% 50% / 0.25)',
          boxShadow: '-4px 0 30px hsl(36 60% 50% / 0.12)',
        }}
      >
        <SheetHeader className="p-4 border-b border-amber-900/30 bg-black/30">
          <SheetTitle className="flex items-center gap-2 text-base font-cinzel text-amber-300">
            ⚒ Tools
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col py-2 overflow-y-auto max-h-[calc(100vh-80px)]">
          {/* Empyrean Campaign Summary */}
          {empyreanConfig && (
            <>
              <div className="px-4 py-3 border-b border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🐉</span>
                  <span className="text-sm font-cinzel text-purple-300">Empyrean Campaign</span>
                </div>
                <div className="space-y-1 text-[11px] text-white/50">
                  <p><span className="text-purple-300/80">Focus:</span> {empyreanConfig.campaignFocus}</p>
                  {empyreanConfig.dragonName && <p><span className="text-purple-300/80">Dragon:</span> {empyreanConfig.dragonName}</p>}
                  {empyreanConfig.signetType && <p><span className="text-purple-300/80">Signet:</span> {empyreanConfig.signetType}</p>}
                  <p><span className="text-purple-300/80">Year:</span> {empyreanConfig.yearAtBasgiath}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  {onReconfigureEmpyrean && (
                    <button onClick={() => closeAndRun(onReconfigureEmpyrean)} className="text-[11px] text-purple-300/70 hover:text-purple-300 transition-colors">
                      Reconfigure
                    </button>
                  )}
                  {onResetBurnout && (
                    <button onClick={() => { onResetBurnout(); onOpenChange(false); }} className="text-[11px] text-amber-300/70 hover:text-amber-300 transition-colors">
                      Reset Burnout
                    </button>
                  )}
                </div>
              </div>

              {empyreanConfig.dragonName && onDragonNotesChange && (
                <div className="px-4 py-3 border-b border-purple-500/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">🐉</span>
                    <span className="text-xs font-cinzel text-white/70">Dragon Personality Profile</span>
                  </div>
                  <textarea
                    value={dragonNotes || ''}
                    onChange={(e) => onDragonNotesChange(e.target.value)}
                    placeholder="Define your dragon's complete personality — voice, temperament, speech patterns, opinions, history, quirks. This is the single source of truth for who your dragon is."
                    className="w-full min-h-[120px] text-xs bg-black/30 border border-purple-500/20 rounded-lg px-2.5 py-2 text-white/80 placeholder:text-white/20 resize-y focus:outline-none focus:border-purple-400/50"
                    maxLength={20000}
                  />
                  <p className="text-[10px] text-white/30 text-right mt-1">{(dragonNotes || '').length.toLocaleString()}/20,000</p>
                </div>
              )}
            </>
          )}

          {/* New Campaign */}
          <ToolRow
            icon={<RotateCcw className="w-4 h-4" />}
            label="New Campaign"
            onClick={() => closeAndRun(onNewCampaign)}
          />


          {/* Campaign Saves */}
          <ToolRow
            icon={<FolderOpen className="w-4 h-4" />}
            label="Campaign Saves"
            onClick={() => closeAndRun(onSaves)}
          />

          {/* GM Guides */}
          <ToolRow
            icon={<BookOpen className="w-4 h-4" />}
            label="GM Guides"
            badge={guidesCount > 0 ? guidesCount : undefined}
            badgeColor="bg-amber-600"
            onClick={() => closeAndRun(onGuides)}
          />

          {/* Empyrean Prompts */}
          {onEmpyreanPrompts && (
            <ToolRow
              icon={<span className="text-sm">🐉</span>}
              label="Empyrean Prompts"
              onClick={() => closeAndRun(onEmpyreanPrompts)}
            />
          )}

          {onNpcScene && (
            <ToolRow
              icon={<Theater className="w-4 h-4" />}
              label="NPC Scene"
              onClick={() => closeAndRun(onNpcScene)}
            />
          )}

          {/* World State */}
          <ToolRow
            icon={<Globe className="w-4 h-4" />}
            label="World State"
            badge={anchorsCount > 0 ? anchorsCount : undefined}
            badgeColor="bg-purple-600"
            onClick={() => closeAndRun(onWorldState)}
          />

          {/* AI Model Selector */}
          {selectedModel !== undefined && onModelChange && (
            <div className="px-4 py-3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-900/30 text-amber-400">
                  <Cpu className="w-4 h-4" />
                </span>
                <span className="text-sm font-cinzel text-white/80">AI Model</span>
              </div>
              <Select value={selectedModel} onValueChange={onModelChange}>
                <SelectTrigger className="w-full h-8 text-xs bg-black/30 border-amber-900/30 text-white/80">
                  <SelectValue>{getModelLabel(selectedModel)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-amber-900/40">
                  {DM_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs text-white/80">
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <span className="text-white/40 ml-1.5">— {m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Chat Theme Selector */}
          {onChatThemeChange && (
            <div className="px-4 py-3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3 mb-2.5">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-900/30 text-amber-400">
                  <Palette className="w-4 h-4" />
                </span>
                <span className="text-sm font-cinzel text-white/80">Chat Theme</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DM_CHAT_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onChatThemeChange(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg transition-all border",
                      chatThemeId === t.id
                        ? "border-amber-400/60 bg-white/10"
                        : "border-transparent hover:bg-white/5"
                    )}
                    style={{ touchAction: 'manipulation' }}
                    title={t.description}
                  >
                    <div className="flex gap-0.5">
                      {t.swatch.map((color, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-full border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-white/60 leading-tight text-center truncate w-full">
                      {t.icon} {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Sync toggle */}
          {showAutoSync && (
            <div
              className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  autoSyncEnabled ? "bg-amber-900/40 text-amber-400" : "bg-white/5 text-white/40"
                )}>
                  <Zap className={cn("w-4 h-4", isExtracting && "animate-pulse")} />
                </span>
                <span className="text-sm font-cinzel text-white/80">Auto-Sync</span>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={onToggleAutoSync}
              />
            </div>
          )}

          {/* Whisper Tray toggle */}
          {onWhisperTrayEnabledChange != null && (
            <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  whisperTrayEnabled ? "bg-purple-900/40 text-purple-400" : "bg-white/5 text-white/40"
                )}>
                  <Eye className="w-4 h-4" />
                </span>
                <span className="text-sm font-cinzel text-white/80">Whisper Trays</span>
              </div>
              <Switch
                checked={whisperTrayEnabled ?? true}
                onCheckedChange={onWhisperTrayEnabledChange}
              />
            </div>
          )}

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-amber-900/20" />

          {/* DM Persona / Personality Test */}
          {onRetakePersonalityTest && (
            <>
              {dmPersonaName && (
                <div className="px-4 py-2">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-cinzel">
                    DM Persona
                  </span>
                  <p className="text-xs text-purple-300/80 font-cinzel mt-0.5">
                    {dmPersonaName}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  onOpenChange(false);
                  setShowRetakeConfirm(true);
                }}
                className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-white/5 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-900/30 text-purple-400 mt-0.5">
                  <Brain className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-cinzel text-white/80 block">
                    {dmPersonaName ? 'Retake Personality Quiz' : 'Customize Your DM'}
                  </span>
                  <span className="text-[11px] text-white/35 leading-snug block mt-0.5">
                    {dmPersonaName
                      ? 'Answer a short quiz to reshape your DM\u2019s style'
                      : 'Take a short optional quiz to personalize your DM\u2019s personality'}
                  </span>
                </div>
              </button>
              <div className="mx-4 my-2 border-t border-amber-900/20" />
            </>
          )}

          {/* Clear Chat */}
          <ToolRow
            icon={<Trash2 className="w-4 h-4" />}
            label="Clear Chat"
            destructive
            onClick={() => {
              onOpenChange(false);
              onClearChat();
            }}
          />
        </div>
      </SheetContent>

      {/* Retake confirmation dialog */}
      <AlertDialog open={showRetakeConfirm} onOpenChange={setShowRetakeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retake Personality Test?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change your DM's personality for all future sessions. Your current DM persona will be replaced with a new one based on your updated answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowRetakeConfirm(false);
              onRetakePersonalityTest?.();
            }}>
              Retake Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

interface ToolRowProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
  destructive?: boolean;
  onClick: () => void;
}

function ToolRow({ icon, label, badge, badgeColor, destructive, onClick }: ToolRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-white/5 transition-colors",
        destructive && "hover:bg-red-900/20"
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        destructive ? "bg-red-900/30 text-red-400" : "bg-amber-900/30 text-amber-400"
      )}>
        {icon}
      </span>
      <span className={cn(
        "text-sm font-cinzel flex-1",
        destructive ? "text-red-400" : "text-white/80"
      )}>
        {label}
      </span>
      {badge !== undefined && (
        <span className={cn(
          "w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white",
          badgeColor || "bg-amber-600"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}
