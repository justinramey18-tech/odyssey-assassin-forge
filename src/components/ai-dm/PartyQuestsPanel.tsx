import { useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { usePartyQuests } from '@/hooks/use-party-quests';
import { questTitle, withQuestEvent } from '@/lib/quests';
import { QuestBoard } from './QuestBoard';

interface PartyQuestsPanelProps {
  partyId: string;
  userId: string;
  isCreator: boolean;
  onBack: () => void;
  /** Host only: announce the accepted quest to the DM so it starts tracking it. */
  onAnnounce?: (text: string) => void;
}

export function PartyQuestsPanel({ partyId, userId, isCreator, onBack, onAnnounce }: PartyQuestsPanelProps) {
  const { quests, worldState, loading, upsertQuest, removeQuest } = usePartyQuests(partyId, userId);

  const activeCount = quests.filter(q => q.status === 'active').length;
  const offeredCount = quests.filter(q => q.status === 'offered').length;
  const resolvedCount = quests.filter(q => q.status === 'completed' || q.status === 'failed').length;

  const handleAccept = useCallback((key: string) => {
    const quest = quests.find(q => q.key === key);
    if (!quest) return;
    upsertQuest(withQuestEvent({ ...quest, status: 'active' }, 'accepted', 'Quest accepted by the party — the DM is now tracking it.'));
    toast.success(`Accepted: ${questTitle(quest)}`);
    const goals = (quest.stages ?? []).map(s => s.text).join('; ');
    onAnnounce?.(`(The party accepts the quest "${questTitle(quest)}".${goals ? ` Objectives: ${goals}.` : ''} Track our progress on it from here.)`);
  }, [quests, upsertQuest, onAnnounce]);

  const handleDecline = useCallback((key: string) => {
    removeQuest(key);
  }, [removeQuest]);

  return (
    <div className="fixed inset-0 z-[70] bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowLeft className="w-4 h-4 text-white/80" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-cinzel text-amber-200">Party Quest Board</h2>
          <p className="text-[10px] text-white/40">
            {offeredCount} offered · {activeCount} active · {resolvedCount} resolved
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="text-center py-8 text-white/30 text-xs">Loading quests...</div>
        ) : (
          <QuestBoard
            quests={quests}
            canManage={isCreator}
            onAccept={handleAccept}
            onDecline={handleDecline}
            worldState={worldState}
          />
        )}
      </div>
    </div>
  );
}
