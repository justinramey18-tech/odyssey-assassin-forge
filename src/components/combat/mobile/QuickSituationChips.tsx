import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  Moon, 
  TrendingUp, 
  Users,
  ChevronDown,
} from 'lucide-react';

interface QuickSituationChipsProps {
  isHidden: boolean;
  hasAdvantage: boolean;
  nearAlly: boolean;
  onToggleHidden: () => void;
  onToggleAdvantage: () => void;
  onToggleNearAlly: () => void;
  onExpandSituationStrip: () => void;
  sneakAttackEligible?: boolean;
}

export function QuickSituationChips({
  isHidden,
  hasAdvantage,
  nearAlly,
  onToggleHidden,
  onToggleAdvantage,
  onToggleNearAlly,
  onExpandSituationStrip,
  sneakAttackEligible = false,
}: QuickSituationChipsProps) {
  return (
    <div className="bg-background/95 backdrop-blur-sm border-b border-red-900/20 px-3 py-2">
      <div className="flex items-center gap-2">
        {/* Hidden chip */}
        <SituationChip
          icon={<Moon className="w-3.5 h-3.5" />}
          label="Hidden"
          active={isHidden}
          onToggle={onToggleHidden}
          activeColor="purple"
        />

        {/* Advantage chip */}
        <SituationChip
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Adv"
          active={hasAdvantage}
          onToggle={onToggleAdvantage}
          activeColor="green"
        />

        {/* Near Ally chip */}
        <SituationChip
          icon={<Users className="w-3.5 h-3.5" />}
          label="Ally"
          active={nearAlly}
          onToggle={onToggleNearAlly}
          activeColor="blue"
        />

        {/* Sneak Attack indicator (read-only) */}
        {sneakAttackEligible && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="ml-auto px-2 py-1 bg-green-500/20 border border-green-500/40 rounded-full"
          >
            <span className="text-[10px] font-mono text-green-400 font-bold">
              SNEAK ✓
            </span>
          </motion.div>
        )}

        {/* Expand button */}
        <button
          onClick={onExpandSituationStrip}
          className="ml-auto p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand situation panel"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SituationChip({
  icon,
  label,
  active,
  onToggle,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
  activeColor: 'purple' | 'green' | 'blue' | 'amber';
}) {
  const colorClasses = {
    purple: {
      active: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
      inactive: 'bg-muted/10 border-muted/30 text-muted-foreground',
    },
    green: {
      active: 'bg-green-500/20 border-green-500/50 text-green-300',
      inactive: 'bg-muted/10 border-muted/30 text-muted-foreground',
    },
    blue: {
      active: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
      inactive: 'bg-muted/10 border-muted/30 text-muted-foreground',
    },
    amber: {
      active: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
      inactive: 'bg-muted/10 border-muted/30 text-muted-foreground',
    },
  };

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all",
        "active:scale-95 min-h-[36px]",
        active ? colorClasses[activeColor].active : colorClasses[activeColor].inactive
      )}
    >
      {icon}
      <span className="text-xs font-mono">{label}</span>
    </button>
  );
}
