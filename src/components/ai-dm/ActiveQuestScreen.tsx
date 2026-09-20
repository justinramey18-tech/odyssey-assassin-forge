import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import activeQuestBackground from '@/assets/active-quest-bg.jpg.asset.json';
import { questPercent, questTitle, type Quest } from '@/lib/quests';

interface ActiveQuestScreenProps {
  open: boolean;
  onClose: () => void;
  quests: Quest[];
  onOpenFullQuestBoard: () => void;
}

const formatReward = (value: unknown): string | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount.toLocaleString() : null;
};

function ActiveQuest({ quest }: { quest: Quest }) {
  const progress = questPercent(quest);
  const rewards = [
    formatReward(quest.xpReward) ? `${formatReward(quest.xpReward)} XP` : null,
    formatReward(quest.goldReward) ? `${formatReward(quest.goldReward)} GP` : null,
    ...(quest.itemRewards ?? []).map(item => {
      const quantity = Number(item.quantity);
      const count = Number.isFinite(quantity) && quantity > 1 ? ` ×${Math.floor(quantity)}` : '';
      return `${item.name}${count}`;
    }),
  ].filter((reward): reward is string => Boolean(reward));

  return (
    <article className="mx-auto w-full max-w-xl px-5 py-7 text-quest-ink">
      <h2 className="text-center font-cinzel text-xl font-bold leading-tight">{questTitle(quest)}</h2>
      <p className="mt-1.5 text-center text-[11px] font-bold uppercase text-quest-red">
        {(quest.questType ?? 'side').toUpperCase()}
        {quest.challengeRating ? ` · ${quest.challengeRating.toUpperCase()}` : ''}
      </p>

      {quest.description && (
        <p className="mt-5 font-serif text-[15px] leading-relaxed text-quest-body">{quest.description}</p>
      )}

      {(quest.stages?.length ?? 0) > 0 && (
        <div className="mt-5 space-y-3">
          {quest.stages?.map(stage => (
            <div key={stage.id} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 border-quest-ink"
                aria-hidden="true"
              >
                {stage.done && <Check className="h-4 w-4 stroke-[3] text-quest-ink" />}
              </span>
              <span className={`font-serif text-[15px] leading-snug text-quest-ink ${stage.done ? 'line-through opacity-60' : ''}`}>
                {stage.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="h-1.5 overflow-hidden border border-quest-ink/70 bg-quest-ink/10">
          <div className="h-full bg-quest-ink transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-right text-[10px] font-bold uppercase text-quest-ink">{progress}% complete</p>
      </div>

      {rewards.length > 0 && (
        <p className="mt-4 font-serif text-sm font-semibold leading-relaxed text-quest-reward">{rewards.join(' · ')}</p>
      )}
      {quest.notes && (
        <p className="mt-3 font-serif text-sm italic leading-relaxed text-quest-body/85">{quest.notes}</p>
      )}
    </article>
  );
}

export function ActiveQuestScreen({ open, onClose, quests, onOpenFullQuestBoard }: ActiveQuestScreenProps) {
  const activeQuests = useMemo(
    () => quests
      .filter(quest => quest.status === 'active')
      .sort((a, b) => Number(b.questType === 'main') - Number(a.questType === 'main')),
    [quests],
  );

  if (!open) return null;

  return createPortal(
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="fixed inset-0 z-[70] overflow-hidden bg-quest-parchment"
      role="dialog"
      aria-modal="true"
      aria-label="Active Quest"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: `url(${activeQuestBackground.url})`, backgroundPosition: 'top center' }}
        aria-hidden="true"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 h-11 w-11 text-quest-ink hover:bg-quest-ink/10 hover:text-quest-ink"
        style={{ touchAction: 'manipulation' }}
      >
        <X className="h-6 w-6 stroke-[2.5]" />
      </Button>

      <div
        className="absolute inset-0 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ paddingTop: 'calc(max(36.3vw, 18.1vh) + 12px)' }}
      >
        {activeQuests.length === 0 ? (
          <p className="mx-auto max-w-sm px-5 py-16 text-center font-serif text-[15px] italic leading-relaxed text-quest-body">
            No active quest. The DM hasn't handed you one yet.
          </p>
        ) : (
          <div>
            {activeQuests.map((quest, index) => (
              <div key={quest.key}>
                {index > 0 && <div className="mx-5 border-t border-quest-ink/45" />}
                <ActiveQuest quest={quest} />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center px-5 pb-6 pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenFullQuestBoard}
            className="min-h-12 border-quest-ink bg-transparent px-5 font-cinzel text-xs font-bold text-quest-ink hover:bg-quest-ink/10 hover:text-quest-ink"
            style={{ touchAction: 'manipulation' }}
          >
            Open full quest board
          </Button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}