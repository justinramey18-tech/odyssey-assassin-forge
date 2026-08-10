import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  HELP_SECTIONS,
  HELP_TOPICS,
  HELP_QUICK_START,
  HELP_FIXES,
  HELP_GLOSSARY,
  type HelpSectionId,
  type HelpIconKey,
} from '@/lib/helpContent';
import {
  X, Search, ChevronLeft, ChevronRight, ChevronDown, Rocket, User, Swords, Users,
  LifeBuoy, BookOpen, Activity, Zap, Backpack, Mic2, Dices, Heart, Wrench, Scroll,
  Gift, MessagesSquare, CheckSquare, Radio, Split, Compass, MapPin, Lightbulb,
} from 'lucide-react';

const ICONS: Record<HelpIconKey, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  user: User,
  swords: Swords,
  users: Users,
  lifebuoy: LifeBuoy,
  bookOpen: BookOpen,
  activity: Activity,
  zap: Zap,
  backpack: Backpack,
  mic: Mic2,
  dice: Dices,
  heart: Heart,
  wrench: Wrench,
  scroll: Scroll,
  gift: Gift,
  messages: MessagesSquare,
  check: CheckSquare,
  radio: Radio,
  split: Split,
  compass: Compass,
};

const TAP = { touchAction: 'manipulation' } as const;

function WhereChip({ where }: { where: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[10px] text-white/45">
      <MapPin className="w-3 h-3 text-amber-400/50" />
      {where}
    </span>
  );
}

type View =
  | { kind: 'home' }
  | { kind: 'section'; id: HelpSectionId }
  | { kind: 'topic'; id: string };

export interface TableGuideProps {
  open: boolean;
  onClose: () => void;
  /** True when opened from a party session — unlocks party-only content. */
  isParty?: boolean;
}

export function TableGuide({ open, onClose, isParty = false }: TableGuideProps) {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [query, setQuery] = useState('');
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setView({ kind: 'home' });
      setQuery('');
      setOpenEntry(null);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allow = (partyOnly?: boolean) => isParty || !partyOnly;

  const sections = useMemo(() => HELP_SECTIONS.filter((s) => allow(s.partyOnly)), [isParty]);
  const topics = useMemo(() => HELP_TOPICS.filter((t) => allow(t.partyOnly)), [isParty]);
  const fixes = useMemo(() => HELP_FIXES.filter((f) => allow(f.partyOnly)), [isParty]);
  const glossary = useMemo(() => HELP_GLOSSARY.filter((g) => allow(g.partyOnly)), [isParty]);

  const q = query.trim().toLowerCase();
  const searching = q.length >= 2;

  const results = useMemo(() => {
    if (!searching) return [];
    const out: Array<{
      key: string;
      crumb: string;
      title: string;
      body: string;
      where?: string;
    }> = [];
    const has = (...parts: Array<string | undefined>) =>
      parts.some((p) => (p || '').toLowerCase().includes(q));

    for (const topic of topics) {
      const section = HELP_SECTIONS.find((s) => s.id === topic.section);
      topic.entries.forEach((e, i) => {
        if (!allow(e.partyOnly)) return;
        if (!has(e.q, e.a)) return;
        out.push({
          key: `t-${topic.id}-${i}`,
          crumb: `${section?.title ?? ''} · ${topic.title}`,
          title: e.q,
          body: e.a,
          where: e.where,
        });
      });
    }
    const fixSection = HELP_SECTIONS.find((s) => s.id === 'fixes');
    fixes.forEach((f, i) => {
      if (!has(f.symptom, f.cause, f.fix)) return;
      out.push({
        key: `f-${i}`,
        crumb: fixSection?.title ?? '',
        title: f.symptom,
        body: f.fix,
      });
    });
    const termSection = HELP_SECTIONS.find((s) => s.id === 'terms');
    glossary.forEach((g, i) => {
      if (!has(g.term, g.meaning)) return;
      out.push({
        key: `g-${i}`,
        crumb: termSection?.title ?? '',
        title: g.term,
        body: g.meaning,
      });
    });
    return out.slice(0, 40);
  }, [searching, q, topics, fixes, glossary, isParty]);

  if (!open) return null;

  const activeSection =
    view.kind === 'section' ? sections.find((s) => s.id === view.id) : undefined;
  const activeTopic = view.kind === 'topic' ? topics.find((t) => t.id === view.id) : undefined;

  const headerTitle =
    view.kind === 'home' ? 'Table Guide' : activeTopic?.title ?? activeSection?.title ?? 'Table Guide';
  const headerSub =
    view.kind === 'home'
      ? 'How to play, and how to fix things'
      : activeTopic?.blurb ?? activeSection?.blurb ?? '';

  const goBack = () => {
    if (view.kind === 'topic') {
      const t = topics.find((x) => x.id === view.id);
      setView(t ? { kind: 'section', id: t.section } : { kind: 'home' });
    } else {
      setView({ kind: 'home' });
    }
    setOpenEntry(null);
  };

  const openTopic = (id: string) => {
    setView({ kind: 'topic', id });
    setOpenEntry(`${id}-0`);
  };

  const visibleEntries = (topicId: string) => {
    const t = topics.find((x) => x.id === topicId);
    if (!t) return [];
    return t.entries
      .map((e, i) => ({ entry: e, index: i }))
      .filter(({ entry }) => allow(entry.partyOnly));
  };

  const body = (
    <div className="fixed inset-0 z-[95] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-amber-900/30 bg-black/50 backdrop-blur-sm">
        {view.kind !== 'home' && (
          <button
            aria-label="Back"
            onClick={goBack}
            style={TAP}
            className="p-2 -ml-1 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-amber-300" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-cinzel text-amber-100 truncate">{headerTitle}</div>
          <div className="text-[10px] text-white/40 truncate">{headerSub}</div>
        </div>
        <button
          aria-label="Close guide"
          onClick={onClose}
          style={TAP}
          className="p-2 rounded-lg hover:bg-white/10 min-w-[48px] min-h-[48px] flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white/80" />
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b border-white/5 bg-black/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — try 'rest', 'loot', 'ticked'"
            className="w-full min-h-[48px] rounded-xl bg-black/50 border border-white/10 pl-9 pr-10 text-xs text-foreground placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
          />
          {query.length > 0 && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery('')}
              style={TAP}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center text-white/40"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3 pb-10">
        {searching ? (
          results.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Search className="w-5 h-5 text-white/20 mx-auto" />
              <div className="text-xs text-white/50">Nothing matches that.</div>
              <div className="text-[10px] text-white/30">
                Try a single word like rest, loot, ticked or gold
              </div>
              <button
                onClick={() => setQuery('')}
                style={TAP}
                className="min-h-[44px] px-4 rounded-lg border border-white/15 text-[11px] text-amber-200"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              <div className="text-[10px] text-white/35 px-1">
                {results.length} {results.length === 1 ? 'match' : 'matches'}
              </div>
              {results.map((r) => (
                <div key={r.key} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-white/30">{r.crumb}</div>
                  <div className="text-[11px] font-semibold text-amber-200/90 leading-snug">{r.title}</div>
                  <div className="text-[11px] text-white/70 leading-relaxed">{r.body}</div>
                  {r.where && <WhereChip where={r.where} />}
                </div>
              ))}
            </>
          )
        ) : view.kind === 'home' ? (
          <>
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-cinzel text-amber-100">Start here</span>
                <span className="text-[10px] text-white/40 ml-auto">
                  5 steps to a playable character
                </span>
              </div>
              {HELP_QUICK_START.map((s, i) => (
                <div key={s.step} className="flex gap-2.5">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[11px] font-semibold text-amber-100/90">{s.step}</div>
                    <div className="text-[11px] text-white/65 leading-relaxed">{s.detail}</div>
                    {s.where && <WhereChip where={s.where} />}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {sections.map((s) => {
                const Icon = ICONS[s.icon];
                return (
                  <button
                    key={s.id}
                    onClick={() => setView({ kind: 'section', id: s.id })}
                    style={TAP}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3 min-h-[92px] rounded-xl border text-left transition-colors',
                      s.accent,
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-cinzel leading-tight">{s.title}</span>
                    <span className="text-[10px] text-white/45 leading-snug">{s.blurb}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-start gap-2 px-1 pt-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400/50 shrink-0 mt-0.5" />
              <span className="text-[10px] text-white/30 leading-relaxed">
                Stuck mid-scene? Search above — it looks through every answer at once.
              </span>
            </div>
          </>
        ) : view.kind === 'section' ? (
          view.id === 'fixes' ? (
            fixes.map((f) => (
              <div key={f.symptom} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1.5">
                <div className="text-[11px] font-semibold text-rose-200/90 leading-snug">{f.symptom}</div>
                <div className="text-[11px] text-white/50 leading-relaxed">Why: {f.cause}</div>
                {f.confirm && (
                  <div className="text-[11px] text-white/40 leading-relaxed">Check: {f.confirm}</div>
                )}
                <div className="flex items-start gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400/70 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-white/75 leading-relaxed">{f.fix}</div>
                </div>
              </div>
            ))
          ) : view.id === 'terms' ? (
            <div className="rounded-xl border border-white/10 bg-black/30 divide-y divide-white/5">
              {glossary.map((g) => (
                <div key={g.term} className="px-3 py-2.5 space-y-0.5">
                  <div className="text-[11px] font-semibold text-amber-200/90">{g.term}</div>
                  <div className="text-[11px] text-white/65 leading-relaxed">{g.meaning}</div>
                  {g.example && (
                    <div className="text-[10px] text-white/35 leading-relaxed italic">{g.example}</div>
                  )}
                </div>
              ))}
            </div>

          ) : (
            topics
              .filter((t) => t.section === view.id)
              .map((t) => {
                const Icon = ICONS[t.icon];
                return (
                  <button
                    key={t.id}
                    onClick={() => openTopic(t.id)}
                    style={TAP}
                    className="w-full flex items-center gap-2.5 px-3 py-3 min-h-[56px] rounded-xl border border-white/10 bg-black/30 text-left"
                  >
                    <Icon className="w-4 h-4 text-amber-400/80 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-cinzel text-foreground truncate">{t.title}</span>
                      <span className="block text-[10px] text-white/40 truncate">{t.blurb}</span>
                    </span>
                    <span className="text-[10px] text-white/25 shrink-0">
                      {visibleEntries(t.id).length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
                  </button>
                );
              })
          )
        ) : activeTopic ? (
          visibleEntries(activeTopic.id).map(({ entry, index }) => {
            const key = `${activeTopic.id}-${index}`;
            const isOpen = openEntry === key;
            return (
              <div key={key} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                <button
                  onClick={() => setOpenEntry(isOpen ? null : key)}
                  aria-expanded={isOpen}
                  style={TAP}
                  className="w-full flex items-start gap-2 px-3 py-3 min-h-[52px] text-left"
                >
                  <span className="min-w-0 flex-1 text-[11px] font-semibold text-amber-200/90 leading-snug">
                    {entry.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-white/25 shrink-0 mt-0.5 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 -mt-1 space-y-2">
                    <div className="text-[11px] text-white/70 leading-relaxed">{entry.a}</div>
                    {entry.steps && entry.steps.length > 0 && (
                      <ol className="space-y-1.5 pt-0.5">
                        {entry.steps.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="shrink-0 w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200/90 text-[9px] font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1 text-[11px] text-white/65 leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {entry.note && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.05] px-2.5 py-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase tracking-wider text-amber-300/60">Good to know</div>
                          <div className="text-[11px] text-white/65 leading-relaxed">{entry.note}</div>
                        </div>
                      </div>
                    )}
                    {entry.where && <WhereChip where={entry.where} />}
                  </div>
                )}

              </div>
            );
          })
        ) : null}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
