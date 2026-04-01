import React, { useState, useEffect, useCallback, useMemo } from 'react';

interface MemorialScreenProps {
  open: boolean;
  riderName: string;
  dragonName: string;
  dragonColor: string;
  signetType: string;
  bondLevel: number;
  maxBondLevel: number;
  characterLevel: number;
  sessionsPlayed: number;
  causeOfDeath: string;
  squadName: string;
  onBeginAgain: () => void;
}

type Act = 'act1' | 'act2' | 'act3';

const EPITAPH_LINES: { text: string; color: string; bold?: boolean }[] = [
  { text: 'The bond between rider and dragon is the most sacred thing in the world.', color: '#8a7d6f' },
  { text: 'When it breaks, the sky itself mourns.', color: '#8a7d6f' },
  { text: 'But the Empyrean does not waste souls.', color: '#8a7d6f' },
  { text: 'You will return — unbonded, unproven, unnamed.', color: '#c9a84c' },
  { text: 'And you will earn your wings again.', color: '#c9a84c', bold: true },
];

function EmberParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 4 + Math.random() * 6,
      size: 2 + Math.random() * 3,
      opacity: 0.2 + Math.random() * 0.5,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Bottom red glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(201,68,68,0.15) 0%, transparent 70%)',
        }}
      />
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: '#c94444',
            opacity: p.opacity,
            boxShadow: '0 0 4px rgba(201,68,68,0.6)',
            animation: `ember-rise ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

const MemorialScreen: React.FC<MemorialScreenProps> = ({
  open,
  riderName,
  dragonName,
  dragonColor,
  signetType,
  bondLevel,
  maxBondLevel,
  characterLevel,
  sessionsPlayed,
  causeOfDeath,
  squadName,
  onBeginAgain,
}) => {
  const [act, setAct] = useState<Act>('act1');

  // Act 1 state
  const [showRemembrance, setShowRemembrance] = useState(false);
  const [remembranceFaded, setRemembranceFaded] = useState(false);
  const [identityLines, setIdentityLines] = useState(0); // 0-4 (name, rider of, squad, divider)

  // Act 2 state
  const [showStats, setShowStats] = useState(false);

  // Act 3 state
  const [epitaphIndex, setEpitaphIndex] = useState(-1);
  const [epitaphVisible, setEpitaphVisible] = useState(false);
  const [epitaphDone, setEpitaphDone] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setAct('act1');
    setShowRemembrance(false);
    setRemembranceFaded(false);
    setIdentityLines(0);
    setShowStats(false);
    setEpitaphIndex(-1);
    setEpitaphVisible(false);
    setEpitaphDone(false);
    setShowButton(false);

    // Start Act 1: "The Empyrean remembers."
    const t1 = setTimeout(() => setShowRemembrance(true), 500);
    return () => clearTimeout(t1);
  }, [open]);

  // Act 1: remembrance fade in → hold → fade out → identity lines
  useEffect(() => {
    if (!showRemembrance || remembranceFaded) return;
    const holdTimer = setTimeout(() => {
      setRemembranceFaded(true);
      // After fade out, start identity lines
      const startIdentity = setTimeout(() => {
        setIdentityLines(1);
      }, 800);
      return () => clearTimeout(startIdentity);
    }, 3200); // 1.2s fade in + 2s hold
    return () => clearTimeout(holdTimer);
  }, [showRemembrance, remembranceFaded]);

  // Identity lines auto-advance
  useEffect(() => {
    if (identityLines < 1 || identityLines >= 4) return;
    const t = setTimeout(() => setIdentityLines(prev => prev + 1), 1400);
    return () => clearTimeout(t);
  }, [identityLines]);

  // After all identity lines shown, transition to Act 2
  useEffect(() => {
    if (identityLines < 4) return;
    const t = setTimeout(() => {
      setAct('act2');
      setTimeout(() => setShowStats(true), 300);
    }, 1200);
    return () => clearTimeout(t);
  }, [identityLines]);

  // Act 2: show stats then transition to Act 3
  useEffect(() => {
    if (act !== 'act2' || !showStats) return;
    const t = setTimeout(() => {
      setShowStats(false);
      setTimeout(() => {
        setAct('act3');
        setEpitaphIndex(0);
      }, 600);
    }, 3500);
    return () => clearTimeout(t);
  }, [act, showStats]);

  // Act 3: epitaph lines one at a time
  useEffect(() => {
    if (act !== 'act3' || epitaphIndex < 0 || epitaphIndex >= EPITAPH_LINES.length) return;
    setEpitaphVisible(true);
    const holdTimer = setTimeout(() => {
      setEpitaphVisible(false);
      const nextTimer = setTimeout(() => {
        if (epitaphIndex < EPITAPH_LINES.length - 1) {
          setEpitaphIndex(prev => prev + 1);
        } else {
          setEpitaphDone(true);
          setTimeout(() => setShowButton(true), 800);
        }
      }, 800);
      return () => clearTimeout(nextTimer);
    }, 2800);
    return () => clearTimeout(holdTimer);
  }, [act, epitaphIndex]);

  const skipAct1 = useCallback(() => {
    if (act === 'act1') {
      if (!remembranceFaded) {
        setRemembranceFaded(true);
        setShowRemembrance(true);
        setTimeout(() => setIdentityLines(prev => Math.min(prev + 1, 4)), 200);
      } else if (identityLines < 4) {
        setIdentityLines(prev => Math.min(prev + 1, 4));
      }
    }
  }, [act, remembranceFaded, identityLines]);

  const skipEpitaph = useCallback(() => {
    if (act !== 'act3' || epitaphDone) return;
    setEpitaphVisible(false);
    setTimeout(() => {
      if (epitaphIndex < EPITAPH_LINES.length - 1) {
        setEpitaphIndex(prev => prev + 1);
      } else {
        setEpitaphDone(true);
        setTimeout(() => setShowButton(true), 400);
      }
    }, 150);
  }, [act, epitaphIndex, epitaphDone]);

  const bondPips = Math.round((bondLevel / maxBondLevel) * 10);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: '#0a0908', fontFamily: "'Crimson Text', 'Cinzel', serif" }}
    >
      <EmberParticles />

      {/* Act 1 — The Naming */}
      {act === 'act1' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          {/* "The Empyrean remembers." */}
          {!remembranceFaded && (
            <p
              className="text-xs uppercase tracking-[0.35em] text-center transition-opacity"
              style={{
                color: '#4a3f35',
                opacity: showRemembrance ? 1 : 0,
                transitionDuration: showRemembrance ? '1200ms' : '800ms',
              }}
            >
              The Empyrean remembers.
            </p>
          )}

          {/* Identity lines — build up and stay */}
          {remembranceFaded && (
            <div className="flex flex-col items-center gap-2">
              {/* Rider name */}
              <h1
                className="font-cinzel font-bold text-center transition-all duration-700"
                style={{
                  fontSize: 28,
                  color: '#e8e0d4',
                  opacity: identityLines >= 1 ? 1 : 0,
                  transform: identityLines >= 1 ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                {riderName}
              </h1>

              {/* Rider of dragon */}
              <p
                className="font-cinzel italic text-center transition-all duration-700"
                style={{
                  fontSize: 17,
                  color: dragonColor,
                  opacity: identityLines >= 2 ? 1 : 0,
                  transform: identityLines >= 2 ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                Rider of {dragonName}
              </p>

              {/* Squad name */}
              <p
                className="text-center transition-all duration-700"
                style={{
                  fontSize: 13,
                  color: '#6b5c4d',
                  opacity: identityLines >= 3 ? 1 : 0,
                  transform: identityLines >= 3 ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                {squadName}
              </p>

              {/* Divider */}
              <div
                className="w-48 h-px mt-2 transition-all duration-700"
                style={{
                  background: 'linear-gradient(90deg, transparent, #4a3f35, transparent)',
                  opacity: identityLines >= 4 ? 1 : 0,
                }}
              />
            </div>
          )}

          {/* Skip button */}
          <button
            onClick={skipAct1}
            className="absolute bottom-20 text-xs font-cinzel tracking-wider transition-colors"
            style={{ color: '#6b5c4d' }}
          >
            Next ›
          </button>
        </div>
      )}

      {/* Act 2 — The Record */}
      {act === 'act2' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-6">
          {/* Identity at top */}
          <div className="flex flex-col items-center gap-1 mb-4">
            <h1 className="font-cinzel font-bold text-center" style={{ fontSize: 28, color: '#e8e0d4' }}>
              {riderName}
            </h1>
            <p className="font-cinzel italic text-center" style={{ fontSize: 17, color: dragonColor }}>
              Rider of {dragonName}
            </p>
            <p className="text-center" style={{ fontSize: 13, color: '#6b5c4d' }}>{squadName}</p>
            <div className="w-48 h-px mt-1" style={{ background: 'linear-gradient(90deg, transparent, #4a3f35, transparent)' }} />
          </div>

          {/* Stats block */}
          <div
            className="flex flex-col items-center gap-4 transition-all duration-700"
            style={{
              opacity: showStats ? 1 : 0,
              transform: showStats ? 'translateY(0)' : 'translateY(16px)',
            }}
          >
            {/* Bond pips */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#6b5c4d' }}>Bond at death</span>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border"
                    style={{
                      borderColor: i < bondPips ? dragonColor : '#3a322a',
                      backgroundColor: i < bondPips ? dragonColor : 'transparent',
                      boxShadow: i < bondPips ? `0 0 4px ${dragonColor}40` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Three stat columns */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-cinzel font-bold text-lg" style={{ color: '#e8e0d4' }}>{characterLevel}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6b5c4d' }}>Level</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-cinzel font-bold text-lg" style={{ color: '#e8e0d4' }}>{signetType || '—'}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6b5c4d' }}>Signet</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-cinzel font-bold text-lg" style={{ color: '#e8e0d4' }}>{sessionsPlayed}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6b5c4d' }}>Sessions</span>
              </div>
            </div>

            {/* Cause of death */}
            <div
              className="px-4 py-2.5 rounded-lg border mt-1 max-w-[280px]"
              style={{
                borderColor: '#c9444430',
                backgroundColor: '#c9444410',
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] block text-center mb-0.5" style={{ color: '#c94444' }}>
                Cause of death
              </span>
              <p className="font-cinzel text-sm text-center" style={{ color: '#c94444' }}>
                {causeOfDeath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Act 3 — The Epitaph */}
      {act === 'act3' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          {/* Identity persists at top */}
          <div className="absolute top-16 flex flex-col items-center gap-1">
            <h1 className="font-cinzel font-bold text-center" style={{ fontSize: 22, color: '#e8e0d4' }}>
              {riderName}
            </h1>
            <p className="font-cinzel italic text-center" style={{ fontSize: 14, color: dragonColor }}>
              Rider of {dragonName}
            </p>
          </div>

          {/* Epitaph lines */}
          {!epitaphDone && epitaphIndex >= 0 && epitaphIndex < EPITAPH_LINES.length && (
            <p
              className="font-cinzel italic text-center max-w-[300px] leading-relaxed transition-opacity"
              style={{
                fontSize: 16,
                color: EPITAPH_LINES[epitaphIndex].color,
                fontWeight: EPITAPH_LINES[epitaphIndex].bold ? 700 : 400,
                opacity: epitaphVisible ? 1 : 0,
                transitionDuration: epitaphVisible ? '600ms' : '600ms',
              }}
            >
              {EPITAPH_LINES[epitaphIndex].text}
            </p>
          )}

          {/* Skip epitaph */}
          {!epitaphDone && (
            <button
              onClick={skipEpitaph}
              className="absolute bottom-20 text-xs font-cinzel tracking-wider transition-colors"
              style={{ color: '#6b5c4d' }}
            >
              Next ›
            </button>
          )}

          {/* Begin Again button */}
          {showButton && (
            <div
              className="flex flex-col items-center gap-2 animate-[fade-in_1s_ease-out]"
            >
              <button
                onClick={onBeginAgain}
                className="min-h-[48px] px-8 py-3 rounded-full font-cinzel font-bold text-sm tracking-wider uppercase
                  border transition-all duration-200 active:scale-95"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#c9a84c',
                  color: '#c9a84c',
                }}
              >
                Begin again
              </button>
              <p className="text-[10px]" style={{ color: '#6b5c4d' }}>
                You will enter as unbonded
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes ember-rise {
          0% { transform: translateY(0) translateX(0); opacity: var(--ember-opacity, 0.3); }
          50% { transform: translateY(-45vh) translateX(8px); opacity: var(--ember-opacity, 0.3); }
          100% { transform: translateY(-100vh) translateX(-4px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MemorialScreen;
