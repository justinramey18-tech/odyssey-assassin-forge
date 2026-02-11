import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, User, Loader2, Save, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

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

  const statusIcon = isSyncing ? (
    <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
  ) : isAuthenticated ? (
    <Cloud className="w-3 h-3 text-emerald-400" />
  ) : (
    <CloudOff className="w-3 h-3 text-muted-foreground" />
  );

  const statusText = isSyncing
    ? 'Syncing...'
    : isAuthenticated && lastSyncTime
      ? `Synced ${formatLastSync}`
      : isAuthenticated
        ? 'Not synced'
        : 'Local only';

  const statusColor = isSyncing
    ? 'text-cyan-400'
    : isAuthenticated && lastSyncTime
      ? 'text-emerald-400/80'
      : isAuthenticated
        ? 'text-amber-400/80'
        : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        "mx-4 rounded-xl overflow-hidden",
        "bg-black/40 backdrop-blur-sm border border-white/20",
        "transition-all"
      )}
    >
      {/* Collapsed header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full px-3 py-2 flex items-center gap-2.5",
          "hover:bg-white/5 active:bg-white/10 transition-colors"
        )}
        style={{ touchAction: 'manipulation' }}
      >
        {/* Mini avatar + level */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center border border-background">
            {characterLevel}
          </div>
        </div>

        {/* Name + status */}
        <div className="flex-1 text-left min-w-0">
          <p className="font-cinzel text-xs font-semibold text-white truncate">{truncatedName}</p>
          <div className="flex items-center gap-1">
            {statusIcon}
            <span className={cn("text-[10px]", statusColor)}>{statusText}</span>
          </div>
        </div>

        {/* Cloud status icon */}
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          isAuthenticated ? "bg-emerald-500/20" : "bg-white/10"
        )}>
          {isSyncing ? (
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          ) : isAuthenticated ? (
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Chevron */}
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-1 flex items-center gap-2 border-t border-white/10">
              {/* Quick Save */}
              {isAuthenticated && onQuickSave && (
                <button
                  onClick={handleQuickSave}
                  disabled={quickSaving || isSyncing}
                  className={cn(
                    "flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all",
                    justSaved
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white/80"
                  )}
                >
                  {quickSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : justSaved ? (
                    <><Check className="w-3.5 h-3.5" /> Saved</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Quick Save</>
                  )}
                </button>
              )}

              {/* Manage Saves */}
              <button
                onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                className="flex-1 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-[0.98] text-xs font-medium text-white/80 transition-all"
              >
                Manage Saves
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
