import { useState, useCallback } from 'react';
import { ChevronDown, Plus, FolderOpen, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignSession } from '@/hooks/use-campaign-sessions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CampaignDropdownProps {
  sessions: CampaignSession[];
  activeCampaignId: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  onNewGame: () => void;
  onLoadCampaign: (session: CampaignSession) => void;
  onRefresh: () => void;
}

export function CampaignDropdown({
  sessions,
  activeCampaignId,
  isSignedIn,
  isLoading,
  onNewGame,
  onLoadCampaign,
  onRefresh,
}: CampaignDropdownProps) {
  const [open, setOpen] = useState(false);

  const activeCampaign = sessions.find(s => s.id === activeCampaignId);
  const displayName = activeCampaign?.name || 'Dungeon Master';

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && isSignedIn) {
      onRefresh();
    }
  }, [isSignedIn, onRefresh]);

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Dungeon Master</h1>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 max-w-[180px] group" style={{ touchAction: 'manipulation' }}>
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide truncate">
            {displayName}
          </h1>
          <ChevronDown className="w-3.5 h-3.5 text-amber-400/60 shrink-0 group-hover:text-amber-400 transition-colors" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 bg-[#1a1a2e] border-amber-900/40 backdrop-blur-md z-[9999]"
      >
        <DropdownMenuItem
          onClick={onNewGame}
          className="gap-2 text-amber-300 focus:text-amber-200 focus:bg-amber-900/30 font-cinzel text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-amber-900/30" />
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 text-amber-400/60 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-white/30">
            No saved campaigns
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {sessions.map(session => {
              const isActive = session.id === activeCampaignId;
              const messageCount = session.messages.length;
              const date = new Date(session.updated_at);
              const timeAgo = getTimeAgo(date);

              return (
                <DropdownMenuItem
                  key={session.id}
                  onClick={() => { if (!isActive) onLoadCampaign(session); }}
                  className={cn(
                    "gap-2 focus:bg-amber-900/20 text-xs cursor-pointer",
                    isActive ? "text-amber-300" : "text-white/70 focus:text-white/90"
                  )}
                >
                  {isActive ? (
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{session.name}</span>
                    <span className="text-[10px] text-white/30">
                      {messageCount} msgs · {timeAgo}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
