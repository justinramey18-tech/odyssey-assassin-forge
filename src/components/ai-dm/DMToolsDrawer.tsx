import { useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RotateCcw, Map, FolderOpen, BookOpen, Globe, Zap, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
}: DMToolsDrawerProps) {
  const closeAndRun = useCallback((fn: () => void) => {
    onOpenChange(false);
    // Small delay so sheet animates closed before overlay opens
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

          {/* World State */}
          <ToolRow
            icon={<Globe className="w-4 h-4" />}
            label="World State"
            badge={anchorsCount > 0 ? anchorsCount : undefined}
            badgeColor="bg-purple-600"
            onClick={() => closeAndRun(onWorldState)}
          />

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
