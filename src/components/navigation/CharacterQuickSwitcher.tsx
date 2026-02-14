import { useState, useEffect } from 'react';
import { ChevronDown, User, Cloud, Loader2, LogIn, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave, CloudSave } from '@/hooks/use-cloud-save';
import { SaveData } from '@/hooks/use-auto-save';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CharacterQuickSwitcherProps {
  currentCharacterName: string;
  currentCharacterLevel: number;
  onLoadSave: (data: SaveData, saveId?: string) => void;
  onCloudClick: () => void;
}

export function CharacterQuickSwitcher({
  currentCharacterName,
  currentCharacterLevel,
  onLoadSave,
  onCloudClick,
}: CharacterQuickSwitcherProps) {
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { loading, cloudSaves, fetchSaves, loadFromCloud } = useCloudSave(user?.id);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch saves when dropdown opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchSaves();
    }
  }, [isOpen, isAuthenticated, fetchSaves]);

  const handleLoadCharacter = async (save: CloudSave) => {
    const data = await loadFromCloud(save.id);
    if (data) {
      onLoadSave(data, save.id);
      toast.success(`Switched to "${save.character_name || save.save_name}"`);
      setIsOpen(false);
    } else {
      toast.error('Failed to load character');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Compact display name
  const displayName = currentCharacterName || 'Unnamed';
  const truncatedName = displayName.length > 10 ? displayName.slice(0, 10) + '…' : displayName;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md",
            "bg-background/40 border border-primary/30 hover:border-primary/60",
            "text-xs font-cinzel transition-all",
            "focus:outline-none focus:ring-1 focus:ring-primary/50"
          )}
        >
          <User className="w-3 h-3 text-primary" />
          <span className="text-foreground/90 max-w-[80px] truncate">{truncatedName}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/40">
            {currentCharacterLevel}
          </Badge>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="center" 
        className="w-[220px] bg-background/95 backdrop-blur-md border-primary/30"
      >
        {/* Current Character Indicator */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Currently playing
        </div>
        
        <DropdownMenuSeparator />

        {!isAuthenticated ? (
          <DropdownMenuItem 
            className="flex items-center gap-2 py-3 cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              onCloudClick();
            }}
          >
            <LogIn className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Sign in</p>
              <p className="text-xs text-muted-foreground">Sync characters across devices</p>
            </div>
          </DropdownMenuItem>
        ) : authLoading || loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : cloudSaves.length === 0 ? (
          <div className="px-2 py-4 text-center">
            <Cloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No saved characters</p>
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto">
            {cloudSaves.map((save) => (
              <DropdownMenuItem
                key={save.id}
                className="flex items-center justify-between py-2 px-2 cursor-pointer"
                onClick={() => handleLoadCharacter(save)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {save.character_name || save.save_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(save.updated_at)}
                    </p>
                  </div>
                </div>
                {save.character_level && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                    Lvl {save.character_level}
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem 
          className="flex items-center gap-2 py-2 cursor-pointer text-primary"
          onClick={() => {
            setIsOpen(false);
            onCloudClick();
          }}
        >
          <Cloud className="w-4 h-4" />
          <span className="text-sm">Manage Saves...</span>
        </DropdownMenuItem>

        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 py-2 cursor-pointer text-destructive"
              onClick={async () => {
                setIsOpen(false);
                await signOut();
                toast.success('Signed out from cloud');
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
