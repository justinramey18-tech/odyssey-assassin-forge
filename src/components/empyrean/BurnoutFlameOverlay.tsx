import React, { useEffect, useRef } from 'react';
import flameBorderImg from '@/assets/flame-border-preview.jpg';

interface BurnoutFlameOverlayProps {
  level: number;
  max: number;
}

// Generate crackling noise using Web Audio API
function createCrackleLoop(ctx: AudioContext, volume: number): { gain: GainNode; stop: () => void } {
  const bufferSize = ctx.sampleRate * 2; // 2-second buffer
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Sparse random pops/crackles
  for (let i = 0; i < bufferSize; i++) {
    // Most samples are near-silent; occasional sharp pops
    data[i] = Math.random() < 0.003 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.02;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Bandpass filter to make it sound like fire crackle
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

// Haptic vibration pulse pattern based on intensity
function triggerHaptic(ratio: number) {
  if (!navigator.vibrate) return;
  if (ratio >= 0.9) {
    navigator.vibrate([30, 80, 30, 80, 50]);
  } else if (ratio >= 0.75) {
    navigator.vibrate([20, 150, 20]);
  } else {
    navigator.vibrate([15, 300, 15]);
  }
}

const BurnoutFlameOverlay: React.FC<BurnoutFlameOverlayProps> = ({ level, max }) => {
  const audioRef = useRef<{ gain: GainNode; stop: () => void; ctx: AudioContext } | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ratio = max > 0 ? Math.min(level / max, 1) : 0;
  const isCritical = ratio >= 0.5;

  // Audio crackling effect
  useEffect(() => {
    if (!isCritical) {
      // Clean up if burnout dropped below critical
      if (audioRef.current) {
        audioRef.current.stop();
        audioRef.current.ctx.close().catch(() => {});
        audioRef.current = null;
      }
      return;
    }

    // Volume scales: faint at 50%, louder toward max
    const volume = 0.03 + (ratio - 0.5) * 0.14; // 0.03 at 50%, ~0.1 at 100%

    if (!audioRef.current) {
      try {
        const ctx = new AudioContext();
        const loop = createCrackleLoop(ctx, volume);
        audioRef.current = { ...loop, ctx };
      } catch {}
    } else {
      // Update volume dynamically
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

  // Haptic vibration pulses
  useEffect(() => {
    if (!isCritical) {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      return;
    }

    // Pulse interval: slower at 50%, faster at max
    const interval = Math.max(4000 - (ratio - 0.5) * 6000, 1200);
    triggerHaptic(ratio);
    hapticIntervalRef.current = setInterval(() => triggerHaptic(ratio), interval);

    return () => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
    };
  }, [isCritical, ratio]);

  if (level <= 0 || max <= 0) return null;

  // Opacity: 0.2 at level 1, up to ~0.9 at max
  const opacity = 0.2 + ratio * 0.7;
  // Animation duration: 3s at low, ~1s at max
  const duration = `${Math.max(3 - ratio * 2, 0.8)}s`;
  // Flame height: 15px at low, ~55px at max
  const flameHeight = Math.round(15 + ratio * 40);

  const edgeStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      opacity,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 10,
    };

    if (side === 'top') {
      return { ...base, top: 0, left: 0, right: 0, height: `${flameHeight}px`, animationName: 'flame-flicker', animationDuration: duration, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' };
    }
    if (side === 'bottom') {
      return { ...base, bottom: 0, left: 0, right: 0, height: `${flameHeight}px`, transform: 'rotate(180deg)', animationName: 'flame-flicker', animationDuration: duration, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: `${parseFloat(duration) * 0.3}s` };
    }
    if (side === 'left') {
      return { ...base, top: 0, bottom: 0, left: 0, width: `${flameHeight}px`, animationName: 'flame-sway', animationDuration: duration, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: `${parseFloat(duration) * 0.15}s` };
    }
    return { ...base, top: 0, bottom: 0, right: 0, width: `${flameHeight}px`, animationName: 'flame-sway', animationDuration: duration, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: `${parseFloat(duration) * 0.5}s` };
  };

  const imgStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => ({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: side === 'top' ? 'center top' : side === 'bottom' ? 'center top' : side === 'left' ? 'left center' : 'right center',
    filter: `brightness(${1 + ratio * 0.5}) saturate(${1 + ratio * 0.8})`,
  });

  const sides = ['top', 'bottom', 'left', 'right'] as const;
  const vignetteOpacity = 0.08 + ratio * 0.35;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(180, 60, 0, ${vignetteOpacity}) 75%, rgba(120, 20, 0, ${vignetteOpacity * 1.3}) 100%)`,
          mixBlendMode: 'screen',
        }}
      />
      {sides.map((side) => (
        <div key={side} style={edgeStyle(side)}>
          <img src={flameBorderImg} alt="" style={imgStyle(side)} draggable={false} />
        </div>
      ))}
    </>
  );
};

export default BurnoutFlameOverlay;
