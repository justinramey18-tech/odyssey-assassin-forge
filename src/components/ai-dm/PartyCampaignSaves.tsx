import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Trash2, Edit2, Check, X, FolderOpen, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SavedCampaign {
  id: string;
  name: string;
  messages: any[];
  campaign_summary: string | null;
  updated_at: string;
}

interface PartyCampaignSavesProps {
  onBack: () => void;
  activeCampaignId: string | null;
  hasMessages: boolean;
  onSave: (name: string, existingId?: string) => Promise<string | null>;
  onLoad: (campaignId: string, messages: any[], summary: string | null) => Promise<void>;
  isCreator: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function PartyCampaignSaves({
  onBack,
  activeCampaignId,
  hasMessages,
  onSave,
  onLoad,
  isCreator,
}: PartyCampaignSavesProps) {
  const [sessions, setSessions] = useState<SavedCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('ai_dm_campaigns')
        .select('id, name, messages, campaign_summary, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setSessions((data || []) as SavedCampaign[]);
    } catch (e) {
      console.error('Failed to load campaigns:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleSaveNew = useCallback(async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    const id = await onSave(saveName.trim());
    setIsSaving(false);
    if (id) {
      setShowSaveInput(false);
      setSaveName('');
      loadSessions();
    }
  }, [saveName, onSave, loadSessions]);

  const handleOverwrite = useCallback(async () => {
    if (!activeCampaignId) return;
    const active = sessions.find(s => s.id === activeCampaignId);
    setIsSaving(true);
    await onSave(active?.name || 'Campaign', activeCampaignId);
    setIsSaving(false);
    loadSessions();
  }, [activeCampaignId, sessions, onSave, loadSessions]);

  const handleRename = useCallback(async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('ai_dm_campaigns')
        .update({ name: renameValue.trim() })
        .eq('id', id)
        .eq('user_id', user.id);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: renameValue.trim() } : s));
      setRenamingId(null);
      setRenameValue('');
    } catch (e) {
      toast.error('Failed to rename');
    }
  }, [renameValue]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('ai_dm_campaigns').delete().eq('id', id).eq('user_id', user.id);
      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      setSessions(prev => prev.filter(s => s.id !== id));
      setDeleteConfirmId(null);
      toast.success('Campaign deleted');
    } catch (e) {
      console.error('Failed to delete campaign:', e);
      toast.error('Failed to delete campaign');
    }
  }, []);

  const handleLoad = useCallback(async (session: SavedCampaign) => {
    const msgs = Array.isArray(session.messages) ? session.messages : [];
    await onLoad(session.id, msgs, session.campaign_summary);
    onBack();
  }, [onLoad, onBack]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      <header className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <FolderOpen className="w-5 h-5 text-amber-400" />
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Campaign Saves</h1>
        </div>
      </header>

      {/* Save Actions */}
      <div className="px-3 py-2 bg-black/30 border-b border-amber-900/20 space-y-2">
        {hasMessages ? (
          <>
            {activeCampaignId && (
              <button
                onClick={handleOverwrite}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 text-sm font-cinzel hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Quick Save'}
              </button>
            )}
            <AnimatePresence>
              {showSaveInput ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex gap-2 overflow-hidden"
                >
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNew()}
                    placeholder="Campaign name..."
                    className="flex-1 bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                    maxLength={80}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveNew}
                    disabled={!saveName.trim() || isSaving}
                    className="px-3 py-2 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Save className="w-4 h-4" /> Save As New
                </button>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="text-xs text-white/30 text-center py-1">Start a conversation to save it as a campaign</p>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <FolderOpen className="w-10 h-10 text-amber-500/40 mb-3" />
            <h2 className="text-base font-cinzel text-amber-200 mb-1">No Saved Campaigns</h2>
            <p className="text-xs text-white/40 max-w-[260px]">Save your party adventure to resume later.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                "bg-white/5 border rounded-xl p-3 transition-colors",
                session.id === activeCampaignId ? "border-amber-500/40 bg-amber-900/10" : "border-amber-900/20"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                {renamingId === session.id ? (
                  <div className="flex items-center gap-1 flex-1 mr-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRename(session.id)}
                      className="flex-1 bg-white/5 border border-amber-900/30 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500/40"
                      maxLength={80}
                      autoFocus
                    />
                    <button onClick={() => handleRename(session.id)} className="p-1 rounded hover:bg-white/10" style={{ touchAction: 'manipulation' }}>
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    <button onClick={() => setRenamingId(null)} className="p-1 rounded hover:bg-white/10" style={{ touchAction: 'manipulation' }}>
                      <X className="w-3.5 h-3.5 text-white/50" />
                    </button>
                  </div>
                ) : (
                  <h3 className="text-sm font-cinzel text-amber-200 truncate flex-1 mr-2">
                    {session.name}
                    {session.id === activeCampaignId && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono uppercase">Active</span>
                    )}
                  </h3>
                )}
              </div>

              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <MessageSquare className="w-3 h-3" />
                  {Array.isArray(session.messages) ? session.messages.length : 0} msgs
                </span>
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="w-3 h-3" />
                  {formatDate(session.updated_at)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isCreator && (
                  <button
                    onClick={() => handleLoad(session)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-900/30 border border-amber-500/20 text-amber-300 text-xs font-cinzel hover:bg-amber-900/50 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Load
                  </button>
                )}
                <button
                  onClick={() => { setRenamingId(session.id); setRenameValue(session.name); }}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Edit2 className="w-3.5 h-3.5 text-white/50" />
                </button>
                {deleteConfirmId === session.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="px-2 py-0.5 rounded bg-red-900/40 text-red-400 text-[10px] hover:bg-red-900/60 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-[10px] hover:bg-white/10 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(session.id)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white/50" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
