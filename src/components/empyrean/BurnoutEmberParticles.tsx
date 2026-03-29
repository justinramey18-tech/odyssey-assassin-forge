import React, { useMemo } from 'react';

interface BurnoutEmberParticlesProps {
  ratio: number;
}

interface Ember {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
  hue: number;
}

const BurnoutEmberParticles: React.FC<BurnoutEmberParticlesProps> = ({ ratio }) => {
  const active = ratio >= 0.6;
  const count = active ? Math.round(8 + (ratio - 0.6) * 50) : 0;

  const embers = useMemo<Ember[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 40,
      opacity: 0.5 + Math.random() * 0.5,
      hue: 15 + Math.random() * 25,
    }));
  }, [active, count]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 62,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {embers.map((e) => (
        <div
          key={e.id}
          style={{
            position: 'absolute',
            left: `${e.x}%`,
            bottom: -4,
            width: e.size,
            height: e.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, hsla(${e.hue}, 100%, 65%, ${e.opacity}) 0%, hsla(${e.hue - 10}, 100%, 45%, 0) 70%)`,
            boxShadow: `0 0 ${e.size + 3}px hsla(${e.hue}, 100%, 55%, ${e.opacity * 0.6})`,
            animation: `ember-rise ${e.duration}s ease-out ${e.delay}s infinite`,
            '--ember-drift': `${e.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default BurnoutEmberParticles;
