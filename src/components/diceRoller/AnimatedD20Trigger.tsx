import { cn } from '@/lib/utils';

interface AnimatedD20TriggerProps {
  onClick: () => void;
  className?: string;
}

export function AnimatedD20Trigger({ onClick, className }: AnimatedD20TriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-10 h-10 rounded-lg',
        'bg-gradient-to-br from-red-500/20 to-red-900/30',
        'border border-red-500/40 hover:border-red-400/60',
        'flex items-center justify-center',
        'transition-colors duration-200',
        'touch-manipulation',
        className,
      )}
      aria-label="Open Dice Roller"
    >
      {/* D20 SVG */}
      <svg
        viewBox="0 0 100 100"
        className="w-7 h-7"
      >
        {/* D20 shape - icosahedron face */}
        <defs>
          <linearGradient id="d20Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" />
          </linearGradient>
        </defs>
        
        {/* Main d20 body */}
        <polygon
          points="50,5 95,35 80,90 20,90 5,35"
          fill="url(#d20Gradient)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />
        
        {/* Inner details */}
        <polygon
          points="50,25 70,45 50,70 30,45"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1"
        />
        
        {/* 20 text */}
        <text
          x="50"
          y="55"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="22"
          fontWeight="bold"
          fontFamily="Cinzel, serif"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          20
        </text>
      </svg>
    </button>
  );
}
