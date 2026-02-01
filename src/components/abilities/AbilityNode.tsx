import { useMemo, useState, useEffect, useRef } from 'react';
import { Ability } from '@/lib/types';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { Shield } from 'lucide-react';

interface AbilityNodeProps {
  ability: Ability;
  currentTier: 0 | 1 | 2 | 3;
  isAccessible: boolean;  // AC Odyssey style: true if parent(s) unlocked or foundation
  isSelected: boolean;
  isMobile: boolean;
  onSelect: () => void;
}

// Haptic feedback helper
const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[type]);
  }
};

// Roman numeral conversion
const tierToRoman = (tier: number): string => {
  const numerals = ['', 'I', 'II', 'III'];
  return numerals[tier] || '';
};

export function AbilityNode({
  ability,
  currentTier,
  isAccessible,
  isSelected,
  isMobile,
  onSelect,
}: AbilityNodeProps) {
  const treeConfig = TREE_VISUAL_CONFIG[ability.tree];
  
  // Track unlock animation (0 → 1 transition)
  const [justUnlocked, setJustUnlocked] = useState(false);
  const prevTierRef = useRef(currentTier);
  
  useEffect(() => {
    if (prevTierRef.current === 0 && currentTier === 1) {
      setJustUnlocked(true);
      const timer = setTimeout(() => setJustUnlocked(false), 600);
      return () => clearTimeout(timer);
    }
    prevTierRef.current = currentTier;
  }, [currentTier]);
  
  // Get the icon component dynamically
  const IconComponent = useMemo(() => {
    if (ability.type === 'passive') {
      return Shield;
    }
    const iconName = ability.icon as keyof typeof LucideIcons;
    return (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || LucideIcons.Zap;
  }, [ability.icon, ability.type]);

  const handleClick = () => {
    if (isMobile) {
      if (!isAccessible && currentTier === 0) {
        triggerHaptic('light');
      } else if (currentTier === 0) {
        triggerHaptic('medium');
      } else {
        triggerHaptic('heavy');
      }
    }
    onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Determine visual state classes
  const stateClasses = useMemo(() => {
    // Unlock flash animation (takes priority)
    if (justUnlocked) {
      return cn(
        `border-${treeConfig.primary}`,
        'animate-ability-unlock-flash'
      );
    }
    
    // Not accessible and not unlocked - locked state
    if (!isAccessible && currentTier === 0) {
      return 'opacity-40 grayscale border-dashed border-muted-foreground/30';
    }
    
    // Accessible but not yet unlocked - pulsing ready state
    if (isAccessible && currentTier === 0) {
      return cn(
        `border-${treeConfig.primary}`,
        isMobile ? 'animate-ability-pulse-mobile' : 'animate-ability-pulse'
      );
    }
    
    // Tier 1 - unlocked, basic glow
    if (currentTier === 1) {
      return cn(
        `border-${treeConfig.primary}`,
        isMobile ? 'shadow-[0_0_10px]' : 'shadow-[0_0_15px]'
      );
    }
    
    // Tier 2 - enhanced glow
    if (currentTier === 2) {
      return cn(
        `border-${treeConfig.primary}`,
        isMobile 
          ? 'shadow-[0_0_15px]' 
          : 'shadow-[0_0_25px] shadow-current'
      );
    }
    
    // Tier 3 - maxed, golden glow
    if (currentTier === 3) {
      return cn(
        'border-yellow-400',
        isMobile 
          ? 'shadow-[0_0_20px_hsl(var(--tier-maxed))]'
          : 'shadow-[0_0_30px_hsl(var(--tier-maxed))] animate-tier-glow'
      );
    }
    
    return `border-${treeConfig.primary}/50`;
  }, [justUnlocked, isAccessible, currentTier, treeConfig.primary, isMobile]);

  // Node size based on device
  const sizeClasses = isMobile 
    ? 'w-16 h-16 min-w-[48px] min-h-[48px]' 
    : 'w-20 h-20';

  // Determine accessibility label
  const accessibilityLabel = useMemo(() => {
    if (!isAccessible && currentTier === 0) return 'Locked';
    if (isAccessible && currentTier === 0) return 'Available';
    return 'Unlocked';
  }, [isAccessible, currentTier]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${ability.name}, Tier ${currentTier} of 3, ${accessibilityLabel}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ touchAction: 'manipulation' }}
      className={cn(
        'relative rounded-full flex items-center justify-center cursor-pointer',
        'border-2 transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        sizeClasses,
        stateClasses,
        isSelected && 'ring-2 ring-white/50 scale-105',
        !(!isAccessible && currentTier === 0) && 'hover:scale-110',
        // Tree-specific text color for glow
        `text-${treeConfig.primary}`,
        // Focus ring color
        `focus-visible:ring-${treeConfig.primary}`
      )}
    >
      {/* Background glow for unlocked abilities */}
      {currentTier > 0 && (
        <div 
          className={cn(
            'absolute inset-0 rounded-full blur-md opacity-30',
            `bg-${treeConfig.primary}`,
            currentTier === 3 && 'bg-yellow-400 opacity-40'
          )}
        />
      )}

      {/* Icon */}
      <IconComponent 
        className={cn(
          'relative z-10 transition-colors',
          isMobile ? 'w-7 h-7' : 'w-9 h-9',
          (!isAccessible && currentTier === 0) && 'text-muted-foreground',
          currentTier > 0 && `text-${treeConfig.primary}`,
          currentTier === 3 && 'text-yellow-400'
        )}
      />

      {/* Tier badge - positioned inside at top-right */}
      {currentTier > 0 && (
        <div 
          className={cn(
            'absolute z-20 font-bold rounded-full',
            'bg-background/90 border',
            isMobile 
              ? 'top-0 right-0 text-[10px] px-1.5 py-0.5' 
              : 'top-1 right-1 text-xs px-2 py-0.5',
            currentTier === 3 
              ? 'border-yellow-400 text-yellow-400' 
              : `border-${treeConfig.primary} text-${treeConfig.primary}-foreground`
          )}
        >
          {tierToRoman(currentTier)}
        </div>
      )}

      {/* Passive indicator */}
      {ability.type === 'passive' && currentTier === 0 && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground uppercase tracking-wider">
          Passive
        </div>
      )}
    </div>
  );
}
