import React, { useEffect, useRef } from 'react';
import burnoutDragonBg from '@/assets/burnout-dragon-bg.jpg';
import burnoutDragonBg75 from '@/assets/burnout-dragon-bg-75.jpg';
import burnoutDragonBg38 from '@/assets/burnout-dragon-bg-38.jpg';
import burnoutDragonBg18 from '@/assets/burnout-dragon-bg-18.jpg';
import burnoutDragonBg58 from '@/assets/burnout-dragon-bg-58.jpg';
import BurnoutEmberParticles from './BurnoutEmberParticles';
import GroundButton from './GroundButton';

interface BurnoutFlameOverlayProps {
  level: number;
  max: number;
  onGround?: () => void;
}

// Generate crackling noise using Web Audio API
function createCrackleLoop(ctx: AudioContext, volume: number): { gain: GainNode; stop: () => void } {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() < 0.003 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.02;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.value = volume;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return { gain, stop: () => { try { source.stop(); } catch {} } };
}

// Burnout haptic vibration patterns
// Level 6: 500ms vibrate, 1000ms pause (every 1.5s)
// Level 7: 500ms vibrate, 500ms pause (every 1s)
// Level 8: constant vibration (only at full burnout)
function triggerHeartbeatHaptic(ratio: number) {
  if (!navigator.vibrate) return;
  if (ratio >= 1) {
    // Level 8: constant vibration — use a long duration, re-triggered by interval
    navigator.vibrate(10000);
  } else if (ratio >= 0.875) {
    // Level 7: 500ms on, 500ms off — re-triggered every 1s by interval
    navigator.vibrate(250);
  } else if (ratio >= 0.625) {
    // Level 6: 500ms on, 1000ms off
    navigator.vibrate([500, 1000]);
  }
}


const BurnoutFlameOverlay: React.FC<BurnoutFlameOverlayProps> = ({ level, max, onGround }) => {
  const audioRef = useRef<{ gain: GainNode; stop: () => void; ctx: AudioContext } | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ratio = max > 0 ? Math.min(level / max, 1) : 0;
  const isCritical = ratio >= 0.5;

  // Audio crackling effect
  useEffect(() => {
    if (!isCritical) {
      if (audioRef.current) {
        audioRef.current.stop();
        audioRef.current.ctx.close().catch(() => {});
        audioRef.current = null;
      }
      return;
    }

    const volume = 0.02 + (ratio - 0.5) * 0.10;

    if (!audioRef.current) {
      try {
        const ctx = new AudioContext();
        const loop = createCrackleLoop(ctx, volume);
        audioRef.current = { ...loop, ctx };
      } catch {}
    } else {
      audioRef.current.gain.gain.setValueAtTime(volume, audioRef.current.ctx.currentTime);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.stop();
        audioRef.current.ctx.close().catch(() => {});
        audioRef.current = null;
      }
    };
  }, [isCritical, ratio]);

  // Heartbeat haptic vibration synced to consciousness animation cycles
  const isHeartbeatActive = ratio >= 0.625;
  useEffect(() => {
    if (!isHeartbeatActive) {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      navigator.vibrate?.(0);
      return;
    }

    // Match the interval to the animation cycle length for each level
    const interval = ratio >= 1 ? 3000 : ratio >= 0.875 ? 2500 : 6000;
    triggerHeartbeatHaptic(ratio);
    hapticIntervalRef.current = setInterval(() => triggerHeartbeatHaptic(ratio), interval);

    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      navigator.vibrate?.(0);
    };
  }, [isHeartbeatActive, ratio]);

  if (level <= 0 || max <= 0) return null;

  const vignetteOpacity = 0.04 + ratio * 0.30;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 61,
          pointerEvents: 'none',
          background: (() => {
            // Shift from orange (low) → deep crimson red (max)
            const midR = Math.round(180 - ratio * 60);   // 180 → 120
            const midG = Math.round(60 - ratio * 50);    // 60 → 10
            const outerR = Math.round(120 - ratio * 40); // 120 → 80
            const outerG = Math.round(20 - ratio * 15);  // 20 → 5
            return `radial-gradient(ellipse at center, transparent 40%, rgba(${midR}, ${midG}, 0, ${vignetteOpacity}) 75%, rgba(${outerR}, ${outerG}, 0, ${vignetteOpacity * 1.3}) 100%)`;
          })(),
          mixBlendMode: 'screen',
        }}
      />
      <BurnoutEmberParticles ratio={ratio} />
      {ratio > 0 && ratio < 0.375 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 62,
            backgroundImage: `url(${burnoutDragonBg18})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
          }}
        />
      )}
      {ratio >= 0.375 && ratio < 0.625 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 62,
            backgroundImage: `url(${burnoutDragonBg38})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.25,
          }}
        />
      )}
      {ratio >= 0.625 && ratio < 0.75 && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 62,
              backgroundImage: `url(${burnoutDragonBg58})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.3,
            }}
          />
          {/* 6/8 heartbeat fade + light wobble — 6s cycle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 65,
              background: 'radial-gradient(circle at center, transparent 0%, transparent 50%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.6) 100%)',
              animation: 'consciousness-fade 6s linear infinite, heartbeat-wobble-light 6s linear infinite',
            }}
          />
        </>
      )}
      {ratio >= 0.75 && ratio < 0.875 && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 62,
              backgroundImage: `url(${burnoutDragonBg58})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.35,
            }}
          />
          {/* 7/8 heartbeat pulse + medium wobble — 4.5s cycle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 65,
              background: 'radial-gradient(circle at center, transparent 0%, transparent 35%, rgba(0,0,0,0.5) 58%, rgba(0,0,0,0.75) 100%)',
              animation: 'consciousness-tunnel 4.5s linear infinite, heartbeat-wobble-medium 4.5s linear infinite',
            }}
          />
        </>
      )}
      {ratio >= 0.875 && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 62,
              backgroundImage: `url(${burnoutDragonBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.4,
            }}
          />
          {/* 8/8 heartbeat pulse + heavy wobble — 3s cycle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 65,
              background: 'radial-gradient(circle at center, transparent 0%, transparent 22%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.85) 100%)',
              animation: 'consciousness-tunnel-heavy 3s linear infinite, heartbeat-wobble-heavy 3s linear infinite',
            }}
          />
        </>
      )}
    </>
  );
};

export default BurnoutFlameOverlay;
