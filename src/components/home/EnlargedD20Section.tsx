import { motion, useAnimationControls } from 'framer-motion';
import { useMemo, useEffect, useState } from 'react';
import { AnimatedD20Trigger } from '@/components/diceRoller';
import { PanelLeft, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import geraltButton from '@/assets/geralt-button.jpg';

interface EnlargedD20SectionProps {
  onClick: () => void;
  onMenusClick?: () => void;
  onMapClick?: () => void;
  onCompanionClick?: () => void;
  companionHpPct?: number;
}

export function EnlargedD20Section({ onClick, onMenusClick, onMapClick, onCompanionClick, companionHpPct }: EnlargedD20SectionProps) {
  // Determine breathing animation class based on companion HP
  const isInjured = companionHpPct !== undefined && companionHpPct <= 30;

  const hpState = companionHpPct !== undefined
    ? companionHpPct > 80 ? 'happy'
      : companionHpPct > 30 ? 'angry'
      : 'injured'
    : 'happy';

  const breatheDuration = hpState === 'happy' ? 10 : hpState === 'angry' ? 4 : 3;
  const breatheScale = hpState === 'happy' ? 1.12 : hpState === 'angry' ? 1.18 : 1.25;

  // Ocean breathing: inhale (40%), hold at peak (10%), exhale (40%), rest (10%)
  // For action breathing (angry/injured): shorter hold, more direct
  const isOcean = hpState === 'happy';
  const inhaleRatio = isOcean ? 0.4 : 0.45;
  const holdRatio = isOcean ? 0.1 : 0.05;
  const exhaleRatio = isOcean ? 0.4 : 0.45;
  // rest fills remainder

  // Breathwork text cycling
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale' | 'rest'>('inhale');

  useEffect(() => {
    const inMs = breatheDuration * inhaleRatio * 1000;
    const holdMs = breatheDuration * holdRatio * 1000;
    const outMs = breatheDuration * exhaleRatio * 1000;
    const restMs = breatheDuration * (1 - inhaleRatio - holdRatio - exhaleRatio) * 1000;

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
  const breatheGlow = hpState === 'happy'
    ? 'rgba(245,158,11,0.55)'
    : hpState === 'angry'
      ? 'rgba(249,115,22,0.55)'
      : 'rgba(239,68,68,0.55)';

  // Border/ring color shifts with HP state
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

  // Particle field scales with HP — more particles + faster when damaged
  const particleCount = hpState === 'happy' ? 4 : hpState === 'angry' ? 8 : 14;
  const particleSpeedMult = hpState === 'happy' ? 1 : hpState === 'angry' ? 0.7 : 0.4;

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

  // Crack overlay intensity based on HP
  const crackOpacity = companionHpPct !== undefined
    ? companionHpPct > 80 ? 0
      : companionHpPct > 50 ? 0.15
      : companionHpPct > 30 ? 0.35
      : companionHpPct > 15 ? 0.55
      : 0.75
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: 0.5, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="flex items-center justify-center gap-6 py-4"
    >
      {/* Left slot: Static D20 Dice Roller (or Map fallback) */}
      {onCompanionClick ? (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="relative w-16 h-16">
            <div className="relative w-full h-full flex items-center justify-center transform scale-[1.6] pointer-events-none">
              <div className="pointer-events-auto">
                <AnimatedD20Trigger onClick={onClick} />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-widest">
            Roll
          </p>
        </motion.div>
      ) : onMapClick && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <button
            onClick={onMapClick}
            className={cn(
              "w-16 h-16 rounded-xl",
              "border-2 border-emerald-500/40 hover:border-emerald-400/60",
              "bg-black/40 backdrop-blur-sm hover:bg-black/50",
              "flex items-center justify-center",
              "transition-all duration-300",
              "hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            )}
            style={{ touchAction: 'manipulation' }}
            aria-label="Open battle map"
          >
            <MapIcon className="w-6 h-6 text-emerald-400" />
          </button>
          <p className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-widest">
            Map
          </p>
        </motion.div>
      )}

      {/* Center slot: Geralt Companion Button (or D20 fallback) */}
      {onCompanionClick ? (
        <div className="flex flex-col items-center gap-1">
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            {/* Aura halo — radial gradient that breathes behind everything */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 140,
                height: 140,
                background: `radial-gradient(circle, ${breatheGlow} 0%, transparent 70%)`,
                willChange: 'transform, opacity',
              }}
              animate={{
                scale: [0.6, 1.3, 1.3, 0.6, 0.6],
                opacity: [0.15, 0.5, 0.5, 0.15, 0.15],
              }}
              transition={{
                duration: breatheDuration,
                times: [0, inhaleRatio, inhaleRatio + holdRatio, inhaleRatio + holdRatio + exhaleRatio, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Background blur shift — area pulses between sharp and blurred */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 130,
                height: 130,
                background: `radial-gradient(circle, ${breatheGlow.replace('0.55', '0.12')} 0%, transparent 60%)`,
                willChange: 'filter',
              }}
              animate={{
                filter: [
                  'blur(8px)',
                  'blur(20px)',
                  'blur(20px)',
                  'blur(8px)',
                  'blur(8px)',
                ],
                opacity: [0.4, 0.8, 0.8, 0.4, 0.4],
              }}
              transition={{
                duration: breatheDuration,
                times: [0, inhaleRatio, inhaleRatio + holdRatio, inhaleRatio + holdRatio + exhaleRatio, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Breathwork ring — expands/contracts in sync */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 120,
                height: 120,
                border: `2px solid ${breatheGlow}`,
                willChange: 'transform, opacity',
              }}
              animate={{
                scale: [0.85, 1.15, 1.15, 0.85, 0.85],
                opacity: [0.3, 0.7, 0.7, 0.3, 0.3],
              }}
              transition={{
                duration: breatheDuration,
                times: [0, inhaleRatio, inhaleRatio + holdRatio, inhaleRatio + holdRatio + exhaleRatio, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Scaled particle field — density and speed shift with HP */}
            {particles.slice(0, particleCount).map(p => (
              <motion.div
                key={p.id}
                className="absolute pointer-events-none rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  left: '50%',
                  bottom: '10%',
                  background: hpState === 'happy'
                    ? `radial-gradient(circle, rgba(245,180,60,0.8), rgba(245,158,11,0.2))`
                    : hpState === 'angry'
                      ? `radial-gradient(circle, rgba(255,140,20,0.9), rgba(249,115,22,0.2))`
                      : `radial-gradient(circle, rgba(255,${60 + Math.random() * 80},0,0.9), rgba(255,0,0,0.3))`,
                }}
                animate={{
                  x: [p.x * 0.3, p.x * 0.6 + p.drift, p.x],
                  y: [0, -40 - Math.random() * 30, -70 - Math.random() * 20],
                  opacity: [0, hpState === 'happy' ? 0.5 : 0.9, 0],
                  scale: [0.5, 1, 0.2],
                }}
                transition={{
                  duration: p.duration * particleSpeedMult,
                  delay: p.delay * particleSpeedMult,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* Main breathing button */}
            <motion.div
              className="rounded-2xl"
              style={{ willChange: 'transform, box-shadow' }}
              animate={{
                scale: [1, breatheScale, breatheScale, 1, 1],
                boxShadow: [
                  `0 0 8px ${breatheGlow}`,
                  `0 0 35px ${breatheGlow}`,
                  `0 0 35px ${breatheGlow}`,
                  `0 0 8px ${breatheGlow}`,
                  `0 0 8px ${breatheGlow}`,
                ],
              }}
              transition={{
                duration: breatheDuration,
                times: [0, inhaleRatio, inhaleRatio + holdRatio, inhaleRatio + holdRatio + exhaleRatio, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <button
                onClick={onCompanionClick}
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
                
                {/* Cracking overlay — intensifies as HP drops */}
                {crackOpacity > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 96 96"
                    style={{ opacity: crackOpacity }}
                  >
                    {/* Primary diagonal crack */}
                    <path
                      d="M 30 0 L 33 18 L 28 32 L 35 48 L 30 62 L 38 80 L 34 96"
                      fill="none"
                      stroke="rgba(200,60,40,0.8)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Branch crack right */}
                    <path
                      d="M 33 18 L 50 24 L 58 20"
                      fill="none"
                      stroke="rgba(200,60,40,0.6)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                    {/* Branch crack left */}
                    <path
                      d="M 28 32 L 14 38 L 8 52"
                      fill="none"
                      stroke="rgba(200,60,40,0.5)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                    {/* Secondary crack from right */}
                    {crackOpacity > 0.3 && (
                      <path
                        d="M 96 25 L 78 30 L 65 45 L 60 58 L 68 75 L 62 96"
                        fill="none"
                        stroke="rgba(180,50,30,0.7)"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    )}
                    {/* Tertiary web cracks at low HP */}
                    {crackOpacity > 0.5 && (
                      <>
                        <path
                          d="M 35 48 L 50 52 L 65 45"
                          fill="none"
                          stroke="rgba(180,50,30,0.5)"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 50 52 L 48 72 L 55 90"
                          fill="none"
                          stroke="rgba(160,40,20,0.5)"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 0 60 L 15 55 L 28 60"
                          fill="none"
                          stroke="rgba(160,40,20,0.4)"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                        />
                      </>
                    )}
                    {/* Glow along cracks */}
                    <path
                      d="M 30 0 L 33 18 L 28 32 L 35 48 L 30 62 L 38 80 L 34 96"
                      fill="none"
                      stroke="rgba(255,80,40,0.3)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      filter="url(#crackGlow)"
                    />
                    <defs>
                      <filter id="crackGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" />
                      </filter>
                    </defs>
                  </svg>
                )}
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
            {breathPhase === 'inhale' ? 'Inhale...' : breathPhase === 'hold' ? 'Hold...' : breathPhase === 'exhale' ? 'Exhale...' : '...'}
          </motion.p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-24 h-24">
            <div 
              className={cn(
                "absolute inset-0 rounded-full pointer-events-none",
                "bg-gradient-to-r from-cyan-500/20 to-primary/20",
                "blur-xl animate-pulse"
              )} 
            />
            <div className="relative w-full h-full flex items-center justify-center transform scale-[2.4] pointer-events-none">
              <div className="pointer-events-auto">
                <AnimatedD20Trigger onClick={onClick} />
              </div>
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs text-muted-foreground font-cinzel uppercase tracking-widest"
          >
            Tap to Roll
          </motion.p>
        </div>
      )}

      {/* Quick Menus Drawer Button */}
      {onMenusClick && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <button
            onClick={onMenusClick}
            className={cn(
              "w-16 h-16 rounded-xl",
              "border-2 border-cyan-500/40 hover:border-cyan-400/60",
              "bg-black/40 backdrop-blur-sm hover:bg-black/50",
              "flex items-center justify-center",
              "transition-all duration-300",
              "hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            )}
            style={{ touchAction: 'manipulation' }}
            aria-label="Open quick-access menus"
          >
            <PanelLeft className="w-6 h-6 text-cyan-400" />
          </button>
          <p className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-widest">
            Menus
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
