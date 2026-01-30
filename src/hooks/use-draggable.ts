import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  storageKey?: string;
  initialPosition?: Position;
  bounds?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { storageKey, initialPosition = { x: 0, y: 50 }, bounds } = options;
  
  const [position, setPosition] = useState<Position>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return initialPosition;
        }
      }
    }
    return initialPosition;
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  // Clamp position within bounds
  const clampPosition = useCallback((pos: Position): Position => {
    let { x, y } = pos;
    
    if (bounds) {
      if (bounds.minX !== undefined) x = Math.max(bounds.minX, x);
      if (bounds.maxX !== undefined) x = Math.min(bounds.maxX, x);
      if (bounds.minY !== undefined) y = Math.max(bounds.minY, y);
      if (bounds.maxY !== undefined) y = Math.min(bounds.maxY, y);
    }
    
    // Ensure within viewport
    if (typeof window !== 'undefined') {
      x = Math.max(0, Math.min(window.innerWidth - 60, x));
      y = Math.max(40, Math.min(window.innerHeight - 100, y));
    }
    
    return { x, y };
  }, [bounds]);

  // Save position to localStorage
  useEffect(() => {
    if (storageKey && !isDragging) {
      localStorage.setItem(storageKey, JSON.stringify(position));
    }
  }, [position, storageKey, isDragging]);

  // Mouse/Touch handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const newPos = clampPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    });
    
    setPosition(newPos);
  }, [isDragging, clampPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Event listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleDragStart]);

  const resetPosition = useCallback(() => {
    setPosition(initialPosition);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [initialPosition, storageKey]);

  return {
    position,
    isDragging,
    dragRef,
    dragHandlers: {
      onMouseDown,
      onTouchStart,
    },
    resetPosition,
  };
}
