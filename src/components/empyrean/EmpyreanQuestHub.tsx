// Empyrean quest hub: the screen (full-screen overlay) and the objective strip above the chat.
// Logic lives in use-empyrean-quests.ts and empyrean-quest-hub.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, X, Loader2, ChevronDown, Sparkles, Coins, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CR_POINTS,
  DRAGON_REWARDS,
  HUB_CATEGORIES,
  SIGNET_STRAIN_RELIEF,
  hubCategory,
  questCategory,
  rankInfo,
  type HubCategoryId,
} from '@/lib/empyrean-quest-hub';
import { CR_META, nextObjective, questPercent, questTitle, type Quest } from '@/lib/quests';
import type { EmpyreanQuests } from '@/hooks/use-empyrean-quests';

const tap = { touchAction: 'manipulation' as const };

function RewardLine({ q, category }: { q: Quest; category: HubCategoryId }) {
  const cr = q.challengeRating ?? 'moderate';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
      {!!q.xpReward && <span className="flex items-center gap-1 text-sky-300"><Sparkles className="w-3 h-3" />{q.xpReward} XP</span>}
      {!!q.goldReward && <span className="flex items-center gap-1 text-amber-300"><Coins className="w-3 h-3" />{q.goldReward} gold</span>}
      <span className="text-white/55">+{CR_POINTS[cr]} standing</span>
      {category === 'dragon' && <span className="text-emerald-300">🐉 bond +{DRAGON_REWARDS[cr].bond}, trust +{DRAGON_REWARDS[cr].trust}</span>}
      {category === 'signet' && <span className="text-orange-300">✨ clears {SIGNET_STRAIN_RELIEF} strain</span>}
    </div>
  );
}

function QuestCard({
  q, category, api, mode,
}: { q: Quest; category: HubCategoryId; api: EmpyreanQuests; mode: 'offered' | 'active' | 'done' }) {
  const [open, setOpen] = useState(mode !== 'done');
  const cr = q.challengeRating ?? 'moderate';
  const pct = questPercent(q);
  const next = nextObjective(q);
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5',
      mode === 'offered' ? 'border-amber-500/30 bg-amber-500/[0.05]'
        : mode === 'active' ? 'border-purple-500/30 bg-purple-500/[0.06]'
        : 'border-white/10 bg-white/[0.02]',
    )}>
      <button onClick={() => setOpen(o => !o)} style={tap} className="w-full flex items-start gap-2 text-left min-h-[40px]">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/90 leading-snug break-words">{questTitle(q)}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={cn('px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider', CR_META[cr].className)}>{CR_META[cr].label}</span>
            {q.questType === 'main' && <span className="px-1.5 py-0.5 rounded border border-yellow-400/40 text-yellow-300 text-[10px] uppercase tracking-wider">Main</span>}
            {mode === 'done' && (
              <span className={cn('text-[11px]', q.status === 'completed' ? 'text-emerald-300' : 'text-rose-300')}>
                {q.status === 'completed' ? 'Completed' : 'Failed'}
              </span>
            )}
            {mode === 'active' && (q.stages?.length ?? 0) > 0 && <span className="text-[11px] text-white/50">{pct}%</span>}
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 mt-1 text-white/40 transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {mode === 'active' && (q.stages?.length ?? 0) > 0 && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
          <div className="h-full bg-purple-400/80" style={{ width: `${pct}%` }} />
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          {(q.description || q.notes) && <p className="text-xs text-white/65 leading-relaxed break-words">{q.description || q.notes}</p>}
          {(q.stages?.length ?? 0) > 0 && (
            <ul className="space-y-1">
              {q.stages!.map(s => (
                <li key={s.id} className={cn('flex items-start gap-2 text-xs', s.done ? 'text-white/40 line-through' : next?.id === s.id && mode === 'active' ? 'text-purple-200' : 'text-white/75')}>
                  <span className={cn('mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0', s.done ? 'border-emerald-400/60 bg-emerald-400/20' : 'border-white/25')}>
                    {s.done && <Check className="w-2.5 h-2.5 text-emerald-300" />}
                  </span>
                  <span className="break-words">{s.text}</span>
                </li>
              ))}
            </ul>
          )}
          {mode !== 'done' && <RewardLine q={q} category={category} />}
          {mode === 'offered' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => api.accept(q.key)}
                style={tap}
                className="flex-1 min-h-[44px] rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={() => api.decline(q.key)}
                style={tap}
                className="min-h-[44px] px-4 rounded-lg bg-white/5 border border-white/15 text-white/60 text-sm flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" /> Decline
              </button>
            </div>
          )}
          {mode !== 'done' && (
            <label className="flex items-center gap-2 text-[11px] text-white/45 pt-1">
              Category
              <select
                value={category}
                onChange={e => api.moveCategory(q.key, e.target.value as HubCategoryId)}
                className="min-h-[36px] flex-1 rounded-md bg-black/40 border border-white/15 text-white/80 text-xs px-2"
                style={tap}
              >
                {HUB_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function EmpyreanQuestHub({ open, onClose, api, startCategory }: {
  open: boolean;
  onClose: () => void;
  api: EmpyreanQuests;
  startCategory?: HubCategoryId;
}) {
  const [category, setCategory] = useState<HubCategoryId>(startCategory ?? 'dragon');
  const [showDone, setShowDone] = useState(false);
  const chipRefs = useRef<Partial<Record<HubCategoryId, HTMLButtonElement | null>>>({});

  // Keep the selected category's chip in view on a narrow phone.
  useEffect(() => {
    if (!open) return;
    chipRefs.current[category]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [open, category]);

  const byCategory = useMemo(() => {
    const map = new Map<HubCategoryId, Quest[]>();
    for (const c of HUB_CATEGORIES) map.set(c.id, []);
    for (const q of api.quests) {
      if (q.status === 'unknown') continue;
      map.get(questCategory(q))!.push(q);
    }
    return map;
  }, [api.quests]);

  if (!open) return null;

  const cat = hubCategory(category);
  const rank = rankInfo(category, api.hub.points[category]);
  const list = byCategory.get(category) ?? [];
  const offered = list.filter(q => q.status === 'offered');
  const active = list.filter(q => q.status === 'active');
  const done = list.filter(q => q.status === 'completed' || q.status === 'failed');
  const seekingHere = api.seeking === category;

  return (
    <div className="fixed inset-0 z-[66] bg-background flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-purple-500/20 bg-background/95">
        <button onClick={onClose} style={tap} aria-label="Close Quest Hub" className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-purple-300" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-cinzel font-bold text-purple-200">📜 Quest Hub</h2>
          <p className="text-[11px] text-white/45">
            {api.quests.filter(q => q.status === 'active').length} active · {api.quests.filter(q => q.status === 'offered').length} waiting
          </p>
        </div>
      </div>

      <div className="shrink-0 flex gap-2 overflow-x-auto px-3 py-2 border-b border-white/5">
        {HUB_CATEGORIES.map(c => {
          const waiting = (byCategory.get(c.id) ?? []).filter(q => q.status === 'offered').length;
          const r = rankInfo(c.id, api.hub.points[c.id]);
          return (
            <button
              key={c.id}
              ref={el => { chipRefs.current[c.id] = el; }}
              onClick={() => setCategory(c.id)}
              style={tap}
              className={cn(
                'relative shrink-0 min-h-[44px] px-3 rounded-full border text-xs flex items-center gap-1.5 whitespace-nowrap',
                c.id === category ? 'bg-purple-500/25 border-purple-400/50 text-purple-100' : 'bg-white/[0.03] border-white/10 text-white/60',
              )}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
              <span className="text-[10px] text-white/40">R{r.index + 1}</span>
              {waiting > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[10px] text-black font-bold flex items-center justify-center">{waiting}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/[0.06] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-cinzel text-purple-100">{cat.emoji} {cat.label}</p>
            <p className="text-xs text-white/60">Rank {rank.index + 1} of 5 · <span className="text-purple-200">{rank.name}</span></p>
          </div>
          <p className="text-xs text-white/55 mt-1">{cat.blurb}</p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-purple-500 to-amber-400" style={{ width: `${rank.progress}%` }} />
          </div>
          <p className="text-[11px] text-white/45 mt-1">
            {rank.next === null
              ? `${rank.points} standing · highest rank`
              : `${rank.points} / ${rank.next} standing to ${cat.ranks[rank.index + 1]}`}
          </p>
          {category === 'dragon' && <p className="text-[11px] text-emerald-300/80 mt-1">Finished quests grow your dragon's bond and trust. Failing one costs trust.</p>}
          {category === 'signet' && (
            <p className="text-[11px] text-orange-300/80 mt-1">
              Finished quests clear strain. Rank 3 raises your strain limit to 9, rank 5 to 10 (now {api.strainCeiling}).
            </p>
          )}
          <button
            onClick={() => api.seek(category)}
            disabled={api.seeking !== null}
            style={tap}
            className="mt-3 w-full min-h-[44px] rounded-lg bg-purple-500/25 border border-purple-400/40 text-purple-100 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {seekingHere ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeking…</> : <><ScrollText className="w-4 h-4" /> Seek a quest</>}
          </button>
        </div>

        {offered.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-wider text-amber-300/80">Offered</h3>
            {offered.map(q => <QuestCard key={q.key} q={q} category={category} api={api} mode="offered" />)}
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-wider text-purple-300/80">Active</h3>
          {active.length === 0
            ? <p className="text-xs text-white/40">No active {cat.label} quests. Accept an offer, or tap Seek a quest.</p>
            : active.map(q => <QuestCard key={q.key} q={q} category={category} api={api} mode="active" />)}
        </section>

        {done.length > 0 && (
          <section className="space-y-2">
            <button onClick={() => setShowDone(s => !s)} style={tap} className="w-full flex items-center gap-2 min-h-[40px] text-left">
              <h3 className="text-[11px] uppercase tracking-wider text-white/45">Finished ({done.length})</h3>
              <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', showDone && 'rotate-180')} />
            </button>
            {showDone && done.map(q => <QuestCard key={q.key} q={q} category={category} api={api} mode="done" />)}
          </section>
        )}
      </div>
    </div>
  );
}

/** One thin line above the chat: the active quest's next step. Tap to open the hub. */
export function QuestObjectiveStrip({ quest, onOpen }: { quest: Quest | null; onOpen: () => void }) {
  if (!quest) return null;
  const cat = hubCategory(questCategory(quest));
  const next = nextObjective(quest);
  return (
    <button
      onClick={onOpen}
      style={tap}
      className="shrink-0 w-full flex items-center gap-2 px-4 py-1.5 min-h-[36px] bg-purple-950/40 border-b border-purple-500/15 text-left"
      aria-label="Open the Quest Hub"
    >
      <span className="text-sm shrink-0">{cat.emoji}</span>
      <span className="text-[11px] text-white/80 truncate min-w-0">
        <span className="text-purple-200">{questTitle(quest)}</span>
        {next ? <span className="text-white/55"> · Next: {next.text}</span> : null}
      </span>
      <span className="ml-auto text-[10px] text-white/40 shrink-0">{questPercent(quest)}%</span>
    </button>
  );
}
