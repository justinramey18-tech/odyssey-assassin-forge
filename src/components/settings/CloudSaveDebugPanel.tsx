import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, RefreshCw, Database, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useCloudSave, CloudSave } from '@/hooks/use-cloud-save';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CloudSaveDebugPanelProps {
  userId?: string;
}

export function CloudSaveDebugPanel({ userId }: CloudSaveDebugPanelProps) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  const { cloudSaves, fetchSaves, loading } = useCloudSave(effectiveUserId);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localSaveInfo, setLocalSaveInfo] = useState<{ name: string; level: number; savedAt: string } | null>(null);

  const refresh = useCallback(() => {
    // Read active cloud save ID
    try {
      setActiveId(localStorage.getItem('odyssey-active-cloud-save-id'));
    } catch { setActiveId(null); }

    // Read local autosave
    try {
      const raw = localStorage.getItem('odyssey-character-autosave');
      if (raw) {
        const parsed = JSON.parse(raw);
        setLocalSaveInfo({
          name: parsed.character?.name || 'Unknown',
          level: parsed.character?.level || 0,
          savedAt: parsed.savedAt || 'N/A',
        });
      } else {
        setLocalSaveInfo(null);
      }
    } catch { setLocalSaveInfo(null); }

    fetchSaves();
  }, [fetchSaves]);

  useEffect(() => { refresh(); }, []);

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleSetActive = (id: string) => {
    try {
      localStorage.setItem('odyssey-active-cloud-save-id', id);
      setActiveId(id);
      window.dispatchEvent(new CustomEvent('odyssey-active-save-changed', { detail: { saveId: id } }));
      toast.success('Active save ID updated', { description: `Set to ${id.slice(0, 8)}…` });
    } catch {
      toast.error('Failed to set active save ID');
    }
  };

  const handleSetManualId = () => {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    handleSetActive(trimmed);
    setManualId('');
  };

  // Find matching cloud save for active ID
  const activeSave = cloudSaves.find(s => s.id === activeId);

  return (
    <div className="space-y-4">
      {/* Active Cloud Save ID */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Cloud Save ID</p>
        <div className="p-2.5 rounded-md bg-muted/30 border border-border/40 font-mono text-xs break-all">
          {activeId || <span className="text-muted-foreground italic">None set</span>}
        </div>
        {activeSave && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="w-3 h-3" />
            <span>Syncing to: <strong className="text-foreground">{activeSave.save_name}</strong> ({activeSave.character_name || '?'})</span>
          </div>
        )}
      </div>

      {/* Local Autosave */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Local Autosave</p>
        {localSaveInfo ? (
          <div className="p-2.5 rounded-md bg-muted/30 border border-border/40 text-xs space-y-1">
            <p><span className="text-muted-foreground">Name:</span> <strong>{localSaveInfo.name}</strong></p>
            <p><span className="text-muted-foreground">Level:</span> {localSaveInfo.level}</p>
            <p><span className="text-muted-foreground">Saved:</span> {new Date(localSaveInfo.savedAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No local autosave found</p>
        )}
      </div>

      {/* Manual ID Entry */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual ID Assignment</p>
        <div className="flex gap-2">
          <Input
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            placeholder="Paste save ID…"
            className="h-8 text-xs font-mono"
          />
          <Button size="sm" variant="outline" onClick={handleSetManualId} disabled={!manualId.trim()} className="h-8 shrink-0">
            Set
          </Button>
        </div>
      </div>

      {/* All Cloud Saves */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Cloud Saves</p>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-7 px-2 gap-1">
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>

        {cloudSaves.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">No cloud saves found</p>
        ) : (
          <div className="space-y-2 max-h-[30vh] overflow-y-auto">
            {cloudSaves.map(save => {
              const isActive = save.id === activeId;
              return (
                <div
                  key={save.id}
                  className={cn(
                    "p-2.5 rounded-md border text-xs space-y-1.5",
                    isActive 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-border/40 bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{save.save_name}</p>
                      <p className="text-muted-foreground">
                        {save.character_name || '?'} · Lv{save.character_level || '?'} · {new Date(save.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isActive && <Badge variant="outline" className="text-[10px] shrink-0 border-primary/50 text-primary">Active</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[10px] text-muted-foreground font-mono truncate flex-1">{save.id}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyId(save.id)}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      {copiedId === save.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetActive(save.id)}
                        className="h-6 px-2 text-[10px] shrink-0"
                      >
                        Set Active
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
