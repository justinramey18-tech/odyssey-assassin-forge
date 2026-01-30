import { useState, useCallback, useRef, TouchEvent } from 'react';

type PanDirection = 'left' | 'right' | 'up' | 'down';

interface PanConfig {
  threshold?: number; // Minimum distance for a pan (default: 50px)
  velocityThreshold?: number; // Minimum velocity for a pan (default: 0.3)
}

interface PanState {
  startX: number;
  startY: number;
  startTime: number;
}

interface PanHandlers {
  onPanLeft?: () => void;
  onPanRight?: () => void;
  onPanUp?: () => void;
  onPanDown?: () => void;
}

export function usePan(
  handlers: PanHandlers,
  config: PanConfig = {}
) {
  const { threshold = 50, velocityThreshold = 0.3 } = config;
  const panState = useRef<PanState | null>(null);
  const [panning, setPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panDirection, setPanDirection] = useState<PanDirection | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    panState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
    setPanning(true);
    setPanDirection(null);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!panState.current) return;
    
    const touch = e.touches[0];
    const diffX = touch.clientX - panState.current.startX;
    const diffY = touch.clientY - panState.current.startY;
    
    // Determine dominant direction
    const isHorizontal = Math.abs(diffX) > Math.abs(diffY);
    
    // Determine current pan direction for visual feedback
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      if (isHorizontal) {
        setPanDirection(diffX > 0 ? 'right' : 'left');
      } else {
        setPanDirection(diffY > 0 ? 'down' : 'up');
      }
    }
    
    // Apply resistance (dampen the offset)
    const dampened = {
      x: diffX * 0.4,
      y: diffY * 0.4,
    };
    setPanOffset(dampened);
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!panState.current) {
      setPanning(false);
      setPanOffset({ x: 0, y: 0 });
      setPanDirection(null);
      return;
    }
    
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - panState.current.startX;
    const diffY = touch.clientY - panState.current.startY;
    const timeDiff = Date.now() - panState.current.startTime;
    
    const velocityX = Math.abs(diffX) / timeDiff;
    const velocityY = Math.abs(diffY) / timeDiff;
    
    // Determine if horizontal or vertical pan
    const isHorizontal = Math.abs(diffX) > Math.abs(diffY);
    
    if (isHorizontal) {
      const isValidPan = Math.abs(diffX) > threshold || velocityX > velocityThreshold;
      
      if (isValidPan) {
        if (diffX < 0 && handlers.onPanLeft) {
          handlers.onPanLeft();
          if (navigator.vibrate) navigator.vibrate(10);
        } else if (diffX > 0 && handlers.onPanRight) {
          handlers.onPanRight();
          if (navigator.vibrate) navigator.vibrate(10);
        }
      }
    } else {
      const isValidPan = Math.abs(diffY) > threshold || velocityY > velocityThreshold;
      
      if (isValidPan) {
        if (diffY < 0 && handlers.onPanUp) {
          handlers.onPanUp();
          if (navigator.vibrate) navigator.vibrate(10);
        } else if (diffY > 0 && handlers.onPanDown) {
          handlers.onPanDown();
          if (navigator.vibrate) navigator.vibrate(10);
        }
      }
    }
    
    panState.current = null;
    setPanning(false);
    setPanOffset({ x: 0, y: 0 });
    setPanDirection(null);
  }, [threshold, velocityThreshold, handlers]);

  const handleTouchCancel = useCallback(() => {
    panState.current = null;
    setPanning(false);
    setPanOffset({ x: 0, y: 0 });
    setPanDirection(null);
  }, []);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    panning,
    panOffset,
    panDirection,
  };
}
