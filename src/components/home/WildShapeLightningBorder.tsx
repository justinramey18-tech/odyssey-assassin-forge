import { motion } from 'framer-motion';

/**
 * DBZ-style crackling lightning energy borders (left & right edges).
 * Gold-green color mix, visible only when Wild Shape is active.
 */
export function WildShapeLightningBorder() {
  // Multiple lightning bolt paths for organic, asynchronous crackling
  const boltVariants = [
    { delay: 0, side: 'left' as const, path: 'M0,0 Q8,12 2,25 Q10,40 0,55 Q7,70 3,85 Q9,95 0,100' },
    { delay: 0.7, side: 'left' as const, path: 'M0,5 Q6,18 1,30 Q9,45 3,60 Q8,78 0,90' },
    { delay: 1.4, side: 'right' as const, path: 'M10,0 Q2,15 8,28 Q0,42 7,58 Q1,72 10,88 Q3,96 10,100' },
    { delay: 0.3, side: 'right' as const, path: 'M10,8 Q4,20 9,35 Q1,50 6,65 Q2,80 10,95' },
    { delay: 2.1, side: 'left' as const, path: 'M0,15 Q7,28 1,42 Q8,55 2,68 Q6,82 0,95' },
    { delay: 1.8, side: 'right' as const, path: 'M10,10 Q3,22 8,38 Q2,52 9,70 Q4,85 10,100' },
  ];

  return (
    <>
      {/* Left edge lightning container */}
      <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {boltVariants
          .filter(b => b.side === 'left')
          .map((bolt, i) => (
            <LightningBolt key={`l-${i}`} path={bolt.path} delay={bolt.delay} side="left" />
          ))}
        {/* Ambient edge glow */}
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: [
              'inset -15px 0 25px -10px rgba(34,197,94,0.0)',
              'inset -15px 0 25px -10px rgba(34,197,94,0.15)',
              'inset -15px 0 25px -10px rgba(34,197,94,0.0)',
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      {/* Right edge lightning container */}
      <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-20 overflow-hidden">
        {boltVariants
          .filter(b => b.side === 'right')
          .map((bolt, i) => (
            <LightningBolt key={`r-${i}`} path={bolt.path} delay={bolt.delay} side="right" />
          ))}
        {/* Ambient edge glow */}
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: [
              'inset 15px 0 25px -10px rgba(34,197,94,0.0)',
              'inset 15px 0 25px -10px rgba(34,197,94,0.15)',
              'inset 15px 0 25px -10px rgba(34,197,94,0.0)',
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        />
      </div>
    </>
  );
}

function LightningBolt({ path, delay, side }: { path: string; side: 'left' | 'right'; delay: number }) {
  return (
    <motion.svg
      viewBox="0 0 10 100"
      preserveAspectRatio="none"
      className="absolute top-0 h-full"
      style={{
        width: '100%',
        [side]: 0,
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
      {/* Gold-green lightning stroke */}
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
        transition={{
          duration: 0.4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {/* Secondary thinner arc for crackling effect */}
      <motion.path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeDasharray="2 4"
        animate={{
          strokeDashoffset: [0, -12],
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          ease: 'linear',
        }}
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
