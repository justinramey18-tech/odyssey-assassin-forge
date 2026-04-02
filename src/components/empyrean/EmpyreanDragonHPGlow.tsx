import { cn } from '@/lib/utils';

interface EmpyreanDragonHPGlowProps {
  currentHP: number;
  maxHP: number;
}

export function EmpyreanDragonHPGlow({ currentHP, maxHP }: EmpyreanDragonHPGlowProps) {
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 100;

  const isHealthy = hpPct > 50;
  const isCritical = hpPct > 0 && hpPct <= 25;
  const isDead = hpPct <= 0;

  const darkOverlayOpacity = isDead
    ? 0.7
    : hpPct > 50
    ? 0
    : hpPct > 25
    ? 0.1 + (50 - hpPct) / 100
    : 0.35 + (25 - hpPct) / 36;

  const desaturationOpacity = isDead
    ? 0.6
    : hpPct > 50
    ? 0
    : hpPct > 25
    ? (50 - hpPct) / 100
    : 0.25 + (25 - hpPct) / 50;

  if (isHealthy) return null;

  return (
    <>
      {/* Desaturation overlay — drains color from the dragon art */}
      <div
        className="fixed inset-0 pointer-events-none z-[3] transition-opacity duration-1000"
        style={{
          backgroundColor: '#1a1a1a',
          mixBlendMode: 'saturation',
          opacity: desaturationOpacity,
        }}
      />

      {/* Dark overlay — dims the dragon art */}
      <div
        className="fixed inset-0 pointer-events-none z-[4] transition-opacity duration-1000"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${darkOverlayOpacity})`,
        }}
      />

      {/* Critical HP pulse — a slow, ominous breathing effect */}
      {isCritical && (
        <div
          className="fixed inset-0 pointer-events-none z-[4]"
          style={{
            backgroundColor: 'rgba(139, 0, 0, 0.08)',
            animation: 'hp-critical-pulse 3s ease-in-out infinite',
          }}
        />
      )}

      {/* Dead state — near-black with a faint red vignette */}
      {isDead && (
        <div
          className="fixed inset-0 pointer-events-none z-[4]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(80, 0, 0, 0.3) 100%)',
          }}
        />
      )}

      <style>{`
        @keyframes hp-critical-pulse {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
