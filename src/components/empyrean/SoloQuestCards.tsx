// Solo Empyrean story feed: quest cards under the DM reply that offered, finished or failed a quest.
// The same quests live in the Quest Hub; Accept and Decline here do exactly what the hub's buttons do.
import { Check, Coins, ScrollText, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CR_POINTS, hubCategory, questCategory, type QuestCardView } from '@/lib/empyrean-quest-hub';
import { CR_META, nextObjective, questTitle } from '@/lib/quests';
import { cn } from '@/lib/utils';

interface SoloQuestCardsProps {
  views: QuestCardView[];
  /** The DM is writing: Accept waits (accepting sends the DM a message). */
  busy?: boolean;
  onAccept: (questKey: string) => void;
  onDecline: (questKey: string) => void;
  onOpenHub: () => void;
}

const tap = { touchAction: 'manipulation' } as const;

export function SoloQuestCards({ views, busy = false, onAccept, onDecline, onOpenHub }: SoloQuestCardsProps) {
  if (views.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {views.map(view => {
        const { card } = view;
        const id = `${card.kind}:${card.questKey}`;
        if (view.state === 'completed') {
          const parts = [
            card.xp ? `${card.xp} XP` : '',
            card.gold ? `${card.gold} gold` : '',
            card.points ? `+${card.points} standing` : '',
          ].filter(Boolean);
          return (
            <button key={id} type="button" onClick={onOpenHub} style={tap} aria-label={`Quest complete: ${card.title}. Open the Quest Hub`}
              className="w-full min-h-[48px] rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-left">
              <p className="text-sm font-semibold text-primary break-words">🏆 Quest complete: {card.title}</p>
              {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>}
            </button>
          );
        }
        if (view.state === 'failed') {
          return (
            <button key={id} type="button" onClick={onOpenHub} style={tap} aria-label={`Quest failed: ${card.title}. Open the Quest Hub`}
              className="w-full min-h-[48px] rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-left">
              <p className="text-sm font-semibold text-destructive break-words">🥀 Quest failed: {card.title}</p>
            </button>
          );
        }
        const { quest } = view;
        const cat = hubCategory(questCategory(quest));
        const next = nextObjective(quest);
        if (view.state === 'accepted') {
          return (
            <button key={id} type="button" onClick={onOpenHub} style={tap} aria-label={`Quest accepted: ${questTitle(quest)}. Open the Quest Hub`}
              className="w-full min-h-[48px] rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-left">
              <p className="text-sm font-semibold text-primary break-words flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" /> Accepted: {questTitle(quest)}
              </p>
              {next && <p className="text-xs text-muted-foreground break-words">Next: {next.text}</p>}
            </button>
          );
        }
        const cr = quest.challengeRating ?? 'moderate';
        return (
          <div key={id} className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ScrollText className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>New quest · {cat.emoji} {cat.label}</span>
              <span className={cn('ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px]', CR_META[cr].className)}>{CR_META[cr].label}</span>
            </div>
            <p className="mt-1 text-base font-semibold text-foreground break-words">{questTitle(quest)}</p>
            {(quest.description || quest.notes) && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed break-words line-clamp-4">{quest.description || quest.notes}</p>
            )}
            {next && <p className="mt-1 text-xs text-foreground/80 break-words">First: {next.text}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {!!quest.xpReward && <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{quest.xpReward} XP</span>}
              {!!quest.goldReward && <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{quest.goldReward} gold</span>}
              <span>+{CR_POINTS[cr]} standing</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => onAccept(quest.key)} disabled={busy} style={tap}
                className="flex-1 min-h-[52px] h-auto py-2 gap-2 text-base" aria-label={`Accept the quest ${questTitle(quest)}`}>
                <Check className="w-5 h-5 shrink-0" /> Accept
              </Button>
              <Button variant="outline" onClick={() => onDecline(quest.key)} style={tap}
                className="min-h-[52px] h-auto py-2 px-4 gap-2 text-base" aria-label={`Decline the quest ${questTitle(quest)}`}>
                <X className="w-5 h-5 shrink-0" /> Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
