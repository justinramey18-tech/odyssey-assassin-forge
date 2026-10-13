// Solo practice: runs the real mini-game screens and rules entirely on the phone,
// so nothing reaches the story, the party or the fight referee.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Swords, Target, Hand, Shield, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { CounterClashRing } from '@/components/ai-dm/CounterClashRing';
import { TugAndSlip } from '@/components/ai-dm/TugAndSlip';
import { DuelWheel, type DuelVerdict } from '@/components/ai-dm/DuelWheel';
import * as M from '@/lib/combatMinigames';
import * as DU from '@/lib/combatDuel';
import { cn } from '@/lib/utils';

export type Opponent = 'dummy' | 'sparring' | 'clash' | 'pin' | 'duel' | 'npc' | 'gauntlet';

/** A practice enemy that fights back. */
export interface Foe { name: string; maxHp: number; ac: number; attackBonus: number; damageAvg: number; speed: DU.DuelSpeed }

/** Gauntlet wave n (1-based): each wave is tougher than the last. */
export function gauntletFoe(wave: number): Foe {
  const w = Math.max(1, Math.floor(wave));
  const speeds: DU.DuelSpeed[] = ['trivial', 'easy', 'medium', 'hard', 'deadly'];
  return { name: `Wave ${w} Challenger`, maxHp: 20 + 12 * w, ac: Math.min(20, 10 + Math.floor(w / 2)), attackBonus: Math.min(12, 2 + w), damageAvg: 4 + 2 * w, speed: speeds[Math.min(4, Math.floor((w - 1) / 2))] };
}

const PLAYER_MAX_HP = 60;
const ATTACK_GAP_MS: Record<DU.DuelSpeed, number> = { trivial: 9000, easy: 8000, medium: 7000, hard: 6000, deadly: 5000 };

export const OPPONENTS: Array<{ id: Opponent; name: string; blurb: string; icon: typeof Swords }> = [
  { id: 'dummy', name: 'Wooden Dummy', blurb: 'Never hits back. Practise your swings.', icon: Target },
  { id: 'sparring', name: 'Sparring Partner', blurb: 'Fights back gently with surprise moves.', icon: Swords },
  { id: 'clash', name: 'Clash Master', blurb: 'Drills Counter Clash over and over.', icon: Shield },
  { id: 'pin', name: 'Grapple Master', blurb: 'Pins you so you can practise breaking free.', icon: Hand },
  { id: 'duel', name: 'Duel Master', blurb: 'Straight into a Duel every time.', icon: Zap },
];

export interface ArenaStats {
  hits: number;
  damage: number;
  taps: number;
  perfects: number;
  bestChain: number;
  pinEscapes: number;
  bestEscapeMs: number | null;
  duelsWon: number;
  duels: number;
  bestWave: number;
}

export const emptyStats = (): ArenaStats => ({
  hits: 0, damage: 0, taps: 0, perfects: 0, bestChain: 0, pinEscapes: 0, bestEscapeMs: null, duelsWon: 0, duels: 0, bestWave: 0,
});

type Live =
  | { kind: 'clash'; clash: M.Clash; hitAt: number; results: Array<M.ClashQ | null> }
  | { kind: 'pin'; struggle: M.Struggle; until: number; startedAt: number }
  | { kind: 'duel'; duel: DU.Duel }
  | null;

const roll: M.Roller = (sides) => 1 + Math.floor(Math.random() * sides);

/** Plain words for how far off a tap was. */
export function timingText(offMs: number): string {
  const s = (Math.abs(offMs) / 1000).toFixed(2);
  if (Math.abs(offMs) <= 15) return 'Dead on';
  return offMs < 0 ? `Early by ${s}s` : `Late by ${s}s`;
}

interface Props {
  opponent: Opponent;
  stats: ArenaStats;
  onStats: (s: ArenaStats) => void;
  onBack: () => void;
  /** For 'npc': the saved campaign NPC to fight. */
  foe?: Foe;
}

export function ArenaPractice({ opponent, stats, onStats, onBack, foe: givenFoe }: Props) {
  const [wave, setWave] = useState(1);
  const foe: Foe | null = opponent === 'gauntlet' ? gauntletFoe(wave) : opponent === 'npc' ? givenFoe ?? null : null;
  const fights = !!foe;
  const meta = OPPONENTS.find((o) => o.id === opponent) ?? { id: opponent, name: foe?.name ?? 'Opponent', blurb: opponent === 'gauntlet' ? `Wave ${wave}. Your health carries over.` : 'Your campaign NPC, for practice.', icon: Swords };
  const [myHp, setMyHp] = useState(PLAYER_MAX_HP);
  const [over, setOver] = useState(false);
  const myHpRef = useRef(PLAYER_MAX_HP);
  const [speed, setSpeed] = useState(1);
  const [live, setLive] = useState<Live>(null);
  const [hp, setHp] = useState(100);
  const [floater, setFloater] = useState<{ text: string; at: number } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const chainRef = useRef(0);

  // Practice clock: speed below 1 slows every swing, ring and needle evenly.
  const clock = useRef({ base: Date.now(), virt: Date.now(), speed: 1 });
  const now = useCallback(() => {
    const c = clock.current;
    return c.virt + (Date.now() - c.base) * c.speed;
  }, []);
  useEffect(() => {
    const t = now();
    clock.current = { base: Date.now(), virt: t, speed };
  }, [speed, now]);

  const bump = (patch: Partial<ArenaStats>) => onStats({ ...statsRef.current, ...patch });

  const startClash = useCallback(() => {
    const moves: M.ClashMove[] = ['heavy', 'signature', 'sweep'];
    const c = M.buildClash(`c${Date.now()}`, moves[Math.floor(Math.random() * moves.length)], roll);
    const hitAt = now() + 1200 - M.clashStartsAt(c, 0);
    setFeedback(null);
    setLive({ kind: 'clash', clash: c, hitAt, results: [] });
  }, [now]);

  const startPin = useCallback(() => {
    const t = now();
    setLive({ kind: 'pin', struggle: M.newStruggle(Math.floor(Math.random() * 1e9), t), until: t + 30000, startedAt: t });
  }, [now]);

  const startDuel = useCallback(() => {
    const P = DU.deriveDuel({ level: 5, dex: 14, ac: 15, maxHp: 40, npcAttack: foe?.attackBonus ?? 5, npcDamageAvg: foe?.damageAvg ?? 8, npcSpeed: foe?.speed ?? 'medium' });
    setLive({
      kind: 'duel',
      duel: DU.newDuel(
        { id: `d${Date.now()}`, npcId: 'arena', npcName: meta.name, startAt: now() + DU.DUEL_LEAD_MS, finish: 'knockout', weapon: null },
        P, Math.random,
      ),
    });
  }, [now, meta.name, foe?.attackBonus, foe?.damageAvg, foe?.speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drill masters start their drill right away and again after each one.
  useEffect(() => {
    if (live) return;
    const t = setTimeout(() => {
      if (opponent === 'clash') startClash();
      else if (opponent === 'pin') startPin();
      else if (opponent === 'duel') startDuel();
    }, 1500);
    return () => clearTimeout(t);
  }, [live, opponent, startClash, startPin, startDuel]);

  // End a clash once its last window has passed.
  useEffect(() => {
    if (live?.kind !== 'clash') return;
    const id = setInterval(() => {
      if (now() > live.hitAt + 600) {
        const perfect = M.chainPerfect(live.clash, live.results);
        if (foe) takeHit(Math.round(live.clash.swings.reduce((a, _s, i) => a + M.clashFactor(live.results[i]), 0) * foe.damageAvg / live.clash.swings.length * (live.clash.move === 'signature' ? 2 : 1.3)));
        chainRef.current = perfect ? chainRef.current + 1 : 0;
        bump({ bestChain: Math.max(statsRef.current.bestChain, chainRef.current) });
        setLive(null);
      }
    }, 100);
    return () => clearInterval(id);
  }, [live, now]); // eslint-disable-line react-hooks/exhaustive-deps

  // A pin that runs out counts as not escaped.
  useEffect(() => {
    if (live?.kind !== 'pin') return;
    const id = setInterval(() => { if (now() > live.until) { setFeedback('The pin held. Try again.'); if (foe) takeHit(Math.round(foe.damageAvg * 1.5)); setLive(null); } }, 200);
    return () => clearInterval(id);
  }, [live, now]);

  // Fighting foes strike on their own: a Counter Clash, sometimes a Pin.
  useEffect(() => {
    if (!foe || live || over) return;
    const t = setTimeout(() => (Math.random() < 0.8 ? startClash() : startPin()), ATTACK_GAP_MS[foe.speed] / speed);
    return () => clearTimeout(t);
  }, [foe?.speed, live, over, speed, startClash, startPin]); // eslint-disable-line react-hooks/exhaustive-deps

  const takeHit = (amount: number) => {
    if (!foe || amount <= 0) return;
    const n = Math.max(0, myHpRef.current - amount);
    myHpRef.current = n;
    setMyHp(n);
    if (n === 0) {
      setOver(true);
      setFeedback(opponent === 'gauntlet' ? `You fell on wave ${wave}.` : `${foe.name} wins this round.`);
    }
  };

  const restart = () => { myHpRef.current = PLAYER_MAX_HP; setMyHp(PLAYER_MAX_HP); setHp(100); setWave(1); setOver(false); setFeedback(null); setLive(null); };

  const attack = () => {
    if (over) return;
    if (foe && roll(20) + 5 < foe.ac) { setFloater({ text: 'Miss', at: Date.now() }); return; }
    const dmg = roll(8) + 3;
    if (foe) {
      const pct = (dmg / foe.maxHp) * 100;
      if (hp - pct > 0) setHp(hp - pct);
      else {
        if (opponent === 'gauntlet') {
          setFeedback(`Wave ${wave} cleared!`);
          bump({ bestWave: Math.max(statsRef.current.bestWave, wave) });
          setWave((w) => w + 1);
        } else setFeedback(`${foe.name} is beaten!`);
        setHp(100);
      }
    } else setHp((h) => (h - dmg <= 0 ? 100 : h - dmg));
    setFloater({ text: `-${dmg}`, at: Date.now() });
    bump({ hits: statsRef.current.hits + 1, damage: statsRef.current.damage + dmg });
    if (!fights && opponent === 'sparring' && Math.random() < 0.3) setTimeout(() => (Math.random() < 0.6 ? startClash() : startPin()), 600);
  };

  const onClashTap = async (side: M.Side, tapAt: number) => {
    if (live?.kind !== 'clash') return null;
    const j = M.judgeClash(live.clash, live.hitAt, tapAt, side, live.results);
    if (!j) return null;
    const { zero } = M.swingTimes(live.clash.swings[j.index], live.hitAt);
    const results = [...live.results];
    results[j.index] = j.q;
    setLive({ ...live, results });
    setFeedback(`${M.CLASH_LABEL[j.q]} · ${timingText(tapAt - zero)}`);
    bump({ taps: statsRef.current.taps + 1, perfects: statsRef.current.perfects + (j.q === 'perfect' ? 1 : 0) });
    return { ok: true, index: j.index, quality: j.q };
  };

  const onHeave = async (tapAt: number) => {
    if (live?.kind !== 'pin') return null;
    const r = M.heave(live.struggle, tapAt);
    if (!r) return null;
    if (r.free) {
      const ms = Math.round(tapAt - live.startedAt);
      const best = statsRef.current.bestEscapeMs;
      bump({ pinEscapes: statsRef.current.pinEscapes + 1, bestEscapeMs: best === null ? ms : Math.min(best, ms) });
      setFeedback(`Broke free in ${(ms / 1000).toFixed(1)}s`);
      setTimeout(() => setLive(null), 900);
    } else {
      setLive({ ...live, struggle: r.state });
    }
    return { ok: true, free: r.free, struggle: r.state };
  };

  const onDuelFinish = async (inputs: DU.DuelInput[]): Promise<DuelVerdict | null> => {
    if (live?.kind !== 'duel') return null;
    const run = DU.startRun(live.duel);
    for (const i of inputs) DU.inputRun(run, i);
    const out = DU.finishRun(run);
    const won = out.hits <= out.perfect;
    if (foe) { if (won) setHp(1); else takeHit(Math.round(out.hits * foe.damageAvg * 0.6)); }
    bump({ duels: statsRef.current.duels + 1, duelsWon: statsRef.current.duelsWon + (won ? 1 : 0) });
    return { ok: true, perfect: out.perfect, block: out.block, hits: out.hits, ripostes: out.ripostes, allPerfect: out.allPerfect, defeated: won, npcName: meta.name };
  };

  const canAttack = opponent === 'dummy' || opponent === 'sparring' || fights;
  const showFloater = floater && Date.now() - floater.at < 900;
  const speedLabel = useMemo(() => `${speed.toFixed(2).replace(/0$/, '')}x`, [speed]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onBack}
        style={{ touchAction: 'manipulation' }}
        className="flex min-h-[48px] items-center gap-2 self-start text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Opponents
      </button>

      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <meta.icon className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-2 font-cinzel text-base font-bold uppercase tracking-wider text-foreground">{meta.name}</h2>
        <p className="text-xs text-muted-foreground">{meta.blurb}</p>
        {canAttack && (
          <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${hp}%` }} />
          </div>
        )}
        {fights && (
          <div className="mt-3 text-left">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">You · {myHp}/{PLAYER_MAX_HP}</div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-accent transition-all" style={{ width: `${(myHp / PLAYER_MAX_HP) * 100}%` }} />
            </div>
          </div>
        )}
        {showFloater && <div className="mt-2 font-cinzel text-2xl font-bold text-destructive">{floater!.text}</div>}
        {feedback && <div className="mt-2 text-sm font-semibold text-primary">{feedback}</div>}
      </div>

      {over && (
        <button type="button" onClick={restart} style={{ touchAction: 'manipulation' }} className="min-h-[56px] w-full rounded-xl border border-primary font-cinzel font-bold uppercase tracking-wider text-primary">
          Try again
        </button>
      )}
      {canAttack && !over && (
        <button
          type="button"
          onClick={attack}
          style={{ touchAction: 'manipulation' }}
          className="min-h-[64px] w-full rounded-xl bg-primary font-cinzel text-lg font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.97]"
        >
          Attack
        </button>
      )}

      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Practise a move now</div>
        <div className="grid grid-cols-3 gap-2">
          {([['Clash', startClash], ['Pin', startPin], ['Duel', startDuel]] as const).map(([label, fn]) => (
            <button
              key={label}
              type="button"
              disabled={!!live}
              onClick={fn}
              style={{ touchAction: 'manipulation' }}
              className={cn('min-h-[48px] rounded-lg border border-border bg-background text-sm font-semibold text-foreground active:scale-95', live && 'opacity-40')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Practice speed</span>
          <span className="text-primary">{speedLabel}</span>
        </div>
        <Slider min={0.5} max={1.5} step={0.25} value={[speed]} onValueChange={(v) => setSpeed(v[0])} disabled={!!live} />
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Slow</span><span>Normal</span><span>Hard</span></div>
      </div>

      {live?.kind === 'clash' && (
        <CounterClashRing
          skillName="Practice swing" npcName={meta.name} clash={live.clash} hitAt={live.hitAt}
          results={live.results} serverTime={now} frozenAt={null} onTap={onClashTap}
        />
      )}
      {live?.kind === 'pin' && (
        <TugAndSlip npcName={meta.name} pinnedUntil={live.until} struggle={live.struggle} serverTime={now} frozenAt={null} onHeave={onHeave} />
      )}
      {live?.kind === 'duel' && (
        <DuelWheel duel={live.duel} serverTime={now} onFinish={onDuelFinish} onClose={() => setLive(null)} />
      )}
    </div>
  );
}
