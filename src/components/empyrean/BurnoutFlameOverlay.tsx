import React from 'react';
import flameBorderImg from '@/assets/flame-border-preview.jpg';

interface BurnoutFlameOverlayProps {
  level: number;
  max: number;
}

const BurnoutFlameOverlay: React.FC<BurnoutFlameOverlayProps> = ({ level, max }) => {
  if (level <= 0 || max <= 0) return null;

  const ratio = Math.min(level / max, 1);
  // Opacity: 0.2 at level 1, up to ~0.9 at max
  const opacity = 0.2 + ratio * 0.7;
  // Animation duration: 3s at low, ~1s at max
  const duration = `${Math.max(3 - ratio * 2, 0.8)}s`;
  // Flame height: 15px at low, ~55px at max
  const flameHeight = Math.round(15 + ratio * 40);

  const edgeStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
    const isVertical = side === 'left' || side === 'right';
    const base: React.CSSProperties = {
      position: 'absolute',
      opacity,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 10,
    };

    if (side === 'top') {
      return {
        ...base,
        top: 0, left: 0, right: 0,
        height: `${flameHeight}px`,
        animationName: 'flame-flicker',
        animationDuration: duration,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      };
    }
    if (side === 'bottom') {
      return {
        ...base,
        bottom: 0, left: 0, right: 0,
        height: `${flameHeight}px`,
        transform: 'rotate(180deg)',
        animationName: 'flame-flicker',
        animationDuration: duration,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        animationDelay: `${parseFloat(duration) * 0.3}s`,
      };
    }
    if (side === 'left') {
      return {
        ...base,
        top: 0, bottom: 0, left: 0,
        width: `${flameHeight}px`,
        animationName: 'flame-sway',
        animationDuration: duration,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        animationDelay: `${parseFloat(duration) * 0.15}s`,
      };
    }
    // right
    return {
      ...base,
      top: 0, bottom: 0, right: 0,
      width: `${flameHeight}px`,
      animationName: 'flame-sway',
      animationDuration: duration,
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      animationDelay: `${parseFloat(duration) * 0.5}s`,
    };
  };

  const imgStyle = (side: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
    const isVertical = side === 'left' || side === 'right';
    return {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: side === 'top' ? 'center top' : side === 'bottom' ? 'center top' : side === 'left' ? 'left center' : 'right center',
      filter: `brightness(${1 + ratio * 0.5}) saturate(${1 + ratio * 0.8})`,
    };
  };

  const sides = ['top', 'bottom', 'left', 'right'] as const;

  return (
    <>
      {sides.map((side) => (
        <div key={side} style={edgeStyle(side)}>
          <img
            src={flameBorderImg}
            alt=""
            style={imgStyle(side)}
            draggable={false}
          />
        </div>
      ))}
    </>
  );
};

export default BurnoutFlameOverlay;
