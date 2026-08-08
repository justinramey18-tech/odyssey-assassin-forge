import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { playDiceRattle } from '@/lib/diceSounds';
import { DICE_ODDS_CONFIGS } from '@/lib/diceOdds';
import { subscribeDiceRolls, DiceRollRequest } from '@/lib/diceRollBus';

/** Tumbling number that lands on a predetermined result — same feel as the
 *  built-in dice roller's RollingNumber. */
function Tumble({ target, sides, duration, delay = 0, onLand, className }: {
  target: number; sides: number; duration: number; delay?: number; onLand?: () => void; className?: string;
}) {
  const [display, setDisplay] = useState<number | null>(delay > 0 ? null : 1);
  const [landed, setLanded] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      const t0 = Date.now();
      const tick = () => {
        if (cancelled) return;
        const elapsed = Date.now() - t0;
        if (elapsed < duration) {
          setDisplay(Math.floor(Math.random() * sides) + 1);
          timer.current = window.setTimeout(tick, 40 + (elapsed / duration) * 120);
        } else {
          setDisplay(target);
          setLanded(true);
          onLand?.();
        }
      };
      tick();
    };
    timer.current = window.setTimeout(start, delay);
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [target, sides, duration, delay]);

  return (
    <span className={cn('tabular-nums inline-block transition-transform', !landed && 'animate-pulse', landed && 'scale-110', className)}>
      {display ?? '–'}
    </span>
  );
}

const D20_MS = 900;
const DMG_MS = 700;
const LINGER_MS = 1100;

export function DiceRollOverlay() {
  const [req, setReq] = useState<DiceRollRequest | null>(null);
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling');
  const lingerTimer = useRef<number>(0);

  useEffect(() => subscribeDiceRolls(r => {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    setReq(r);
    setPhase('rolling');
    playDiceRattle(D20_MS);
  }), []);

  useEffect(() => () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); }, []);

  if (!req) return null;

  const { roll } = req;
  const isCheck = roll.kind === 'check';
  const modeLabel = DICE_ODDS_CONFIGS[roll.mode].label;

  const finish = () => {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    const done = req;
    setReq(null);
    done.onComplete();
  };

  const handleAllLanded = () => {
    setPhase('done');
    lingerTimer.current = window.setTimeout(finish, LINGER_MS);
  };

  if (roll.kind === 'heal') {
    return createPortal(
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={finish}
        role="dialog"
        aria-label={`Healing roll for ${req.title}`}
      >
        <div className="mx-6 w-full max-w-xs rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#05150e] to-[#0a0a0f] p-5 text-center shadow-2xl shadow-black/70">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">healing</p>
          <p className="mt-1 text-sm font-cinzel text-emerald-200/90 truncate">{req.title}</p>

          <div className="mt-4 flex items-center justify-center gap-2 text-4xl font-display text-emerald-300">
            {roll.rolls.map((v, i) => (
              <Tumble
                key={i}
                target={v}
                sides={roll.die}
                duration={DMG_MS}
                delay={i * 90}
                onLand={i === roll.rolls.length - 1 ? handleAllLanded : undefined}
              />
            ))}
            {roll.bonus !== 0 && (
              <span className="text-2xl text-emerald-200/70">
                {roll.bonus > 0 ? '+' : '-'} {Math.abs(roll.bonus)}
              </span>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d{roll.die}</p>

          <div className="mt-3 h-6">
            {phase === 'done' && (
              <p className="text-sm font-bold tracking-widest text-emerald-300">+{roll.total} HP</p>
            )}
          </div>

          <p className="mt-2 text-[10px] text-white/25">tap to skip</p>
        </div>
      </div>,
      document.body
    );
  }

  if (roll.kind === 'effect') {
    return createPortal(
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={finish}
        role="dialog"
        aria-label={`Effect roll for ${req.title}`}
      >
        <div className="mx-6 w-full max-w-xs rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#150f05] to-[#0a0a0f] p-5 text-center shadow-2xl shadow-black/70">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{roll.label}</p>
          <p className="mt-1 text-sm font-cinzel text-amber-200/90 truncate">{req.title}</p>

          <div className="mt-4 flex items-center justify-center gap-2 text-4xl font-display text-amber-300">
            {roll.rolls.map((v, i) => (
              <Tumble
                key={i}
                target={v}
                sides={roll.die}
                duration={DMG_MS}
                delay={i * 90}
                onLand={i === roll.rolls.length - 1 ? handleAllLanded : undefined}
              />
            ))}
            {roll.bonus !== 0 && (
              <span className="text-2xl text-amber-200/70">
                {roll.bonus > 0 ? '+' : '-'} {Math.abs(roll.bonus)}
              </span>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d{roll.die}</p>

          <div className="mt-3 h-6">
            {phase === 'done' && (
              <p className="text-sm font-bold tracking-widest text-amber-300">{roll.total}</p>
            )}
          </div>

          <p className="mt-2 text-[10px] text-white/25">tap to skip</p>
        </div>
      </div>,
      document.body
    );
  }

  const d20Land = isCheck ? handleAllLanded : undefined;


  const outcomeText = isCheck
    ? roll.outcome.toUpperCase()
    : roll.d20 === 20 ? 'CRITICAL HIT' : roll.d20 === 1 ? 'CRITICAL MISS' : null;

  const outcomeClass = roll.d20 === 20 ? 'text-emerald-300'
    : roll.d20 === 1 ? 'text-red-400'
    : isCheck && (roll.outcome === 'failure') ? 'text-red-300/90'
    : isCheck && roll.outcome === 'mixed success' ? 'text-amber-300'
    : 'text-emerald-300/90';

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={finish}
      role="dialog"
      aria-label={`Dice roll for ${req.title}`}
    >
      <div className="mx-6 w-full max-w-xs rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a0e05] to-[#0a0a0f] p-5 text-center shadow-2xl shadow-black/70">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{modeLabel} dice</p>
        <p className="mt-1 text-sm font-cinzel text-amber-200/90 truncate">{req.title}</p>

        <div className="mt-4 text-6xl font-display font-bold text-white">
          <Tumble target={roll.d20} sides={20} duration={D20_MS} onLand={d20Land} />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d20</p>

        {!isCheck && (
          <div className="mt-3">
            <div className="flex items-center justify-center gap-2 text-2xl font-display text-amber-300">
              {roll.damageRolls.map((v, i) => (
                <Tumble
                  key={i}
                  target={v}
                  sides={roll.damageDie}
                  duration={DMG_MS}
                  delay={D20_MS + 150 + i * 90}
                  onLand={i === roll.damageRolls.length - 1 ? handleAllLanded : undefined}
                />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">
              damage (d{roll.damageDie}){roll.d20 === 20 ? ' — doubled' : ''}
            </p>
          </div>
        )}

        <div className="mt-3 h-6">
          {phase === 'done' && outcomeText && (
            <p className={cn('text-sm font-bold tracking-widest', outcomeClass)}>{outcomeText}</p>
          )}
          {phase === 'done' && !isCheck && roll.d20 !== 1 && (
            <p className="text-[11px] text-white/50">total damage {roll.damageTotal}</p>
          )}
        </div>

        <p className="mt-2 text-[10px] text-white/25">tap to skip</p>
      </div>
    </div>,
    document.body
  );
}
