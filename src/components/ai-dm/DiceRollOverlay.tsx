import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { playDiceRattle } from '@/lib/diceSounds';
import { DICE_ODDS_CONFIGS } from '@/lib/diceOdds';
import { subscribeDiceRolls, DiceRollRequest } from '@/lib/diceRollBus';
import diceTrayAsset from '@/assets/rolls/dice-tray.png.asset.json';
import d20Asset from '@/assets/rolls/d20.png.asset.json';
import crit20Asset from '@/assets/rolls/crit-20.jpg.asset.json';
import crit1Asset from '@/assets/rolls/crit-1.jpg.asset.json';
import ringDamageAsset from '@/assets/rolls/ring-damage.png.asset.json';
import ringHealAsset from '@/assets/rolls/ring-heal.png.asset.json';
import ringEffectAsset from '@/assets/rolls/ring-effect.png.asset.json';

const diceTray = diceTrayAsset.url;
const d20 = d20Asset.url;
const crit20 = crit20Asset.url;
const crit1 = crit1Asset.url;
const ringDamage = ringDamageAsset.url;
const ringHeal = ringHealAsset.url;
const ringEffect = ringEffectAsset.url;

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

/** Wooden dice tray that frames every roll result. */
function Tray({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[78%] max-w-[300px] aspect-[640/904]">
      <img
        src={diceTray}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 w-full h-full select-none"
      />
      <div
        className="absolute flex flex-col items-center text-center"
        style={{ left: '13%', right: '13%', top: '9%', bottom: '11%' }}
      >
        {children}
        <p className="mt-auto text-[10px] text-white/35">tap to skip</p>
      </div>
    </div>
  );
}

const D20_MS = 900;
const DMG_MS = 700;
const LINGER_MS = 1100;

export function DiceRollOverlay() {
  const [req, setReq] = useState<DiceRollRequest | null>(null);
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling');
  const lingerTimer = useRef<number>(0);
  const reduceMotion = useReducedMotion();

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
        <Tray>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/45">healing</p>
          <p className="text-sm font-cinzel text-amber-200 truncate max-w-full">{req.title}</p>

          <div className="relative w-[58%] mt-4">
            <img src={ringHeal} alt="" aria-hidden="true" draggable={false} className="block w-full select-none" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-3xl font-cinzel text-emerald-200">
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
                <span className="text-xl text-emerald-200/70">
                  {roll.bonus > 0 ? '+' : '-'} {Math.abs(roll.bonus)}
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d{roll.die}</p>

          <div className="mt-3 h-6">
            {phase === 'done' && (
              <p className="text-sm font-bold tracking-widest text-emerald-300">+{roll.total} HP</p>
            )}
          </div>
        </Tray>
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
        <Tray>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/45">{roll.label}</p>
          <p className="text-sm font-cinzel text-amber-200 truncate max-w-full">{req.title}</p>

          <div className="relative w-[58%] mt-4">
            <img src={ringEffect} alt="" aria-hidden="true" draggable={false} className="block w-full select-none" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-3xl font-cinzel text-amber-200">
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
                <span className="text-xl text-amber-200/70">
                  {roll.bonus > 0 ? '+' : '-'} {Math.abs(roll.bonus)}
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d{roll.die}</p>

          <div className="mt-3 h-6">
            {phase === 'done' && (
              <p className="text-sm font-bold tracking-widest text-amber-300">{roll.total}</p>
            )}
          </div>
        </Tray>
      </div>,
      document.body
    );
  }

  if (roll.kind === 'test') {
    const isD20 = roll.die === 20;
    const keptIndex = roll.rolls.indexOf(roll.kept);
    const dropped = roll.rolls.filter((_, i) => i !== keptIndex);
    const nat20 = isD20 && roll.kept === 20;
    const nat1 = isD20 && roll.kept === 1;
    const testLanded = phase === 'done';
    const modText = roll.modifier === 0 ? '' : ` ${roll.modifier > 0 ? '+' : '-'} ${Math.abs(roll.modifier)}`;
    const rollModeText = roll.rollMode === 'advantage'
      ? 'advantage · 2d20 keep higher'
      : roll.rollMode === 'disadvantage'
        ? 'disadvantage · 2d20 keep lower'
        : `${modeLabel} dice`;

    return createPortal(
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={finish}
        role="dialog"
        aria-label={`Dice roll for ${req.title}`}
      >
        <Tray>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/45">{isD20 ? rollModeText : 'quick roll'}</p>
          <p className="text-sm font-cinzel text-amber-200 truncate max-w-full">{req.title}</p>

          {isD20 ? (
            <div className="relative w-[62%] mt-3">
              {testLanded && (nat20 || nat1) && (
                <motion.img
                  src={nat20 ? crit20 : crit1}
                  alt=""
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 0.75, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="pointer-events-none absolute -inset-[30%] w-[160%] max-w-none mix-blend-screen"
                />
              )}
              <motion.div
                className="relative z-10"
                initial={reduceMotion ? { opacity: 0 } : { rotate: 0, x: 0, y: 0, filter: 'blur(1.5px)' }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : testLanded
                      ? { rotate: 720, x: 0, y: 0, filter: 'blur(0px)', scale: [1.12, 1] }
                      : {
                          rotate: [0, 220, 430, 600, 700, 720],
                          x: [0, -14, 10, -6, 3, 0],
                          y: [0, -10, 4, -4, 1, 0],
                          filter: ['blur(1.5px)', 'blur(0px)'],
                        }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.3 }
                    : testLanded
                      ? { duration: 0.25, ease: 'easeOut' }
                      : { duration: D20_MS / 1000, ease: 'easeOut' }
                }
              >
                <img src={d20} alt="" draggable={false} className="block w-full select-none" />
                <div className="absolute" style={{ left: '50%', top: '52%', transform: 'translate(-50%, -50%)' }}>
                  <Tumble
                    target={roll.kept}
                    sides={20}
                    duration={D20_MS}
                    onLand={handleAllLanded}
                    className="text-5xl font-cinzel font-bold text-white [text-shadow:0_0_10px_rgba(251,191,36,0.8),0_2px_3px_#000]"
                  />
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="relative w-[58%] mt-4">
              <img src={ringEffect} alt="" aria-hidden="true" draggable={false} className="block w-full select-none" />
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-cinzel text-amber-200">
                <Tumble target={roll.kept} sides={roll.die} duration={DMG_MS} onLand={handleAllLanded} />
              </div>
            </div>
          )}
          <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d{roll.die}</p>

          <div className="mt-3 min-h-6 flex flex-col items-center">
            {testLanded && dropped.length > 0 && (
              <p className="text-[11px] text-white/45">
                other die <span className="line-through">{dropped.join(', ')}</span>
              </p>
            )}
            {testLanded && (
              <p className={cn(
                'text-sm font-bold tracking-widest',
                nat20 ? 'text-emerald-300' : nat1 ? 'text-red-400' : 'text-amber-300',
              )}>
                {roll.modifier !== 0 ? `${roll.kept}${modText} = ${roll.total}` : `${roll.total}`}
                {nat20 ? ' · NATURAL 20' : nat1 ? ' · NATURAL 1' : ''}
              </p>
            )}
          </div>
        </Tray>
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

  const isCrit = roll.d20 === 20 || roll.d20 === 1;
  const landed = phase === 'done';

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={finish}
      role="dialog"
      aria-label={`Dice roll for ${req.title}`}
    >
      <Tray>
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/45">{modeLabel} dice</p>
        <p className="text-sm font-cinzel text-amber-200 truncate max-w-full">{req.title}</p>

        <div className="relative w-[62%] mt-3">
          {landed && isCrit && (
            <motion.img
              src={roll.d20 === 20 ? crit20 : crit1}
              alt=""
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.75, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute -inset-[30%] w-[160%] max-w-none mix-blend-screen"
            />
          )}
          <motion.div
            className="relative z-10"
            initial={reduceMotion ? { opacity: 0 } : { rotate: 0, x: 0, y: 0, filter: 'blur(1.5px)' }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : landed
                  ? { rotate: 720, x: 0, y: 0, filter: 'blur(0px)', scale: [1.12, 1] }
                  : {
                      rotate: [0, 220, 430, 600, 700, 720],
                      x: [0, -14, 10, -6, 3, 0],
                      y: [0, -10, 4, -4, 1, 0],
                      filter: ['blur(1.5px)', 'blur(0px)'],
                    }
            }
            transition={
              reduceMotion
                ? { duration: 0.3 }
                : landed
                  ? { duration: 0.25, ease: 'easeOut' }
                  : { duration: D20_MS / 1000, ease: 'easeOut' }
            }
          >
            <img src={d20} alt="" draggable={false} className="block w-full select-none" />
            <div className="absolute" style={{ left: '50%', top: '52%', transform: 'translate(-50%, -50%)' }}>
              <Tumble
                target={roll.d20}
                sides={20}
                duration={D20_MS}
                onLand={d20Land}
                className="text-5xl font-cinzel font-bold text-white [text-shadow:0_0_10px_rgba(251,191,36,0.8),0_2px_3px_#000]"
              />
            </div>
          </motion.div>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-white/35 mt-1">d20</p>

        {!isCheck && (
          <div className="mt-3 flex flex-col items-center">
            <div className="relative w-[36%] mt-2">
              <img src={ringDamage} alt="" aria-hidden="true" draggable={false} className="block w-full select-none" />
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center gap-1 font-cinzel text-red-200',
                  roll.damageRolls.length > 2 ? 'text-base' : 'text-xl',
                )}
              >
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
      </Tray>
    </div>,
    document.body
  );
}
