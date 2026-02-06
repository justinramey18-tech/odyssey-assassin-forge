import { cn } from '@/lib/utils';
import { Heart, Shield, Swords, Zap, Target } from 'lucide-react';
import './TacticalHUDStyles.css';

interface VitalsStripProps {
  currentHP: number;
  maxHP: number;
  tempHP?: number;
  ac: number;
  attackBonus: number;
  className?: string;
}

/**
 * Compact vitals display with HP bar, AC, and attack bonus.
 * Uses tactical HUD styling.
 */
export function VitalsStrip({
  currentHP,
  maxHP,
  tempHP = 0,
  ac,
  attackBonus,
  className,
}: VitalsStripProps) {
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  const tempPercent = Math.min(100 - hpPercent, (tempHP / maxHP) * 100);
  
  // Determine HP status
  const isDown = currentHP <= 0;
  const isCritical = hpPercent <= 25 && !isDown;
  const isWounded = hpPercent <= 50 && !isCritical && !isDown;
  
  const hpFillClass = isDown 
    ? 'vital-bar__fill--hp-critical' 
    : isCritical 
      ? 'vital-bar__fill--hp-critical'
      : isWounded 
        ? 'vital-bar__fill--hp-wounded'
        : 'vital-bar__fill--hp-healthy';
  
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2",
      "bg-gradient-to-r from-red-950/30 via-background/50 to-red-950/30",
      "border-b border-red-900/20",
      className
    )}>
      {/* HP Section */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Heart className={cn(
              "w-4 h-4",
              isDown ? "text-rose-500 animate-pulse" : isCritical ? "text-rose-400" : "text-emerald-400"
            )} />
            <span className="tactical-data">HP</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(
              "font-mono font-bold text-sm",
              isDown ? "text-rose-500" : isCritical ? "text-rose-400" : isWounded ? "text-amber-400" : "text-emerald-400"
            )}>
              {isDown ? 'DOWN' : currentHP}
            </span>
            {!isDown && (
              <>
                <span className="text-muted-foreground text-xs">/</span>
                <span className="text-muted-foreground text-xs font-mono">{maxHP}</span>
              </>
            )}
            {tempHP > 0 && (
              <span className="text-cyan-400 text-xs font-mono ml-1">+{tempHP}</span>
            )}
          </div>
        </div>
        
        {/* HP Bar */}
        <div className="vital-bar">
          <div 
            className={cn("vital-bar__fill", hpFillClass)}
            style={{ width: `${hpPercent}%` }}
          />
          {tempHP > 0 && (
            <div 
              className="vital-bar__temp"
              style={{ left: `${hpPercent}%`, width: `${tempPercent}%` }}
            />
          )}
        </div>
      </div>
      
      {/* Divider */}
      <div className="h-8 w-px bg-red-900/30" />
      
      {/* AC */}
      <div className="flex flex-col items-center gap-0.5">
        <Shield className="w-4 h-4 text-cyan-400" />
        <span className="font-mono font-bold text-sm text-cyan-400">{ac}</span>
        <span className="tactical-data text-[8px]">AC</span>
      </div>
      
      {/* Attack Bonus */}
      <div className="flex flex-col items-center gap-0.5">
        <Swords className="w-4 h-4 text-red-400" />
        <span className="font-mono font-bold text-sm text-red-400">+{attackBonus}</span>
        <span className="tactical-data text-[8px]">ATK</span>
      </div>
    </div>
  );
}
