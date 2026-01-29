import { useState, useCallback, useRef, TouchEvent } from 'react';

interface SwipeConfig {
  threshold?: number; // Minimum distance for a swipe (default: 50px)
  velocityThreshold?: number; // Minimum velocity for a swipe (default: 0.3)
}

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  config: SwipeConfig = {}
) {
  const { threshold = 50, velocityThreshold = 0.3 } = config;
  const swipeState = useRef<SwipeState | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeState.current) return;
    
    const touch = e.touches[0];
    const diffX = touch.clientX - swipeState.current.startX;
    const diffY = touch.clientY - swipeState.current.startY;
    
    // Only track horizontal swipes (ignore if mostly vertical)
    if (Math.abs(diffY) > Math.abs(diffX) * 0.5) {
      return;
    }
    
    // Prevent default to stop scroll while swiping horizontally
    if (Math.abs(diffX) > 10) {
      e.preventDefault();
    }
    
    // Apply resistance at edges (dampen the offset)
    const dampened = diffX * 0.4;
    setSwipeOffset(dampened);
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!swipeState.current) {
      setSwiping(false);
      setSwipeOffset(0);
      return;
    }
    
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - swipeState.current.startX;
    const diffY = touch.clientY - swipeState.current.startY;
    const timeDiff = Date.now() - swipeState.current.startTime;
    const velocity = Math.abs(diffX) / timeDiff;
    
    // Check if it's a valid horizontal swipe
    if (Math.abs(diffY) < Math.abs(diffX) * 0.7) {
      const isValidSwipe = Math.abs(diffX) > threshold || velocity > velocityThreshold;
      
      if (isValidSwipe) {
        if (diffX < 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (diffX > 0 && onSwipeRight) {
          onSwipeRight();
        }
      }
    }
    
    swipeState.current = null;
    setSwiping(false);
    setSwipeOffset(0);
  }, [threshold, velocityThreshold, onSwipeLeft, onSwipeRight]);

  const handleTouchCancel = useCallback(() => {
    swipeState.current = null;
    setSwiping(false);
    setSwipeOffset(0);
  }, []);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    swiping,
    swipeOffset,
  };
}
