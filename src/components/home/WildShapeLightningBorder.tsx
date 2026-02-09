import { motion } from 'framer-motion';
import { useMemo } from 'react';

type Edge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Maps a CR value (0–30) to a 0–1 intensity scale.
 * CR 0 = 0.15 (barely visible), CR 6 = ~0.5, CR 12+ = ~0.85, CR 20+ = 1.0
 */
function crToIntensity(cr: number): number {
  if (cr <= 0) return 0.15;
  if (cr >= 20) return 1.0;
  // Logarithmic curve for natural scaling
  return Math.min(1, 0.15 + 0.85 * (Math.log(cr + 1) / Math.log(21)));
}

interface CRProps {
  cr: number;
}

/**
 * Green energy vignette pulse that scales with CR.
 * Low CR = faint, slow pulse. High CR = intense, fast pulse.
 */
export function CRScaledPulse({ cr }: CRProps) {
  const intensity = crToIntensity(cr);

  // Scale spread and opacity with intensity
  const peakSpread = Math.round(60 + intensity * 80); // 60–140px
  const peakBlur = Math.round(10 + intensity * 35);   // 10–45px
  const peakOpacity = (0.08 + intensity * 0.22).toFixed(2); // 0.08–0.30
  // Duration: slower at low CR (7s), faster at high CR (3s)
  const duration = 7 - intensity * 4;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      animate={{
        boxShadow: [
          `inset 0 0 ${peakSpread * 0.7}px ${peakBlur * 0.4}px rgba(34,197,94,0.0)`,
          `inset 0 0 ${peakSpread}px ${peakBlur}px rgba(34,197,94,${peakOpacity})`,
          `inset 0 0 ${peakSpread * 0.7}px ${peakBlur * 0.4}px rgba(34,197,94,0.0)`,
        ],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * DBZ-style crackling lightning energy borders on all 4 edges.
 * Gold-green color mix. Intensity and bolt count scale with CR.
 */
export function WildShapeLightningBorder({ cr }: CRProps) {
  const intensity = crToIntensity(cr);

  // At low CR, show fewer bolts; at high CR, show all
  const verticalBolts = useMemo(() => {
    const all = [
      { delay: 0, side: 'left' as Edge, path: 'M0,0 Q8,12 2,25 Q10,40 0,55 Q7,70 3,85 Q9,95 0,100' },
      { delay: 0.7, side: 'left' as Edge, path: 'M0,5 Q6,18 1,30 Q9,45 3,60 Q8,78 0,90' },
      { delay: 2.1, side: 'left' as Edge, path: 'M0,15 Q7,28 1,42 Q8,55 2,68 Q6,82 0,95' },
      { delay: 1.4, side: 'right' as Edge, path: 'M10,0 Q2,15 8,28 Q0,42 7,58 Q1,72 10,88 Q3,96 10,100' },
      { delay: 0.3, side: 'right' as Edge, path: 'M10,8 Q4,20 9,35 Q1,50 6,65 Q2,80 10,95' },
      { delay: 1.8, side: 'right' as Edge, path: 'M10,10 Q3,22 8,38 Q2,52 9,70 Q4,85 10,100' },
    ];
    const count = Math.max(2, Math.round(all.length * intensity));
    return all.slice(0, count);
  }, [intensity]);

  const horizontalBolts = useMemo(() => {
    const all = [
      { delay: 0.4, side: 'top' as Edge, path: 'M0,0 Q12,8 25,2 Q40,10 55,0 Q70,7 85,3 Q95,9 100,0' },
      { delay: 1.1, side: 'top' as Edge, path: 'M5,0 Q18,6 30,1 Q45,9 60,3 Q78,8 90,0' },
      { delay: 1.6, side: 'bottom' as Edge, path: 'M0,10 Q15,2 28,8 Q42,0 58,7 Q72,1 88,10 Q96,3 100,10' },
      { delay: 0.9, side: 'bottom' as Edge, path: 'M5,10 Q18,4 32,9 Q48,1 62,6 Q78,2 93,10' },
    ];
    // Only show horizontal bolts above ~40% intensity (CR ~3+)
    if (intensity < 0.35) return [];
    const count = Math.max(1, Math.round(all.length * intensity));
    return all.slice(0, count);
  }, [intensity]);

  // Scale glow opacity with intensity
  const glowOpacity = (0.05 + intensity * 0.15).toFixed(2);

  return (
    <>
      {/* Left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'left').map((bolt, i) => (
          <LightningBolt key={`l-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" intensity={intensity} />
        ))}
        <EdgeGlow direction="left" opacity={glowOpacity} />
      </div>

      {/* Right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'right').map((bolt, i) => (
          <LightningBolt key={`r-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" intensity={intensity} />
        ))}
        <EdgeGlow direction="right" opacity={glowOpacity} />
      </div>

      {/* Top edge — only at higher CR */}
      {horizontalBolts.some(b => b.side === 'top') && (
        <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
          {horizontalBolts.filter(b => b.side === 'top').map((bolt, i) => (
            <LightningBolt key={`t-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" intensity={intensity} />
          ))}
          <EdgeGlow direction="top" opacity={glowOpacity} />
        </div>
      )}

      {/* Bottom edge — only at higher CR */}
      {horizontalBolts.some(b => b.side === 'bottom') && (
        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
          {horizontalBolts.filter(b => b.side === 'bottom').map((bolt, i) => (
            <LightningBolt key={`b-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" intensity={intensity} />
          ))}
          <EdgeGlow direction="bottom" opacity={glowOpacity} />
        </div>
      )}
    </>
  );
}

function EdgeGlow({ direction, opacity }: { direction: 'left' | 'right' | 'top' | 'bottom'; opacity: string }) {
  const glowMap: Record<string, string[]> = {
    left: [
      `inset -15px 0 25px -10px rgba(34,197,94,0.0)`,
      `inset -15px 0 25px -10px rgba(34,197,94,${opacity})`,
      `inset -15px 0 25px -10px rgba(34,197,94,0.0)`,
    ],
    right: [
      `inset 15px 0 25px -10px rgba(34,197,94,0.0)`,
      `inset 15px 0 25px -10px rgba(34,197,94,${opacity})`,
      `inset 15px 0 25px -10px rgba(34,197,94,0.0)`,
    ],
    top: [
      `inset 0 -15px 25px -10px rgba(34,197,94,0.0)`,
      `inset 0 -15px 25px -10px rgba(34,197,94,${opacity})`,
      `inset 0 -15px 25px -10px rgba(34,197,94,0.0)`,
    ],
    bottom: [
      `inset 0 15px 25px -10px rgba(34,197,94,0.0)`,
      `inset 0 15px 25px -10px rgba(34,197,94,${opacity})`,
      `inset 0 15px 25px -10px rgba(34,197,94,0.0)`,
    ],
  };
  const delayMap: Record<string, number> = { left: 0.5, right: 1.2, top: 0.8, bottom: 1.5 };

  return (
    <motion.div
      className="absolute inset-0"
      animate={{ boxShadow: glowMap[direction] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: delayMap[direction] }}
    />
  );
}

function LightningBolt({ path, delay, orientation, intensity }: { path: string; delay: number; orientation: 'vertical' | 'horizontal'; intensity: number }) {
  const isHorizontal = orientation === 'horizontal';
  const viewBox = isHorizontal ? '0 0 100 10' : '0 0 10 100';

  // Scale opacity peaks and pause duration with intensity
  const peakOpacity = 0.4 + intensity * 0.6; // 0.4–1.0
  const repeatDelay = 2.5 - intensity * 1.8; // 2.5s pause at low CR, 0.7s at high CR

  return (
    <motion.svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="absolute top-0 left-0 w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, peakOpacity * 0.9, peakOpacity, peakOpacity * 0.8, 0, 0, 0] }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        repeatDelay: Math.max(0.3, repeatDelay + delay * 0.5),
        delay,
        ease: 'easeInOut',
        times: [0, 0.05, 0.1, 0.15, 0.25, 0.6, 1],
      }}
    >
      <motion.path
        d={path}
        fill="none"
        stroke="url(#lightning-gradient)"
        strokeWidth="0.8"
        strokeLinecap="round"
        animate={{
          strokeWidth: [0.3 + intensity * 0.2, 0.6 + intensity * 0.8, 0.4 + intensity * 0.3, 0.5 + intensity * 0.6, 0.3 + intensity * 0.2],
          filter: [
            `drop-shadow(0 0 ${1 + intensity * 2}px rgba(34,197,94,${(0.4 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${3 + intensity * 4}px rgba(202,178,52,${(0.5 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${2 + intensity * 2}px rgba(34,197,94,${(0.3 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${2 + intensity * 3}px rgba(202,178,52,${(0.4 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${1 + intensity * 2}px rgba(34,197,94,${(0.3 + intensity * 0.3).toFixed(2)}))`,
          ],
        }}
        transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={`rgba(255,255,255,${(0.2 + intensity * 0.5).toFixed(2)})`}
        strokeWidth={0.15 + intensity * 0.2}
        strokeLinecap="round"
        strokeDasharray="2 4"
        animate={{ strokeDashoffset: [0, -12] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
      />
      <defs>
        <linearGradient id="lightning-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,197,94,0.9)" />
          <stop offset="30%" stopColor="rgba(202,178,52,1)" />
          <stop offset="60%" stopColor="rgba(34,197,94,0.95)" />
          <stop offset="100%" stopColor="rgba(202,178,52,0.9)" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
