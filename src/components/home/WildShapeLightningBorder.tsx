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
  return Math.min(1, 0.15 + 0.85 * (Math.log(cr + 1) / Math.log(21)));
}

/**
 * Dragon element color palettes keyed by dragon name substring.
 * Returns [primary RGB, accent RGB] for lightning/glow effects.
 */
interface ElementColors {
  primary: string;   // e.g. "34,197,94" (green default)
  accent: string;    // e.g. "202,178,52" (gold default)
  flash1: string;    // radial flash color 1
  flash2: string;    // radial flash color 2
}

const DRAGON_COLOR_MAP: Record<string, ElementColors> = {
  // Fire dragons — red/orange/gold
  'red-dragon':    { primary: '239,68,68',   accent: '251,146,60',  flash1: '239,68,68',   flash2: '251,146,60'  },
  'gold-dragon':   { primary: '234,179,8',   accent: '251,146,60',  flash1: '234,179,8',   flash2: '251,191,36'  },
  // Cold dragons — ice blue/white
  'white-dragon':  { primary: '147,197,253', accent: '219,234,254', flash1: '147,197,253', flash2: '219,234,254' },
  'silver-dragon': { primary: '148,163,184', accent: '203,213,225', flash1: '148,163,184', flash2: '226,232,240' },
  // Acid dragons — toxic green/purple
  'black-dragon':  { primary: '132,204,22',  accent: '163,130,246', flash1: '132,204,22',  flash2: '163,130,246' },
  'copper-dragon': { primary: '180,83,9',    accent: '132,204,22',  flash1: '180,83,9',    flash2: '132,204,22'  },
};

const DEFAULT_COLORS: ElementColors = {
  primary: '34,197,94',
  accent: '202,178,52',
  flash1: '34,197,94',
  flash2: '202,178,52',
};

function getFormColors(formName?: string): ElementColors {
  if (!formName) return DEFAULT_COLORS;
  // Match against known dragon form IDs by converting name to id format
  const id = formName.toLowerCase().replace(/\s+/g, '-');
  return DRAGON_COLOR_MAP[id] ?? DEFAULT_COLORS;
}

interface CRProps {
  cr: number;
  formName?: string;
}

/**
 * Energy vignette pulse that scales with CR.
 * Color adapts to dragon element type.
 */
export function CRScaledPulse({ cr, formName }: CRProps) {
  const intensity = crToIntensity(cr);
  const colors = getFormColors(formName);

  const peakSpread = Math.round(60 + intensity * 80);
  const peakBlur = Math.round(10 + intensity * 35);
  const peakOpacity = (0.08 + intensity * 0.22).toFixed(2);
  const duration = 7 - intensity * 4;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      animate={{
        boxShadow: [
          `inset 0 0 ${peakSpread * 0.7}px ${peakBlur * 0.4}px rgba(${colors.primary},0.0)`,
          `inset 0 0 ${peakSpread}px ${peakBlur}px rgba(${colors.primary},${peakOpacity})`,
          `inset 0 0 ${peakSpread * 0.7}px ${peakBlur * 0.4}px rgba(${colors.primary},0.0)`,
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
 * Color adapts to dragon element type.
 */
export function WildShapeLightningBorder({ cr, formName }: CRProps) {
  const intensity = crToIntensity(cr);
  const colors = getFormColors(formName);

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
    if (intensity < 0.35) return [];
    const count = Math.max(1, Math.round(all.length * intensity));
    return all.slice(0, count);
  }, [intensity]);

  const glowOpacity = (0.05 + intensity * 0.15).toFixed(2);

  // Unique gradient ID to avoid SVG defs collision across instances
  const gradientId = useMemo(() => `lightning-grad-${formName?.replace(/\s/g, '') ?? 'default'}`, [formName]);

  return (
    <>
      {/* Left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'left').map((bolt, i) => (
          <LightningBolt key={`l-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" intensity={intensity} colors={colors} gradientId={gradientId} />
        ))}
        <EdgeGlow direction="left" opacity={glowOpacity} colors={colors} />
      </div>

      {/* Right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'right').map((bolt, i) => (
          <LightningBolt key={`r-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" intensity={intensity} colors={colors} gradientId={gradientId} />
        ))}
        <EdgeGlow direction="right" opacity={glowOpacity} colors={colors} />
      </div>

      {/* Top edge */}
      {horizontalBolts.some(b => b.side === 'top') && (
        <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
          {horizontalBolts.filter(b => b.side === 'top').map((bolt, i) => (
            <LightningBolt key={`t-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" intensity={intensity} colors={colors} gradientId={gradientId} />
          ))}
          <EdgeGlow direction="top" opacity={glowOpacity} colors={colors} />
        </div>
      )}

      {/* Bottom edge */}
      {horizontalBolts.some(b => b.side === 'bottom') && (
        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
          {horizontalBolts.filter(b => b.side === 'bottom').map((bolt, i) => (
            <LightningBolt key={`b-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" intensity={intensity} colors={colors} gradientId={gradientId} />
          ))}
          <EdgeGlow direction="bottom" opacity={glowOpacity} colors={colors} />
        </div>
      )}
    </>
  );
}

function EdgeGlow({ direction, opacity, colors }: { direction: 'left' | 'right' | 'top' | 'bottom'; opacity: string; colors: ElementColors }) {
  const { primary } = colors;
  const glowMap: Record<string, string[]> = {
    left: [
      `inset -15px 0 25px -10px rgba(${primary},0.0)`,
      `inset -15px 0 25px -10px rgba(${primary},${opacity})`,
      `inset -15px 0 25px -10px rgba(${primary},0.0)`,
    ],
    right: [
      `inset 15px 0 25px -10px rgba(${primary},0.0)`,
      `inset 15px 0 25px -10px rgba(${primary},${opacity})`,
      `inset 15px 0 25px -10px rgba(${primary},0.0)`,
    ],
    top: [
      `inset 0 -15px 25px -10px rgba(${primary},0.0)`,
      `inset 0 -15px 25px -10px rgba(${primary},${opacity})`,
      `inset 0 -15px 25px -10px rgba(${primary},0.0)`,
    ],
    bottom: [
      `inset 0 15px 25px -10px rgba(${primary},0.0)`,
      `inset 0 15px 25px -10px rgba(${primary},${opacity})`,
      `inset 0 15px 25px -10px rgba(${primary},0.0)`,
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

function LightningBolt({ path, delay, orientation, intensity, colors, gradientId }: {
  path: string;
  delay: number;
  orientation: 'vertical' | 'horizontal';
  intensity: number;
  colors: ElementColors;
  gradientId: string;
}) {
  const isHorizontal = orientation === 'horizontal';
  const viewBox = isHorizontal ? '0 0 100 10' : '0 0 10 100';
  const { primary, accent } = colors;

  const peakOpacity = 0.4 + intensity * 0.6;
  const repeatDelay = 2.5 - intensity * 1.8;

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
        stroke={`url(#${gradientId})`}
        strokeWidth="0.8"
        strokeLinecap="round"
        animate={{
          strokeWidth: [0.3 + intensity * 0.2, 0.6 + intensity * 0.8, 0.4 + intensity * 0.3, 0.5 + intensity * 0.6, 0.3 + intensity * 0.2],
          filter: [
            `drop-shadow(0 0 ${1 + intensity * 2}px rgba(${primary},${(0.4 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${3 + intensity * 4}px rgba(${accent},${(0.5 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${2 + intensity * 2}px rgba(${primary},${(0.3 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${2 + intensity * 3}px rgba(${accent},${(0.4 + intensity * 0.4).toFixed(2)}))`,
            `drop-shadow(0 0 ${1 + intensity * 2}px rgba(${primary},${(0.3 + intensity * 0.3).toFixed(2)}))`,
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${primary},0.9)`} />
          <stop offset="30%" stopColor={`rgba(${accent},1)`} />
          <stop offset="60%" stopColor={`rgba(${primary},0.95)`} />
          <stop offset="100%" stopColor={`rgba(${accent},0.9)`} />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

/**
 * One-shot transformation burst: flash + screen shake.
 * Color adapts to dragon element type.
 */
export function TransformationBurst({ cr, formName }: CRProps) {
  const intensity = crToIntensity(cr);
  const colors = getFormColors(formName);

  const flashPeak = 0.1 + intensity * 0.5;
  const shakePx = Math.round(1 + intensity * 5);
  const duration = 0.3 + intensity * 0.3;

  const shakeX = [0, -shakePx, shakePx, -shakePx * 0.6, shakePx * 0.4, 0];
  const shakeY = [0, shakePx * 0.5, -shakePx * 0.3, shakePx * 0.4, -shakePx * 0.2, 0];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, rgba(${colors.flash1},0.8), rgba(${colors.flash2},0.4), transparent 70%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, flashPeak, flashPeak * 0.3, 0] }}
        transition={{ duration: duration + 0.2, ease: 'easeOut', times: [0, 0.15, 0.5, 1] }}
      />
      <motion.div
        className="fixed inset-0 z-[59] pointer-events-none"
        initial={{ x: 0, y: 0 }}
        animate={{ x: shakeX, y: shakeY }}
        transition={{ duration, ease: 'easeOut' }}
      />
    </>
  );
}
