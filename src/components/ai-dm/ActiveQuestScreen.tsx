import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import questTableBgAsset from '@/assets/quest-log/quest-table-bg.jpg.asset.json';
import questTitleRibbonAsset from '@/assets/quest-log/quest-title-ribbon.png.asset.json';
import questScrollTopAsset from '@/assets/quest-log/quest-scroll-top.png.asset.json';
import questScrollMidAsset from '@/assets/quest-log/quest-scroll-mid.png.asset.json';
import questScrollBottomAsset from '@/assets/quest-log/quest-scroll-bottom.png.asset.json';
import questCheckEmptyAsset from '@/assets/quest-log/quest-check-empty.png.asset.json';
import questCheckDoneAsset from '@/assets/quest-log/quest-check-done.png.asset.json';
import questCloseSealAsset from '@/assets/quest-log/quest-close-seal.png.asset.json';
import questProgressFrameAsset from '@/assets/quest-log/quest-progress-frame.png.asset.json';
import questRewardXpAsset from '@/assets/quest-log/quest-reward-xp.png.asset.json';
import questRewardGoldAsset from '@/assets/quest-log/quest-reward-gold.png.asset.json';
import questRewardFavorAsset from '@/assets/quest-log/quest-reward-favor.png.asset.json';
import questBoardButtonAsset from '@/assets/quest-log/quest-board-button.png.asset.json';
import { questPercent, questTitle, type Quest } from '@/lib/quests';

const questTableBg = questTableBgAsset.url;
const questTitleRibbon = questTitleRibbonAsset.url;
const questScrollTop = questScrollTopAsset.url;
const questScrollMid = questScrollMidAsset.url;
const questScrollBottom = questScrollBottomAsset.url;
const questCheckEmpty = questCheckEmptyAsset.url;
const questCheckDone = questCheckDoneAsset.url;
const questCloseSeal = questCloseSealAsset.url;
const questProgressFrame = questProgressFrameAsset.url;
const questRewardXp = questRewardXpAsset.url;
const questRewardGold = questRewardGoldAsset.url;
const questRewardFavor = questRewardFavorAsset.url;
const questBoardButton = questBoardButtonAsset.url;

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
    formatReward(quest.xpReward) ? { label: `${formatReward(quest.xpReward)} XP`, icon: questRewardXp } : null,
    formatReward(quest.goldReward) ? { label: `${formatReward(quest.goldReward)} GP`, icon: questRewardGold } : null,
    ...(quest.itemRewards ?? []).map(item => {
      const quantity = Number(item.quantity);
      const count = Number.isFinite(quantity) && quantity > 1 ? ` ×${Math.floor(quantity)}` : '';
      return { label: `${item.name}${count}`, icon: questRewardFavor };
    }),
  ].filter((reward): reward is { label: string; icon: string } => Boolean(reward));

  return (
    <article className="w-full text-quest-ink">
      <h2 className="text-center font-cinzel text-lg font-bold leading-tight text-[#3b2412] [text-shadow:0_1px_0_rgba(255,240,200,0.5)]">{questTitle(quest)}</h2>
      <p className="mx-auto mt-2 block w-fit rounded-full bg-gradient-to-b from-[#8b1a1a] to-[#5c0f0f] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f7e3b5] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        {(quest.questType ?? 'side').toUpperCase()}
        {quest.challengeRating ? ` · ${quest.challengeRating.toUpperCase()}` : ''}
      </p>

      {quest.description && (
        <p className="mt-4 font-serif text-[14px] leading-relaxed text-quest-body">{quest.description}</p>
      )}

      {(quest.stages?.length ?? 0) > 0 && (
        <div className="mt-5 space-y-3">
          {quest.stages?.map(stage => (
            <div key={stage.id} className="flex items-start gap-2.5">
              <img
                src={stage.done ? questCheckDone : questCheckEmpty}
                alt={stage.done ? 'Done' : 'Not done'}
                draggable={false}
                className="mt-[-1px] h-[22px] w-[22px] shrink-0"
              />
              <span className={`font-serif text-[14px] leading-snug ${stage.done ? 'text-quest-ink/50 line-through decoration-[#781414]/60' : 'text-quest-ink'}`}>
                {stage.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="relative mt-5 aspect-[7.62/1] w-full">
          <img src={questProgressFrame} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
          <div className="absolute overflow-hidden" style={{ top: '33%', bottom: '31%', left: '8%', right: '8%' }}>
            <div className="h-full bg-gradient-to-b from-[#8b1a1a] to-[#4a0a0a] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className="mt-1.5 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-quest-ink">{progress}% complete</p>
      </div>

      {rewards.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {rewards.map((reward, index) => (
            <span key={`${reward.label}-${index}`} className="flex items-center gap-1.5 font-serif text-[13px] font-semibold text-quest-reward">
              <img src={reward.icon} alt="" draggable={false} className="h-[22px] w-[22px] shrink-0" />
              {reward.label}
            </span>
          ))}
        </div>
      )}
      {quest.notes && (
        <p className="mt-3 font-serif text-[13px] italic leading-relaxed text-quest-body/85">{quest.notes}</p>
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
      className="fixed inset-0 z-[70] overflow-hidden bg-[#0d0a08]"
      role="dialog"
      aria-modal="true"
      aria-label="Active Quest"
    >
      <img src={questTableBg} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/35" />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-20 h-12 w-12 active:scale-95 transition-transform"
        style={{ touchAction: 'manipulation' }}
      >
        <img src={questCloseSeal} alt="" draggable={false} className="h-full w-full object-contain" />
      </button>

      <div
        className="absolute inset-x-0 bottom-0 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <img src={questTitleRibbon} alt="Active Quest" draggable={false} className="relative z-10 mx-auto mt-2 -mb-4 block w-[84%] max-w-[380px]" />

        <div className="mx-auto w-full max-w-xl overflow-x-hidden">
          <div className="relative w-[112%] -ml-[6%]">
            <img src={questScrollTop} alt="" aria-hidden="true" draggable={false} className="relative z-10 block w-full" />
            <div
              className="relative z-0 -my-6"
              style={{ backgroundImage: `url(${questScrollMid})`, backgroundRepeat: 'repeat-y', backgroundSize: '100% auto', padding: '30px 20.5% 34px' }}
            >
              {activeQuests.length === 0 ? (
                <p className="py-10 text-center font-serif text-[15px] italic leading-relaxed text-quest-body">
                  No active quest. The DM hasn't handed you one yet.
                </p>
              ) : (
                <div>
                  {activeQuests.map((quest, index) => (
                    <div key={quest.key}>
                      {index > 0 && <div className="my-5 h-px bg-gradient-to-r from-transparent via-[#6b3a1f]/50 to-transparent" />}
                      <ActiveQuest quest={quest} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <img src={questScrollBottom} alt="" aria-hidden="true" draggable={false} className="relative z-10 block w-full" />
          </div>
        </div>

        <div className="flex justify-center px-5 pb-6 pt-4">
          <button
            type="button"
            onClick={onOpenFullQuestBoard}
            aria-label="Open full quest board"
            className="w-[80%] max-w-[320px] active:scale-[0.97] transition-transform"
            style={{ touchAction: 'manipulation' }}
          >
            <img src={questBoardButton} alt="" draggable={false} className="block w-full" />
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}