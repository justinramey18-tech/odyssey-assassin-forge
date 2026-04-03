import { useState, useEffect, useMemo } from 'react';

// === PERSISTENT PARTICLE EFFECTS (stay until cleared by next slide) ===

function RainVFX() {
  const drops = useMemo(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 0.35 + Math.random() * 0.25,
      height: 12 + Math.random() * 18,
    })), []);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
        {drops.map(d => (
          <div
            key={d.id}
            className="absolute"
            style={{
              left: `${d.left}%`,
              top: '-20px',
              width: '1px',
              height: `${d.height}px`,
              background: 'linear-gradient(to bottom, transparent, rgba(150,180,220,0.35))',
              animation: `vfx-rain-fall ${d.duration}s linear infinite`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes vfx-rain-fall {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </>
  );
}

function EmbersVFX() {
  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      size: 2 + Math.random() * 3,
      hue: 20 + Math.random() * 25,
      lightness: 50 + Math.random() * 20,
      duration: 2.5 + Math.random() * 3,
      delay: Math.random() * 2.5,
      drift: (Math.random() - 0.5) * 60,
    })), []);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              bottom: '-10px',
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: `hsl(${p.hue}, 100%, ${p.lightness}%)`,
              boxShadow: `0 0 ${p.size + 2}px hsl(${p.hue}, 100%, 50%)`,
              animation: `vfx-ember-rise ${p.duration}s ease-out infinite`,
              animationDelay: `${p.delay}s`,
              ['--drift' as any]: `${p.drift}px`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes vfx-ember-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(var(--drift)); opacity: 0; }
        }
      `}</style>
    </>
  );
}

function FrostVFX() {
  const flakes = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 3,
      drift: (Math.random() - 0.5) * 40,
    })), []);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
        {flakes.map(f => (
          <div
            key={f.id}
            className="absolute rounded-full"
            style={{
              left: `${f.left}%`,
              top: '-10px',
              width: `${f.size}px`,
              height: `${f.size}px`,
              background: 'rgba(180, 210, 240, 0.5)',
              boxShadow: '0 0 4px rgba(180, 210, 240, 0.3)',
              animation: `vfx-frost-fall ${f.duration}s ease-in-out infinite`,
              animationDelay: `${f.delay}s`,
              ['--drift' as any]: `${f.drift}px`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes vfx-frost-fall {
          0% { transform: translateY(-10px) translateX(0); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.3; }
          100% { transform: translateY(100vh) translateX(var(--drift)); opacity: 0; }
        }
      `}</style>
    </>
  );
}

function GoldParticlesVFX() {
  const sparks = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: 15 + Math.random() * 70,
      top: 10 + Math.random() * 80,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 4,
    })), []);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
        {sparks.map(s => (
          <div
            key={s.id}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              background: '#daa520',
              boxShadow: '0 0 6px #daa520, 0 0 12px rgba(218,165,32,0.3)',
              animation: `vfx-gold-pulse ${s.duration}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes vfx-gold-pulse {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}

// === ATMOSPHERIC PERSISTENT EFFECTS ===

function LightningVFX() {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleFlash = () => {
      timeout = setTimeout(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 80);
        scheduleFlash();
      }, 2000 + Math.random() * 4000);
    };
    scheduleFlash();
    return () => clearTimeout(timeout);
  }, []);

  if (!flash) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[6]"
      style={{ background: 'rgba(200,210,255,0.07)' }}
    />
  );
}

function GroundPulseVFX() {
  return (
    <>
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-[4]"
        style={{
          height: '30%',
          background: 'radial-gradient(ellipse at bottom, rgba(180,50,20,0.12) 0%, transparent 70%)',
          animation: 'vfx-ground-pulse 2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes vfx-ground-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// === ONE-SHOT EFFECTS (fire once, auto-cleanup) ===

function ScreenShakeVFX({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <style>{`
      .vfx-shake-target {
        animation: vfx-screen-shake 0.5s ease-in-out;
      }
      @keyframes vfx-screen-shake {
        0%, 100% { transform: translate(0); }
        10% { transform: translate(-4px, 2px); }
        20% { transform: translate(3px, -3px); }
        30% { transform: translate(-3px, 1px); }
        40% { transform: translate(2px, -2px); }
        50% { transform: translate(-2px, 3px); }
        60% { transform: translate(3px, -1px); }
        70% { transform: translate(-1px, 2px); }
        80% { transform: translate(2px, -2px); }
        90% { transform: translate(-3px, 1px); }
      }
    `}</style>
  );
}

function FlashWhiteVFX({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 150);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-[8]"
        style={{ animation: 'vfx-flash-white 0.15s ease-out forwards' }}
      />
      <style>{`
        @keyframes vfx-flash-white {
          0% { background: rgba(255,255,255,0.25); }
          100% { background: rgba(255,255,255,0); }
        }
      `}</style>
    </>
  );
}

function FadeToBlackVFX({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-[8]"
        style={{ animation: 'vfx-fade-black 0.8s ease-in-out forwards' }}
      />
      <style>{`
        @keyframes vfx-fade-black {
          0% { background: rgba(0,0,0,0); }
          40% { background: rgba(0,0,0,0.85); }
          70% { background: rgba(0,0,0,0.85); }
          100% { background: rgba(0,0,0,0); }
        }
      `}</style>
    </>
  );
}

function BloodVignetteVFX({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-[7]"
        style={{ animation: 'vfx-blood-vignette 1.2s ease-in-out forwards' }}
      />
      <style>{`
        @keyframes vfx-blood-vignette {
          0% { box-shadow: inset 0 0 0 0 rgba(120,10,10,0); }
          30% { box-shadow: inset 0 0 80px 30px rgba(120,10,10,0.4); }
          100% { box-shadow: inset 0 0 0 0 rgba(120,10,10,0); }
        }
      `}</style>
    </>
  );
}

// === MAIN VFX LAYER ===

const PERSISTENT_EFFECTS = new Set(['rain', 'embers', 'frost', 'gold-particles', 'lightning', 'ground-pulse']);
const ONE_SHOT_EFFECTS = new Set(['screen-shake', 'flash-white', 'fade-to-black', 'blood-vignette']);

interface SlideshowVFXProps {
  /** VFX names from the current slide */
  slideVfx: string[];
  /** Incremented on each slide change to re-trigger one-shots */
  slideKey: number;
}

export default function SlideshowVFX({ slideVfx, slideKey }: SlideshowVFXProps) {
  // Track which persistent effects are active (they accumulate across slides)
  const [persistentEffects, setPersistentEffects] = useState<Set<string>>(new Set());
  // Track active one-shot effects for this slide
  const [activeOneShots, setActiveOneShots] = useState<Set<string>>(new Set());
  // Track if screen-shake is active (applied as CSS class to parent)
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    // Update persistent effects: add new ones from this slide
    // (Persistent effects stay until a new slide does NOT include them,
    //  OR we could keep them until explicitly cleared. For now: keep them
    //  until a slide brings a new set of persistent effects that replaces them.)
    const newPersistent = slideVfx.filter(v => PERSISTENT_EFFECTS.has(v));
    if (newPersistent.length > 0) {
      setPersistentEffects(new Set(newPersistent));
    }

    // Fire one-shots for this slide
    const newOneShots = slideVfx.filter(v => ONE_SHOT_EFFECTS.has(v));
    setActiveOneShots(new Set(newOneShots));

    if (newOneShots.includes('screen-shake')) {
      setShaking(true);
    }
  }, [slideKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOneShot = (name: string) => {
    setActiveOneShots(prev => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    if (name === 'screen-shake') setShaking(false);
  };

  return (
    <>
      {/* Persistent particle effects */}
      {persistentEffects.has('rain') && <RainVFX />}
      {persistentEffects.has('embers') && <EmbersVFX />}
      {persistentEffects.has('frost') && <FrostVFX />}
      {persistentEffects.has('gold-particles') && <GoldParticlesVFX />}
      {persistentEffects.has('lightning') && <LightningVFX />}
      {persistentEffects.has('ground-pulse') && <GroundPulseVFX />}

      {/* One-shot effects */}
      {activeOneShots.has('screen-shake') && (
        <ScreenShakeVFX onDone={() => removeOneShot('screen-shake')} />
      )}
      {activeOneShots.has('flash-white') && (
        <FlashWhiteVFX onDone={() => removeOneShot('flash-white')} />
      )}
      {activeOneShots.has('fade-to-black') && (
        <FadeToBlackVFX onDone={() => removeOneShot('fade-to-black')} />
      )}
      {activeOneShots.has('blood-vignette') && (
        <BloodVignetteVFX onDone={() => removeOneShot('blood-vignette')} />
      )}

      {/* Inject shake class on the parent via a global style when active */}
      {shaking && (
        <style>{`
          .cinematic-slideshow-root {
            animation: vfx-screen-shake 0.5s ease-in-out !important;
          }
        `}</style>
      )}
    </>
  );
}

export { PERSISTENT_EFFECTS, ONE_SHOT_EFFECTS };
