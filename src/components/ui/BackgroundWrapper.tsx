import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BackgroundWrapperProps {
  imagePath: string;
  overlayOpacity?: number;
  tintColor?: 'red' | 'amber' | 'purple' | 'cyan' | 'green';
  tintOpacity?: number;
  fixed?: boolean;
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

export function BackgroundWrapper({
  imagePath,
  overlayOpacity = 60,
  tintColor,
  tintOpacity = 20,
  fixed = true,
  children,
  className,
}: BackgroundWrapperProps) {
  // Calculate gradient stops based on overlay opacity (0-100)
  const topOpacity = Math.round(overlayOpacity * 0.9) / 100;
  const midOpacity = Math.round(overlayOpacity * 0.6) / 100;
  const bottomOpacity = Math.round(overlayOpacity * 0.95) / 100;
  
  const tintOpacityValue = tintOpacity / 100;

  return (
    <div className={cn('relative min-h-screen w-full overflow-hidden', className)}>
      {/* Background Image Layer */}
      <div 
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat z-0',
          fixed && 'bg-fixed'
        )}
        style={{ backgroundImage: `url(${imagePath})` }}
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
      />
      
      {/* Optional Colored Tint Layer */}
      {tintColor && (
        <div 
          className={cn(
            'absolute inset-0 z-0 bg-gradient-to-r',
            tintColorMap[tintColor]
          )}
          style={{ opacity: tintOpacityValue }}
        />
      )}
      
      {/* Content Layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
