import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Trash2, Edit2, Check, X, FolderOpen, Clock, MessageSquare, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignSession } from '@/hooks/use-campaign-sessions';
import { Message } from '@/components/oracle/types';
import { toast } from 'sonner';

interface CampaignSessionsManagerProps {
  onBack: () => void;
  sessions: CampaignSession[];
  isLoading: boolean;
  isSignedIn: boolean;
  currentMessages: Message[];
  currentSummary: string | null;
  activeCampaignId: string | null;
  onSave: (name: string, messages: Message[], summary: string | null, existingId?: string) => Promise<string | null>;
  onLoad: (session: CampaignSession) => void;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
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

export function CampaignSessionsManager({
  onBack,
  sessions,
  isLoading,
  isSignedIn,
  currentMessages,
  currentSummary,
  activeCampaignId,
  onSave,
  onLoad,
  onDelete,
  onRename,
}: CampaignSessionsManagerProps) {
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const isSelectMode = selectedIds.size > 0;
  const allSelected = useMemo(
    () => sessions.length > 0 && sessions.every(s => selectedIds.has(s.id)),
    [sessions, selectedIds]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sessions.map(s => s.id)));
    }
  }, [allSelected, sessions]);

  const handleSaveNew = useCallback(async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    const id = await onSave(saveName.trim(), currentMessages, currentSummary);
    setIsSaving(false);
    if (id) {
      setShowSaveInput(false);
      setSaveName('');
    }
  }, [saveName, currentMessages, currentSummary, onSave]);

  const handleOverwrite = useCallback(async () => {
    if (!activeCampaignId) return;
    const activeSession = sessions.find(s => s.id === activeCampaignId);
    setIsSaving(true);
    await onSave(activeSession?.name || 'Campaign', currentMessages, currentSummary, activeCampaignId);
    setIsSaving(false);
  }, [activeCampaignId, sessions, currentMessages, currentSummary, onSave]);

  const handleRenameSubmit = useCallback(async (id: string) => {
    if (!renameValue.trim()) return;
    await onRename(id, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, onRename]);

  const handleDelete = useCallback(async (id: string) => {
    await onDelete(id);
    setDeleteConfirmId(null);
  }, [onDelete]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await onDelete(id);
      }
      setSelectedIds(new Set());
      setShowBulkConfirm(false);
      toast.success(`${ids.length} campaign${ids.length > 1 ? 's' : ''} deleted`);
    } catch (e) {
      console.error('Bulk delete failed:', e);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onDelete]);

  if (!isSignedIn) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <FolderOpen className="w-5 h-5 text-amber-400" />
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Campaign Sessions</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <FolderOpen className="w-10 h-10 text-amber-500/40 mb-3" />
          <h2 className="text-base font-cinzel text-amber-200 mb-1">Sign In Required</h2>
          <p className="text-xs text-white/40 max-w-[260px]">Sign in to save and load campaign sessions across devices.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <FolderOpen className="w-5 h-5 text-amber-400" />
          <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Campaigns</h1>
        </div>
        {isSelectMode && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
        )}
      </header>

      {/* Select All + Bulk Delete Bar */}
      {sessions.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/20 border-b border-amber-900/15">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors py-1"
            style={{ touchAction: 'manipulation' }}
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-amber-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <AnimatePresence>
            {isSelectMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {showBulkConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-red-400">Delete {selectedIds.size}?</span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 text-[10px] hover:bg-red-900/70 transition-colors disabled:opacity-50"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {isDeleting ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowBulkConfirm(false)}
                      className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-[10px] hover:bg-white/10 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBulkConfirm(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-500/20 text-red-400 text-xs hover:bg-red-900/50 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {selectedIds.size}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Save Actions */}
      <div className="px-3 py-2 bg-black/30 border-b border-amber-900/20 space-y-2">
        {currentMessages.length > 0 && (
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
        )}
        {currentMessages.length === 0 && (
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
            <p className="text-xs text-white/40 max-w-[260px]">
              Save your current adventure to come back to it later.
            </p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                "bg-white/5 border rounded-xl p-3 transition-colors",
                session.id === activeCampaignId ? "border-amber-500/40 bg-amber-900/10" : "border-amber-900/20",
                selectedIds.has(session.id) && "border-red-500/40 bg-red-900/10"
              )}
            >
              {/* Name / Rename */}
              <div className="flex items-center gap-2 mb-1.5">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(session.id)}
                  className="shrink-0 p-0.5"
                  style={{ touchAction: 'manipulation' }}
                >
                  {selectedIds.has(session.id) ? (
                    <CheckSquare className="w-4 h-4 text-red-400" />
                  ) : (
                    <Square className="w-4 h-4 text-white/25" />
                  )}
                </button>

                {renamingId === session.id ? (
                  <div className="flex items-center gap-1 flex-1 mr-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(session.id)}
                      className="flex-1 bg-white/5 border border-amber-900/30 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500/40"
                      maxLength={80}
                      autoFocus
                    />
                    <button onClick={() => handleRenameSubmit(session.id)} className="p-1 rounded hover:bg-white/10" style={{ touchAction: 'manipulation' }}>
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

              {/* Meta */}
              <div className="flex items-center gap-3 mb-2 pl-6">
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <MessageSquare className="w-3 h-3" />
                  {session.messages.length} msgs
                </span>
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="w-3 h-3" />
                  {formatDate(session.updated_at)}
                </span>
                {session.campaign_summary && (
                  <span className="text-[10px] text-purple-300/50">{(session.campaign_summary.length / 1000).toFixed(1)}k summary</span>
                )}
              </div>

              {/* Actions — hidden in select mode */}
              {!isSelectMode && (
                <div className="flex items-center gap-1.5 pl-6">
                  <button
                    onClick={() => onLoad(session)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-900/30 border border-amber-500/20 text-amber-300 text-xs font-cinzel hover:bg-amber-900/50 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Load
                  </button>
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
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
