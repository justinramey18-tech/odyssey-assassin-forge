import { motion } from 'framer-motion';
import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import geraltButton from '@/assets/geralt-button.jpg';

type HpState = 'happy' | 'angry' | 'injured';
type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

interface GeraltMeditationButtonProps {
  onClick: () => void;
  companionHpPct?: number;
}

function useBreathingConfig(companionHpPct?: number) {
  const hpState: HpState = companionHpPct !== undefined
    ? companionHpPct > 80 ? 'happy'
      : companionHpPct > 30 ? 'angry'
      : 'injured'
    : 'happy';

  const breatheDuration = hpState === 'happy' ? 10 : hpState === 'angry' ? 4 : 3;
  const breatheScale = hpState === 'happy' ? 1.12 : hpState === 'angry' ? 1.18 : 1.25;

  const isOcean = hpState === 'happy';
  const inhaleRatio = isOcean ? 0.4 : 0.45;
  const holdRatio = isOcean ? 0.1 : 0.05;
  const exhaleRatio = isOcean ? 0.4 : 0.45;

  const breatheGlow = hpState === 'happy'
    ? 'rgba(245,158,11,0.55)'
    : hpState === 'angry'
      ? 'rgba(249,115,22,0.55)'
      : 'rgba(239,68,68,0.55)';

  const borderColor = companionHpPct !== undefined
    ? companionHpPct > 80 ? 'border-amber-500/50 hover:border-amber-400/80'
      : companionHpPct > 30 ? 'border-orange-500/50 hover:border-orange-400/80'
      : 'border-red-500/50 hover:border-red-400/80'
    : 'border-amber-500/50 hover:border-amber-400/80';

  const ringColor = companionHpPct !== undefined
    ? companionHpPct > 80 ? 'ring-amber-400/20'
      : companionHpPct > 30 ? 'ring-orange-400/20'
      : 'ring-red-400/20'
    : 'ring-amber-400/20';

  const particleCount = hpState === 'happy' ? 4 : hpState === 'angry' ? 8 : 14;
  const particleSpeedMult = hpState === 'happy' ? 1 : hpState === 'angry' ? 0.7 : 0.4;

  const crackOpacity = companionHpPct !== undefined
    ? companionHpPct > 80 ? 0
      : companionHpPct > 50 ? 0.15
      : companionHpPct > 30 ? 0.35
      : companionHpPct > 15 ? 0.55
      : 0.75
    : 0;

  const times = [0, inhaleRatio, inhaleRatio + holdRatio, inhaleRatio + holdRatio + exhaleRatio, 1] as const;

  return {
    hpState, breatheDuration, breatheScale, breatheGlow,
    inhaleRatio, holdRatio, exhaleRatio, times,
    borderColor, ringColor, particleCount, particleSpeedMult, crackOpacity,
  };
}

function useBreathPhase(breatheDuration: number, inhaleRatio: number, holdRatio: number, exhaleRatio: number) {
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');

  useEffect(() => {
    const inMs = breatheDuration * inhaleRatio * 1000;
    const holdMs = breatheDuration * holdRatio * 1000;
    const outMs = breatheDuration * exhaleRatio * 1000;

    let mounted = true;
    const cycle = () => {
      if (!mounted) return;
      setBreathPhase('inhale');
      setTimeout(() => { if (mounted) setBreathPhase('hold'); }, inMs);
      setTimeout(() => { if (mounted) setBreathPhase('exhale'); }, inMs + holdMs);
      setTimeout(() => { if (mounted) setBreathPhase('rest'); }, inMs + holdMs + outMs);
    };
    cycle();
    const interval = setInterval(cycle, breatheDuration * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [breatheDuration, inhaleRatio, holdRatio, exhaleRatio]);

  return breathPhase;
}

const BREATH_LABELS: Record<BreathPhase, string> = {
  inhale: 'Inhale...',
  hold: 'Hold...',
  exhale: 'Exhale...',
  rest: '...',
};

function CrackOverlay({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 96 96"
      style={{ opacity }}
    >
      <defs>
        <filter id="crackGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {/* Primary diagonal crack */}
      <path d="M 30 0 L 33 18 L 28 32 L 35 48 L 30 62 L 38 80 L 34 96" fill="none" stroke="rgba(200,60,40,0.8)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 33 18 L 50 24 L 58 20" fill="none" stroke="rgba(200,60,40,0.6)" strokeWidth="1" strokeLinecap="round" />
      <path d="M 28 32 L 14 38 L 8 52" fill="none" stroke="rgba(200,60,40,0.5)" strokeWidth="1" strokeLinecap="round" />
      {/* Secondary crack */}
      {opacity > 0.3 && (
        <path d="M 96 25 L 78 30 L 65 45 L 60 58 L 68 75 L 62 96" fill="none" stroke="rgba(180,50,30,0.7)" strokeWidth="1.2" strokeLinecap="round" />
      )}
      {/* Tertiary web cracks */}
      {opacity > 0.5 && (
        <>
          <path d="M 35 48 L 50 52 L 65 45" fill="none" stroke="rgba(180,50,30,0.5)" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M 50 52 L 48 72 L 55 90" fill="none" stroke="rgba(160,40,20,0.5)" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M 0 60 L 15 55 L 28 60" fill="none" stroke="rgba(160,40,20,0.4)" strokeWidth="0.8" strokeLinecap="round" />
        </>
      )}
      {/* Glow along primary crack */}
      <path d="M 30 0 L 33 18 L 28 32 L 35 48 L 30 62 L 38 80 L 34 96" fill="none" stroke="rgba(255,80,40,0.3)" strokeWidth="4" strokeLinecap="round" filter="url(#crackGlow)" />
    </svg>
  );
}

export function GeraltMeditationButton({ onClick, companionHpPct }: GeraltMeditationButtonProps) {
  const config = useBreathingConfig(companionHpPct);
  const breathPhase = useBreathPhase(config.breatheDuration, config.inhaleRatio, config.holdRatio, config.exhaleRatio);

  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: Math.random() * 80 - 40,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 2,
      size: 2 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 20,
    })),
  []);

  const { breatheDuration, breatheScale, breatheGlow, times, borderColor, ringColor, particleCount, particleSpeedMult, crackOpacity, hpState } = config;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        {/* Aura halo */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 140, height: 140,
            background: `radial-gradient(circle, ${breatheGlow} 0%, transparent 70%)`,
            willChange: 'transform, opacity',
          }}
          animate={{ scale: [0.6, 1.3, 1.3, 0.6, 0.6], opacity: [0.15, 0.5, 0.5, 0.15, 0.15] }}
          transition={{ duration: breatheDuration, times: [...times], repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Background blur shift */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 130, height: 130,
            background: `radial-gradient(circle, ${breatheGlow.replace('0.55', '0.12')} 0%, transparent 60%)`,
            willChange: 'filter',
          }}
          animate={{
            filter: ['blur(8px)', 'blur(20px)', 'blur(20px)', 'blur(8px)', 'blur(8px)'],
            opacity: [0.4, 0.8, 0.8, 0.4, 0.4],
          }}
          transition={{ duration: breatheDuration, times: [...times], repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Breathwork ring */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 120, height: 120, border: `2px solid ${breatheGlow}`, willChange: 'transform, opacity' }}
          animate={{ scale: [0.85, 1.15, 1.15, 0.85, 0.85], opacity: [0.3, 0.7, 0.7, 0.3, 0.3] }}
          transition={{ duration: breatheDuration, times: [...times], repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Scaled particle field */}
        {particles.slice(0, particleCount).map(p => (
          <motion.div
            key={p.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: p.size, height: p.size, left: '50%', bottom: '10%',
              background: hpState === 'happy'
                ? 'radial-gradient(circle, rgba(245,180,60,0.8), rgba(245,158,11,0.2))'
                : hpState === 'angry'
                  ? 'radial-gradient(circle, rgba(255,140,20,0.9), rgba(249,115,22,0.2))'
                  : `radial-gradient(circle, rgba(255,${60 + Math.random() * 80},0,0.9), rgba(255,0,0,0.3))`,
            }}
            animate={{
              x: [p.x * 0.3, p.x * 0.6 + p.drift, p.x],
              y: [0, -40 - Math.random() * 30, -70 - Math.random() * 20],
              opacity: [0, hpState === 'happy' ? 0.5 : 0.9, 0],
              scale: [0.5, 1, 0.2],
            }}
            transition={{ duration: p.duration * particleSpeedMult, delay: p.delay * particleSpeedMult, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}

        {/* Main breathing button */}
        <motion.div
          className="rounded-2xl"
          style={{ willChange: 'transform, box-shadow' }}
          animate={{
            scale: [1, breatheScale, breatheScale, 1, 1],
            boxShadow: [
              `0 0 8px ${breatheGlow}`, `0 0 35px ${breatheGlow}`, `0 0 35px ${breatheGlow}`,
              `0 0 8px ${breatheGlow}`, `0 0 8px ${breatheGlow}`,
            ],
          }}
          transition={{ duration: breatheDuration, times: [...times], repeat: Infinity, ease: 'easeInOut' }}
        >
          <button
            onClick={onClick}
            className={cn(
              "w-24 h-24 rounded-2xl overflow-hidden relative",
              `border-2 ${borderColor}`,
              "transition-colors duration-300",
              `ring-2 ${ringColor} ring-offset-0`
            )}
            style={{ touchAction: 'manipulation', transform: 'perspective(500px) rotateY(-3deg) rotateX(2deg)' }}
            aria-label="Open Geralt companion"
          >
            <img src={geraltButton} alt="Geralt" className="w-full h-full object-cover" />
            <CrackOverlay opacity={crackOpacity} />
          </button>
        </motion.div>
      </div>

      {/* Breathwork text cue */}
      <motion.p
        key={breathPhase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.7, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-[0.2em] select-none"
      >
        {BREATH_LABELS[breathPhase]}
      </motion.p>
    </div>
  );
}
