import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, Swords, Trophy, FileSearch, ShoppingBag, Backpack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Achievement } from '@/lib/achievements';
import type { LucideIcon } from 'lucide-react';

interface ContextualCardConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
}

interface PrimaryNavigationCardsProps {
  onQuickMenusClick: () => void;
  onCombatClick: () => void;
  onContextualClick: (cardId: string) => void;
  achievements: Achievement[];
  hasChronicleUndo: boolean;
  hasNewShopItems: boolean;
}

// Card styling constants
const cardBase = cn(
  "relative min-h-[120px] p-4 w-full",
  "flex flex-col items-center justify-center text-center gap-2",
  "rounded-lg border-2 bg-black/40 backdrop-blur-sm",
  "transition-all duration-300",
  "hover:bg-black/50"
);

export function PrimaryNavigationCards({
  onQuickMenusClick,
  onCombatClick,
  onContextualClick,
  achievements,
  hasChronicleUndo,
  hasNewShopItems,
}: PrimaryNavigationCardsProps) {
  
  // Determine contextual card based on priority
  const contextualCard = useMemo<ContextualCardConfig>(() => {
    // Priority 1: Unclaimed achievements
    const unclaimedAchievements = achievements.filter(
      a => a.currentValue >= a.maxValue && !a.claimedMilestones?.includes(100)
    );
    if (unclaimedAchievements.length > 0) {
      return {
        id: 'feats',
        label: 'Claim Rewards',
        description: `${unclaimedAchievements.length} ready`,
        icon: Trophy,
        color: 'text-yellow-400',
        borderColor: 'border-yellow-500/40 hover:border-yellow-400/60',
      };
    }
    
    // Priority 2: Chronicle undo available
    if (hasChronicleUndo) {
      return {
        id: 'chronicle',
        label: 'Review Changes',
        description: 'Pending sync',
        icon: FileSearch,
        color: 'text-blue-400',
        borderColor: 'border-blue-500/40 hover:border-blue-400/60',
      };
    }
    
    // Priority 3: New shop items
    if (hasNewShopItems) {
      return {
        id: 'shop',
        label: 'Shop Updated',
        description: 'New items',
        icon: ShoppingBag,
        color: 'text-green-400',
        borderColor: 'border-green-500/40 hover:border-green-400/60',
      };
    }
    
    // Default: Gear
    return {
      id: 'gear',
      label: 'Gear',
      description: 'Equipment',
      icon: Backpack,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/40 hover:border-amber-400/60',
    };
  }, [achievements, hasChronicleUndo, hasNewShopItems]);

  const cardVariants = {
    hidden: { opacity: 0, y: 80 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { 
        delay: 1.0 + i * 0.1, 
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1] as const // smooth ease-out
      }
    })
  };

  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      {/* Card 1: Quick Menus */}
      <motion.button
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onQuickMenusClick}
        className={cn(
          cardBase,
          "border-cyan-500/40 hover:border-cyan-400/60",
          "hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open quick-access menus"
      >
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/60" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/60" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60" />
        
        <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <PanelLeft className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="font-cinzel font-bold text-sm text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Quick Menus
        </h3>
        <p className="text-[10px] text-white/60">Drawers</p>
      </motion.button>

      {/* Card 2: The Main HUD (Combat) */}
      <motion.button
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onCombatClick}
        className={cn(
          cardBase,
          "border-red-500/40 hover:border-red-400/60",
          "hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open combat HUD"
      >
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500/60" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500/60" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500/60" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500/60" />
        
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <Swords className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="font-cinzel font-bold text-sm text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Main HUD
        </h3>
        <p className="text-[10px] text-white/60">Combat</p>
      </motion.button>

      {/* Card 3: Contextual */}
      <motion.button
        custom={2}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={() => onContextualClick(contextualCard.id)}
        className={cn(
          cardBase,
          contextualCard.borderColor,
          "hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label={`Navigate to ${contextualCard.label}`}
      >
        {/* Corner Accents with dynamic color */}
        <div className={cn(
          "absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2",
          contextualCard.borderColor.replace('border-', 'border-').replace('/40', '/60').replace('hover:border-', '')
        )} />
        <div className={cn(
          "absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2",
          contextualCard.borderColor.replace('border-', 'border-').replace('/40', '/60').replace('hover:border-', '')
        )} />
        <div className={cn(
          "absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2",
          contextualCard.borderColor.replace('border-', 'border-').replace('/40', '/60').replace('hover:border-', '')
        )} />
        <div className={cn(
          "absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2",
          contextualCard.borderColor.replace('border-', 'border-').replace('/40', '/60').replace('hover:border-', '')
        )} />
        
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          contextualCard.color.replace('text-', 'bg-').replace('400', '500/20')
        )}>
          <contextualCard.icon className={cn("w-6 h-6", contextualCard.color)} />
        </div>
        <h3 className="font-cinzel font-bold text-sm text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {contextualCard.label}
        </h3>
        <p className="text-[10px] text-white/60">{contextualCard.description}</p>
      </motion.button>
    </div>
  );
}
