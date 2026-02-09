import { motion } from 'framer-motion';
import { useMemo } from 'react';

type DragonElement = 'fire' | 'cold' | 'acid';

interface ParticleConfig {
  color: string;
  glowColor: string;
  sizeRange: [number, number];
  direction: 'up' | 'down';
  count: number;
  emoji?: string;
}

const ELEMENT_CONFIG: Record<DragonElement, ParticleConfig> = {
  fire: {
    color: 'rgba(251,146,60,0.8)',
    glowColor: 'rgba(239,68,68,0.6)',
    sizeRange: [3, 7],
    direction: 'up',
    count: 18,
  },
  cold: {
    color: 'rgba(200,220,255,0.7)',
    glowColor: 'rgba(147,197,253,0.5)',
    sizeRange: [4, 8],
    direction: 'down',
    count: 14,
    emoji: '❄',
  },
  acid: {
    color: 'rgba(132,204,22,0.75)',
    glowColor: 'rgba(163,130,246,0.5)',
    sizeRange: [3, 6],
    direction: 'down',
    count: 16,
  },
};

const DRAGON_ELEMENT_MAP: Record<string, DragonElement> = {
  'red-dragon': 'fire',
  'gold-dragon': 'fire',
  'white-dragon': 'cold',
  'silver-dragon': 'cold',
  'black-dragon': 'acid',
  'copper-dragon': 'acid',
};

function getDragonElement(formName?: string): DragonElement | null {
  if (!formName) return null;
  const id = formName.toLowerCase().replace(/\s+/g, '-');
  return DRAGON_ELEMENT_MAP[id] ?? null;
}

interface DragonParticlesProps {
  formName?: string;
}

export function DragonParticles({ formName }: DragonParticlesProps) {
  const element = getDragonElement(formName);
  if (!element) return null;
  return <ParticleField element={element} />;
}

function ParticleField({ element }: { element: DragonElement }) {
  const config = ELEMENT_CONFIG[element];

  const particles = useMemo(() => {
    return Array.from({ length: config.count }, (_, i) => {
      const size = config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);
      return {
        id: i,
        x: Math.random() * 100,         // % horizontal position
        delay: Math.random() * 6,        // stagger start
        duration: 4 + Math.random() * 5, // 4–9s travel time
        size,
        drift: (Math.random() - 0.5) * 30, // horizontal sway in px
        opacity: 0.3 + Math.random() * 0.5,
      };
    });
  }, [config]);

  const isUp = config.direction === 'up';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            ...(isUp ? { bottom: -10 } : { top: -10 }),
            width: p.size,
            height: element === 'acid' ? p.size * 1.6 : p.size,
            borderRadius: element === 'acid' ? '50% 50% 50% 50% / 60% 60% 40% 40%' : '50%',
            background: config.color,
            boxShadow: `0 0 ${p.size + 2}px ${config.glowColor}`,
          }}
          animate={{
            y: isUp ? [0, -(window.innerHeight + 20)] : [0, window.innerHeight + 20],
            x: [0, p.drift, -p.drift * 0.5, p.drift * 0.3, 0],
            opacity: [0, p.opacity, p.opacity, p.opacity * 0.6, 0],
            scale: element === 'fire'
              ? [1, 1.3, 0.8, 0.4]
              : element === 'cold'
                ? [0.6, 1, 1, 0.8]
                : [1, 1, 0.9, 0.7],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {element === 'cold' && p.size > 6 && (
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ fontSize: p.size * 1.2, opacity: 0.7 }}
            >
              ❄
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}
