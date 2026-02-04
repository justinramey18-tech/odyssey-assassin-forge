import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, Swords, Trophy, FileSearch, ShoppingBag, Backpack, Search, BookOpen, MessageCircle } from 'lucide-react';
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
  onChronicleClick: () => void;
  onScribeClick: () => void;
  onOracleClick: () => void;
  achievements: Achievement[];
  hasChronicleUndo: boolean;
  hasNewShopItems: boolean;
}

// Compact card styling for 6-card grid
const cardBase = cn(
  "relative min-h-[90px] p-3 w-full",
  "flex flex-col items-center justify-center text-center gap-1.5",
  "rounded-lg border-2 bg-black/40 backdrop-blur-sm",
  "transition-all duration-300",
  "hover:bg-black/50"
);

export function PrimaryNavigationCards({
  onQuickMenusClick,
  onCombatClick,
  onContextualClick,
  onChronicleClick,
  onScribeClick,
  onOracleClick,
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
        label: 'Rewards',
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
        label: 'Review',
        description: 'Pending',
        icon: FileSearch,
        color: 'text-blue-400',
        borderColor: 'border-blue-500/40 hover:border-blue-400/60',
      };
    }
    
    // Priority 3: New shop items
    if (hasNewShopItems) {
      return {
        id: 'shop',
        label: 'Shop',
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
    hidden: { opacity: 0, y: 60 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { 
        delay: 1.0 + i * 0.08, 
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1] as const
      }
    })
  };

  // Corner accent component for cleaner JSX
  const CornerAccents = ({ colorClass }: { colorClass: string }) => (
    <>
      <div className={cn("absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2", colorClass)} />
      <div className={cn("absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2", colorClass)} />
      <div className={cn("absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2", colorClass)} />
      <div className={cn("absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2", colorClass)} />
    </>
  );

  return (
    <div className="grid grid-cols-3 gap-2 px-3">
      {/* Row 1: Quick Menus, Main HUD, Contextual */}
      
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
          "hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open quick-access menus"
      >
        <CornerAccents colorClass="border-cyan-500/60" />
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <PanelLeft className="w-5 h-5 text-cyan-400" />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Menus
        </h3>
        <p className="text-[9px] text-white/60">Drawers</p>
      </motion.button>

      {/* Card 2: Main HUD (Combat) */}
      <motion.button
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onCombatClick}
        className={cn(
          cardBase,
          "border-red-500/40 hover:border-red-400/60",
          "hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open combat HUD"
      >
        <CornerAccents colorClass="border-red-500/60" />
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <Swords className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Combat
        </h3>
        <p className="text-[9px] text-white/60">Main HUD</p>
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
          "hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label={`Navigate to ${contextualCard.label}`}
      >
        <CornerAccents colorClass={contextualCard.borderColor.split(' ')[0].replace('/40', '/60')} />
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          contextualCard.color.replace('text-', 'bg-').replace('400', '500/20')
        )}>
          <contextualCard.icon className={cn("w-5 h-5", contextualCard.color)} />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {contextualCard.label}
        </h3>
        <p className="text-[9px] text-white/60">{contextualCard.description}</p>
      </motion.button>

      {/* Row 2: Chronicle, Scribe, Oracle */}

      {/* Card 4: Chronicle */}
      <motion.button
        custom={3}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onChronicleClick}
        className={cn(
          cardBase,
          "border-blue-500/40 hover:border-blue-400/60",
          "hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open Chronicle sync"
      >
        <CornerAccents colorClass="border-blue-500/60" />
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Search className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Chronicle
        </h3>
        <p className="text-[9px] text-white/60">Sync</p>
      </motion.button>

      {/* Card 5: Scribe */}
      <motion.button
        custom={4}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onScribeClick}
        className={cn(
          cardBase,
          "border-amber-500/40 hover:border-amber-400/60",
          "hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open Narrative Scribe"
      >
        <CornerAccents colorClass="border-amber-500/60" />
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Scribe
        </h3>
        <p className="text-[9px] text-white/60">Narrative</p>
      </motion.button>

      {/* Card 6: Oracle */}
      <motion.button
        custom={5}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        onClick={onOracleClick}
        className={cn(
          cardBase,
          "border-purple-500/40 hover:border-purple-400/60",
          "hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]"
        )}
        style={{ touchAction: 'manipulation' }}
        aria-label="Open Oracle assistant"
      >
        <CornerAccents colorClass="border-purple-500/60" />
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="font-cinzel font-bold text-xs text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Oracle
        </h3>
        <p className="text-[9px] text-white/60">AI Chat</p>
      </motion.button>
    </div>
  );
}
