import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, ScrollText, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuestFlag {
  status: 'active' | 'completed' | 'failed';
  notes?: string;
}

interface PartyQuestsPanelProps {
  partyId: string;
  userId: string;
  isCreator: boolean;
  onBack: () => void;
}

export function PartyQuestsPanel({ partyId, userId, isCreator, onBack }: PartyQuestsPanelProps) {
  const [quests, setQuests] = useState<Record<string, QuestFlag>>({});
  const [newQuestName, setNewQuestName] = useState('');
  const [newQuestNotes, setNewQuestNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Load quests from party_shared_state
  const loadQuests = useCallback(async () => {
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('state_data')
      .eq('party_id', partyId)
      .eq('state_type', 'quest_flags')
      .maybeSingle();
    if (data?.state_data) {
      setQuests(data.state_data as Record<string, QuestFlag>);
    }
    setLoading(false);
  }, [partyId]);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`party-quests-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as any;
        if (row?.state_type === 'quest_flags') {
          setQuests(row.state_data ?? {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  const saveQuests = useCallback(async (updated: Record<string, QuestFlag>) => {
    setQuests(updated);
    await (supabase.from('party_shared_state') as any).upsert({
      party_id: partyId,
      user_id: userId,
      state_type: 'quest_flags',
      state_data: updated,
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [partyId, userId]);

  const handleAddQuest = useCallback(() => {
    const name = newQuestName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) return;
    const updated = { ...quests, [key]: { status: 'active' as const, notes: newQuestNotes.trim() || undefined } };
    saveQuests(updated);
    setNewQuestName('');
    setNewQuestNotes('');
    toast.success('Quest added');
  }, [newQuestName, newQuestNotes, quests, saveQuests]);

  const setQuestStatus = useCallback((key: string, status: QuestFlag['status']) => {
    const updated = { ...quests, [key]: { ...quests[key], status } };
    saveQuests(updated);
  }, [quests, saveQuests]);

  const entries = Object.entries(quests);
  const activeQuests = entries.filter(([, q]) => q.status === 'active');
  const completedQuests = entries.filter(([, q]) => q.status === 'completed');
  const failedQuests = entries.filter(([, q]) => q.status === 'failed');

  return (
    <div className="fixed inset-0 z-[70] bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowLeft className="w-4 h-4 text-white/80" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-cinzel text-amber-200">Party Quests</h2>
          <p className="text-[10px] text-white/40">{activeQuests.length} active · {completedQuests.length + failedQuests.length} resolved</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Add Quest Form (host only) */}
        {isCreator && (
          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/15 space-y-2">
            <input
              type="text"
              placeholder="Quest name..."
              value={newQuestName}
              onChange={e => setNewQuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddQuest()}
              className="w-full text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newQuestNotes}
                onChange={e => setNewQuestNotes(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddQuest()}
                className="flex-1 text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40"
              />
              <button
                onClick={handleAddQuest}
                disabled={!newQuestName.trim()}
                className="px-3 py-2 text-xs bg-amber-700/60 hover:bg-amber-700/80 text-amber-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-white/30 text-xs">Loading quests...</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-6 text-white/30">
            <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No quests tracked yet.</p>
            <p className="text-[10px] mt-1">
              {isCreator ? 'Add manually above or let the AI auto-detect them.' : 'The host can add quests or the AI will detect them.'}
            </p>
          </div>
        )}

        {/* Active */}
        {activeQuests.length > 0 && (
          <div>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-2">Active</p>
            <div className="space-y-1.5">
              <AnimatePresence>
                {activeQuests.map(([key, q]) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-amber-200 flex-1">{key.replace(/_/g, ' ')}</p>
                      {isCreator && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setQuestStatus(key, 'completed')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-800/40 text-green-300 hover:bg-green-700/50 transition-colors"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => setQuestStatus(key, 'failed')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 hover:bg-red-800/50 transition-colors"
                          >
                            Fail
                          </button>
                        </div>
                      )}
                    </div>
                    {q.notes && <p className="text-[10px] text-white/50 mt-1">{q.notes}</p>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Completed */}
        {completedQuests.length > 0 && (
          <div>
            <p className="text-[10px] text-green-400/60 uppercase tracking-wider mb-2">Completed</p>
            <div className="space-y-1">
              {completedQuests.map(([key, q]) => (
                <div key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-950/20 border border-green-500/10">
                  <Check className="w-3 h-3 text-green-400/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/40 line-through">{key.replace(/_/g, ' ')}</p>
                    {q.notes && <p className="text-[10px] text-white/25 mt-0.5">{q.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed */}
        {failedQuests.length > 0 && (
          <div>
            <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-2">Failed</p>
            <div className="space-y-1">
              {failedQuests.map(([key, q]) => (
                <div key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-950/20 border border-red-500/10">
                  <X className="w-3 h-3 text-red-400/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/40">{key.replace(/_/g, ' ')}</p>
                    {q.notes && <p className="text-[10px] text-white/25 mt-0.5">{q.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
