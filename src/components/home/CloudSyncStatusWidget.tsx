import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, User, Loader2, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface CloudSyncStatusWidgetProps {
  characterName: string;
  characterLevel: number;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
  onClick?: () => void;
  onQuickSave?: () => Promise<void>;
}

export function CloudSyncStatusWidget({
  characterName,
  characterLevel,
  lastSyncTime,
  isSyncing = false,
  onClick,
  onQuickSave,
}: CloudSyncStatusWidgetProps) {
  const { isAuthenticated } = useAuth();
  const [quickSaving, setQuickSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleQuickSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onQuickSave || quickSaving || isSyncing) return;
    
    setQuickSaving(true);
    try {
      await onQuickSave();
      setJustSaved(true);
      toast.success('Saved!', { duration: 1500 });
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      toast.error('Save failed');
    } finally {
      setQuickSaving(false);
    }
  };

  const formatLastSync = useMemo(() => {
    if (!lastSyncTime) return null;
    
    const syncDate = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return syncDate.toLocaleDateString();
  }, [lastSyncTime]);

  const displayName = characterName || 'Unnamed Hero';
  const truncatedName = displayName.length > 16 ? displayName.slice(0, 16) + '…' : displayName;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      onClick={onClick}
      className={cn(
        "mx-4 px-4 py-3 rounded-xl",
        "bg-black/40 backdrop-blur-sm border border-white/20",
        "hover:bg-black/50 hover:border-white/30 transition-all",
        "flex items-center gap-3"
      )}
    >
      {/* Character Avatar */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        {/* Level badge */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border border-background">
          {characterLevel}
        </div>
      </div>

      {/* Character Info */}
      <div className="flex-1 text-left min-w-0">
        <p className="font-cinzel text-sm font-semibold text-white truncate">
          {truncatedName}
        </p>
        <div className="flex items-center gap-1.5">
          {isSyncing ? (
            <>
              <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
              <span className="text-[11px] text-cyan-400">Syncing...</span>
            </>
          ) : isAuthenticated && lastSyncTime ? (
            <>
              <Cloud className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] text-emerald-400/80">
                Synced {formatLastSync}
              </span>
            </>
          ) : isAuthenticated ? (
            <>
              <Cloud className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400/80">Not synced</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Local only</span>
            </>
          )}
        </div>
      </div>

      {/* Quick Save Button */}
      {isAuthenticated && onQuickSave && (
        <button
          onClick={handleQuickSave}
          disabled={quickSaving || isSyncing}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            justSaved 
              ? "bg-emerald-500/30" 
              : "bg-white/10 hover:bg-white/20 active:scale-95"
          )}
        >
          {quickSaving ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          ) : justSaved ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Save className="w-4 h-4 text-white/70" />
          )}
        </button>
      )}

      {/* Cloud Icon / Status */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        isAuthenticated ? "bg-emerald-500/20" : "bg-white/10"
      )}>
        {isSyncing ? (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        ) : isAuthenticated ? (
          <Cloud className="w-4 h-4 text-emerald-400" />
        ) : (
          <CloudOff className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </motion.button>
  );
}
