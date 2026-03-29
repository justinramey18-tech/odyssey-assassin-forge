import React, { useEffect, useRef } from 'react';
import flameBorderImg from '@/assets/flame-border-preview.jpg';
import BurnoutEmberParticles from './BurnoutEmberParticles';

interface BurnoutFlameOverlayProps {
  level: number;
  max: number;
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

const SIDE_CONFIGS = {
  top: { delay1: '0s', delay2: '0.4s', delay3: '0.8s' },
  bottom: { delay1: '0.2s', delay2: '0.6s', delay3: '1.1s' },
  left: { delay1: '0.1s', delay2: '0.5s', delay3: '0.9s' },
  right: { delay1: '0.3s', delay2: '0.7s', delay3: '1.2s' },
} as const;

const BurnoutFlameOverlay: React.FC<BurnoutFlameOverlayProps> = ({ level, max }) => {
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

    const volume = 0.03 + (ratio - 0.5) * 0.14;

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

  // Haptic vibration pulses
  useEffect(() => {
    if (!isCritical) {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      return;
    }

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

  const opacity = 0.45 + ratio * 0.55;
  const flickerDuration = Math.max(3 - ratio * 2, 0.8);
  const danceDuration = Math.max(4 - ratio * 2.5, 1.2);
  const flameHeight = Math.round(18 + ratio * 30);

  const isHorizontal = (side: string) => side === 'top' || side === 'bottom';

  const edgeStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      opacity,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 61,
    };

    if (side === 'top') {
      return { ...base, top: 0, left: 0, right: 0, height: `${flameHeight}px` };
    }
    if (side === 'bottom') {
      return { ...base, bottom: 0, left: 0, right: 0, height: `${flameHeight}px`, transform: 'rotate(180deg)' };
    }
    if (side === 'left') {
      return { ...base, top: 0, bottom: 0, left: 0, width: `${flameHeight}px` };
    }
    return { ...base, top: 0, bottom: 0, right: 0, width: `${flameHeight}px` };
  };

  const flameLayerStyle = (
    side: 'top' | 'bottom' | 'left' | 'right',
    layerIndex: number
  ): React.CSSProperties => {
    const horiz = isHorizontal(side);
    const delays = SIDE_CONFIGS[side];
    const delay = layerIndex === 0 ? delays.delay1 : layerIndex === 1 ? delays.delay2 : delays.delay3;
    const layerOpacity = layerIndex === 0 ? 1 : layerIndex === 1 ? 0.7 : 0.4;
    const danceAnim = horiz ? 'flame-dance' : 'flame-dance-vertical';
    const flickerAnim = horiz ? 'flame-flicker' : 'flame-sway';

    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url(${flameBorderImg})`,
      backgroundSize: 'cover',
      backgroundPosition: horiz ? 'center top' : (side === 'left' ? 'left center' : 'right center'),
      filter: `brightness(${1.3 + ratio * 0.7 + layerIndex * 0.2}) saturate(${1.2 + ratio * 1.2})`,
      opacity: layerOpacity,
      animation: `${danceAnim} ${danceDuration + layerIndex * 0.6}s linear infinite, ${flickerAnim} ${flickerDuration + layerIndex * 0.3}s ease-in-out infinite`,
      animationDelay: delay,
      mixBlendMode: layerIndex > 0 ? 'screen' : undefined,
    };
  };

  const sides = ['top', 'bottom', 'left', 'right'] as const;
  const vignetteOpacity = 0.08 + ratio * 0.35;
  const layerCount = ratio >= 0.75 ? 3 : ratio >= 0.4 ? 2 : 1;

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
      {sides.map((side) => (
        <div key={side} style={edgeStyle(side)}>
          {Array.from({ length: layerCount }).map((_, i) => (
            <div key={i} style={flameLayerStyle(side, i)} />
          ))}
        </div>
      ))}
      <BurnoutEmberParticles ratio={ratio} />
      {ratio >= 0.75 && ratio < 0.95 && (
        <div
          className="absolute inset-0 bg-black animate-[consciousness-fade_8s_ease-in-out_infinite] pointer-events-none"
          style={{ zIndex: 62, opacity: 0.25 }}
        />
      )}
      {ratio >= 0.95 && (
        <div
          className="absolute inset-0 bg-black animate-[consciousness-fade_10s_ease-in-out_infinite] pointer-events-none"
          style={{ zIndex: 62 }}
        />
      )}
    </>
  );
};

export default BurnoutFlameOverlay;
