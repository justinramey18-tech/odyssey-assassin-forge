import { cn } from '@/lib/utils';
import { ChevronDown, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CATEGORY_CONFIG,
  getSubTabsForCategory,
  type MainCategory,
} from '@/components/navigation/types';

interface CategoryQuickNavProps {
  onSubTabSelect: (category: MainCategory, subTabId: string) => void;
  isLegacyUnlocked?: boolean;
}

const CATEGORIES: MainCategory[] = ['fighting', 'inventory', 'utility'];

const CATEGORY_STYLES: Record<MainCategory, {
  border: string;
  hoverBorder: string;
  iconBg: string;
  iconText: string;
  dropdownBorder: string;
  activeBg: string;
  activeText: string;
}> = {
  fighting: {
    border: 'border-red-500/30',
    hoverBorder: 'hover:border-red-400/50',
    iconBg: 'bg-red-500/20',
    iconText: 'text-red-400',
    dropdownBorder: 'border-red-900/50',
    activeBg: 'bg-red-900/30',
    activeText: 'text-red-300',
  },
  inventory: {
    border: 'border-amber-500/30',
    hoverBorder: 'hover:border-amber-400/50',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    dropdownBorder: 'border-amber-900/50',
    activeBg: 'bg-amber-900/30',
    activeText: 'text-amber-300',
  },
  utility: {
    border: 'border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-400/50',
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-400',
    dropdownBorder: 'border-cyan-900/50',
    activeBg: 'bg-cyan-900/30',
    activeText: 'text-cyan-300',
  },
  home: {
    border: 'border-green-500/30',
    hoverBorder: 'hover:border-green-400/50',
    iconBg: 'bg-green-500/20',
    iconText: 'text-green-400',
    dropdownBorder: 'border-green-900/50',
    activeBg: 'bg-green-900/30',
    activeText: 'text-green-300',
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.9 + i * 0.08,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export function CategoryQuickNav({ onSubTabSelect, isLegacyUnlocked = false }: CategoryQuickNavProps) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3 mb-2">
      {CATEGORIES.map((category, i) => {
        const config = CATEGORY_CONFIG[category];
        const styles = CATEGORY_STYLES[category];
        const Icon = config.icon;
        const subTabs = getSubTabsForCategory(category);

        return (
          <DropdownMenu key={category}>
            <DropdownMenuTrigger asChild>
              <motion.button
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className={cn(
                  "relative min-h-[72px] p-3 w-full",
                  "flex flex-col items-center justify-center text-center gap-1",
                  "rounded-lg border bg-black/40 backdrop-blur-sm",
                  "transition-all duration-300 hover:bg-black/50",
                  styles.border,
                  styles.hoverBorder,
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", styles.iconBg)}>
                  <Icon className={cn("w-4 h-4", styles.iconText)} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-cinzel font-bold text-[10px] text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {config.label}
                  </span>
                  <ChevronDown className="w-3 h-3 text-white/50" />
                </div>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className={cn(
                "min-w-[160px] bg-background/95 backdrop-blur-md border z-[100]",
                styles.dropdownBorder,
              )}
            >
              {subTabs.map((tab) => {
                const TabIcon = tab.icon;
                const isLocked = tab.id === 'legacy' && !isLegacyUnlocked;

                return (
                  <DropdownMenuItem
                    key={tab.id}
                    onClick={() => !isLocked && onSubTabSelect(category, tab.id)}
                    disabled={isLocked}
                    className={cn(
                      "flex items-center gap-3 py-3 px-4 cursor-pointer",
                      "font-cinzel uppercase tracking-wider text-xs",
                      isLocked && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isLocked ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <TabIcon className={cn("w-4 h-4", tab.color)} />
                    )}
                    <span>{tab.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
