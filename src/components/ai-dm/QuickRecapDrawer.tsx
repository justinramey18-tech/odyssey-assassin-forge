import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RefreshCw, Loader2, Eye, Compass, ScrollText, Flag, Users, Skull, Shield, Signpost, Link2, Hourglass, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Art slots (null = styled fallback) ──
const HANDLE_ART: string | null = null;
const BG_ART: string | null = null;
const BANNER_ART: string | null = null;
const LOADING_ART: string | null = null;
const PLAY_ART: string | null = null;
const CARD_FRAME_ART: string | null = null;
const FRAME_SLICE = 120;
const FRAME_WIDTH = 22;
const SECTION_ICON_ART: Record<string, string | null> = {
  rightNow: null, whereWhen: null, story: null, objectives: null, npcs: null,
  threats: null, crew: null, options: null, threads: null,
};

const GLOW_TEXT_SHADOW =
  '0 0 6px rgba(255,183,77,0.9), 0 0 14px rgba(245,158,11,0.55), 0 1px 2px rgba(0,0,0,0.95), 0 -1px 1px rgba(0,0,0,0.8)';

export type QuickRecapContext = {
  lastMessageId: string | null;
  characterName: string;
  campaignSummary: string | null;
  memoryAnchors: string | null;
  quests: { title: string; status: string; detail: string }[];
  worldState: { title: string; consequence: string; impact: string }[];
  party: { name: string; className?: string; level?: number; currentHP?: number; maxHP?: number; conditions?: string[] }[];
  recentMessages: { role: 'user' | 'assistant'; name: string; content: string }[];
};

export type QuickRecap = {
  headline: string;
  rightNow: string;
  whereAndWhen: { location: string; time?: string; sceneType: string };
  storySoFar: string[];
  objectives: { title: string; status: 'active' | 'urgent' | 'done' | string; detail: string }[];
  keyNpcs: { name: string; role: string; attitude: 'ally' | 'neutral' | 'hostile' | 'unknown' | string; note: string }[];
  threats: { name: string; detail: string; clock?: string }[];
  crew: { name: string; status: string }[];
  yourOptions: string[];
  looseThreads: string[];
};

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'empty';
type CacheEntry = { recap: QuickRecap; lastMessageId: string | null; generatedAt: number };

interface QuickRecapDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay: () => void;
  partyId: string;
  characterName: string;
  getContext: () => QuickRecapContext;
}

const cacheKey = (partyId: string, name: string) => `odyssey:quick-recap:${partyId}:${name}`;

function readCache(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.recap) return null;
    return parsed as CacheEntry;
  } catch { return null; }
}
function writeCache(key: string, entry: CacheEntry) {
  try { localStorage.setItem(key, JSON.stringify(entry)); } catch { /* storage unavailable */ }
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

function RecapCard({ title, icon: Icon, iconArt, hero, children }: {
  title: string; icon: ComponentType<{ className?: string }>; iconArt: string | null; hero?: boolean; children: ReactNode;
}) {
  const framed = !!CARD_FRAME_ART;
  return (
    <section
      className={cn(
        !framed && 'rounded-xl border border-amber-700/35 bg-black/55 backdrop-blur-[2px] p-3.5',
        hero && 'shadow-[0_0_22px_rgba(245,158,11,0.25)]',
      )}
      style={framed ? {
        borderStyle: 'solid',
        borderWidth: `${FRAME_WIDTH}px`,
        borderImage: `url(${CARD_FRAME_ART}) ${FRAME_SLICE} fill / ${FRAME_WIDTH}px stretch`,
        padding: '4px',
      } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        {iconArt
          ? <img src={iconArt} alt="" className="h-7 w-7 object-contain" />
          : <span className="h-7 w-7 flex items-center justify-center"><Icon className="h-5 w-5 text-amber-400" /></span>}
        <h3 className="font-cinzel text-[13px] uppercase tracking-[0.12em] text-amber-300">{title}</h3>
      </div>
      {children}
    </section>
  );
}

const ATTITUDE: Record<string, { dot: string; label: string }> = {
  ally: { dot: 'bg-emerald-400', label: 'Ally' },
  neutral: { dot: 'bg-zinc-400', label: 'Neutral' },
  hostile: { dot: 'bg-red-400', label: 'Hostile' },
  unknown: { dot: 'bg-violet-300', label: 'Unknown' },
};

export function QuickRecapDrawer({ open, onOpenChange, onPlay, partyId, characterName, getContext }: QuickRecapDrawerProps) {
  const [recap, setRecap] = useState<QuickRecap | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [fullyOpen, setFullyOpen] = useState(false);
  const [roundChatExpanded, setRoundChatExpanded] = useState(false);
  const inFlight = useRef(false);
  const getContextRef = useRef(getContext);
  getContextRef.current = getContext;

  const key = cacheKey(partyId, characterName);

  useEffect(() => {
    const update = () => setRoundChatExpanded(document.body.classList.contains('round-chat-expanded'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const generate = useCallback(async (_force?: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const ctx = getContextRef.current();
      const { lastMessageId, ...body } = ctx;
      const { data, error } = await supabase.functions.invoke('party-quick-recap', { body });
      if (error) {
        let msg = 'Could not build the recap.';
        try {
          const ctxRes = (error as { context?: Response }).context;
          if (ctxRes && typeof ctxRes.json === 'function') {
            const j = await ctxRes.json();
            if (j?.error && typeof j.error === 'string') msg = j.error;
          }
        } catch { /* ignore */ }
        setErrorMessage(msg);
        setStatus('error');
        return;
      }
      if (data?.recap) {
        const now = Date.now();
        setRecap(data.recap as QuickRecap);
        setGeneratedAt(now);
        setStatus('ready');
        writeCache(key, { recap: data.recap, lastMessageId, generatedAt: now });
      } else if (data?.reason === 'no_story') {
        setStatus('empty');
      } else {
        setErrorMessage(typeof data?.error === 'string' ? data.error : 'Could not build the recap.');
        setStatus('error');
      }
    } catch {
      setErrorMessage('Could not build the recap.');
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [key]);

  useEffect(() => {
    if (!open) { setFullyOpen(false); return; }
    let ctx: QuickRecapContext;
    try { ctx = getContextRef.current(); } catch { setStatus('error'); setErrorMessage('Could not build the recap.'); return; }
    if (arr(ctx.recentMessages).length === 0 && !ctx.campaignSummary?.trim()) { setStatus('empty'); return; }
    const cached = readCache(key);
    if (cached && cached.lastMessageId === ctx.lastMessageId) {
      setRecap(cached.recap);
      setGeneratedAt(Number.isFinite(cached.generatedAt) ? cached.generatedAt : null);
      setStatus('ready');
      return;
    }
    void generate();
  }, [open, key, generate]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Notch swipe-up (same thresholds as DMBottomNav)
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartTime.current;
    const velocity = Math.abs(dy) / Math.max(dt, 1);
    if (dy > 30 || (dy > 10 && velocity > 0.3)) onOpenChange(true);
  }, [onOpenChange]);

  // Header swipe-down to close
  const headerStartY = useRef(0);
  const onHeaderTouchStart = useCallback((e: React.TouchEvent) => { headerStartY.current = e.touches[0].clientY; }, []);
  const onHeaderTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - headerStartY.current > 120) onOpenChange(false);
  }, [onOpenChange]);

  const handlePlay = useCallback(() => { onOpenChange(false); onPlay(); }, [onOpenChange, onPlay]);

  // Early return must stay below every hook call.
  const hideNotch = roundChatExpanded;

  const lowerName = characterName.trim().toLowerCase();

  const renderBody = () => {
    if (status === 'loading' || status === 'idle') {
      return (
        <>
          <div className="space-y-2 pt-1">
            <Skeleton className="h-5 w-4/5 bg-amber-900/30" />
            <Skeleton className="h-5 w-3/5 bg-amber-900/30" />
          </div>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl bg-amber-900/20" />)}
          <div className="flex flex-col items-center gap-2 pt-2">
            {LOADING_ART
              ? <img src={LOADING_ART} alt="" className="w-[72px] animate-[spin_6s_linear_infinite]" />
              : <Loader2 className="h-6 w-6 animate-spin text-amber-400" />}
            <p className="text-xs text-amber-200/70 text-center">Reading the chronicle...</p>
          </div>
        </>
      );
    }
    if (status === 'empty') {
      return (
        <div className="rounded-xl border border-amber-700/35 bg-black/55 p-4 text-[14px] text-zinc-200 text-center">
          The story hasn't started yet. Hit Play and make the first move.
        </div>
      );
    }
    if (status === 'error' || !recap) {
      return (
        <div className="rounded-xl border border-red-700/40 bg-black/60 p-4 flex flex-col items-center gap-3 text-center">
          <p className="text-[14px] text-zinc-200">{errorMessage || 'Could not build the recap.'}</p>
          <button
            onClick={() => void generate(true)}
            className="min-h-[44px] px-5 rounded-lg border border-amber-500/50 bg-amber-900/40 text-amber-100 font-cinzel text-[13px] tracking-wide active:scale-95"
            style={{ touchAction: 'manipulation' }}
          >Try again</button>
        </div>
      );
    }

    const story = arr(recap.storySoFar);
    const objectives = arr(recap.objectives);
    const npcs = arr(recap.keyNpcs);
    const threats = arr(recap.threats);
    const crew = arr(recap.crew);
    const options = arr(recap.yourOptions);
    const threads = arr(recap.looseThreads);
    const ww = recap.whereAndWhen;

    return (
      <>
        {(recap.headline || recap.rightNow) && (
          <RecapCard title="Right Now" icon={Eye} iconArt={SECTION_ICON_ART.rightNow} hero>
            {recap.headline && <p className="font-cinzel text-[17px] leading-snug text-[#FFE4AA] mb-1.5">{recap.headline}</p>}
            {recap.rightNow && <p className="text-[15px] leading-relaxed text-zinc-200">{recap.rightNow}</p>}
          </RecapCard>
        )}

        {ww && (ww.location || ww.time || ww.sceneType) && (
          <RecapCard title="Where & When" icon={Compass} iconArt={SECTION_ICON_ART.whereWhen}>
            {ww.location && <p className="text-[15px] text-zinc-100">{ww.location}</p>}
            {ww.time && <p className="text-[13px] text-amber-300">{ww.time}</p>}
            {ww.sceneType && (
              <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide border border-amber-500/40 text-amber-200">
                {ww.sceneType}
              </span>
            )}
          </RecapCard>
        )}

        {story.length > 0 && (
          <RecapCard title="Story So Far" icon={ScrollText} iconArt={SECTION_ICON_ART.story}>
            <ol className="list-decimal pl-5 space-y-1.5">
              {story.map((beat, i) => (
                <li key={i} className={cn('text-[14px]', i === story.length - 1 ? 'text-zinc-100' : 'text-zinc-300')}>{beat}</li>
              ))}
            </ol>
          </RecapCard>
        )}

        {objectives.length > 0 && (
          <RecapCard title="Objectives" icon={Flag} iconArt={SECTION_ICON_ART.objectives}>
            <ul className="space-y-2.5">
              {objectives.map((o, i) => {
                const st = (o.status || 'active').toLowerCase();
                const done = st === 'done';
                const pill = st === 'urgent'
                  ? 'border-red-400/60 text-red-400 animate-pulse'
                  : done ? 'border-emerald-400/50 text-emerald-300' : 'border-amber-500/50 text-amber-300';
                return (
                  <li key={i} className={cn(done && 'opacity-70')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('font-semibold text-zinc-100 text-[14px]', done && 'line-through')}>{o.title}</span>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide', pill)}>{st}</span>
                    </div>
                    {o.detail && <p className="text-[13px] text-zinc-400">{o.detail}</p>}
                  </li>
                );
              })}
            </ul>
          </RecapCard>
        )}

        {npcs.length > 0 && (
          <RecapCard title="Key People" icon={Users} iconArt={SECTION_ICON_ART.npcs}>
            <ul className="space-y-2.5">
              {npcs.map((n, i) => {
                const a = ATTITUDE[(n.attitude || 'unknown').toLowerCase()] ?? ATTITUDE.unknown;
                return (
                  <li key={i}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-100 text-[14px]">{n.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                        <span className={cn('h-2 w-2 rounded-full', a.dot)} />{a.label}
                      </span>
                    </div>
                    {n.role && <p className="text-[12px] text-zinc-400">{n.role}</p>}
                    {n.note && <p className="text-[13px] text-zinc-300">{n.note}</p>}
                  </li>
                );
              })}
            </ul>
          </RecapCard>
        )}

        {threats.length > 0 && (
          <RecapCard title="Threats & Clocks" icon={Skull} iconArt={SECTION_ICON_ART.threats}>
            <ul className="space-y-2.5">
              {threats.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold text-red-200 text-[14px]">{t.name}</span>
                  {t.detail && <p className="text-[13px] text-zinc-300">{t.detail}</p>}
                  {t.clock && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-red-400/40 px-2 py-0.5 text-[11px] text-red-200">
                      <Hourglass className="h-3 w-3" />{t.clock}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </RecapCard>
        )}

        {crew.length > 0 && (
          <RecapCard title="The Crew" icon={Shield} iconArt={SECTION_ICON_ART.crew}>
            <ul className="space-y-2">
              {crew.map((c, i) => {
                const you = !!lowerName && (c.name || '').trim().toLowerCase() === lowerName;
                return (
                  <li key={i} className={cn('pl-2', you && 'border-l-2 border-amber-400')}>
                    <span className="font-semibold text-zinc-100 text-[14px]">{c.name}</span>
                    {you && <span className="ml-2 rounded px-1.5 py-0.5 text-[11px] bg-amber-500/20 text-amber-200">you</span>}
                    {c.status && <p className="text-[13px] text-zinc-300">{c.status}</p>}
                  </li>
                );
              })}
            </ul>
          </RecapCard>
        )}

        {options.length > 0 && (
          <RecapCard title="Your Options" icon={Signpost} iconArt={SECTION_ICON_ART.options}>
            <ul className="space-y-1.5">
              {options.map((o, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[14px] text-zinc-100">
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />{o}
                </li>
              ))}
            </ul>
          </RecapCard>
        )}

        {threads.length > 0 && (
          <RecapCard title="Loose Threads" icon={Link2} iconArt={SECTION_ICON_ART.threads}>
            <ul className="list-disc pl-5 space-y-1">
              {threads.map((t, i) => <li key={i} className="text-[13px] italic text-zinc-400">{t}</li>)}
            </ul>
          </RecapCard>
        )}
      </>
    );
  };

  return (
    <>
      {!open && !hideNotch && (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
          <div className="bg-background/95 backdrop-blur-sm border-t border-amber-900/30">
            <div
              className="flex flex-col items-center py-2.5 cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => onOpenChange(true)}
              role="button"
              aria-label="Open quick recap"
              style={{ touchAction: 'manipulation' }}
            >
              {HANDLE_ART ? (
                <div className="relative w-full">
                  <img src={HANDLE_ART} alt="" className="h-[44px] w-full object-contain pointer-events-none" />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 flex items-center justify-center text-[11px] font-mono tracking-widest text-amber-400/60 font-semibold select-none">
                    📜 QUICK RECAP
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-14 h-1.5 rounded-full transition-all bg-amber-500/30 shadow-[0_0_10px_3px_rgba(245,158,11,0.3)] animate-pulse" />
                  <span className="text-[11px] font-mono text-amber-400/60 mt-1 tracking-widest select-none font-semibold">
                    📜 QUICK RECAP
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="quick-recap"
            role="dialog"
            aria-modal="true"
            aria-label="Quick Recap"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onAnimationComplete={(def) => {
              if (typeof def === 'object' && def && (def as { y?: unknown }).y === 0) setFullyOpen(true);
            }}
            className={cn('fixed inset-0 z-[58] flex flex-col', !BG_ART && 'bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]')}
            style={{
              backgroundImage: BG_ART
                ? `linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 30%, rgba(0,0,0,.75) 100%), url(${BG_ART})`
                : 'linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 30%, rgba(0,0,0,.75) 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
            }}
          >
            <div
              className="shrink-0 relative pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex flex-col items-center text-center"
              onTouchStart={onHeaderTouchStart}
              onTouchEnd={onHeaderTouchEnd}
            >
              {BANNER_ART ? (
                <img src={BANNER_ART} alt="Quick Recap" className="w-[82%] max-w-[360px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]" />
              ) : (
                <h2 className="font-cinzel text-xl font-bold tracking-[0.08em] text-[#FFE4AA]" style={{ textShadow: GLOW_TEXT_SHADOW }}>
                  QUICK RECAP
                </h2>
              )}
              <p className="text-[11px] text-amber-200/60 mt-0.5">
                Catching {characterName} up{generatedAt ? ` · updated ${relativeTime(generatedAt)}` : ''}
              </p>
              <button
                onClick={() => void generate(true)}
                disabled={status === 'loading'}
                aria-label="Refresh recap"
                className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] h-9 w-9 rounded-full border border-[#caa05a]/70 bg-black/70 text-[#f0c97a] flex items-center justify-center active:scale-95 disabled:opacity-60"
                style={{ touchAction: 'manipulation' }}
              >
                <RefreshCw className={cn('h-4 w-4', status === 'loading' && 'animate-spin')} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-32">
              <div className="mx-auto w-full max-w-[480px] flex flex-col gap-3">
                {renderBody()}
              </div>
            </div>

            {fullyOpen && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-x-0 bottom-0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent"
              >
                <button
                  onClick={handlePlay}
                  aria-label="Play: close the recap and open the live chat"
                  className={cn(
                    'block w-full max-w-[380px] mx-auto h-[64px] active:scale-[0.98] transition-transform',
                    !PLAY_ART && 'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 border border-amber-300/60 rounded-xl shadow-[0_0_24px_rgba(245,158,11,0.35)]',
                  )}
                  style={{
                    touchAction: 'manipulation',
                    ...(PLAY_ART ? { backgroundImage: `url(${PLAY_ART})`, backgroundSize: '100% 100%', border: 'none', background: undefined } : {}),
                  }}
                >
                  <span className="font-cinzel text-[22px] font-black tracking-[0.2em] text-[#FFE4AA]" style={{ textShadow: GLOW_TEXT_SHADOW }}>
                    PLAY
                  </span>
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default QuickRecapDrawer;
