import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface BackgroundWrapperProps {
  imagePath: string;
  overlayOpacity?: number;
  tintColor?: 'red' | 'amber' | 'purple' | 'cyan' | 'green';
  tintOpacity?: number;
  fixed?: boolean;
  backgroundSize?: 'cover' | 'contain';
  backgroundPosition?: string;
  fallbackGradient?: string;
  enablePerformanceHints?: boolean;
  respectReducedMotion?: boolean;
  onLoad?: () => void;
  children: ReactNode;
  className?: string;
}

const tintColorMap = {
  red: 'from-red-900 via-transparent to-red-900',
  amber: 'from-amber-900 via-transparent to-amber-900',
  purple: 'from-purple-900 via-transparent to-purple-900',
  cyan: 'from-cyan-900 via-transparent to-cyan-900',
  green: 'from-green-900 via-transparent to-green-900',
};

const DEFAULT_FALLBACK_GRADIENT = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)';

export function BackgroundWrapper({
  imagePath,
  overlayOpacity = 60,
  tintColor,
  tintOpacity = 20,
  fixed = true,
  backgroundSize = 'cover',
  backgroundPosition = 'center center',
  fallbackGradient = DEFAULT_FALLBACK_GRADIENT,
  enablePerformanceHints = true,
  respectReducedMotion = true,
  onLoad,
  children,
  className,
}: BackgroundWrapperProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect reduced motion preference
  useEffect(() => {
    if (respectReducedMotion) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [respectReducedMotion]);

  // Detect touch device for performance optimization
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Preload image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      onLoad?.();
    };
    img.onerror = () => {
      setImageError(true);
    };
    img.src = imagePath;
  }, [imagePath, onLoad]);

  // Calculate gradient stops based on overlay opacity (0-100)
  const topOpacity = Math.round(overlayOpacity * 0.9) / 100;
  const midOpacity = Math.round(overlayOpacity * 0.6) / 100;
  const bottomOpacity = Math.round(overlayOpacity * 0.95) / 100;
  
  const tintOpacityValue = tintOpacity / 100;

  // Disable fixed positioning on touch devices for 60fps scrolling
  // Also disable if user prefers reduced motion
  const useFixed = fixed && !isTouchDevice && !prefersReducedMotion;

  return (
    <div className={cn('relative min-h-screen w-full overflow-hidden', className)}>
      {/* Background Image Layer */}
      <div 
        className={cn(
          'absolute inset-0 bg-center bg-no-repeat z-0 transition-opacity duration-300',
          useFixed && 'bg-fixed',
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        style={{ 
          backgroundImage: `url(${imagePath})`,
          backgroundSize: backgroundSize,
          backgroundPosition: backgroundPosition,
          ...(enablePerformanceHints && {
            willChange: 'transform',
            contain: 'layout style paint',
          }),
        }}
        aria-hidden="true"
      />
      
      {/* Fallback Gradient (shown while loading or on error) */}
      <div 
        className={cn(
          'absolute inset-0 z-0 transition-opacity duration-300',
          imageLoaded && !imageError ? 'opacity-0' : 'opacity-100'
        )}
        style={{ 
          background: fallbackGradient,
        }}
        aria-hidden="true"
      />
      
      {/* Dark Gradient Overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, 
            rgba(0, 0, 0, ${topOpacity}), 
            rgba(0, 0, 0, ${midOpacity}), 
            rgba(0, 0, 0, ${bottomOpacity}))`
        }}
        aria-hidden="true"
      />
      
      {/* Optional Colored Tint Layer */}
      {tintColor && (
        <div 
          className={cn(
            'absolute inset-0 z-0 bg-gradient-to-r',
            tintColorMap[tintColor]
          )}
          style={{ opacity: tintOpacityValue }}
          aria-hidden="true"
        />
      )}
      
      {/* Content Layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
