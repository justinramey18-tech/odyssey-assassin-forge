import { motion } from 'framer-motion';
import { Heart, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicHealthBarProps {
  currentHP: number;
  maxHP: number;
  tempHP?: number;
  ac: number;
  initiative: number;
  onTap?: () => void;
}

export function DynamicHealthBar({
  currentHP,
  maxHP,
  tempHP = 0,
  ac,
  initiative,
  onTap,
}: DynamicHealthBarProps) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  
  // Determine health state
  const isHealthy = hpPercentage > 50;
  const isInjured = hpPercentage > 25 && hpPercentage <= 50;
  const isCritical = hpPercentage <= 25;
  
  // Get bar color based on health
  const getBarColor = () => {
    if (isCritical) return 'bg-gradient-to-r from-rose-600 to-rose-500';
    if (isInjured) return 'bg-gradient-to-r from-amber-600 to-amber-500';
    return 'bg-gradient-to-r from-emerald-600 to-emerald-500';
  };
  
  // Get glow color
  const getGlowColor = () => {
    if (isCritical) return 'shadow-rose-500/40';
    if (isInjured) return 'shadow-amber-500/40';
    return 'shadow-emerald-500/40';
  };
  
  // Get text color
  const getTextColor = () => {
    if (isCritical) return 'text-rose-400';
    if (isInjured) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4 space-y-3"
      style={{ transformOrigin: 'center' }}
    >
      {/* Health Bar Container */}
      <button
        onClick={onTap}
        className="w-full text-left"
        style={{ touchAction: 'manipulation' }}
        aria-label={`Health: ${currentHP} of ${maxHP} HP${tempHP > 0 ? `, plus ${tempHP} temporary HP` : ''}`}
      >
        {/* Main HP Bar */}
        <div 
          className={cn(
            "relative h-8 rounded-lg overflow-hidden",
            "bg-black/60 border border-white/20",
            "shadow-lg",
            getGlowColor(),
            isCritical && "animate-health-critical"
          )}
        >
          {/* HP Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hpPercentage}%` }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className={cn(
              "absolute inset-y-0 left-0",
              getBarColor(),
              isHealthy && "animate-health-pulse"
            )}
          />
          
          {/* Temp HP Overlay (cyan accent on top) */}
          {tempHP > 0 && (
            <div 
              className="absolute inset-y-0 right-0 bg-sky-500/30 border-l border-sky-400/50"
              style={{ 
                width: `${Math.min((tempHP / maxHP) * 100, 100 - hpPercentage)}%`,
                left: `${hpPercentage}%`
              }}
            />
          )}
          
          {/* Segmented Lines */}
          <div className="absolute inset-0 flex">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="flex-1 border-r border-white/10 last:border-r-0" 
              />
            ))}
          </div>
          
          {/* HP Text Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Heart className={cn("w-4 h-4", getTextColor())} />
              <span 
                className={cn(
                  "font-cinzel font-bold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
                  "text-white"
                )}
              >
                {currentHP}/{maxHP}
              </span>
              {tempHP > 0 && (
                <span className="text-sky-400 font-semibold text-sm">
                  (+{tempHP})
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      
      {/* Compact Stat Row */}
      <div className="flex justify-center gap-6">
        {/* AC Badge */}
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-black/40 border border-blue-500/30 backdrop-blur-sm"
          )}
        >
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="font-cinzel font-bold text-blue-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            AC: {ac}
          </span>
        </div>
        
        {/* Initiative Badge */}
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-black/40 border border-yellow-500/30 backdrop-blur-sm"
          )}
        >
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="font-cinzel font-bold text-yellow-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Init: {initiative >= 0 ? `+${initiative}` : initiative}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
