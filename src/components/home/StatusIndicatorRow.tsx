import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Timer, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShopItem } from '@/lib/shop/types';

interface StatusIndicatorRowProps {
  // Conditions
  activeConditionCount: number;
  mostSevereCondition?: { name: string; severity: 'minor' | 'moderate' | 'severe' } | null;
  hasConcentration: boolean;
  concentrationSpellName?: string | null;
  
  // Cooldowns
  readyCooldownCount: number;
  coolingCooldownCount: number;
  
  // Shop items for expiration
  shopItems?: ShopItem[];
  
  // Actions
  onConditionsClick: () => void;
  onCooldownsClick: () => void;
  onShopClick: () => void;
}

// Get color based on condition severity
function getConditionColor(severity?: string, count: number = 0) {
  if (count === 0) return 'text-blue-400 border-blue-500/30';
  if (severity === 'severe') return 'text-rose-400 border-rose-500/30';
  if (severity === 'moderate') return 'text-amber-400 border-amber-500/30';
  return 'text-blue-400 border-blue-500/30';
}

// Get color for shop timer based on time remaining
function getShopTimerColor(seconds: number) {
  if (seconds < 60) return 'text-rose-400 border-rose-500/30';
  if (seconds < 180) return 'text-amber-400 border-amber-500/30';
  return 'text-cyan-400 border-cyan-500/30';
}

// Format countdown display
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StatusIndicatorRow({
  activeConditionCount,
  mostSevereCondition,
  hasConcentration,
  concentrationSpellName,
  readyCooldownCount,
  coolingCooldownCount,
  shopItems = [],
  onConditionsClick,
  onCooldownsClick,
  onShopClick,
}: StatusIndicatorRowProps) {
  // Find soonest expiring shop item within 5 minutes
  const soonestExpiringItem = useMemo(() => {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    return shopItems
      .filter(item => {
        const expiryTime = new Date(item.expiresAt).getTime();
        return expiryTime - now < FIVE_MINUTES && expiryTime > now;
      })
      .sort((a, b) => 
        new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
      )[0] || null;
  }, [shopItems]);

  // Real-time countdown for shop timer
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!soonestExpiringItem) {
      setTimeRemaining(0);
      return;
    }
    
    const updateTime = () => {
      const remaining = Math.max(0, 
        new Date(soonestExpiringItem.expiresAt).getTime() - Date.now()
      );
      setTimeRemaining(Math.floor(remaining / 1000));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [soonestExpiringItem]);

  const badgeVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: 0.35 + i * 0.05, duration: 0.3 }
    })
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35, duration: 0.3 }}
      className="flex justify-center gap-2 px-4 overflow-x-auto scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* Conditions Badge */}
      <motion.button
        custom={0}
        variants={badgeVariants}
        initial="hidden"
        animate="visible"
        onClick={onConditionsClick}
        className={cn(
          "status-badge transition-all hover:bg-white/10",
          getConditionColor(mostSevereCondition?.severity, activeConditionCount)
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label={`${activeConditionCount} active conditions. Tap to view.`}
      >
        <Activity className="w-4 h-4" />
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold">{activeConditionCount} Active</span>
          {mostSevereCondition && activeConditionCount > 0 && (
            <span className="text-[10px] opacity-70 truncate max-w-[80px]">
              {mostSevereCondition.name}
            </span>
          )}
        </div>
      </motion.button>

      {/* Cooldowns Badge */}
      <motion.button
        custom={1}
        variants={badgeVariants}
        initial="hidden"
        animate="visible"
        onClick={onCooldownsClick}
        className={cn(
          "status-badge transition-all hover:bg-white/10",
          readyCooldownCount > 0 
            ? "text-cyan-400 border-cyan-500/30" 
            : "text-white/50 border-white/20"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label={`${readyCooldownCount} abilities ready, ${coolingCooldownCount} cooling down. Tap to view.`}
      >
        <Timer className="w-4 h-4" />
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold">{readyCooldownCount} Ready</span>
          {coolingCooldownCount > 0 && (
            <span className="text-[10px] opacity-70">
              {coolingCooldownCount} cooling
            </span>
          )}
        </div>
      </motion.button>

      {/* Concentration Badge (Conditional) */}
      {hasConcentration && concentrationSpellName && (
        <motion.div
          custom={2}
          variants={badgeVariants}
          initial="hidden"
          animate="visible"
          className={cn(
            "status-badge text-amber-400 border-amber-500/30",
            "animate-concentration-pulse"
          )}
          aria-label={`Concentrating on ${concentrationSpellName}`}
        >
          <Eye className="w-4 h-4" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold">Concentrating</span>
            <span className="text-[10px] opacity-70 truncate max-w-[80px]">
              {concentrationSpellName}
            </span>
          </div>
        </motion.div>
      )}

      {/* Shop Timer Badge (Conditional) */}
      {soonestExpiringItem && timeRemaining > 0 && (
        <motion.button
          custom={3}
          variants={badgeVariants}
          initial="hidden"
          animate="visible"
          onClick={onShopClick}
          className={cn(
            "status-badge transition-all hover:bg-white/10",
            getShopTimerColor(timeRemaining),
            timeRemaining < 60 && "animate-urgent-pulse"
          )}
          style={{ touchAction: 'manipulation' }}
          aria-label={`Shop item expiring in ${formatCountdown(timeRemaining)}. Tap to view shop.`}
        >
          <Clock className="w-4 h-4" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold font-mono">
              {formatCountdown(timeRemaining)}
            </span>
            <span className="text-[10px] opacity-70 truncate max-w-[80px]">
              {soonestExpiringItem.name}
            </span>
          </div>
        </motion.button>
      )}
    </motion.div>
  );
}
