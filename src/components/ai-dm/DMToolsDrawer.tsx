import { useCallback, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RotateCcw, Map, FolderOpen, BookOpen, Globe, Zap, Trash2, Brain, Cpu } from 'lucide-react';
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

interface DMToolsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewCampaign: () => void;
  onBattleMap: () => void;
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
}

export function DMToolsDrawer({
  open,
  onOpenChange,
  onNewCampaign,
  onBattleMap,
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
        className="w-[280px] max-w-[85vw] p-0 bg-glass backdrop-blur-xl border-glass"
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

        <div className="flex flex-col py-2">
          {/* New Campaign */}
          <ToolRow
            icon={<RotateCcw className="w-4 h-4" />}
            label="New Campaign"
            onClick={() => closeAndRun(onNewCampaign)}
          />

          {/* Battle Map */}
          <ToolRow
            icon={<Map className="w-4 h-4" />}
            label="Battle Map"
            onClick={() => closeAndRun(onBattleMap)}
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

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-amber-900/20" />

          {/* DM Persona / Retake Test */}
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
              <ToolRow
                icon={<Brain className="w-4 h-4" />}
                label="Retake Personality Test"
                onClick={() => {
                  onOpenChange(false);
                  setShowRetakeConfirm(true);
                }}
              />
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
