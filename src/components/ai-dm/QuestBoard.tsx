import { Check, X, ScrollText, Coins, Sparkles, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Quest, CR_META, questPercent, questTitle } from '@/lib/quests';

interface QuestBoardProps {
  quests: Quest[];
  /** Only host / solo player may accept or decline offers. */
  canManage?: boolean;
  onAccept?: (key: string) => void;
  onDecline?: (key: string) => void;
}

function RewardRow({ q }: { q: Quest }) {
  const items = q.itemRewards ?? [];
  if (!q.xpReward && !q.goldReward && items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px]">
      {!!q.xpReward && (
        <span className="flex items-center gap-1 text-sky-300"><Sparkles className="w-3 h-3" />{q.xpReward} XP</span>
      )}
      {!!q.goldReward && (
        <span className="flex items-center gap-1 text-amber-300"><Coins className="w-3 h-3" />{q.goldReward} gp</span>
      )}
      {items.map(it => (
        <span key={it.name} className="flex items-center gap-1 text-violet-300">
          <Package className="w-3 h-3" />{it.name}{(it.quantity ?? 1) > 1 ? ` x${it.quantity}` : ''}
        </span>
      ))}
    </div>
  );
}

function QuestHeader({ q }: { q: Quest }) {
  const cr = q.challengeRating ? CR_META[q.challengeRating] : null;
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-foreground flex-1">{questTitle(q)}</p>
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn(
          'text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border',
          q.questType === 'main'
            ? 'text-amber-200 border-amber-500/40 bg-amber-500/10'
            : 'text-white/60 border-white/15 bg-white/5',
        )}>
          {q.questType === 'main' ? 'Main' : 'Side'}
        </span>
        {cr && (
          <span className={cn('text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border', cr.className)}>
            {cr.label}
          </span>
        )}
      </div>
    </div>
  );
}

function Stages({ q }: { q: Quest }) {
  const stages = q.stages ?? [];
  if (stages.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {stages.map(s => (
        <div key={s.id} className="flex items-start gap-2">
          <span className={cn(
            'mt-[3px] w-3 h-3 rounded-[4px] border flex items-center justify-center shrink-0',
            s.done ? 'bg-emerald-500/25 border-emerald-400/50' : 'border-white/20',
          )}>
            {s.done && <Check className="w-2.5 h-2.5 text-emerald-300" />}
          </span>
          <span className={cn('text-[10px] leading-snug', s.done ? 'text-white/35 line-through' : 'text-white/70')}>
            {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-white/40 mt-1">{pct}% complete</p>
    </div>
  );
}

export function QuestBoard({ quests, canManage = true, onAccept, onDecline }: QuestBoardProps) {
  const offered = quests.filter(q => q.status === 'offered');
  const active = quests.filter(q => q.status === 'active' || q.status === 'unknown');
  const done = quests.filter(q => q.status === 'completed');
  const failed = quests.filter(q => q.status === 'failed');

  if (quests.length === 0) {
    return (
      <div className="text-center py-6 text-white/30">
        <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">No quests yet.</p>
        <p className="text-[10px] mt-1">The DM will offer work as the story unfolds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {offered.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-300/70 uppercase tracking-wider mb-2">Offered</p>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {offered.map(q => (
                <motion.div
                  key={q.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2.5"
                >
                  <QuestHeader q={q} />
                  {q.description && <p className="text-[10px] text-white/55 mt-1 leading-snug">{q.description}</p>}
                  <Stages q={q} />
                  <RewardRow q={q} />
                  {canManage && (
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => onAccept?.(q.key)}
                        style={{ touchAction: 'manipulation' }}
                        className="flex-1 min-h-[40px] text-xs rounded-lg bg-emerald-700/50 hover:bg-emerald-700/70 text-emerald-100 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onDecline?.(q.key)}
                        style={{ touchAction: 'manipulation' }}
                        className="px-4 min-h-[40px] text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <p className="text-[10px] text-emerald-300/60 uppercase tracking-wider mb-2">Active</p>
          <div className="space-y-2">
            {active.map(q => (
              <div key={q.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <QuestHeader q={q} />
                {q.description && <p className="text-[10px] text-white/50 mt-1 leading-snug">{q.description}</p>}
                <Stages q={q} />
                <ProgressBar pct={questPercent(q)} />
                <RewardRow q={q} />
                {q.notes && <p className="text-[10px] text-white/35 mt-1.5 italic">{q.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <p className="text-[10px] text-green-400/60 uppercase tracking-wider mb-2">Completed</p>
          <div className="space-y-1">
            {done.map(q => (
              <div key={q.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-950/20 border border-green-500/10">
                <Check className="w-3 h-3 text-green-400/60 shrink-0" />
                <p className="text-xs text-white/40 line-through flex-1 truncate">{questTitle(q)}</p>
                {!!q.xpReward && <span className="text-[9px] text-sky-300/60 shrink-0">+{q.xpReward} XP</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-2">Failed</p>
          <div className="space-y-1">
            {failed.map(q => (
              <div key={q.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-950/20 border border-red-500/10">
                <X className="w-3 h-3 text-red-400/60 shrink-0" />
                <p className="text-xs text-white/40 flex-1 truncate">{questTitle(q)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
