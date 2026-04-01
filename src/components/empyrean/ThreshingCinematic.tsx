import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ThreshingCinematicProps {
  open: boolean;
  riderName: string;
  onConfigureDragon: () => void;
}

const DRAGON_COLOR = '#b8926a';
const TEXT_COLOR = '#e8e0d4';

function GoldParticles({ count = 16 }: { count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 6 + Math.random() * 6,
      size: 2 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.25,
    })), [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: DRAGON_COLOR,
            boxShadow: `0 0 ${p.size * 2}px ${DRAGON_COLOR}`,
            opacity: 0,
            animation: `threshing-ember-rise ${p.duration}s ${p.delay}s ease-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function LineReveal({
  lines,
  onComplete,
  onSkip,
}: {
  lines: string[];
  onComplete: () => void;
  onSkip?: () => void;
}) {
  const [currentLine, setCurrentLine] = useState(0);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    if (currentLine >= lines.length) {
      onComplete();
      return;
    }
    if (phase === 'in') {
      const t = setTimeout(() => setPhase('hold'), 800);
      return () => clearTimeout(t);
    }
    if (phase === 'hold') {
      const t = setTimeout(() => setPhase('out'), 1600);
      return () => clearTimeout(t);
    }
    if (phase === 'out') {
      const t = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
        setPhase('in');
      }, 900);
      return () => clearTimeout(t);
    }
  }, [currentLine, phase, lines.length, onComplete]);

  const handleSkip = useCallback(() => {
    if (currentLine < lines.length - 1) {
      setCurrentLine(prev => prev + 1);
      setPhase('in');
    } else {
      onComplete();
    }
  }, [currentLine, lines.length, onComplete]);

  if (currentLine >= lines.length) return null;

  return (
    <div className="flex flex-col items-center justify-center h-full relative px-8">
      <AnimatePresence mode="wait">
        <motion.p
          key={currentLine}
          initial={{ opacity: 0, y: 8 }}
          animate={phase === 'out' ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={{ duration: phase === 'out' ? 0.6 : 0.8 }}
          className="text-center text-lg italic leading-relaxed"
          style={{ color: TEXT_COLOR }}
        >
          {lines[currentLine]}
        </motion.p>
      </AnimatePresence>
      <button
        onClick={handleSkip}
        className="absolute bottom-12 right-6 text-xs tracking-wider uppercase opacity-30 hover:opacity-60 transition-opacity"
        style={{ color: TEXT_COLOR }}
      >
        Next ›
      </button>
    </div>
  );
}

export function ThreshingCinematic({ open, riderName, onConfigureDragon }: ThreshingCinematicProps) {
  const [phase, setPhase] = useState(0);
  const [approachWordIndex, setApproachWordIndex] = useState(-1);
  const [approachFading, setApproachFading] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [nameVisible, setNameVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [edgeGlowIntensity, setEdgeGlowIntensity] = useState(0);
  const [floodGlowIntensity, setFloodGlowIntensity] = useState(0);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase(0);
      setApproachWordIndex(-1);
      setApproachFading(false);
      setFlashActive(false);
      setNameVisible(false);
      setSubtitleVisible(false);
      setEdgeGlowIntensity(0);
      setFloodGlowIntensity(0);
    }
  }, [open]);

  // Phase 0 → 1 (Darkness → Approach): 2.5s
  useEffect(() => {
    if (!open || phase !== 0) return;
    const t = setTimeout(() => setPhase(1), 2500);
    return () => clearTimeout(t);
  }, [open, phase]);

  // Phase 1: Word-by-word reveal of "Something stirs in the silence"
  const approachWords = useMemo(() => ['Something', 'stirs', 'in', 'the', 'silence'], []);

  useEffect(() => {
    if (!open || phase !== 1) return;
    let idx = 0;
    const showNext = () => {
      setApproachWordIndex(idx);
      idx++;
      if (idx < approachWords.length) {
        setTimeout(showNext, idx === 1 ? 400 : 300);
      } else {
        // Hold 2s then fade out
        setTimeout(() => setApproachFading(true), 2000);
        setTimeout(() => setPhase(2), 2800);
      }
    };
    setTimeout(showNext, 400);
  }, [open, phase, approachWords]);

  // Phase 2: The Choosing — edge glow ramps up
  const choosingCallback = useCallback(() => setPhase(3), []);
  useEffect(() => {
    if (phase !== 2) return;
    setEdgeGlowIntensity(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setEdgeGlowIntensity(Math.min(step / 10, 1));
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 3: Bond flash → name reveal
  useEffect(() => {
    if (!open || phase !== 3) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 400);
    setTimeout(() => setNameVisible(true), 600);
    setTimeout(() => setSubtitleVisible(true), 1000);
    setTimeout(() => setPhase(4), 3500);
  }, [open, phase]);

  // Phase 4: The Flood — background glow ramps
  const floodCallback = useCallback(() => setPhase(5), []);
  useEffect(() => {
    if (phase !== 4) return;
    setFloodGlowIntensity(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setFloodGlowIntensity(Math.min(step / 8, 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        zIndex: 9999,
        backgroundColor: '#0a0908',
        fontFamily: "'Crimson Text', 'Georgia', serif",
      }}
    >
      {/* Edge glow (phases 2-3) */}
      {(phase === 2 || phase === 3) && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 60px 20px rgba(184,146,106,${0.05 + edgeGlowIntensity * 0.25})`,
            transition: 'box-shadow 0.8s ease-out',
            zIndex: 2,
          }}
        />
      )}

      {/* Flood radial glow (phases 4-5) */}
      {phase >= 4 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, rgba(184,146,106,${floodGlowIntensity * 0.15}) 0%, rgba(184,146,106,0) 70%)`,
            transition: 'background 1s ease-out',
            zIndex: 0,
          }}
        />
      )}

      {/* Flash overlay */}
      {flashActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ backgroundColor: DRAGON_COLOR, zIndex: 5 }}
        />
      )}

      {/* Particles (phases 4-5) */}
      {phase >= 4 && <GoldParticles count={16} />}

      {/* Phase 0: Pulsing dot */}
      {phase === 0 && (
        <div className="flex items-center justify-center h-full">
          <div
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              backgroundColor: DRAGON_COLOR,
              boxShadow: `0 0 12px 4px rgba(184,146,106,0.5)`,
              animation: 'threshing-dot-pulse 1.2s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Phase 1: "Something stirs in the silence" */}
      {phase === 1 && (
        <motion.div
          className="flex items-center justify-center h-full px-8"
          animate={approachFading ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-lg italic text-center" style={{ color: TEXT_COLOR }}>
            {approachWords.map((word, i) => (
              <span
                key={i}
                className="inline-block mr-[0.35em]"
                style={{
                  opacity: i <= approachWordIndex ? 1 : 0,
                  transform: i <= approachWordIndex ? 'translateX(0)' : 'translateX(-8px)',
                  transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
                  ...(word === 'silence'
                    ? {
                        color: DRAGON_COLOR,
                        fontSize: '1.2em',
                        textShadow: `0 0 16px rgba(184,146,106,0.4)`,
                      }
                    : {}),
                }}
              >
                {word}
              </span>
            ))}
          </p>
        </motion.div>
      )}

      {/* Phase 2: The Choosing */}
      {phase === 2 && (
        <LineReveal
          lines={[
            'A presence presses against the edge of your mind.',
            'Not asking. Deciding.',
            'It has already chosen.',
          ]}
          onComplete={choosingCallback}
        />
      )}

      {/* Phase 3: The Name */}
      {phase === 3 && (
        <div className="flex flex-col items-center justify-center h-full gap-4 relative z-[3]">
          {nameVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-3"
            >
              <span
                className="font-bold"
                style={{
                  fontSize: 42,
                  color: DRAGON_COLOR,
                  textShadow: `0 0 30px rgba(184,146,106,0.5), 0 0 60px rgba(184,146,106,0.2)`,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: '0.1em',
                }}
              >
                ???
              </span>
              <div
                className="h-[1px] w-24"
                style={{
                  background: `linear-gradient(to right, transparent, ${DRAGON_COLOR}, transparent)`,
                }}
              />
            </motion.div>
          )}
          {subtitleVisible && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-sm italic text-muted-foreground"
            >
              has chosen you
            </motion.p>
          )}
        </div>
      )}

      {/* Phase 4: The Flood */}
      {phase === 4 && (
        <LineReveal
          lines={[
            'The silence shatters.',
            'A voice fills every corner of your mind.',
            'You are no longer alone.',
          ]}
          onComplete={floodCallback}
        />
      )}

      {/* Phase 5: Configure */}
      {phase === 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center justify-center h-full gap-6 px-8 relative z-[3]"
        >
          {/* Dragon icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              border: `2px solid ${DRAGON_COLOR}`,
              boxShadow: `0 0 20px rgba(184,146,106,0.3), inset 0 0 20px rgba(184,146,106,0.1)`,
            }}
          >
            <span className="text-3xl">🐉</span>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm italic text-muted-foreground">A bond forms between</p>
            <p className="text-lg font-bold text-white">{riderName}</p>
            <p className="text-sm italic text-muted-foreground">and</p>
            <p
              className="text-lg font-bold"
              style={{
                color: DRAGON_COLOR,
                textShadow: `0 0 20px rgba(184,146,106,0.4)`,
                fontFamily: "'Cinzel', serif",
              }}
            >
              ???
            </p>
          </div>

          <div
            className="h-[1px] w-32"
            style={{
              background: `linear-gradient(to right, transparent, ${DRAGON_COLOR}, transparent)`,
            }}
          />

          <button
            onClick={onConfigureDragon}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{
              backgroundColor: `rgba(184,146,106,0.08)`,
              border: `1px solid rgba(184,146,106,0.3)`,
              color: DRAGON_COLOR,
              fontFamily: "'Cinzel', serif",
            }}
          >
            Configure your dragon
          </button>

          <p className="text-[10px] text-muted-foreground/50 text-center">
            Bond chat, signet, and burnout are now available
          </p>
        </motion.div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes threshing-dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes threshing-ember-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) translateX(15px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default ThreshingCinematic;
