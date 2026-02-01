import { cn } from '@/lib/utils';
import { MainCategory, CATEGORY_CONFIG } from './types';

interface AssassinHeaderProps {
  onHomeClick: () => void;
  activeCategory: MainCategory;
  onCategoryChange: (category: MainCategory) => void;
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

export function AssassinHeader({ 
  onHomeClick,
  activeCategory,
  onCategoryChange,
}: AssassinHeaderProps) {
  const categories: { value: MainCategory; config: typeof CATEGORY_CONFIG['home'] }[] = [
    { value: 'home', config: CATEGORY_CONFIG.home },
    { value: 'fighting', config: CATEGORY_CONFIG.fighting },
    { value: 'inventory', config: CATEGORY_CONFIG.inventory },
    { value: 'utility', config: CATEGORY_CONFIG.utility },
  ];

  const handleTabClick = (value: MainCategory) => {
    triggerHaptic('light');
    if (value === 'home') {
      onHomeClick();
    } else {
      onCategoryChange(value);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full h-[10vh] min-h-[70px] max-h-[100px] bg-gradient-to-b from-black via-background/98 to-background/90 backdrop-blur-md">
      {/* Assassin's Creed Top Border Art */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
      <div className="absolute top-[3px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      
      {/* Angular corner decorations - Assassin's Creed style */}
      <div className="absolute top-0 left-0 w-8 h-8">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-transparent" />
        <div className="absolute top-0 left-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] left-[8px] w-4 h-4 border-t-2 border-l-2 border-red-400/60 rotate-0" />
      </div>
      <div className="absolute top-0 right-0 w-8 h-8">
        <div className="absolute top-0 right-0 w-full h-[3px] bg-gradient-to-l from-red-500 to-transparent" />
        <div className="absolute top-0 right-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] right-[8px] w-4 h-4 border-t-2 border-r-2 border-red-400/60" />
      </div>
      
      {/* Bottom decorative border with angular accent */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-red-900/80 to-transparent" />
        {/* Center diamond accent */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-3 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500/40 rotate-45 border border-red-400/60" />
        </div>
      </div>
      
      {/* Main navigation content - 4 Main Tabs */}
      <div className="h-full w-full flex items-center justify-center px-4">
        <div className="h-full flex bg-transparent p-0 rounded-none gap-2">
          {categories.map(({ value, config }) => {
            const Icon = config.icon;
            const isActive = value === activeCategory;
            
            return (
              <button
                key={value}
                onClick={() => handleTabClick(value)}
                className={cn(
                  "group h-full flex flex-col items-center justify-center gap-1",
                  "px-6 min-w-[80px] rounded-none",
                  "border-x border-red-900/20",
                  "font-cinzel uppercase tracking-wider text-[10px]",
                  "transition-all hover:bg-opacity-20",
                  // Category-specific hover colors
                  value === 'home' && "hover:bg-green-900/20",
                  value === 'fighting' && "hover:bg-red-900/20",
                  value === 'inventory' && "hover:bg-amber-900/20",
                  value === 'utility' && "hover:bg-cyan-900/20",
                  // Active state styling
                  isActive && [
                    "bg-gradient-to-b to-transparent border-b-2",
                    value === 'home' && "from-green-600/30 border-b-green-500",
                    value === 'fighting' && "from-red-600/30 border-b-red-500",
                    value === 'inventory' && "from-amber-600/30 border-b-amber-500",
                    value === 'utility' && "from-cyan-600/30 border-b-cyan-500",
                  ],
                )}
              >
                <span className="relative">
                  <Icon 
                    className={cn(
                      "w-5 h-5 relative z-10 transition-transform",
                      "group-hover:scale-110",
                      // Active state icon color
                      isActive && value === 'home' && "text-green-400",
                      isActive && value === 'fighting' && "text-red-400",
                      isActive && value === 'inventory' && "text-amber-400",
                      isActive && value === 'utility' && "text-cyan-400",
                    )} 
                  />
                  {/* Glow effect */}
                  <span 
                    className={cn(
                      "absolute inset-0 blur-md rounded-full transition-opacity",
                      isActive ? "opacity-70 animate-glow-pulse" : "opacity-0",
                      value === 'home' && "bg-green-400",
                      value === 'fighting' && "bg-red-400",
                      value === 'inventory' && "bg-amber-400",
                      value === 'utility' && "bg-cyan-400",
                    )}
                  />
                </span>
                <span 
                  className={cn(
                    "whitespace-nowrap",
                    isActive && value === 'home' && "text-green-300",
                    isActive && value === 'fighting' && "text-red-300",
                    isActive && value === 'inventory' && "text-amber-300",
                    isActive && value === 'utility' && "text-cyan-300",
                  )}
                >
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Decorative side tribal marks */}
      <div className="absolute top-1/2 left-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 right-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
    </header>
  );
}
