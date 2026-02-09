import { motion } from 'framer-motion';

type Edge = 'left' | 'right' | 'top' | 'bottom';

/**
 * DBZ-style crackling lightning energy borders on all 4 edges.
 * Gold-green color mix, visible only when Wild Shape is active.
 */
export function WildShapeLightningBorder() {
  const verticalBolts = [
    { delay: 0, side: 'left' as Edge, path: 'M0,0 Q8,12 2,25 Q10,40 0,55 Q7,70 3,85 Q9,95 0,100' },
    { delay: 0.7, side: 'left' as Edge, path: 'M0,5 Q6,18 1,30 Q9,45 3,60 Q8,78 0,90' },
    { delay: 2.1, side: 'left' as Edge, path: 'M0,15 Q7,28 1,42 Q8,55 2,68 Q6,82 0,95' },
    { delay: 1.4, side: 'right' as Edge, path: 'M10,0 Q2,15 8,28 Q0,42 7,58 Q1,72 10,88 Q3,96 10,100' },
    { delay: 0.3, side: 'right' as Edge, path: 'M10,8 Q4,20 9,35 Q1,50 6,65 Q2,80 10,95' },
    { delay: 1.8, side: 'right' as Edge, path: 'M10,10 Q3,22 8,38 Q2,52 9,70 Q4,85 10,100' },
  ];

  // Horizontal bolts use the same viewBox but rendered rotated via container
  const horizontalBolts = [
    { delay: 0.4, side: 'top' as Edge, path: 'M0,0 Q8,12 2,25 Q10,40 0,55 Q7,70 3,85 Q9,95 0,100' },
    { delay: 1.1, side: 'top' as Edge, path: 'M0,10 Q6,22 1,38 Q9,50 3,65 Q8,80 0,92' },
    { delay: 1.6, side: 'bottom' as Edge, path: 'M10,0 Q2,15 8,28 Q0,42 7,58 Q1,72 10,88 Q3,96 10,100' },
    { delay: 0.9, side: 'bottom' as Edge, path: 'M10,5 Q4,18 9,32 Q1,48 6,62 Q2,78 10,93' },
  ];

  return (
    <>
      {/* Left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'left').map((bolt, i) => (
          <LightningBolt key={`l-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" />
        ))}
        <EdgeGlow direction="left" />
      </div>

      {/* Right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {verticalBolts.filter(b => b.side === 'right').map((bolt, i) => (
          <LightningBolt key={`r-${i}`} path={bolt.path} delay={bolt.delay} orientation="vertical" />
        ))}
        <EdgeGlow direction="right" />
      </div>

      {/* Top edge */}
      <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
        {horizontalBolts.filter(b => b.side === 'top').map((bolt, i) => (
          <LightningBolt key={`t-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" />
        ))}
        <EdgeGlow direction="top" />
      </div>

      {/* Bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-20 overflow-hidden">
        {horizontalBolts.filter(b => b.side === 'bottom').map((bolt, i) => (
          <LightningBolt key={`b-${i}`} path={bolt.path} delay={bolt.delay} orientation="horizontal" />
        ))}
        <EdgeGlow direction="bottom" />
      </div>
    </>
  );
}

const glowMap = {
  left: [
    'inset -15px 0 25px -10px rgba(34,197,94,0.0)',
    'inset -15px 0 25px -10px rgba(34,197,94,0.15)',
    'inset -15px 0 25px -10px rgba(34,197,94,0.0)',
  ],
  right: [
    'inset 15px 0 25px -10px rgba(34,197,94,0.0)',
    'inset 15px 0 25px -10px rgba(34,197,94,0.15)',
    'inset 15px 0 25px -10px rgba(34,197,94,0.0)',
  ],
  top: [
    'inset 0 -15px 25px -10px rgba(34,197,94,0.0)',
    'inset 0 -15px 25px -10px rgba(34,197,94,0.15)',
    'inset 0 -15px 25px -10px rgba(34,197,94,0.0)',
  ],
  bottom: [
    'inset 0 15px 25px -10px rgba(34,197,94,0.0)',
    'inset 0 15px 25px -10px rgba(34,197,94,0.15)',
    'inset 0 15px 25px -10px rgba(34,197,94,0.0)',
  ],
};

function EdgeGlow({ direction }: { direction: 'left' | 'right' | 'top' | 'bottom' }) {
  const delayMap = { left: 0.5, right: 1.2, top: 0.8, bottom: 1.5 };
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ boxShadow: glowMap[direction] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: delayMap[direction] }}
    />
  );
}

function LightningBolt({ path, delay, orientation }: { path: string; delay: number; orientation: 'vertical' | 'horizontal' }) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <motion.svg
      viewBox="0 0 10 100"
      preserveAspectRatio="none"
      className="absolute"
      style={{
        ...(isHorizontal
          ? { top: 0, left: 0, width: '100%', height: '100%', transform: 'rotate(90deg) scaleY(-1)', transformOrigin: 'center center' }
          : { top: 0, left: 0, width: '100%', height: '100%' }),
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 1, 0.8, 0, 0, 0] }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        repeatDelay: 1.2 + delay * 0.5,
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
          strokeWidth: [0.5, 1.2, 0.6, 1.0, 0.5],
          filter: [
            'drop-shadow(0 0 2px rgba(34,197,94,0.8))',
            'drop-shadow(0 0 6px rgba(202,178,52,0.9))',
            'drop-shadow(0 0 3px rgba(34,197,94,0.7))',
            'drop-shadow(0 0 5px rgba(202,178,52,0.8))',
            'drop-shadow(0 0 2px rgba(34,197,94,0.6))',
          ],
        }}
        transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="0.3"
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
